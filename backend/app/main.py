from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import os
import json
import httpx
import base64
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:latest")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL nie ustawiony")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            avatar TEXT DEFAULT '👤',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audits (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            norm TEXT,
            compliance_score INTEGER,
            status TEXT,
            risk_level TEXT,
            hazards JSONB,
            non_compliances JSONB,
            recommendations JSONB,
            iso_clauses JSONB
        );
    """)
    conn.commit()
    cur.close()
    conn.close()

@app.on_event("startup")
async def startup():
    init_db()

@app.post("/api/register")
async def register(
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    avatar: str = Form("👤")
):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email już istnieje")

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(
            "INSERT INTO users (email, password_hash, full_name, avatar) VALUES (%s, %s, %s, %s) RETURNING id, email, full_name, avatar",
            (email, hashed, full_name, avatar)
        )
        user = cur.fetchone()
        conn.commit()
        return {"user_id": str(user["id"]), "email": user["email"], "full_name": user["full_name"], "avatar": user["avatar"]}
    finally:
        cur.close()
        conn.close()

@app.post("/api/login")
async def login(email: str = Form(...), password: str = Form(...)):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, email, full_name, password_hash, avatar FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if not user or not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
            raise HTTPException(status_code=401, detail="Nieprawidłowy email lub hasło")

        return {
            "user_id": str(user["id"]),
            "email": user["email"],
            "full_name": user["full_name"] or "Użytkownik",
            "avatar": user["avatar"] or "👤"
        }
    finally:
        cur.close()
        conn.close()

@app.post("/api/change-password")
async def change_password(
    user_id: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...)
):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(old_password.encode('utf-8'), user["password_hash"].encode('utf-8')):
            raise HTTPException(status_code=400, detail="Stare hasło nieprawidłowe")

        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
        conn.commit()
        return {"status": "ok"}
    finally:
        cur.close()
        conn.close()

@app.post("/api/update-avatar")
async def update_avatar(user_id: str = Form(...), avatar: str = Form(...)):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE users SET avatar = %s WHERE id = %s RETURNING avatar", (avatar, user_id))
        updated = cur.fetchone()
        conn.commit()
        return {"status": "ok", "avatar": updated["avatar"]}
    finally:
        cur.close()
        conn.close()

@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    norm: str = Form("PN-ISO 45001:2018"),
    user_id: str = Form(...)
):
    logger.info(f"Analiza start: user={user_id}, norm={norm}, file={file.filename}")
    
    content = await file.read()
    img_base64 = base64.b64encode(content).decode()
    logger.info(f"Obraz base64 length: {len(img_base64)}")

    prompt = f"""Jesteś ekspertem BHP audytującym zgodnie z normą {norm}.

Przeanalizuj zdjęcie stanowiska pracy. Zidentyfikuj:
1. Naruszenia BHP, brakujące ŚOI, zagrożenia
2. Dobre praktyki
3. Zgodność z klauzulami normy

Zwróć TYLKO czysty JSON bez markdown, bez komentarzy, bez tekstu przed/po:
{{
  "compliance_score": liczba 0-100 oznaczająca % zgodności,
  "status": "Zgodne" lub "Częściowo zgodne" lub "Niezgodne",
  "risk_level": "niskie" lub "średnie" lub "wysokie" lub "krytyczne",
  "hazards": [{{"name": "krótki tytuł zagrożenia", "severity": "niskie/średnie/wysokie/krytyczne"}}],
  "non_compliances": ["lista konkretnych niezgodności max 2 zdania każda"],
  "recommendations": ["lista konkretnych zaleceń"],
  "iso_clauses": ["lista klauzul np. 6.1.2, 8.1"]
}}

Wygeneruj 3-4 hazards. Bądź konkretny i techniczny."""

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            logger.info(f"Wysyłam do Ollama: {OLLAMA_URL}/api/generate model={OLLAMA_MODEL}")
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "images": [img_base64],
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 512,
                        "num_ctx": 2048
                    }
                }
            )

        logger.info(f"Ollama status: {response.status_code}")
        
        if response.status_code!= 200:
            logger.error(f"Ollama error: {response.text}")
            raise HTTPException(status_code=500, detail=f"Ollama error: {response.text}")

        data = response.json()
        result_text = data.get("response", "")
        logger.info(f"Ollama raw response: {result_text[:200]}...")
        
        # Czyścimy markdown jeśli Gemma go doda
        cleaned = result_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        result = json.loads(cleaned)
        logger.info(f"Parsed JSON: score={result.get('compliance_score')}")

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO audits (user_id, norm, compliance_score, status, risk_level, hazards, non_compliances, recommendations, iso_clauses)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,
            norm,
            result["compliance_score"],
            result["status"],
            result["risk_level"],
            json.dumps(result["hazards"]),
            json.dumps(result["non_compliances"]),
            json.dumps(result["recommendations"]),
            json.dumps(result["iso_clauses"])
        ))
        audit_id = cur.fetchone()["id"]
        conn.commit()
        cur.close()
        conn.close()

        result["id"] = audit_id
        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}, raw: {result_text}")
        raise HTTPException(status_code=500, detail=f"AI zwróciła niepoprawny JSON: {str(e)}")
    except httpx.TimeoutException:
        logger.error("Timeout po 600s")
        raise HTTPException(status_code=504, detail="Timeout: analiza trwała >10 min")
    except Exception as e:
        logger.error(f"Błąd analizy: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Błąd analizy: {str(e)}")

@app.get("/api/history/{user_id}")
async def get_history(user_id: str):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, created_at, norm, status, compliance_score, risk_level
            FROM audits
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        cur.close()
        conn.close()

@app.get("/health")
async def health():
    return {"status": "ok", "model": OLLAMA_MODEL}