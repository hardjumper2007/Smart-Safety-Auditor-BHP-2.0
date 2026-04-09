from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Używamy SQLite lokalnie - plik bhp_local.db stworzy się sam
SQLALCHEMY_DATABASE_URL = "sqlite:///./bhp_local.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()