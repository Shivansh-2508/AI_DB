import os
from dotenv import load_dotenv
import google.generativeai as genai
import re

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Configure Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')


def generate_sql_from_prompt(user_question, schema=None):
    schema_str = ""
    if schema:
        # Format schema as readable text for the model
        for table, info in schema.items():
            schema_str += f"Table: {table}\n"
            schema_str += "  Columns: " + ", ".join(
                [f"{col['name']} ({col['type']})" for col in info['columns']]
            ) + "\n"
            if info.get('primary_key'):
                schema_str += f"  Primary Key: {', '.join(info['primary_key'])}\n"
            if info.get('foreign_keys'):
                for fk in info['foreign_keys']:
                    schema_str += f"  Foreign Key: {fk['column']} -> {fk['ref_table']}.{fk['ref_column']}\n"
            schema_str += "\n"

    # Stronger instruction to avoid explanation / markdown
    prompt = f"""
You are an expert SQL assistant.
Translate the following natural language question into a **single valid PostgreSQL SQL query**.

### Rules:
- Use ONLY the tables and columns from the schema.
- Do NOT explain, apologize, or add text outside the SQL.
- Do NOT include markdown or ```sql fences.
- Return just the pure SQL query.

Schema:
{schema_str}

Question: {user_question}
SQL:
"""

    try:
        response = model.generate_content(prompt)
        sql_query = response.text.strip()

        # Clean up if model still sneaks markdown/fences
        sql_query = re.sub(r"```.*?```", "", sql_query,
                           flags=re.DOTALL).strip()
        sql_query = sql_query.replace("sql", "").strip()

        return sql_query
    except Exception as e:
        return f"Error: {str(e)}"
