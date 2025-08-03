import os
from dotenv import load_dotenv
from together import Together

load_dotenv()
client = Together(api_key=os.getenv("TOGETHER_API_KEY"))

# Let write operations through with confirmation


def generate_sql_from_prompt(user_question):
    prompt = f"""
You are a helpful assistant that translates user questions into accurate SQL queries.
Translate the following question into a single SQL query.
Return only the raw SQL query without any explanation, markdown, or code formatting.

Question: {user_question}
SQL:
    """

    try:
        response = client.chat.completions.create(
            model="mistralai/Mixtral-8x7B-Instruct-v0.1",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=150,
        )

        sql_query = response.choices[0].message.content.strip()

        # Remove markdown if still present
        if sql_query.startswith("```"):
            sql_query = sql_query.strip("`").replace("sql", "").strip()

        return sql_query

    except Exception as e:
        return f"Error: {str(e)}"
