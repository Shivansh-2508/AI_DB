from db import execute_query

result = execute_query("SELECT * FROM customers;")
print("Result:", result)
