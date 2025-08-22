import threading
import os
import psycopg2
from dotenv import load_dotenv
from threading import Lock

import json
import datetime
import threading
from decimal import Decimal

load_dotenv()

# In-memory schema cache
_schema_cache = {}
_cache_lock = Lock()


def get_db_connection():
    """Return a new PostgreSQL connection."""
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        raise ValueError("SUPABASE_DB_URL not set in environment")
    return psycopg2.connect(db_url)


def save_message(session_id, message_id, content, role):
    """Persist a chat message to Postgres (Supabase). Raise on failure.

    Expects a table `chat_messages` with columns:
      session_id TEXT, message_id TEXT, content TEXT, role TEXT, timestamp TIMESTAMPTZ DEFAULT now()
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        # If content is not a plain string, serialize to JSON so structured results survive DB storage.
        if not isinstance(content, str):
            def _default(o):
                if isinstance(o, (datetime.date, datetime.datetime)):
                    return o.isoformat()
                if isinstance(o, Decimal):
                    return float(o)
                return str(o)

            content_to_store = json.dumps(content, default=_default)
        else:
            content_to_store = content

        # Use INSERT ... ON CONFLICT DO UPDATE if message_id is unique; otherwise just insert
        if message_id:
            cur.execute(
                """
                INSERT INTO chat_messages (session_id, message_id, content, role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (message_id) DO UPDATE SET content = EXCLUDED.content, role = EXCLUDED.role
                """,
                (session_id, message_id, content_to_store, role),
            )
        else:
            cur.execute(
                "INSERT INTO chat_messages (session_id, content, role) VALUES (%s, %s, %s)",
                (session_id, content_to_store, role),
            )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def get_chat_history(session_id):
    """Return chat history from Postgres. Raise on failure."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT message_id, content, role, timestamp FROM chat_messages WHERE session_id = %s ORDER BY timestamp ASC",
            (session_id,)
        )
        rows = cur.fetchall()
        cur.close()
        parsed = []
        for r in rows:
            raw_content = r[1]
            parsed_content = raw_content
            # Try to parse JSON content that we may have stored earlier
            if isinstance(raw_content, str):
                try:
                    parsed_content = json.loads(raw_content)
                except Exception:
                    parsed_content = raw_content

            parsed.append({
                "message_id": r[0],
                "content": parsed_content,
                "role": r[2],
                "timestamp": r[3].isoformat() if hasattr(r[3], 'isoformat') else r[3]
            })

        return parsed
    finally:
        conn.close()


def clear_chat_session(session_id):
    """Clear chat history for a session (DB delete). Raise on failure."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM chat_messages WHERE session_id = %s", (session_id,))
        conn.commit()
        cur.close()
    finally:
        conn.close()


def is_write_query(query: str) -> bool:
    """Detect queries that modify DB state."""
    keywords = ["INSERT", "UPDATE", "DELETE",
                "TRUNCATE", "ALTER", "DROP", "CREATE"]
    return any(kw in query.upper() for kw in keywords)


def fetch_schema_info(schema_name="public"):
    """Fetch rich schema info from PostgreSQL."""
    conn = get_db_connection()
    cur = conn.cursor()
    schema = {}

    try:
        # --- Get tables ---
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s;
        """, (schema_name,))
        tables = [row[0] for row in cur.fetchall()]

        for table in tables:
            table_info = {"columns": [], "primary_key": [], "foreign_keys": []}

            # Columns
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s;
            """, (schema_name, table))
            table_info["columns"] = [{"name": c, "type": t}
                                     for c, t in cur.fetchall()]

            # Primary keys
            cur.execute("""
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = %s AND tc.table_name = %s;
            """, (schema_name, table))
            table_info["primary_key"] = [row[0] for row in cur.fetchall()]

            # Foreign keys
            cur.execute("""
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table,
                    ccu.column_name AS foreign_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                 AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = %s AND tc.table_name = %s;
            """, (schema_name, table))
            table_info["foreign_keys"] = [
                {"column": col, "ref_table": ft, "ref_column": fc}
                for col, ft, fc in cur.fetchall()
            ]

            schema[table] = table_info

        return schema

    finally:
        cur.close()
        conn.close()


def cache_schema_for_user(user_id, schema_name="public"):
    """Cache schema in memory for a user."""
    global _schema_cache
    with _cache_lock:
        schema = fetch_schema_info(schema_name)
        if not isinstance(schema, dict):
            raise ValueError("Fetched schema is not a dict")
        _schema_cache[user_id] = schema
        return schema


def get_cached_schema(user_id):
    """Get cached schema for a user."""
    global _schema_cache
    with _cache_lock:
        return _schema_cache.get(user_id)


def execute_query(query, schema=None):
    """
    Execute SQL safely.
    SELECT returns list of dicts.
    Writes return {"rows_affected": N}.
    """
    if not query or query.lower().startswith("error:"):
        raise ValueError(f"Invalid SQL: {query}")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        if schema:
            cur.execute(f"SET search_path TO {schema}, public;")

        cur.execute(query)

        if cur.description:  # SELECT query
            # Preserve explicit column order using cursor.description
            desc = [col[0] for col in cur.description]
            rows = cur.fetchall()
            dict_rows = [dict(zip(desc, row)) for row in rows]
            # Return both columns (ordered) and rows to let callers render stable tables
            return {"columns": desc, "rows": dict_rows}
        else:  # INSERT/UPDATE/DELETE etc.
            conn.commit()
            return {"rows_affected": cur.rowcount}

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()
