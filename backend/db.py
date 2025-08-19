import os
import psycopg2
from dotenv import load_dotenv
from threading import Lock

load_dotenv()

_schema_cache = {}
_cache_lock = Lock()


def get_db_connection():
    conn = psycopg2.connect(os.getenv("SUPABASE_DB_URL"))
    return conn


def is_write_query(query):
    keywords = ["INSERT", "UPDATE", "DELETE"]
    return any(kw in query.upper() for kw in keywords)


def fetch_schema_info(schema_name="public"):
    """
    Fetch only table names and their fields (columns).
    Returns format:
    {
        "users": ["id", "name", "email"],
        "orders": ["id", "user_id", "amount"]
    }
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Fetch all tables in the schema
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables
        WHERE table_schema = %s;
    """, (schema_name,))
    tables = [row[0] for row in cur.fetchall()]

    schema = {}
    for table in tables:
        # Fetch just column names
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s;
        """, (schema_name, table))
        columns = [row[0] for row in cur.fetchall()]
        schema[table] = columns

    cur.close()
    conn.close()
    return schema


def cache_schema_for_user(user_id, schema_name="public"):
    global _schema_cache
    with _cache_lock:
        schema = fetch_schema_info(schema_name)
        _schema_cache[user_id] = schema
    return schema


def get_cached_schema(user_id):
    global _schema_cache
    with _cache_lock:
        return _schema_cache.get(user_id)


def execute_query(query, schema=None):
    conn = get_db_connection()
    cur = conn.cursor()
    if schema:
        cur.execute(f"SET search_path TO {schema},public;")
    try:
        cur.execute(query)
        if cur.description:  # SELECT query
            data = cur.fetchall()
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
