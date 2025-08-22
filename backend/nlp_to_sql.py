import os
import re
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Configure Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the Gemini model (fast + cheap for MVP)
model = genai.GenerativeModel('models/gemini-2.0-flash-001')


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
                    cols_parts.append(
                        f"{col.get('name')} ({col.get('type', '?')})")
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
    fenced = re.findall(
        r"```(?:sql)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
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


def _find_table_in_history(schema, chat_history):
    """Return the most recently-mentioned table name from chat_history that exists in schema, or None."""
    if not schema or not isinstance(schema, dict) or not chat_history:
        return None
    tables = set(map(str.lower, schema.keys()))
    # search recent entries for any table name
    for entry in reversed(chat_history[-8:]):
        text = (entry.get("content") or entry.get("text") or "").lower()
        for t in tables:
            # match word boundary
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
    """Generate SQL focused on the latest user question.

    The prompt explicitly points the model at the most recent user message and asks it to
    ignore earlier assistant SQL suggestions. Returns SQL string or raises on obvious mismatch.
    """
    schema_str = format_schema(schema)

    # Extract last user message (prefer most recent user role)
    last_user = None
    for entry in reversed(chat_history or []):
        if entry.get("role") == "user":
            last_user = entry.get("content") or entry.get("text")
            break
    # Fallback to the last entry if no explicit user role found
    if not last_user and chat_history:
        last_user = (
            chat_history or [])[-1].get("content") or (chat_history or [])[-1].get("text")

    chat_context = []
    # include a short recent context (roles + content) for reference
    for entry in (chat_history or [])[-6:]:
        role = entry.get("role", "")
        content = entry.get("content", entry.get("text", ""))
        chat_context.append(f"{role.capitalize()}: {content}")
    chat_str = "\n".join(chat_context)

    # Heuristic: if the user asked to show tables, return information_schema query directly
    if _is_show_tables_intent(last_user or ""):
        return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

    # If it's a write intent and user didn't specify a table, try to infer table from recent history
    if _is_write_intent(last_user or ""):
        # If SQL likely to modify data but user omitted table, look for a table mentioned earlier
        inferred_table = _find_table_in_history(schema, chat_history or [])
        if inferred_table and inferred_table not in (last_user or ""):
            # Augment the last_user text to include table context
            last_user = f"{last_user} into {inferred_table}"

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

    try:
        res = model.generate_content(prompt)
        sql = _strip_markdown_fences((res.text or "").strip())

        # Basic sanity: ensure the SQL mentions at least one table/column from the schema when schema provided
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
                # Try a single regeneration with explicit table hint if we inferred one
                inferred_table = _find_table_in_history(
                    schema, chat_history or [])
                if inferred_table:
                    retry_prompt = prompt + \
                        f"\n\nHint: Use table {inferred_table} when generating SQL."
                    try:
                        retry_res = model.generate_content(retry_prompt)
                        retry_sql = _strip_markdown_fences(
                            (retry_res.text or "").strip())
                        if any(tok for tok in schema_tokens if tok and tok in retry_sql.lower()):
                            return retry_sql
                    except Exception:
                        pass

                return f"Error: Generated SQL does not reference known tables/columns from the schema. SQL: {sql}"

        return sql
    except Exception as e:
        return f"Error: {str(e)}"


def maybe_generate_clarifier(user_question, schema, chat_history=None):
    """
    Decide whether a clarifying question is needed.

    Parameters:
      - user_question: the latest user message
      - schema: DB schema summary
      - chat_history: optional list of prior messages (dicts with 'role' and 'content')

    Returns: a clarifying question string, or None if CLEAR.
    """
    schema_str = format_schema(schema)

    # Include recent conversation if available to give the model context
    convo = ""
    if chat_history:
        convo_lines = []
        # Only include the last ~6 turns to keep prompt small
        for entry in (chat_history or [])[-6:]:
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
  - "Should I include inactive users or only active ones?"

Answer:
""".strip()

    try:
        res = model.generate_content(prompt)
        text = (res.text or "").strip()
        if text.upper().startswith("CLEAR"):
            return None
        return text
    except Exception:
        return None


def rewrite_db_error(error_message: str, chat_history):
    """
    Take a raw DB error and chat history, return a friendly explanation.
    """
    # Build a safe chat string for the LLM diagnostic prompt — tolerate odd/missing keys
    chat_str = "\n".join(
        (
            f"{(entry.get('role') or 'assistant').capitalize()}: {(entry.get('content') or entry.get('message') or entry.get('text') or '')}"
            if isinstance(entry, dict)
            else f"Assistant: {str(entry)}"
        )
        for entry in (chat_history or [])
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
