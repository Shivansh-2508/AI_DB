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

def format_schema(schema: dict) -> str:
    """
    Accepts either:
      - rich: {table: {columns:[{name,type}], primary_key:[], foreign_keys:[...]} }
      - simple: {table: [col1, col2, ...]}
    Returns a readable text summary.
    """
    if not schema or not isinstance(schema, dict):
        return ""

    out = []
    for table, info in schema.items():
        lines = [f"Table: {table}"]
        if isinstance(info, dict) and "columns" in info:
            cols_parts = []
            for col in info["columns"]:
                if isinstance(col, dict):
                    cols_parts.append(f"{col.get('name')} ({col.get('type', '?')})")
                else:
                    cols_parts.append(str(col))
            lines.append(" Columns: " + ", ".join(cols_parts))

            if info.get("primary_key"):
                lines.append(" Primary Key: " + ", ".join(info["primary_key"]))

            if info.get("foreign_keys"):
                for fk in info["foreign_keys"]:
                    lines.append(
                        f" Foreign Key: {fk.get('column')} -> {fk.get('ref_table')}.{fk.get('ref_column')}"
                    )
        elif isinstance(info, list):
            lines.append(" Columns: " + ", ".join(map(str, info)))
        out.append("\n".join(lines))
    return "\n\n".join(out)

def generate_sql_from_prompt(user_question, schema=None):
    schema_str = format_schema(schema)

    prompt = f"""
You are an expert SQL assistant.
Translate the following natural language question into a single valid PostgreSQL SQL query.

Rules:
- Use ONLY the tables and columns from the schema.
- Do NOT explain or add any text outside the SQL.
- Do NOT include markdown or ```
- Return just the pure SQL.

Schema:
{schema_str}

Question: {user_question}

SQL:
"""
    try:
        response = model.generate_content(prompt)
        sql = (response.text or "").strip()

        # Clean up if model still sneaks markdown/fences
        sql = re.sub(r"```.*?```", "", sql, flags=re.DOTALL)
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()

        return sql
    except Exception as e:
        return f"Error: {str(e)}"
