from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compare', methods=['POST'])
def compare():
    data = request.get_json()
    lists = data.get('lists', {})
    sets = {name: set(items) for name, items in lists.items()}
    all_items = set.union(*sets.values()) if sets else set()
    everyone_needs = set.intersection(*sets.values()) if sets else set()
    unique_items = {name: items - set.union(*(sets[n] for n in sets if n != name)) for name, items in sets.items()}
    suggested_by_one = {item for item in all_items if sum(item in s for s in sets.values()) == 1}
    return jsonify({
        'everyone_needs': list(everyone_needs),
        'unique_items': {k: list(v) for k, v in unique_items.items()},
        'suggested_by_one': list(suggested_by_one)
    })

if __name__ == '__main__':
    app.run(debug=True)
