import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    conn = psycopg2.connect(os.getenv("SUPABASE_DB_URL"))
    return conn


def is_write_query(query):
    keywords = ["INSERT", "UPDATE", "DELETE"]
    return any(kw in query.upper() for kw in keywords)


def execute_query(query):
    conn = get_db_connection()
    cur = conn.cursor()

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
