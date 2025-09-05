# mailer.py
def send_email(to: str, subject: str, html: str):
    # Plug in SendGrid/Resend/Postmark here
    # For Supabase: you can call a serverless function or use any SMTP
    print(f"[DEV] Email to {to} :: {subject}\n{html}")
