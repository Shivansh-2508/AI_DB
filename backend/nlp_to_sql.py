import os
import google.generativeai as genai
from dotenv import load_dotenv
import re

ai_table_cache = {}

def cache_ai_table(session_id, columns, rows):
    if columns and rows:
        ai_table_cache[session_id] = {"columns": columns, "rows": rows}

def get_cached_ai_table(session_id):
    return ai_table_cache.get(session_id)

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('models/gemini-2.0-flash-001')

# ----------------------------------------------------
# FILTER HELPER
# ----------------------------------------------------
def filter_history_for_llm(chat_history):
    """
    Remove assistant 'results'-style JSON objects and huge/JSON-like strings
    before sending chat context to the LLM.
    """
    filtered = []
    for entry in chat_history or []:
        content = entry.get("content", "")
        role = entry.get("role", "")
        # Skip assistant responses that are dicts with type == "results"
        if isinstance(content, dict) and content.get("type") == "results":
            continue
        # Skip large or JSON-ish assistant string responses
        if isinstance(content, str):
            text = content.strip()
            if (
                role == "assistant"
                and (
                    (text.startswith("{") and text.endswith("}"))
                    or len(text) > 2500
                )
            ):
                continue
        filtered.append(entry)
    return filtered
# ----------------------------------------------------

def format_schema(schema: dict) -> str:
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
    fenced = re.findall(r"```(?:sql)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    if fenced:
        text = fenced[0]
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

    print("\n==== Gemini context for SQL generation ====")
    print(prompt)
    print("===========================================\n")

    try:
        response = model.generate_content(prompt)
        sql = _strip_markdown_fences((response.text or "").strip())
        return sql
    except Exception as e:
        return f"Error: {str(e)}"

def _find_table_in_history(schema, chat_history):
    if not schema or not isinstance(schema, dict) or not chat_history:
        return None
    tables = set(map(str.lower, schema.keys()))
    for entry in reversed(chat_history[-8:]):
        text = (entry.get("content") or entry.get("text") or "").lower()
        for t in tables:
            if f"{t}" in text:
                return t
    return None

def _is_show_tables_intent(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(kw in t for kw in ["show me all tables", "show tables", "list tables", "what tables"])

def _is_write_intent(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(kw in t for kw in ["add ", "insert ", "create ", "update ", "delete ", "remove ", "add:"])

def generate_sql_from_chat_history(chat_history, schema):
    # Use filtered history
    filtered_history = filter_history_for_llm(chat_history)
    schema_str = format_schema(schema)

    # Find latest user question
    last_user = None
    for entry in reversed(filtered_history or []):
        if entry.get("role") == "user":
            last_user = entry.get("content") or entry.get("text")
            break
    if not last_user and filtered_history:
        last_user = (filtered_history or [])[-1].get("content") or (filtered_history or [])[-1].get("text")

    # Build context string
    chat_context = []
    for entry in (filtered_history or [])[-6:]:
        role = entry.get("role", "")
        content = entry.get("content", entry.get("text", ""))
        chat_context.append(f"{role.capitalize()}: {content}")
    chat_str = "\n".join(chat_context)

    print("\n======== Gemini context (SQL from chat history) ========")
    print(chat_str)
    print("========================================================\n")

    # Heuristics
    if _is_show_tables_intent(last_user or ""):
        return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    if _is_write_intent(last_user or ""):
        inferred_table = _find_table_in_history(schema, filtered_history or [])
        if inferred_table and inferred_table not in (last_user or ""):
            last_user = f"{last_user} into {inferred_table}"

    # Build SQL prompt
    prompt = f"""
You are an expert SQL assistant.
Database Schema:
{schema_str}
Conversation (recent):
{chat_str}
Latest user question:
{last_user}
Instructions:
- Produce ONE valid PostgreSQL query that answers ONLY the latest user question.
- Ignore any prior assistant-generated SQL in the conversation; do NOT repeat or re-run old queries.
- Use ONLY tables and columns from the schema above.
- Do NOT add explanation or commentary — return only the raw SQL (no markdown fences).
If the user asked for a schema-level action like "show me all tables", return a query against information_schema
that lists table names (e.g. SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';).
""".strip()

    print("\n======== Gemini full prompt (SQL from chat history) ========")
    print(prompt)
    print("===========================================================\n")

    try:
        res = model.generate_content(prompt)
        sql = _strip_markdown_fences((res.text or "").strip())
        # Sanity check
        if schema and isinstance(schema, dict):
            schema_tokens = set()
            for t, info in schema.items():
                schema_tokens.add(t.lower())
                if isinstance(info, dict) and info.get("columns"):
                    for c in info["columns"]:
                        if isinstance(c, dict):
                            schema_tokens.add(c.get("name", "").lower())
                        else:
                            schema_tokens.add(str(c).lower())
            sql_lc = sql.lower()
            if not any(tok for tok in schema_tokens if tok and tok in sql_lc):
                inferred_table = _find_table_in_history(schema, filtered_history or [])
                if inferred_table:
                    retry_prompt = prompt + f"\n\nHint: Use table {inferred_table} when generating SQL."
                    try:
                        retry_res = model.generate_content(retry_prompt)
                        retry_sql = _strip_markdown_fences((retry_res.text or "").strip())
                        if any(tok for tok in schema_tokens if tok and tok in retry_sql.lower()):
                            return retry_sql
                    except Exception:
                        pass
                return f"Error: Generated SQL does not reference known tables/columns from the schema. SQL: {sql}"
        return sql
    except Exception as e:
        return f"Error: {str(e)}"

def maybe_generate_clarifier(user_question, schema, chat_history=None):
    schema_str = format_schema(schema)
    # Use filtered history
    filtered_history = filter_history_for_llm(chat_history or [])

    convo = ""
    if filtered_history:
        convo_lines = []
        for entry in (filtered_history or [])[-6:]:
            role = entry.get("role", "")
            content = entry.get("content", entry.get("text", ""))
            convo_lines.append(f"{role.capitalize()}: {content}")
        convo = "\n".join(convo_lines)

    prompt = f"""
You are an expert assistant helping convert natural language into SQL.
Database Schema:
{schema_str}
Conversation so far:
{convo}
User just asked: "{user_question}"
Task:
- If the user question is clear and specific enough to generate SQL directly, answer with: CLEAR
- If the question is vague, incomplete, or ambiguous, output a short clarifying question to ask the user.
Examples of clarifying questions:
- "Which table should I use to fetch 'records'?"
- "Do you mean all orders, or only recent ones?"
- "Should I include inactive private.users or only active ones?"
Answer:
""".strip()

    print("\n======== Gemini prompt for clarifier ========")
    print(prompt)
    print("=============================================\n")

    try:
        res = model.generate_content(prompt)
        text = (res.text or "").strip()
        if text.upper().startswith("CLEAR"):
            return None
        return text
    except Exception:
        return None

def rewrite_db_error(error_message: str, chat_history):
    # Use filtered history
    filtered_history = filter_history_for_llm(chat_history or [])

    chat_str = "\n".join(
        (
            f"{(entry.get('role') or 'assistant').capitalize()}: {(entry.get('content') or entry.get('message') or entry.get('text') or '')}"
            if isinstance(entry, dict)
            else f"Assistant: {str(entry)}"
        )
        for entry in (filtered_history or [])
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

    print("\n======== Gemini prompt for DB error explanation ========")
    print(prompt)
    print("=========================================================\n")

    try:
        res = model.generate_content(prompt)
        return (res.text or "").strip()
    except Exception as e:
        return f"An error occurred: {error_message}"

def suggest_next_commands(schema, chat_history):
    schema_str = format_schema(schema)
    # Use filtered history
    filtered_history = filter_history_for_llm(chat_history or [])

    chat_str = "\n".join(
        f"{entry['role'].capitalize()}: {entry['content']}"
        for entry in (filtered_history or [])
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

    print("\n======== Gemini prompt for next command suggestions ========")
    print(prompt)
    print("============================================================\n")

    try:
        res = model.generate_content(prompt)
        suggestions = (res.text or "").strip()
        return suggestions
    except Exception:
        return "- show customers\n- list products\n- latest orders"

def detect_chartable(columns, rows):
    if not columns or not rows:
        return False, None
    if len(columns) < 2:
        return False, None
    try:
        sample_values = [r[1] for r in rows[:10]]
        numeric = all(
            isinstance(v, (int, float)) or (isinstance(v, str) and v.replace('.', '', 1).isdigit())
            for v in sample_values if v is not None
        )
    except Exception:
        numeric = False
    if not numeric:
        return False, None
    return True, "bar"
