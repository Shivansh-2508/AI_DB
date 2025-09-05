# deps.py
import os
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.orm import sessionmaker
from models import get_engine

def configure_cors(app):
    CORS(
        app,
        resources={r"/api/*": {"origins": os.environ["FRONTEND_ORIGIN"]}},
        supports_credentials=True,
    )

def configure_jwt(app):
    app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET_KEY"]
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]  # httpOnly cookies
    app.config["JWT_COOKIE_SECURE"] = True if os.environ.get("ENV") == "prod" else False
    app.config["JWT_COOKIE_SAMESITE"] = "None" if app.config["JWT_COOKIE_SECURE"] else "Lax"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = True
    app.config["JWT_ACCESS_COOKIE_PATH"] = "/"
    app.config["JWT_REFRESH_COOKIE_PATH"] = "/api/auth/refresh"
    return JWTManager(app)

def configure_db():
    engine = get_engine()
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)

def configure_limiter(app):
    key_func = lambda: (get_remote_address(),)  # IP-based; you can enrich with user_id when logged in
    limiter = Limiter(key_func=key_func, app=app, default_limits=["200/hour"])
    return limiter
