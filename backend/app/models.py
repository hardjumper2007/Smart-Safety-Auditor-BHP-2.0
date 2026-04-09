from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    violation_type = Column(String, index=True) # np. "Brak kasku"
    severity = Column(String) # np. "Wysokie"
    image_path = Column(String) # Ścieżka do zrzutu ekranu z naruszeniem
    ai_reasoning = Column(Text) # <- DODAJ TO: Co Gemma powiedziała o naruszeniu
    timestamp = Column(DateTime, server_default=func.now())