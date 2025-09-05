import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from threading import Lock
import json
import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

load_dotenv()

# In-memory schema cache
_schema_cache: Dict[str, dict] = {}
_cache_lock = Lock()


def get_db_connection():
    """Return a new PostgreSQL connection (Supabase)."""
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        raise ValueError("SUPABASE_DB_URL not set in environment")
    return psycopg2.connect(db_url)


def _json_default(o: Any) -> Any:
    """Default serializer for JSON storage."""
    if isinstance(o, (datetime.date, datetime.datetime)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return float(o)
    return str(o)


def save_message(session_id: str, message_id: Optional[str], content: Any, role: str) -> None:
    """
    Persist a chat message to Postgres.

    Expects a table `chat_messages`:
      session_id TEXT,
      message_id TEXT UNIQUE,
      content TEXT,
      role TEXT,
      timestamp TIMESTAMPTZ DEFAULT now()
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if not isinstance(content, str):
                content_to_store = json.dumps(content, default=_json_default)
            else:
                content_to_store = content

            if message_id:
                cur.execute(
                    """
                    INSERT INTO chat_messages (session_id, message_id, content, role)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (message_id)
                    DO UPDATE SET content = EXCLUDED.content, role = EXCLUDED.role
                    """,
                    (session_id, message_id, content_to_store, role),
                )
            else:
                cur.execute(
                    "INSERT INTO chat_messages (session_id, content, role) VALUES (%s, %s, %s)",
                    (session_id, content_to_store, role),
                )
        conn.commit()
    finally:
        conn.close()


def get_chat_history(session_id: str) -> List[Dict[str, Any]]:
    """Return chat history for a session."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT message_id, content, role, timestamp
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY timestamp ASC
                """,
                (session_id,),
            )
            rows = cur.fetchall()

        parsed = []
        for mid, raw_content, role, ts in rows:
            try:
                parsed_content = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
            except Exception:
                parsed_content = raw_content

            parsed.append({
                "message_id": mid,
                "content": parsed_content,
                "role": role,
                "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else ts,
            })

        return parsed
    finally:
        conn.close()


def clear_chat_session(session_id: str) -> None:
    """Delete all messages for a session."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chat_messages WHERE session_id = %s", (session_id,))
        conn.commit()
    finally:
        conn.close()


def is_write_query(query: str) -> bool:
    """Detect queries that modify DB state."""
    keywords = {"INSERT", "UPDATE", "DELETE", "TRUNCATE", "ALTER", "DROP", "CREATE"}
    return any(kw in query.upper() for kw in keywords)


def fetch_schema_info(schema_name: str = "public") -> Dict[str, Any]:
    """Fetch schema info: tables, columns, PKs, FKs."""
    conn = get_db_connection()
    schema = {}

    try:
        with conn.cursor() as cur:
            # Tables
            cur.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = %s",
                (schema_name,),
            )
            tables = [row[0] for row in cur.fetchall()]

            for table in tables:
                table_info = {"columns": [], "primary_key": [], "foreign_keys": []}

                # Columns
                cur.execute(
                    """
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    """,
                    (schema_name, table),
                )
                table_info["columns"] = [{"name": c, "type": t} for c, t in cur.fetchall()]

                # PKs
                cur.execute(
                    """
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_schema = %s AND tc.table_name = %s
                    """,
                    (schema_name, table),
                )
                table_info["primary_key"] = [row[0] for row in cur.fetchall()]

                # FKs
                cur.execute(
                    """
                    SELECT kcu.column_name, ccu.table_name, ccu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage ccu
                      ON ccu.constraint_name = tc.constraint_name
                     AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_schema = %s AND tc.table_name = %s
                    """,
                    (schema_name, table),
                )
                table_info["foreign_keys"] = [
                    {"column": col, "ref_table": ft, "ref_column": fc}
                    for col, ft, fc in cur.fetchall()
                ]

                schema[table] = table_info

        return schema
    finally:
        conn.close()


def cache_schema_for_user(user_id: str, schema_name: str = "public") -> Dict[str, Any]:
    """Cache schema in memory per user."""
    schema = fetch_schema_info(schema_name)
    with _cache_lock:
        _schema_cache[user_id] = schema
    return schema


def get_cached_schema(user_id: str) -> Optional[Dict[str, Any]]:
    """Return cached schema if exists."""
    with _cache_lock:
        return _schema_cache.get(user_id)


def execute_query(query, params=None, schema=None):
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

        if params:
            cur.execute(query, params)
        else:
            cur.execute(query)

        if cur.description:  # SELECT query
            desc = [col[0] for col in cur.description]
            rows = cur.fetchall()
            dict_rows = [dict(zip(desc, row)) for row in rows]
            return dict_rows
        else:
            conn.commit()
            return {"rows_affected": cur.rowcount}

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()
