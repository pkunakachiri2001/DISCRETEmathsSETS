from __future__ import annotations

from flask import Flask, jsonify, render_template, request
from typing import Dict, Iterable, List, Set
import os

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
