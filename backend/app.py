import traceback
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

from db import (
    execute_query,
    is_write_query,
    cache_schema_for_user,
    get_cached_schema,
    save_message,
    get_chat_history,
    clear_chat_history,
)
from nlp_to_sql import (
    generate_sql_from_chat_history,
    maybe_generate_clarifier,
    rewrite_db_error,
    suggest_next_commands,
    generate_sql_and_chart,
)

# -------------------- App + Extensions --------------------


app = Flask(__name__)
CORS(app, origins=["http://localhost:3000",
     "https://ai-db-one.vercel.app"], supports_credentials=True)
bcrypt = Bcrypt(app)

app.config["JWT_SECRET_KEY"] = "super-secret-key"  # TODO: set via env var
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(hours=1)
jwt = JWTManager(app)

# --- JWT and General Error Handlers for Debugging ---


@app.errorhandler(jwt_exceptions.NoAuthorizationError)
def handle_no_auth_error(e):
    print("[JWT ERROR] NoAuthorizationError:", str(e))
    print("[JWT ERROR] Authorization header:",
          request.headers.get("Authorization"))
    return jsonify({"error": "No valid JWT provided", "details": str(e)}), 422


@app.errorhandler(jwt_exceptions.JWTDecodeError)
def handle_jwt_decode_error(e):
    print("[JWT ERROR] JWTDecodeError:", str(e))
    print("[JWT ERROR] Authorization header:",
          request.headers.get("Authorization"))
    return jsonify({"error": "JWT decode error", "details": str(e)}), 422


@app.errorhandler(ExpiredSignatureError)
def handle_jwt_expired_error(e):
    print("[JWT ERROR] ExpiredSignatureError:", str(e))
    print("[JWT ERROR] Authorization header:",
          request.headers.get("Authorization"))
    return jsonify({"error": "JWT expired", "details": str(e)}), 422


@app.errorhandler(Exception)
def handle_general_error(e):
    print("[GENERAL ERROR]", str(e))
    print("[GENERAL ERROR] Authorization header:",
          request.headers.get("Authorization"))
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

    existing = execute_query(
        "SELECT user_id FROM private.users WHERE email = %s", (email,))
    if isinstance(existing, list) and len(existing) > 0:
        return jsonify({"error": "Email already in use"}), 400

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    execute_query(
        "INSERT INTO private.users (email, hashed_pw, role) VALUES (%s, %s, %s)",
        (email, hashed_pw, "user")
    )

    return jsonify({"message": "Signup successful"}), 201


@api_bp.route('/auth/login', methods=['POST'])
def login():
    # Parse JSON safely to avoid BadRequest exceptions on invalid/missing JSON
    data = request.get_json(silent=True) or {}
    email = str(data.get('email') or '').strip()
    password = str(data.get('password') or '')

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    try:
        print(f"Login attempt for email: {email}")

        result = execute_query(
            "SELECT user_id, hashed_pw, role FROM private.users WHERE email = %s",
            (email,)
        )

        # Normalize DB result to a single row object
        row = None
        if isinstance(result, list) and len(result) > 0:
            row = next(iter(result), None)
        elif isinstance(result, dict):
            rows = result.get("rows")
            if isinstance(rows, list) and rows:
                for _item in rows:
                    row = _item
                    break

        if not row:
            print(f"User not found: {email}")
            return jsonify({"error": "Invalid credentials"}), 401

        # Extract fields from either dict or tuple/list
        if isinstance(row, dict):
            user_id = row.get("user_id") or row.get("USER_ID") or row.get("id")
            hashed_pw = row.get("hashed_pw") or row.get(
                "HASHED_PW") or row.get("password")
            role = row.get("role") or row.get("ROLE") or "user"
        elif isinstance(row, (tuple, list)):
            try:
                user_id, hashed_pw, role = row[0], row[1], row[2]
            except Exception:
                print("Unexpected row length/structure for tuple result")
                return jsonify({"error": "Internal server error"}), 500
        else:
            print("Unexpected row type:", type(row))
            return jsonify({"error": "Internal server error"}), 500

        # Ensure hashed_pw is a string (decode if DB returned bytes/memoryview)
        if isinstance(hashed_pw, (bytes, bytearray, memoryview)):
            try:
                hashed_pw = bytes(hashed_pw).decode("utf-8", errors="ignore")
            except Exception:
                return jsonify({"error": "Internal server error"}), 500

        # Validate password using bcrypt
        if not hashed_pw:
            print(f"Missing hash for: {email}")
            return jsonify({"error": "Invalid credentials"}), 401
        try:
            if not bcrypt.check_password_hash(hashed_pw, password):
                print(f"Password check failed for: {email}")
                return jsonify({"error": "Invalid credentials"}), 401
        except Exception as _bcrypt_err:
            # Any unexpected hash format issues -> treat as invalid
            print(f"Bcrypt error for {email}: {_bcrypt_err}")
            return jsonify({"error": "Invalid credentials"}), 401

        # Create JWT with user_id as identity (string)
        access_token = create_access_token(identity=str(user_id))
        user_data = {
            "id": user_id,
            "user_id": user_id,
            "email": email,
            "role": role
        }

        print(f"✅ Login successful for: {email}")
        return jsonify({
            "access_token": access_token,
            "user": user_data
        }), 200

    except Exception as e:
        # Catch-all to ensure JSON error response instead of HTML 500
        print(f"❌ Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@api_bp.route('/auth/protected', methods=['GET'])
@jwt_required()
def protected():
    try:
        current_user_id = get_jwt_identity()
        # Debug log
        print(f"Protected route accessed by user_id: {current_user_id}")
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

pending_queries = {}


def remember(user_id: str, role: str, content: object, message_id: str | None = None) -> None:
    import uuid
    if not message_id:
        message_id = str(uuid.uuid4())
    # Always pass a non-null session_id (use user_id as fallback)
    save_message(user_id, message_id, content, role, session_id=user_id)


def normalize_history(raw_history):
    normalized = []
    for entry in (raw_history or []):
        if isinstance(entry, dict):
            role = entry.get('role') or entry.get('type') or 'assistant'
            content = entry.get('content') or entry.get(
                'text') or entry.get('message') or ''
            message_id = entry.get('message_id') or entry.get(
                'messageId') or entry.get('id')
            timestamp = entry.get('timestamp') or entry.get('time')
            normalized.append({
                'role': role,
                'content': content,
                'message_id': message_id,
                'timestamp': timestamp,
            })
        else:
            normalized.append({'role': 'assistant', 'content': str(
                entry), 'message_id': None, 'timestamp': None})
    return normalized


def get_history(user_id: str):
    raw = get_chat_history(user_id)
    return normalize_history(raw)


def clear_history(user_id: str) -> None:
    clear_chat_history(user_id)


def cache_user_schema(user_id, schema_name="public"):
    return cache_schema_for_user(user_id, schema_name)

# -------------------- Chat Routes --------------------

# -------------------- Schema Prefetch Endpoint --------------------


@app.route('/chat/schema', methods=['GET'])
@jwt_required()
def chat_schema():
    user_id = get_jwt_identity()
    try:
        schema = get_cached_schema(user_id)
        if not schema:
            schema = cache_user_schema(user_id)
        return jsonify({"schema_summary": schema}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/chat', methods=['POST', 'PUT'])
@jwt_required()
def chat_handler():
    data = request.get_json(silent=True) or {}

    user_id = get_jwt_identity()
    message_id = data.get('messageId') or data.get(
        'message_id') or data.get('id')
    content = data.get('content') or data.get('text') or data.get('message')
    role = (data.get('role') or data.get('type') or 'assistant')

    if content:
        try:
            remember(user_id, role, content, message_id)
            return jsonify({"message": "saved", "history": get_history(user_id)}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if not user_id:
        return jsonify({"error": "email required"}), 400

    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    return jsonify({
        "message": "Schema cached and ready",
        "schema_summary": schema,
        "history": get_history(user_id),
    }), 200

# -------------------- Ask (NL → SQL) --------------------


@app.route('/ask', methods=['POST'])
@jwt_required()
def ask():
    data = request.get_json(silent=True) or {}
    user_input = data.get('message', '').strip()

    user_id = get_jwt_identity()
    # Fetch user role from DB
    user_info = execute_query(
        "SELECT role FROM private.users WHERE user_id = %s", (user_id,))
    user_role = None
    if isinstance(user_info, list) and len(user_info) > 0 and isinstance(user_info[0], dict):
        user_role = user_info[0].get("role", None)

    if not user_input:
        return jsonify({"error": "Message is required."}), 400
    if not user_id:
        return jsonify({"error": "email required"}), 400

    schema = get_cached_schema(user_id)
    if not schema:
        return jsonify({"error": "Schema not cached. Please refresh or re-login to cache your schema before chatting."}), 400

    remember(user_id, "user", user_input)
    history = get_history(user_id)
    clarifier = maybe_generate_clarifier(user_input, schema, history)
    if clarifier:
        remember(user_id, "assistant", clarifier)
        return jsonify({"clarifier": clarifier, "history": history}), 200

    sql_query = generate_sql_from_chat_history(history, schema)

    # Restrict write queries to admin only
    if is_write_query(sql_query):
        if user_role != "admin":
            msg = "❌ Only admins are allowed to perform actions that modify the database (DELETE/UPDATE/INSERT). Please contact an administrator if you need this action."
            remember(user_id, "assistant", msg)
            return jsonify({"error": msg, "history": get_history(user_id)}), 403
        pending_queries[user_id] = {"sql": sql_query, "user_id": user_id}
        clarifier_msg = f"This query will modify data. Do you want me to run it?\n\n{sql_query}"
        remember(user_id, "assistant", clarifier_msg)
        return jsonify({"clarifier": clarifier_msg, "history": get_history(user_id)}), 200

    try:
        results_raw = execute_query(sql_query)
        if isinstance(results_raw, list):
            rows = results_raw
            cols = list(results_raw[0].keys()) if results_raw and isinstance(
                results_raw[0], dict) else []
        elif isinstance(results_raw, dict):
            cols = results_raw.get("columns", [])
            rows = results_raw.get("rows", [])
        else:
            cols = []
            rows = []

    # Chart generation is now handled by the /generate_chart endpoint.

        remember(user_id, "assistant", f"Generated SQL:\n{sql_query}")
        result_payload = {"type": "results",
                          "sql": sql_query, "columns": cols, "rows": rows}
        remember(user_id, "assistant", result_payload)

        return jsonify({
            "sql": sql_query,
            "results": rows,
            "columns": cols,
            "history": get_history(user_id)
        }), 200

        # return jsonify({
        #     "sql": sql_query,
        #     "results": rows,
        #     "columns": cols,
        #     # Chart info omitted in new flow; use /generate_chart for visuals
        #     "chartable": True,
        #     "chart_type": None,
        #     "history": get_history(user_id)
        # }), 200

    except Exception as e:
        friendly_error = rewrite_db_error(str(e), get_history(user_id))
        remember(user_id, "assistant", f"❌ {friendly_error}")
        suggestions = suggest_next_commands(schema, get_history(user_id))
        remember(user_id, "assistant", f"💡 You can try:\n{suggestions}")
        return jsonify({"error": friendly_error, "sql": sql_query, "suggestions": suggestions, "history": get_history(user_id)}), 500

# -------------------- Confirm & Cancel --------------------


@app.route('/confirm', methods=['POST'])
@jwt_required()
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
        if isinstance(results_raw, list):
            rows = results_raw
            cols = list(results_raw[0].keys()) if results_raw and isinstance(
                results_raw[0], dict) else []
        elif isinstance(results_raw, dict):
            cols = results_raw.get("columns", [])
            rows = results_raw.get("rows", [])
        else:
            cols = []
            rows = []

        remember(session_id, "assistant", f"✅ Query executed.")
        result_payload = {"type": "results",
                          "sql": sql, "columns": cols, "rows": rows}
        remember(session_id, "assistant", result_payload)

        pending_queries.pop(session_id, None)
        return jsonify({"results": rows, "columns": cols, "history": get_history(session_id)}), 200
    except Exception as e:
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")
        return jsonify({"error": friendly_error, "history": get_history(session_id)}), 500


@app.route('/cancel', methods=['POST'])
@jwt_required()
def cancel_query():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id') or data.get('sessionId') or 'default'

    if session_id not in pending_queries:
        return jsonify({"error": "No pending query for this session"}), 400

    pending_queries.pop(session_id, None)
    remember(session_id, "assistant", "❌ Query cancelled.")
    return jsonify({"message": "Query cancelled", "history": get_history(session_id)}), 200

# -------------------- Chart --------------------

# New Chart Generation Flow


@app.route('/generate_chart', methods=['POST'])
@jwt_required()
def generate_chart_new():
    data = request.get_json(silent=True) or {}
    user_query = data.get("query")

    if not user_query:
        return jsonify({"error": "No query provided"}), 400

    # Ensure schema is available for the current user to guide SQL generation
    user_id = get_jwt_identity()
    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    try:
        # Step 1: Ask AI for SQL + confidence + chart_type (no data sent to AI)
        meta = generate_sql_and_chart(user_query, schema)
        sql_query = meta.get("sql", "")
        confidence = meta.get("confidence", 0.0)
        chart_type = meta.get("chart_type", "")

        if not sql_query or sql_query.lower().startswith("error:"):
            return jsonify({"error": "Failed to generate SQL", "meta": meta}), 500

        # Reject write queries (read-only endpoint)
        if is_write_query(sql_query):
            return jsonify({"error": "Read-only endpoint"}), 403

        # Step 2: Execute SQL on our DB only
        results = execute_query(sql_query)
        if isinstance(results, list):
            rows = results
            columns = list(results[0].keys()) if results and isinstance(
                results[0], dict) else []
        elif isinstance(results, dict):
            rows = results.get("rows", [])
            columns = results.get("columns", [])
        else:
            rows = []
            columns = []

        # Step 3: Return only results + suggestions
        return jsonify({
            "sql": sql_query,
            "confidence": confidence,
            "chart_type": chart_type,
            "columns": columns,
            "rows": rows
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------- Chat Helpers --------------------


# @app.route('/chat/<session_id>', methods=['GET'])
# @jwt_required()
# def get_chat(session_id):
#     user_id = get_jwt_identity()
#     try:
#         history = get_history(user_id)
#         return jsonify({"history": history}), 200
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

@app.route('/chat/history', methods=['GET'])
@jwt_required()
def get_chat_history_route():
    user_id = get_jwt_identity()
    try:
        history = get_history(user_id)
        return jsonify({"history": history}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/chat/clear', methods=['POST'])
@jwt_required()
def chat_clear():
    user_id = get_jwt_identity()
    clear_history(user_id)
    return jsonify({"message": f"history cleared for user {user_id}"}), 200


# @app.route('/chat', methods=['PUT'])
# @jwt_required()
# def save_private.chat_messages():
#     data = request.get_json(silent=True) or {}
#     user_id = get_jwt_identity()
#     session_id = data.get('session_id') or data.get('sessionId') or 'default'
#     message_id = data.get('message_id') or data.get('messageId')
#     text = data.get('text') or data.get('content') or data.get('message')
#     role = data.get('type') or data.get('role') or 'assistant'

#     if not text:
#         return jsonify({"error": "text (message) is required"}), 400

#     try:
#         save_message(session_id, message_id, text, role, user_id)
#         return jsonify({"message": "saved", "history": get_history(user_id)}), 200
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


# @app.route('/chat/clear', methods=['POST'])
# @jwt_required()
# def chat_clear():
#     data = request.get_json(silent=True) or {}
#     session_id = data.get('sessionId') or data.get('session_id') or 'default'
#     clear_history(session_id)
#     return jsonify({"message": f"history cleared for {session_id}"}), 200


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
        methods = []
        if getattr(rule, 'methods', None):
            methods = list(rule.methods)  # type: ignore[arg-type]
        routes.append({
            "endpoint": rule.endpoint,
            "methods": methods,
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
        methods = []
        if getattr(rule, 'methods', None):
            methods = list(rule.methods)  # type: ignore[arg-type]
        print(f"  {rule.endpoint}: {methods} {rule}")

    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
