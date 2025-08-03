from db import execute_query

query = "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
result = execute_query(query)
print("Tables:", result)
