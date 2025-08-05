import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Configure Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-pro')


def generate_sql_from_prompt(user_question):
    prompt = f"""
You are a helpful assistant that translates user questions into accurate SQL queries.
Translate the following question into a single SQL query.
Return only the raw SQL query without any explanation, markdown, or code formatting.

Question: {user_question}
SQL:
"""

    try:
        response = model.generate_content(prompt)
        sql_query = response.text.strip()

        # Clean output if markdown/code block present
        if sql_query.startswith("```"):
            sql_query = sql_query.strip("`").replace("sql", "").strip()

        return sql_query

    except Exception as e:
        return f"Error: {str(e)}"
