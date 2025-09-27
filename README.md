# Discrete Mathematics – Grocery List Set Operations App

Interactive web tool that demonstrates core set theory concepts (union, intersection, exclusivity, cardinality) through a real-world scenario: comparing multiple members' grocery lists.

## ✨ Key Features
* Add unlimited members with comma‑separated item lists
* Real-time live stats (union size, intersection size, exactly-one count, averages)
* Color‑coded “unique per member” visualization
* Plain‑language explanations for non‑math users
* Responsive, mobile-friendly UI with glassmorphism styling
* Clean JSON API (`POST /compare`) for integration or reuse
* Health endpoint (`GET /health`) for deployment monitoring

## 🧮 Set Operations Returned
| Operation | Meaning | Key |
|-----------|---------|-----|
| Union | All distinct items across every member | `union` |
| Intersection | Items every member listed | `intersection` |
| Unique Per Member | Items only that member listed | `unique_per_member` |
| Exactly One | Items appearing in exactly one member list | `exactly_one` |
| Cardinalities | Distinct item count per member | `cardinalities` |

## 📦 Tech Stack
* Python 3.11+ / Flask 3
* Gunicorn (production WSGI)
* Vanilla JS + HTML5 + CSS3
* No database required (pure in‑memory processing)

## 🚀 Quick Start (Local)
```bash
python -m venv .venv
./.venv/Scripts/activate  # Windows PowerShell
pip install -r requirements.txt
python app.py
```
Open: http://127.0.0.1:5000  (home)  or  http://127.0.0.1:5000/calculator

Environment variables (optional):
| Var | Default | Purpose |
|-----|---------|---------|
| `FLASK_DEBUG` | `1` | Enable auto-reload & debugger |
| `PORT` | `5000` | Server port override |
| `HOST` | `0.0.0.0` | Bind host |

## 🧪 API Example
Request:
```bash
curl -X POST http://127.0.0.1:5000/compare \
  -H "Content-Type: application/json" \
  -d '{"lists":{"Alice":["milk","eggs","bread"],"Bob":["eggs","cheese"]}}'
```
Response:
```json
{
  "union": ["bread", "cheese", "eggs", "milk"],
  "intersection": ["eggs"],
  "unique_per_member": {"Alice": ["bread", "milk"], "Bob": ["cheese"]},
  "exactly_one": ["bread", "cheese", "milk"],
  "cardinalities": {"Alice": 3, "Bob": 2}
}
```

## 🩺 Health Check
`GET /health` → `{ "status": "ok" }`

## 📁 Project Layout
```
app.py              # Flask app factory + endpoints
templates/          # Jinja2 HTML templates (home & calculator)
static/style.css    # Calculator styles
static/home.css     # Landing page styles
static/script.js    # Front-end logic
requirements.txt    # Pinned dependencies
Procfile            # Gunicorn process definition
README.md           # Documentation
```

## ☁️ Deploy to Render
1. Push this repo to GitHub.
2. In Render dashboard → New → Web Service.
3. Select repo.
4. Settings:
   * Runtime: Python 3.x
   * Build Command: `pip install -r requirements.txt`
   * Start Command: `gunicorn 'app:create_app()'`
   * Add (optional) env var: `FLASK_DEBUG=0`
5. Deploy. Health endpoint available at `/health`.

### Alternative: Heroku (if needed)
```bash
heroku create my-set-app
heroku buildpacks:set heroku/python
git push heroku master
heroku open
```

## 🔒 Production Notes
* This app is stateless; safe in multiple dynos/instances.
* Input is user-provided strings; no code execution; minimal security surface.
* For rate limiting or auth, wrap the `/compare` route / add proxy layer.

## 🧹 Maintenance / Extensibility
Ideas:
* Add export (CSV / JSON) of results
* Add symmetric difference operation explicitly
* Add dark/light theme toggle
* Persist last session via localStorage
* Add simple Venn diagram visualization

## 👥 Credits
Team: TANVI PATIL · NOORWAY FARAS · CHRISTIAN R MUTIWADIRWA · PANASHE KUNAKA (UI & Dev)

---
Made with ❤️ for Discrete Mathematics Project 1.
