import os
import psycopg2
from dotenv import load_dotenv
from threading import Lock

load_dotenv()

# In-memory schema cache
_schema_cache = {}
_cache_lock = Lock()

def get_db_connection():
    conn = psycopg2.connect(os.getenv("SUPABASE_DB_URL"))
    return conn

def is_write_query(query: str) -> bool:
    """
    Basic detection of queries that would modify DB state.
    """
    keywords = ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "ALTER", "DROP", "CREATE"]
    return any(kw in query.upper() for kw in keywords)

def fetch_schema_info(schema_name="public"):
    """
    Fetch rich schema info for a given schema.

    Returns dict like:
    {
      "users": {
        "columns": [ {"name": "id", "type": "integer"}, {"name":"email","type":"text"} ],
        "primary_key": ["id"],
        "foreign_keys": [
            {"column": "user_id", "ref_table": "users", "ref_column": "id"}
        ]
      }
    }
    """
    conn = get_db_connection()
    cur = conn.cursor()
    schema = {}

    # --- Get tables ---
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s;
    """, (schema_name,))
    tables = [row[0] for row in cur.fetchall()]

    for table in tables:
        table_info = {"columns": [], "primary_key": [], "foreign_keys": []}

        # --- Get columns with type ---
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s;
        """, (schema_name, table))
        cols = [{"name": c, "type": t} for c, t in cur.fetchall()]
        table_info["columns"] = cols

        # --- Get primary keys ---
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

        # --- Get foreign keys ---
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
        fks = [
            {"column": col, "ref_table": ft, "ref_column": fc}
            for col, ft, fc in cur.fetchall()
        ]
        table_info["foreign_keys"] = fks

        schema[table] = table_info

    cur.close()
    conn.close()
    return schema

def cache_schema_for_user(user_id, schema_name="public"):
    """
    Cache schema in memory for this user.
    """
    global _schema_cache
    with _cache_lock:
        schema = fetch_schema_info(schema_name)
        if not isinstance(schema, dict):
            raise ValueError("Fetched schema is not a dict")
        _schema_cache[user_id] = schema
        return schema

def get_cached_schema(user_id):
    global _schema_cache
    with _cache_lock:
        return _schema_cache.get(user_id)

def execute_query(query, schema=None):
    """
    Execute SQL query safely.
    SELECT returns list of dicts (JSON clean).
    Writes return {"rows_affected": N}.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    if schema:
        # If you plan to pass a schema name, sanitize/validate it first.
        cur.execute(f"SET search_path TO {schema},public;")

    try:
        cur.execute(query)

        if cur.description:  # SELECT query
            desc = [col[0] for col in cur.description]
            rows = cur.fetchall()
            data = [dict(zip(desc, row)) for row in rows]
        else:
            conn.commit()
            data = [{"rows_affected": cur.rowcount}]

        return data

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()
