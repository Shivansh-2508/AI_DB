from nlp_to_sql import generate_sql_from_prompt
from flask import Flask, request, jsonify
from flask_cors import CORS
from db import execute_query, is_write_query, cache_schema_for_user, get_cached_schema

app = Flask(__name__)
CORS(app)

pending_queries = {}  # Holds user confirmation context


def cache_user_schema(user_id, schema_name="public"):
    """
    Cache only table names + fields for the given user.
    """
    return cache_schema_for_user(user_id, schema_name)


# User login: verify credentials (dummy) and respond
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get('email')
    password = data.get('password')

    if not user_id or not password:
        return jsonify({"error": "user_id and password required"}), 400

    # Dummy auth (replace with real DB or Supabase auth later)
    if user_id and password:
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401


# Chat prefetch endpoint: ensures schema is cached BEFORE any user asks
@app.route('/chat', methods=['POST'])
def chat_init():
    data = request.get_json(silent=True) or {}
    user_id = data.get('email')

    if not user_id:
        return jsonify({"error": "email required"}), 400

    # Prefetch + cache schema for this user
    schema = get_cached_schema(user_id)
    if not schema:
        schema = cache_user_schema(user_id)

    return jsonify({
        "message": "Schema cached and ready",
        "schema_summary": schema  # returns table names + fields
    }), 200


# Handle natural language → SQL
@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json(silent=True) or {}
        user_input = data.get('message', '').strip()
        session_id = data.get('session_id', 'default')
        user_id = data.get('email')

        if not user_input:
            return jsonify({"error": "Message is required."}), 400
        if not user_id:
            return jsonify({"error": "email required"}), 400

        # Ensure schema is cached before processing query
        schema = get_cached_schema(user_id)
        if not schema:
            schema = cache_user_schema(user_id)

        if not isinstance(schema, dict):
            return jsonify({"error": "Invalid schema format"}), 500

        # Handle confirmation for pending write queries
        if session_id in pending_queries:
            if user_input.lower() in ['yes', 'y', 'confirm']:
                sql_query = pending_queries.pop(session_id)
                result = execute_query(sql_query)
                return jsonify({
                    "sql": sql_query,
                    "result": result,
                    "message": "✅ Action executed successfully."
                })
            else:
                pending_queries.pop(session_id)
                return jsonify({"message": "❌ Action cancelled."})

        # Generate SQL from natural language prompt
        sql_query = generate_sql_from_prompt(user_input, schema)

        if sql_query.startswith("Error:"):
            return jsonify({"error": sql_query}), 400

        # If it's a write query → ask for confirmation
        if is_write_query(sql_query):
            pending_queries[session_id] = sql_query
            return jsonify({
                "sql": sql_query,
                "message": f"⚠️ This will modify data. Confirm with 'yes' to proceed."
            })

        # Otherwise, execute directly
        result = execute_query(sql_query)
        return jsonify({
            "sql": sql_query,
            "result": result
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Root health check
@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Flask backend running"}), 200


if __name__ == '__main__':
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
