import os
import re
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Configure Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the Gemini model (fast + cheap for MVP)
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


def _strip_markdown_fences(text: str) -> str:
    if not text:
        return ""
    # Remove anything between triple backtick fences (common LLM habit)
    # but keep content inside if it looks like SQL only.
    # First, try to capture content inside fences.
    fenced = re.findall(r"```(?:sql)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    if fenced:
        # If we found fenced content, prefer the first (usually the SQL)
        text = fenced[0]

    # Also remove any leftover fences or 'SQL:' prefixes
    text = re.sub(r"```+", "", text)
    if text.strip().lower().startswith("sql:"):
        text = text.split(":", 1)[1]
    return text.strip()


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
""".strip()
    try:
        response = model.generate_content(prompt)
        sql = _strip_markdown_fences((response.text or "").strip())
        return sql
    except Exception as e:
        return f"Error: {str(e)}"


def generate_sql_from_chat_history(chat_history, schema):
    schema_str = format_schema(schema)

    chat_str_lines = []
    for entry in chat_history or []:
        role = entry.get("role", "")
        content = entry.get("content", "")
        chat_str_lines.append(f"{role.capitalize()}: {content}")
    chat_str = "\n".join(chat_str_lines)

    prompt = f"""
You are an expert SQL assistant.

Database Schema:
{schema_str}

Chat history:
{chat_str}

Based on the latest user question, provide a SINGLE valid PostgreSQL SQL query.
Return ONLY the SQL query with no explanations or markdown.
""".strip()

    try:
        res = model.generate_content(prompt)
        sql = _strip_markdown_fences((res.text or "").strip())
        return sql
    except Exception as e:
        return f"Error: {str(e)}"
def maybe_generate_clarifier(user_question, schema):
    """
    Use LLM to decide if a clarifying question is needed.
    Returns a string clarifier if input is vague/ambiguous,
    or None if the query is clear enough to translate.
    """
    schema_str = format_schema(schema)

    prompt = f"""
You are an expert assistant helping convert natural language into SQL.

Database Schema:
{schema_str}

User just asked: "{user_question}"

Task:
- If the user question is clear and specific enough to generate SQL directly, answer with: CLEAR
- If the question is vague, incomplete, or ambiguous, output a short clarifying question to ask the user.
Examples of clarifying questions:
  - "Which table should I use to fetch 'records'?"
  - "Do you mean all orders, or only recent ones?"
  - "Should I include inactive users or only active ones?"

Answer:
""".strip()

    try:
        res = model.generate_content(prompt)
        text = (res.text or "").strip()
        if text.upper().startswith("CLEAR"):
            return None
        return text
    except Exception as e:
        return None
def rewrite_db_error(error_message: str, chat_history):
    """
    Take a raw DB error and chat history, return a friendly explanation.
    """
    chat_str = "\n".join(
        f"{entry['role'].capitalize()}: {entry['content']}" for entry in (chat_history or [])
    )

    prompt = f"""
You are an assistant helping a user query a PostgreSQL database via natural language.

Conversation so far:
{chat_str}

The database returned this error:
{error_message}

Task:
- Explain the error in plain English (user-friendly).
- If it looks like a typo or missing table/column, suggest a correction.
- Keep it short and conversational.
    """.strip()

    try:
        res = model.generate_content(prompt)
        return (res.text or "").strip()
    except Exception as e:
        return f"An error occurred: {error_message}"
def suggest_next_commands(schema, chat_history):
    """
    Suggest a few example queries the user might try next.
    Uses schema + conversation context.
    """
    schema_str = format_schema(schema)
    chat_str = "\n".join(
        f"{entry['role'].capitalize()}: {entry['content']}"
        for entry in (chat_history or [])
    )

    prompt = f"""
You are an assistant helping a user query a PostgreSQL database.

Database Schema:
{schema_str}

Conversation so far:
{chat_str}

Task:
- Suggest 2 to 3 example user queries that are relevant and likely to succeed.
- Base them on the schema (real tables/columns).
- Keep them short, natural language (like "show last 10 orders", not SQL).
- Do NOT explain, just give the example queries as a bulleted list.
    """.strip()

    try:
        res = model.generate_content(prompt)
        suggestions = (res.text or "").strip()
        return suggestions
    except Exception:
        return "- show customers\n- list products\n- latest orders"
