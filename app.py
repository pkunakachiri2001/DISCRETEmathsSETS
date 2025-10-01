from __future__ import annotations

from flask import Flask, jsonify, render_template, request, make_response, send_file
from typing import Dict, Iterable, List, Set, Optional
import os
import pandas as pd
from io import StringIO, BytesIO
from datetime import datetime
import json

###############################################################################
# App Factory (keeps future extensibility easy)
###############################################################################

def create_app() -> Flask:
    app = Flask(__name__)

    # ------------------------------ Views ---------------------------------- #
    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/calculator')
    def calculator():
        return render_template('index.html')

    @app.route('/health')
    def health():  # lightweight uptime probe
        return {'status': 'ok'}, 200

    # --------------------------- Helper Functions -------------------------- #
    def _clean_items(items: Iterable[str]) -> Set[str]:
        """Return a set of trimmed non-empty strings from raw iterable."""
        return {i.strip() for i in items if isinstance(i, str) and i.strip()}

    def _normalize(payload: Dict[str, List[str]]) -> Dict[str, Set[str]]:
        return {name: _clean_items(lst) for name, lst in payload.items() if _clean_items(lst)}

    # ------------------------------ API ------------------------------------ #
    @app.route('/compare', methods=['POST'])
    def compare():  # type: ignore
        data = request.get_json(silent=True) or {}
        raw_lists = data.get('lists', {}) or {}
        sets: Dict[str, Set[str]] = _normalize(raw_lists)

        if not sets:
            empty = {"union": [], "intersection": [], "unique_per_member": {}, "exactly_one": [], "cardinalities": {}}
            return jsonify(empty)

        # Core operations
        all_sets = list(sets.values())
        union_set = set().union(*all_sets)
        intersection_set = all_sets[0].copy() if len(all_sets) == 1 else set.intersection(*all_sets)

        # Unique per member: set difference against union of others
        unique_per_member = {m: s - set().union(*(sets[o] for o in sets if o != m)) for m, s in sets.items()}

        # Items appearing in exactly one member's set
        # (iterate once building frequency map)
        freq: Dict[str, int] = {}
        for s in all_sets:
            for item in s:
                freq[item] = freq.get(item, 0) + 1
        exactly_one = [item for item, c in freq.items() if c == 1]

        cardinalities = {m: len(s) for m, s in sets.items()}

        return jsonify({
            'union': sorted(union_set),
            'intersection': sorted(intersection_set),
            'unique_per_member': {k: sorted(v) for k, v in unique_per_member.items()},
            'exactly_one': sorted(exactly_one),
            'cardinalities': cardinalities,
        })

    @app.route('/import-csv', methods=['POST'])
    def import_csv():
        """Import member data from CSV/Excel file."""
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Read file based on extension
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                df = pd.read_csv(file)
            elif filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file)
            else:
                return jsonify({'error': 'Unsupported file format. Use CSV or Excel files.'}), 400
            
            # Validate required columns
            if 'member' not in df.columns or 'items' not in df.columns:
                return jsonify({'error': 'File must have "member" and "items" columns'}), 400
            
            # Process data
            members_data = []
            for _, row in df.iterrows():
                member_name = str(row['member']).strip()
                items_str = str(row['items']).strip()
                
                if member_name and items_str and items_str != 'nan':
                    # Handle comma-separated items
                    items = [item.strip() for item in items_str.split(',') if item.strip()]
                    if items:
                        members_data.append({
                            'name': member_name,
                            'items': items
                        })
            
            if not members_data:
                return jsonify({'error': 'No valid member data found in file'}), 400
            
            return jsonify({
                'success': True,
                'members': members_data,
                'count': len(members_data)
            })
            
        except Exception as e:
            return jsonify({'error': f'Failed to process file: {str(e)}'}), 500

    @app.route('/export-csv', methods=['POST'])
    def export_csv():
        """Export current members data and results to CSV."""
        try:
            data = request.get_json(silent=True) or {}
            members = data.get('members', [])
            results = data.get('results', {})
            format_type = data.get('format', 'csv').lower()
            
            if not members:
                return jsonify({'error': 'No member data to export'}), 400
            
            # Create members DataFrame
            members_df = pd.DataFrame([
                {'member': m['name'], 'items': ', '.join(m['items']), 'count': len(m['items'])}
                for m in members
            ])
            
            # Create results summary if available
            summary_data = []
            if results:
                summary_data.extend([
                    {'operation': 'Union', 'result': ', '.join(results.get('union', [])), 'count': len(results.get('union', []))},
                    {'operation': 'Intersection', 'result': ', '.join(results.get('intersection', [])), 'count': len(results.get('intersection', []))},
                    {'operation': 'Exactly One', 'result': ', '.join(results.get('exactly_one', [])), 'count': len(results.get('exactly_one', []))},
                ])
                
                # Add unique per member
                for member, items in results.get('unique_per_member', {}).items():
                    summary_data.append({
                        'operation': f'Unique to {member}', 
                        'result': ', '.join(items) if items else '—', 
                        'count': len(items)
                    })
            
            # Generate timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            if format_type == 'excel':
                # Create Excel with multiple sheets
                output = BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    members_df.to_excel(writer, sheet_name='Members Data', index=False)
                    if summary_data:
                        pd.DataFrame(summary_data).to_excel(writer, sheet_name='Results Summary', index=False)
                    
                    # Add metadata sheet
                    metadata_df = pd.DataFrame([
                        {'property': 'Export Date', 'value': datetime.now().strftime('%Y-%m-%d %H:%M:%S')},
                        {'property': 'Total Members', 'value': len(members)},
                        {'property': 'Total Unique Items', 'value': len(results.get('union', []))},
                        {'property': 'Common Items', 'value': len(results.get('intersection', []))},
                    ])
                    metadata_df.to_excel(writer, sheet_name='Export Info', index=False)
                
                output.seek(0)
                filename = f'discrete_math_analysis_{timestamp}.xlsx'
                
                response = make_response(output.read())
                response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                response.headers['Content-Disposition'] = f'attachment; filename={filename}'
                return response
            
            else:  # CSV format
                # Combine members and results in one CSV
                all_data = []
                
                # Add members section
                all_data.append(['=== MEMBERS DATA ===', '', ''])
                all_data.append(['Member', 'Items', 'Count'])
                for _, row in members_df.iterrows():
                    all_data.append([row['member'], row['items'], row['count']])
                
                # Add results section
                if summary_data:
                    all_data.append(['', '', ''])
                    all_data.append(['=== RESULTS SUMMARY ===', '', ''])
                    all_data.append(['Operation', 'Result', 'Count'])
                    for item in summary_data:
                        all_data.append([item['operation'], item['result'], item['count']])
                
                # Add metadata
                all_data.append(['', '', ''])
                all_data.append(['=== EXPORT INFO ===', '', ''])
                all_data.append(['Export Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'), ''])
                all_data.append(['Total Members', len(members), ''])
                all_data.append(['Generated by', 'Discrete Mathematics Set Calculator', ''])
                
                output = StringIO()
                df_export = pd.DataFrame(all_data)
                df_export.to_csv(output, index=False, header=False)
                output.seek(0)
                
                filename = f'discrete_math_analysis_{timestamp}.csv'
                
                response = make_response(output.getvalue())
                response.headers['Content-Type'] = 'text/csv'
                response.headers['Content-Disposition'] = f'attachment; filename={filename}'
                return response
                
        except Exception as e:
            return jsonify({'error': f'Export failed: {str(e)}'}), 500

    @app.route('/sample-template')
    def sample_template():
        """Generate a sample CSV template for import."""
        try:
            sample_data = [
                ['member', 'items'],
                ['Alice', 'milk, bread, eggs, butter'],
                ['Bob', 'bread, cheese, milk, yogurt'],
                ['Charlie', 'eggs, bread, apples, bananas'],
                ['Diana', 'milk, cheese, bread, pasta'],
            ]
            
            output = StringIO()
            df = pd.DataFrame(sample_data[1:], columns=sample_data[0])
            df.to_csv(output, index=False)
            output.seek(0)
            
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = 'attachment; filename=sample_import_template.csv'
            return response
            
        except Exception as e:
            return jsonify({'error': f'Template generation failed: {str(e)}'}), 500

    return app


###############################################################################
# Entrypoint
###############################################################################
def main():  # pragma: no cover - manual run helper
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    port = int(os.getenv('PORT', '5000'))
    host = os.getenv('HOST', '0.0.0.0')
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':  # pragma: no cover
    main()
