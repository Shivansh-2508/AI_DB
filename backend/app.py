from flask import Flask, request, jsonify
from flask_cors import CORS
from db import execute_query

app = Flask(__name__)
CORS(app)


@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json(silent=True) or {}
        user_input = data.get('message', '')

        # TEMP SQL for testing
        query = "SELECT * FROM customers LIMIT 5;"
        result = execute_query(query)

        return jsonify({"result": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Flask backend running"}), 200


if __name__ == '__main__':
    app.run(debug=True)
