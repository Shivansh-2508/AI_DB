from flask import Flask, request, jsonify
from flask_cors import CORS

from db import (
    execute_query,
    is_write_query,
    cache_schema_for_user,
    get_cached_schema,
    save_message,
    get_chat_history,
    clear_chat_session,
)
from nlp_to_sql import generate_sql_from_chat_history, maybe_generate_clarifier, rewrite_db_error, suggest_next_commands

app = Flask(__name__)
# Allow CORS from the frontend during local development (preflight + credentials)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000", "https://ai-db-one.vercel.app"]}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# -------------------- In-memory chat history (MVP) --------------------
chat_history = {}

# Pending write queries: { sessionId: {"sql": "...", "user_id": "..."} }
pending_queries = {}


def remember(session_id: str, role: str, content: str, message_id: str | None = None) -> None:
    """Persist a chat turn using db.save_message. Accepts optional message_id.

    role should be one of 'user'|'assistant'|'system'|'error'.
    """
    # Use save_message helper (which will write to Supabase/Postgres when configured)
    try:
        save_message(session_id, message_id, content, role)
    except Exception:
        # Best-effort: fall back to in-memory append to keep behavior if DB is temporarily unavailable
        chat_history.setdefault(session_id, []).append(
            {"role": role, "content": content})


def normalize_history(raw_history):
    """Normalize diverse history formats (DB rows, in-memory dicts, or legacy shapes)
    into a consistent list of objects: { role, content, message_id, timestamp }.
    """
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
            # unexpected format: stringify
            normalized.append({'role': 'assistant', 'content': str(
                entry), 'message_id': None, 'timestamp': None})
    return normalized


def get_history(session_id: str):
    """Return full chat history for a session (DB-backed) and normalize entries.

    Ensures frontend always receives a consistent structure when fetching history on load/reload.
    """
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
    """Cache table names + fields for a user."""
    return cache_schema_for_user(user_id, schema_name)

# -------------------- Auth (dummy) --------------------


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get('email')
    password = data.get('password')

    if not user_id or not password:
        return jsonify({"error": "email and password required"}), 400

    # Dummy auth
    return jsonify({"message": "Login successful"}), 200

# -------------------- Chat init / schema prefetch --------------------


@app.route('/chat', methods=['POST', 'PUT'])
def chat_handler():
    """Handles two things depending on payload:
    - If payload includes a message (content/message/messageId), persist it to chat storage.
    - Otherwise, treat as schema prefetch request (expects 'email'/'user_id' and 'session_id').
    This keeps compatibility with the frontend which POSTs both for prefetch and message saves.
    """
    data = request.get_json(silent=True) or {}

    # Normalize common keys from frontend variations
    user_id = data.get('email') or data.get('user_id')
    session_id = data.get('sessionId') or data.get(
        'session_id') or data.get('session') or 'default'

    # Message save path (supports both POST and PUT semantics)
    # Accept multiple key names for robustness
    message_id = data.get('messageId') or data.get(
        'message_id') or data.get('id')
    content = data.get('content') or data.get('text') or data.get('message')
    role = (data.get('role') or data.get('type') or 'assistant')

    if content:
        # Persist message
        try:
            save_message(session_id, message_id, content, role)
            return jsonify({"message": "saved", "history": get_history(session_id)}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Otherwise: schema prefetch / chat init flow
    if not user_id:
        return jsonify({"error": "email required"}), 400

    # Prefetch + cache schema
    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    # Ensure session exists (DB-backed get_history will return an array)
    _ = get_history(session_id)

    return jsonify({
        "message": "Schema cached and ready",
        "schema_summary": schema,
        "history": get_history(session_id),
    }), 200

# -------------------- Ask (NL → SQL using chat history) --------------------


@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json(silent=True) or {}
    user_input = data.get('message', '').strip()
    # normalize session id key names (frontend may send session_id or sessionId)
    session_id = data.get('session_id') or data.get('sessionId') or 'default'
    user_id = data.get('email')

    if not user_input:
        return jsonify({"error": "Message is required."}), 400
    if not user_id:
        return jsonify({"error": "email required"}), 400

    schema = get_cached_schema(user_id) or cache_user_schema(user_id)

    # Log user input
    remember(session_id, "user", user_input)

    # Clarifier check — include recent chat history so the LLM can use context
    clarifier = maybe_generate_clarifier(
        user_input, schema, get_history(session_id))
    if clarifier:
        remember(session_id, "assistant", clarifier)
        return jsonify({"clarifier": clarifier, "history": get_history(session_id)}), 200

    # Generate SQL
    sql_query = generate_sql_from_chat_history(get_history(session_id), schema)

    # Write protection
    if is_write_query(sql_query):
        pending_queries[session_id] = {"sql": sql_query, "user_id": user_id}
        clarifier_msg = f"This query will modify data. Do you want me to run it?\n\n{sql_query}"
        remember(session_id, "assistant", clarifier_msg)
        return jsonify({"clarifier": clarifier_msg, "history": get_history(session_id)}), 200

    # Safe read query execution
    try:
        results_raw = execute_query(sql_query)
        # results_raw may be either {columns, rows} or legacy list of dicts
        if isinstance(results_raw, dict) and "rows" in results_raw:
            cols = results_raw.get("columns")
            rows = results_raw.get("rows")
        else:
            cols = None
            rows = results_raw

        remember(session_id, "assistant", f"Generated SQL:\n{sql_query}")
        remember(session_id, "assistant", f"📊 Results: {rows}")
        return jsonify({"sql": sql_query, "results": rows, "columns": cols, "history": get_history(session_id)}), 200
    except Exception as e:
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")
        suggestions = suggest_next_commands(schema, get_history(session_id))
        remember(session_id, "assistant", f"💡 You can try:\n{suggestions}")
        return jsonify({"error": friendly_error, "sql": sql_query, "suggestions": suggestions, "history": get_history(session_id)}), 500

# -------------------- Confirm pending write --------------------


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

    # User confirmed yes
    sql = pending_queries[session_id]["sql"]
    try:
        results_raw = execute_query(sql)
        if isinstance(results_raw, dict) and "rows" in results_raw:
            cols = results_raw.get("columns")
            rows = results_raw.get("rows")
        else:
            cols = None
            rows = results_raw

        remember(session_id, "assistant",
                 f"✅ Query executed.\nResults: {rows}")
        pending_queries.pop(session_id, None)
        return jsonify({"results": rows, "columns": cols, "history": get_history(session_id)}), 200
    except Exception as e:
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")
        return jsonify({"error": friendly_error, "history": get_history(session_id)}), 500

# -------------------- Cancel pending write --------------------


@app.route('/cancel', methods=['POST'])
def cancel_query():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id') or data.get('sessionId') or 'default'

    if session_id not in pending_queries:
        return jsonify({"error": "No pending query for this session"}), 400

    pending_queries.pop(session_id, None)
    remember(session_id, "assistant", "❌ Query cancelled.")
    return jsonify({"message": "Query cancelled", "history": get_history(session_id)}), 200

# -------------------- Chat HTTP helpers (frontend compatibility) --------------------


@app.route('/chat/<session_id>', methods=['GET'])
def get_chat(session_id):
    """Return chat history for a session (used by frontend GET /chat/:session_id)."""
    try:
        history = get_history(session_id)
        return jsonify({"history": history}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/chat', methods=['PUT'])
def save_chat_message():
    """Persist a single chat message from the frontend.

    Accepts both `session_id` and `sessionId` to be robust.
    """
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

# -------------------- Clear chat (compatible with frontend) --------------------


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


if __name__ == '__main__':
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
