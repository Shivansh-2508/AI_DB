# models.py
from datetime import datetime, timezone
from sqlalchemy import Column, text
from sqlalchemy.dialects.postgresql import UUID, CITEXT
from sqlalchemy.orm import declarative_base
from sqlalchemy import create_engine, TIMESTAMP, Text, String, Boolean
import os

Base = declarative_base()


class User(Base):
    __tablename__ = "private.users"
    user_id = Column(UUID(as_uuid=True), primary_key=True,
                     server_default=text("gen_random_uuid()"))
    # requires citext extension
    email = Column(CITEXT, unique=True, nullable=False)
    hashed_pw = Column(Text, nullable=False)
    role = Column(String(30), nullable=False, default="user")
    is_email_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True),
                        server_default=text("now()"), nullable=False)


def get_engine():
    return create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True, future=True)
