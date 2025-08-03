from flask import Flask, request, jsonify
from flask_cors import CORS
from db import execute_query, is_write_query
from nlp_to_sql import generate_sql_from_prompt

app = Flask(__name__)
CORS(app)

pending_queries = {}  # Holds user confirmation context


@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json(silent=True) or {}
        user_input = data.get('message', '').strip()
        session_id = data.get('session_id', 'default')  # Optional session ID

        if not user_input:
            return jsonify({"error": "Message is required."}), 400

        # Handle confirmation for pending write
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

        # Generate SQL from user input
        sql_query = generate_sql_from_prompt(user_input)

        if sql_query.startswith("Error:"):
            return jsonify({"error": sql_query}), 400

        if is_write_query(sql_query):
            # Ask for confirmation before executing
            pending_queries[session_id] = sql_query
            return jsonify({
                "sql": sql_query,
                "message": f"⚠️ This will modify data. Confirm with 'yes' to proceed."
            })

        # Read-only query — just run it
        result = execute_query(sql_query)

        return jsonify({
            "sql": sql_query,
            "result": result
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Flask backend running"}), 200


if __name__ == '__main__':
    app.run(debug=True)
