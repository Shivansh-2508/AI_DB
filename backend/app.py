from flask import Flask, request, jsonify
from flask_cors import CORS

from db import (
    execute_query,
    is_write_query,
    cache_schema_for_user,
    get_cached_schema,
)

# IMPORTANT: we need the chat-history-aware generator
from nlp_to_sql import (
    generate_sql_from_chat_history,
)

app = Flask(__name__)
CORS(app)

# --- In-memory chat history (MVP). Later: Redis/DB for persistence/scaling. ---
# Structure: { session_id: [ {role: "user"|"assistant"|"system", content: "..."}, ... ] }
chat_history = {}

def remember(session_id: str, role: str, content: str) -> None:
    """Append a chat turn to session history."""
    chat_history.setdefault(session_id, []).append({"role": role, "content": content})

def get_history(session_id: str):
    """Return full chat history for a session."""
    return chat_history.get(session_id, [])

# Optional: basic clear (useful in dev)
def clear_history(session_id: str) -> None:
    chat_history.pop(session_id, None)

# ---(Optional) Pending write queries; keeping the dict for future steps ---
pending_queries = {}  # { session_id: {"sql": "..."} }


def cache_user_schema(user_id, schema_name="public"):
    """
    Cache only table names + fields (rich dict) for the given user.
    """
    return cache_schema_for_user(user_id, schema_name)


# -------------------- Auth (dummy) --------------------
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get('email')
    password = data.get('password')

    if not user_id or not password:
        return jsonify({"error": "user_id and password required"}), 400

    # Dummy auth
    if user_id and password:
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401


# -------------------- Chat init / schema prefetch --------------------
@app.route('/chat', methods=['POST'])
def chat_init():
    data = request.get_json(silent=True) or {}
    user_id = data.get('email')
    session_id = data.get('session_id', 'default')

    if not user_id:
        return jsonify({"error": "email required"}), 400

    # Prefetch + cache schema for this user
    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    # Initialize empty chat on first touch (harmless if exists)
    chat_history.setdefault(session_id, [])

    return jsonify({
        "message": "Schema cached and ready",
        "schema_summary": schema,
        "history": get_history(session_id),
    }), 200


# -------------------- Ask (NL -> SQL using full chat history) --------------------
@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json(silent=True) or {}
    user_input = data.get('message', '').strip()
    session_id = data.get('session_id', 'default')
    user_id = data.get('email')

    if not user_input:
        return jsonify({"error": "Message is required."}), 400
    if not user_id:
        return jsonify({"error": "email required"}), 400

    schema = get_cached_schema(user_id) or cache_user_schema(user_id)

    # Log user input
    remember(session_id, "user", user_input)

    from nlp_to_sql import maybe_generate_clarifier
    # First try a clarifier check (only if very vague)
    clarifier = maybe_generate_clarifier(user_input, schema)

    if clarifier:
        remember(session_id, "assistant", clarifier)
        return jsonify({
            "clarifier": clarifier,
            "history": get_history(session_id)
        }), 200

    # Generate SQL
    sql_query = generate_sql_from_chat_history(get_history(session_id), schema)

   # --- Write protection ---
    if is_write_query(sql_query):
        pending_queries[session_id] = {"sql": sql_query, "user_id": user_id}
        clarifier_msg = f"This query will modify data. Do you want me to run it?\n\n{sql_query}"
        remember(session_id, "assistant", clarifier_msg)
        return jsonify({
            "clarifier": clarifier_msg,
            "history": get_history(session_id),
        }), 200

    # --- Safe read query: try executing immediately ---
    try:
        results = execute_query(sql_query)
        remember(session_id, "assistant", f"Generated SQL:\n{sql_query}")
        remember(session_id, "assistant", f"📊 Results: {results}")
        return jsonify({
            "sql": sql_query,
            "results": results,
            "history": get_history(session_id),
        }), 200
    except Exception as e:
        from nlp_to_sql import rewrite_db_error, suggest_next_commands
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")

        # Add proactive suggestions
        suggestions = suggest_next_commands(schema, get_history(session_id))
        remember(session_id, "assistant", f"💡 You can try:\n{suggestions}")

        return jsonify({
            "error": friendly_error,
            "sql": sql_query,
            "suggestions": suggestions,
            "history": get_history(session_id),
        }), 500



@app.route('/confirm', methods=['POST'])
def confirm_query():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id', 'default')
    decision = data.get('decision', '').lower()

    if session_id not in pending_queries:
        return jsonify({"error": "No pending query for this session"}), 400

    if decision not in ["yes", "no"]:
        return jsonify({"error": "Decision must be 'yes' or 'no'"}), 400

    if decision == "no":
        remember(session_id, "assistant", "Query cancelled.")
        pending_queries.pop(session_id, None)
        return jsonify({"message": "Query cancelled", "history": get_history(session_id)}), 200

    # User confirmed yes
   # User confirmed yes
    sql = pending_queries[session_id]["sql"]
    try:
        results = execute_query(sql)
        remember(session_id, "assistant", f"✅ Query executed.\nResults: {results}")
        pending_queries.pop(session_id, None)
        return jsonify({
            "results": results,
            "history": get_history(session_id)
        }), 200
    except Exception as e:
        from nlp_to_sql import rewrite_db_error
        friendly_error = rewrite_db_error(str(e), get_history(session_id))
        remember(session_id, "assistant", f"❌ {friendly_error}")
        return jsonify({
            "error": friendly_error,
            "history": get_history(session_id)
        }), 500


@app.route('/cancel', methods=['POST'])
def cancel_query():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id', 'default')

    if session_id not in pending_queries:
        return jsonify({"error": "No pending query for this session"}), 400

    # Clear pending query
    pending_queries.pop(session_id, None)
    remember(session_id, "assistant", "❌ Query cancelled.")
    return jsonify({
        "message": "Query cancelled",
        "history": get_history(session_id)
    }), 200


# -------------------- Utility: clear a session (dev) --------------------
@app.route('/chat/clear', methods=['POST'])
def chat_clear():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id', 'default')
    clear_history(session_id)
    return jsonify({"message": f"history cleared for {session_id}"}), 200


# -------------------- Health --------------------
@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Flask backend running"}), 200


if __name__ == '__main__':
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
