import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    conn = psycopg2.connect(os.getenv("SUPABASE_DB_URL"))
    return conn


def execute_query(query):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query)
    data = cur.fetchall()
    conn.close()
    return data
