from flask import Flask, request, jsonify, Blueprint
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity,
    exceptions as jwt_exceptions
)
from jwt.exceptions import ExpiredSignatureError
import datetime
import io
import base64
import matplotlib.pyplot as plt

from db import (
    execute_query,
    is_write_query,
    cache_schema_for_user,
    get_cached_schema,
    save_message,
    get_chat_history,
    clear_chat_session,
)
from nlp_to_sql import (
    generate_sql_from_chat_history,
    maybe_generate_clarifier,
    rewrite_db_error,
    suggest_next_commands,
    detect_chartable,
    cache_ai_table
)

# -------------------- App + Extensions --------------------


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

bcrypt = Bcrypt(app)

app.config["JWT_SECRET_KEY"] = "super-secret-key"  # TODO: set via env var
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(hours=1)
jwt = JWTManager(app)

# --- JWT and General Error Handlers for Debugging ---
import traceback

@app.errorhandler(jwt_exceptions.NoAuthorizationError)
def handle_no_auth_error(e):
    print("[JWT ERROR] NoAuthorizationError:", str(e))
    print("[JWT ERROR] Authorization header:", request.headers.get("Authorization"))
    return jsonify({"error": "No valid JWT provided", "details": str(e)}), 422

@app.errorhandler(jwt_exceptions.JWTDecodeError)
def handle_jwt_decode_error(e):
    print("[JWT ERROR] JWTDecodeError:", str(e))
    print("[JWT ERROR] Authorization header:", request.headers.get("Authorization"))
    return jsonify({"error": "JWT decode error", "details": str(e)}), 422


@app.errorhandler(ExpiredSignatureError)
def handle_jwt_expired_error(e):
    print("[JWT ERROR] ExpiredSignatureError:", str(e))
    print("[JWT ERROR] Authorization header:", request.headers.get("Authorization"))
    return jsonify({"error": "JWT expired", "details": str(e)}), 422

@app.errorhandler(Exception)
def handle_general_error(e):
    print("[GENERAL ERROR]", str(e))
    print("[GENERAL ERROR] Authorization header:", request.headers.get("Authorization"))
    traceback.print_exc()
    return jsonify({"error": str(e)}), 500

# Create API Blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# -------------------- Auth Routes (in blueprint) --------------------

@api_bp.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    existing = execute_query("SELECT user_id FROM users WHERE email = %s", (email,))
    if existing and len(existing.get("rows", [])) > 0:
         return jsonify({"error": "Email already in use"}), 400

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    execute_query(
        "INSERT INTO users (email, hashed_pw, role) VALUES (%s, %s, %s)",
        (email, hashed_pw, "user")
    )

    return jsonify({"message": "Signup successful"}), 201

@api_bp.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        email = data.get('email')
        password = data.get('password')

        print(f"Login attempt for email: {email}")  # Debug log

        if not email or not password:
            print("Missing email or password")
            return jsonify({"error": "email and password required"}), 400

        user = execute_query(
            "SELECT user_id, hashed_pw, role FROM users WHERE email = %s", 
            (email,)
        )

        if not user or len(user) == 0:
            print(f"User not found: {email}")
            return jsonify({"error": "Invalid credentials"}), 401

        user_id = user[0]["user_id"]
        hashed_pw = user[0]["hashed_pw"]
        role = user[0]["role"]

        if not bcrypt.check_password_hash(hashed_pw, password):
            print(f"Password check failed for: {email}")
            return jsonify({"error": "Invalid credentials"}), 401

        # Use user_id as string for JWT identity
        access_token = create_access_token(identity=str(user_id))
        # Return user data with 'id' field for frontend consistency
        user_data = {
            "id": user_id,
            "user_id": user_id,
            "email": email,
            "role": role
        }
        print(f"Login successful for: {email}, token created")
        return jsonify({
            "access_token": access_token,
            "user": user_data
        }), 200
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@api_bp.route('/auth/protected', methods=['GET'])
@jwt_required()
def protected():
    try:
        current_user_id = get_jwt_identity()
        print(f"Protected route accessed by user_id: {current_user_id}")  # Debug log
        response_data = {
            "message": "Protected route accessed successfully",
            "user_id": current_user_id
        }
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Protected route error: {str(e)}")
        return jsonify({"error": "Failed to access protected route"}), 500

@api_bp.route('/auth/debug-token', methods=['GET'])
@jwt_required()
def debug_token():
    try:
        current_user = get_jwt_identity()
        return jsonify({
            "message": "Token debug info",
            "token_payload": current_user,
            "token_type": type(current_user).__name__
        }), 200
    except Exception as e:
        return jsonify({"error": f"Debug error: {str(e)}"}), 500

# Register the blueprint
app.register_blueprint(api_bp)

# -------------------- In-memory chat history (MVP) --------------------

chat_history = {}
last_results_cache = {}
pending_queries = {}

def remember(session_id: str, role: str, content: object, message_id: str | None = None) -> None:
    try:
        save_message(session_id, message_id, content, role)
    except Exception:
        chat_history.setdefault(session_id, []).append({"role": role, "content": content})

def normalize_history(raw_history):
    normalized = []
    for entry in (raw_history or []):
        if isinstance(entry, dict):
            role = entry.get('role') or entry.get('type') or 'assistant'
            content = entry.get('content') or entry.get('text') or entry.get('message') or ''
            message_id = entry.get('message_id') or entry.get('messageId') or entry.get('id')
            timestamp = entry.get('timestamp') or entry.get('time')
            normalized.append({
                'role': role,
                'content': content,
                'message_id': message_id,
                'timestamp': timestamp,
            })
        else:
            normalized.append({'role': 'assistant', 'content': str(entry), 'message_id': None, 'timestamp': None})
    return normalized

def get_history(session_id: str):
    try:
        raw = get_chat_history(session_id)
        return normalize_history(raw)
    except Exception:
        return normalize_history(chat_history.get(session_id, []))

def clear_history(session_id: str) -> None:
    try:
        clear_chat_session(session_id)
    except Exception:
        chat_history.pop(session_id, None)

def cache_user_schema(user_id, schema_name="public"):
    return cache_schema_for_user(user_id, schema_name)

# -------------------- Chat Routes --------------------

@app.route('/chat', methods=['POST', 'PUT'])
def chat_handler():
    data = request.get_json(silent=True) or {}

    user_id = data.get('email') or data.get('user_id')
    session_id = data.get('sessionId') or data.get('session_id') or 'default'

    message_id = data.get('messageId') or data.get('message_id') or data.get('id')
    content = data.get('content') or data.get('text') or data.get('message')
    role = (data.get('role') or data.get('type') or 'assistant')

    if content:
        try:
            save_message(session_id, message_id, content, role)
            return jsonify({"message": "saved", "history": get_history(session_id)}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if not user_id:
        return jsonify({"error": "email required"}), 400

    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    _ = get_history(session_id)

    return jsonify({
        "message": "Schema cached and ready",
        "schema_summary": schema,
        "history": get_history(session_id),
    }), 200

# -------------------- Ask (NL → SQL) --------------------

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json(silent=True) or {}
    user_input = data.get('message', '').strip()
    session_id = data.get('session_id') or data.get('sessionId') or 'default'
    user_id = data.get('email')

    if not user_input:
        return jsonify({"error": "Message is required."}), 400
    if not user_id:
        return jsonify({"error": "email required"}), 400

    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    remember(session_id, "user", user_input)
    history = get_history(session_id)
    clarifier = maybe_generate_clarifier(user_input, schema, history)
    if clarifier:
        remember(session_id, "assistant", clarifier)
        return jsonify({"clarifier": clarifier, "history": history}), 200

    sql_query = generate_sql_from_chat_history(history, schema)

    if is_write_query(sql_query):
        pending_queries[session_id] = {"sql": sql_query, "user_id": user_id}
        clarifier_msg = f"This query will modify data. Do you want me to run it?\n\n{sql_query}"
        remember(session_id, "assistant", clarifier_msg)
        return jsonify({"clarifier": clarifier_msg, "history": get_history(session_id)}), 200

    try:
        results_raw = execute_query(sql_query)
        if isinstance(results_raw, dict):
            cols = results_raw.get("columns", [])
            rows = results_raw.get("rows", [])
        else:
            cols = []
            rows = results_raw

        if cols and rows:
            last_results_cache[session_id] = {"columns": cols, "rows": rows}
            cache_ai_table(session_id, cols, rows)
            chartable, chart_type = detect_chartable(cols, rows)
            if chartable:
                chart_prompt = "Do you want me to generate a chart for the above table?"
                remember(session_id, "assistant", chart_prompt)

        remember(session_id, "assistant", f"Generated SQL:\n{sql_query}")
        result_payload = {"type": "results", "sql": sql_query, "columns": cols, "rows": rows}
        remember(session_id, "assistant", result_payload)

        return jsonify({
            "sql": sql_query,
            "results": rows,
            "columns": cols,
            "chartable": chartable if 'chartable' in locals() else False,
            "chart_type": chart_type if 'chart_type' in locals() else None,
            "history": get_history(session_id)
        }), 200
    except Exception as e:
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")
        suggestions = suggest_next_commands(schema, get_history(session_id))
        remember(session_id, "assistant", f"💡 You can try:\n{suggestions}")
        return jsonify({"error": friendly_error, "sql": sql_query, "suggestions": suggestions, "history": get_history(session_id)}), 500

# -------------------- Confirm & Cancel --------------------

@app.route('/confirm', methods=['POST'])
def confirm_query():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id') or data.get('sessionId') or 'default'
    decision = (data.get('decision') or '').lower()

    if session_id not in pending_queries:
        return jsonify({"error": "No pending query for this session"}), 400

    if decision not in ["yes", "no"]:
        return jsonify({"error": "Decision must be 'yes' or 'no'"}), 400

    if decision == "no":
        remember(session_id, "assistant", "Query cancelled.")
        pending_queries.pop(session_id, None)
        return jsonify({"message": "Query cancelled", "history": get_history(session_id)}), 200

    sql = pending_queries[session_id]["sql"]
    try:
        results_raw = execute_query(sql)
        if isinstance(results_raw, dict) and "rows" in results_raw:
            cols = results_raw.get("columns")
            rows = results_raw.get("rows")
        else:
            cols = None
            rows = results_raw

        remember(session_id, "assistant", f"✅ Query executed.")
        result_payload = {"type": "results", "sql": sql, "columns": cols, "rows": rows}
        remember(session_id, "assistant", result_payload)

        pending_queries.pop(session_id, None)
        return jsonify({"results": rows, "columns": cols, "history": get_history(session_id)}), 200
    except Exception as e:
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")
        return jsonify({"error": friendly_error, "history": get_history(session_id)}), 500

@app.route('/cancel', methods=['POST'])
def cancel_query():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id') or data.get('sessionId') or 'default'

    if session_id not in pending_queries:
        return jsonify({"error": "No pending query for this session"}), 400

    pending_queries.pop(session_id, None)
    remember(session_id, "assistant", "❌ Query cancelled.")
    return jsonify({"message": "Query cancelled", "history": get_history(session_id)}), 200

# -------------------- Chart --------------------

@app.route('/chart', methods=['POST'])
def generate_chart():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id') or data.get('sessionId') or 'default'
    chart_type = data.get('chartType') or data.get('chart_type')

    if session_id not in last_results_cache:
        return jsonify({"error": "No recent results found for this session"}), 400

    results = last_results_cache[session_id]
    cols, rows = results["columns"], results["rows"]

    chartable, detected_chart_type = detect_chartable(cols, rows)
    if not chartable:
        return jsonify({"error": "Data not suitable for charting"}), 400

    x_key = str(cols[0]).lower()
    y_key = str(cols[1]).lower()
    chart_config = {
        "type": chart_type or detected_chart_type,
        "x": x_key,
        "y": y_key,
        "data": [{x_key: r[0], y_key: r[1]} for r in rows[:50]]
    }

    try:
        fig, ax = plt.subplots()
        x_vals = [r[0] for r in rows[:50]]
        y_vals = [r[1] for r in rows[:50]]
        if chart_type == "bar" or detected_chart_type == "bar":
            ax.bar(x_vals, y_vals)
            ax.set_xlabel(cols[0])
            ax.set_ylabel(cols[1])
        elif chart_type == "line" or detected_chart_type == "line":
            ax.plot(x_vals, y_vals, marker='o')
            ax.set_xlabel(cols[0])
            ax.set_ylabel(cols[1])
        elif chart_type == "pie" or detected_chart_type == "pie":
            ax.pie(y_vals, labels=x_vals, autopct='%1.1f%%')
        else:
            plt.close(fig)
            return jsonify({"error": f"Chart type '{chart_type or detected_chart_type}' not supported for image rendering."}), 400

        chart_title = (chart_type or detected_chart_type or "").capitalize()
        ax.set_title(f"{chart_title} Chart")
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    except Exception as e:
        return jsonify({"error": f"Chart rendering failed: {str(e)}"}), 500

    return jsonify({
        "chart": chart_config,
        "chart_image_base64": img_base64
    }), 200

# -------------------- Chat Helpers --------------------

@app.route('/chat/<session_id>', methods=['GET'])
def get_chat(session_id):
    try:
        history = get_history(session_id)
        return jsonify({"history": history}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chat', methods=['PUT'])
def save_chat_message():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id') or data.get('sessionId') or 'default'
    message_id = data.get('message_id') or data.get('messageId')
    text = data.get('text') or data.get('content') or data.get('message')
    role = data.get('type') or data.get('role') or 'assistant'

    if not text:
        return jsonify({"error": "text (message) is required"}), 400

    try:
        save_message(session_id, message_id, text, role)
        return jsonify({"message": "saved", "history": get_history(session_id)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chat/clear', methods=['POST'])
def chat_clear():
    data = request.get_json(silent=True) or {}
    session_id = data.get('sessionId') or data.get('session_id') or 'default'
    clear_history(session_id)
    return jsonify({"message": f"history cleared for {session_id}"}), 200

# -------------------- Health --------------------

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Flask backend running"}), 200

# -------------------- Debug Routes --------------------

@app.route('/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            "endpoint": rule.endpoint,
            "methods": list(rule.methods),
            "rule": str(rule)
        })
    return jsonify({"routes": routes}), 200

@app.route('/debug/headers', methods=['GET', 'POST'])
def debug_headers():
    """Debug endpoint to see request headers"""
    return jsonify({
        "method": request.method,
        "headers": dict(request.headers),
        "args": dict(request.args),
        "json": request.get_json(silent=True),
        "form": dict(request.form) if request.form else None
    }), 200

if __name__ == '__main__':
    import os
    print("🚀 Starting Flask app...")
    print("📋 Registered routes:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.endpoint}: {list(rule.methods)} {rule}")
    
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)