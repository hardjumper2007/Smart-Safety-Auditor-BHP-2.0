from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.formparsers import MultiPartParser
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import os
import json
import httpx
import base64
from dotenv import load_dotenv
import logging
import tempfile
import subprocess
import glob
import shutil
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any, Set

MultiPartParser.max_part_size = 200 * 1024

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b-cloud")
MAX_FILE_SIZE_MB = 200
MAX_REQUEST_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

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
        raise HTTPException(status_code=500, detail="DATABASE_URL not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    conn = None
    try:
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

            CREATE TABLE IF NOT EXISTS facilities (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                address TEXT,
                logo_base64 TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS facility_norms (
                id SERIAL PRIMARY KEY,
                facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
                norm_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS audits (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                norm TEXT,
                compliance_score INTEGER,
                status TEXT,
                risk_level TEXT,
                hazards JSONB,
                non_compliances JSONB,
                recommendations JSONB,
                iso_clauses JSONB,
                user_notes TEXT,
                image_base64 TEXT
            );
        """)
        conn.commit()
    except Exception as e:
        logger.error(f"DB init error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            cur.close()
            conn.close()

@app.on_event("startup")
async def startup():
    init_db()

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    avatar: str = "👤"

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserResponse(UserBase):
    user_id: UUID

class FacilityBase(BaseModel):
    name: str
    address: Optional[str] = ""
    logo_base64: Optional[str] = ""

class FacilityResponse(FacilityBase):
    id: int
    user_id: UUID
    created_at: datetime

@app.post("/api/register", response_model=UserResponse)
async def register(
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    avatar: str = Form("👤"),
):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Hasło musi mieć co najmniej 8 znaków")

    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email już istnieje")

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            """INSERT INTO users (email, password_hash, full_name, avatar)
               VALUES (%s, %s, %s, %s)
               RETURNING id, email, full_name, avatar""",
            (email, hashed, full_name, avatar),
        )
        user = cur.fetchone()
        conn.commit()
        return {
            "user_id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "avatar": user["avatar"],
        }
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Błąd rejestracji")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.post("/api/login", response_model=UserResponse)
async def login(email: str = Form(...), password: str = Form(...)):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, full_name, password_hash, avatar FROM users WHERE email = %s",
            (email,),
        )
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
            raise HTTPException(status_code=401, detail="Nieprawidłowy email lub hasło")

        return {
            "user_id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"] or "Użytkownik",
            "avatar": user["avatar"] or "👤",
        }
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Błąd logowania")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.post("/api/change-password")
async def change_password(
    user_id: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...),
):
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Nowe hasło musi mieć co najmniej 8 znaków")

    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(old_password.encode(), user["password_hash"].encode()):
            raise HTTPException(status_code=400, detail="Stare hasło nieprawidłowe")

        new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Change password error: {e}")
        raise HTTPException(status_code=500, detail="Błąd zmiany hasła")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.post("/api/update-avatar")
async def update_avatar(user_id: str = Form(...), avatar: str = Form(...)):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET avatar = %s WHERE id = %s RETURNING avatar",
            (avatar, user_id),
        )
        updated = cur.fetchone()
        conn.commit()
        return {"status": "ok", "avatar": updated["avatar"]}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Update avatar error: {e}")
        raise HTTPException(status_code=500, detail="Błąd aktualizacji awatara")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.post("/api/facilities", response_model=FacilityResponse)
async def create_facility(
    user_id: str = Form(...),
    name: str = Form(...),
    address: str = Form(""),
    logo_base64: str = Form(""),
):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO facilities (user_id, name, address, logo_base64)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (user_id, name, address, logo_base64),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Create facility error: {e}")
        raise HTTPException(status_code=500, detail="Błąd tworzenia obiektu")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.get("/api/facilities/{user_id}", response_model=List[FacilityResponse])
async def get_facilities(user_id: str):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM facilities WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Get facilities error: {e}")
        raise HTTPException(status_code=500, detail="Błąd pobierania obiektów")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.put("/api/facilities/{facility_id}", response_model=FacilityResponse)
async def update_facility(
    facility_id: int,
    name: str = Form(...),
    address: str = Form(""),
    logo_base64: str = Form(""),
):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """UPDATE facilities
               SET name = %s, address = %s, logo_base64 = %s
               WHERE id = %s RETURNING *""",
            (name, address, logo_base64, facility_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Obiekt nie znaleziony")
        conn.commit()
        return dict(row)
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Update facility error: {e}")
        raise HTTPException(status_code=500, detail="Błąd aktualizacji obiektu")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.delete("/api/facilities/{facility_id}")
async def delete_facility(facility_id: int):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM facilities WHERE id = %s", (facility_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Obiekt nie znaleziony")
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Delete facility error: {e}")
        raise HTTPException(status_code=500, detail="Błąd usuwania obiektu")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.post("/api/facilities/{facility_id}/norms")
async def add_norm(facility_id: int, norm_name: str = Form(...)):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO facility_norms (facility_id, norm_name)
               VALUES (%s, %s) RETURNING *""",
            (facility_id, norm_name),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Add norm error: {e}")
        raise HTTPException(status_code=500, detail="Błąd dodawania normy")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.get("/api/facilities/{facility_id}/norms")
async def get_norms(facility_id: int):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM facility_norms WHERE facility_id = %s ORDER BY id",
            (facility_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Get norms error: {e}")
        raise HTTPException(status_code=500, detail="Błąd pobierania norm")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.delete("/api/norms/{norm_id}")
async def delete_norm(norm_id: int):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM facility_norms WHERE id = %s", (norm_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Norma nie znaleziona")
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Delete norm error: {e}")
        raise HTTPException(status_code=500, detail="Błąd usuwania normy")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    norm: str = Form("PN-ISO 45001:2018"),
    user_id: str = Form(...),
    facility_id: Optional[str] = Form(""),
):
    logger.info(f"Analiza start: user={user_id}, norm={norm}, file={file.filename}")

    content = await file.read()
    if len(content) > MAX_REQUEST_SIZE:
        raise HTTPException(status_code=413, detail="Plik jest za duży (max 200MB)")
    img_base64 = base64.b64encode(content).decode()

    prompt = f"""Jesteś ekspertem BHP audytującym zgodnie z normą {norm}.

Przeanalizuj zdjęcie stanowiska pracy. Jeśli zdjęcie NIE przedstawia żadnej sytuacji w środowisku pracy (np. pokazuje krajobraz, jedzenie, zwierzęta, portret, itp.) – zwróć JSON z polem "not_workplace": true i niczym więcej.

Jeśli zdjęcie PRZEDSTAWIA środowisko pracy, zidentyfikuj:
1. Naruszenia BHP, brakujące ŚOI, zagrożenia
2. Dobre praktyki
3. Zgodność z klauzulami normy

Zwróć TYLKO czysty JSON bez markdown:
{{
  "not_workplace": false,
  "compliance_score": liczba 0-100,
  "status": "Zgodne" lub "Częściowo zgodne" lub "Niezgodne",
  "risk_level": "niskie" lub "średnie" lub "wysokie" lub "krytyczne",
  "hazards": [{{"name": "krótki tytuł", "severity": "niskie/średnie/wysokie/krytyczne"}}],
  "non_compliances": ["lista niezgodności max 2 zdania każda"],
  "recommendations": ["lista zaleceń"],
  "iso_clauses": ["lista klauzul np. 6.1.2, 8.1"]
}}

Wygeneruj 3-4 hazards. Bądź konkretny i techniczny."""

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "images": [img_base64],
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.1, "num_predict": 512, "num_ctx": 2048},
                },
            )

        if response.status_code!= 200:
            raise HTTPException(status_code=500, detail=f"Ollama error: {response.text}")

        data = response.json()
        result_text = data.get("response", "").strip()

        cleaned = result_text.strip()
        for tag in ("```json", "```"):
            if cleaned.startswith(tag):
                cleaned = cleaned[len(tag):].strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

        result = json.loads(cleaned)

        if result.get("not_workplace"):
            return {"not_workplace": True}

        fac_id = int(facility_id) if facility_id and facility_id.isdigit() else None

        conn = None
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO audits
                   (user_id, facility_id, norm, compliance_score, status, risk_level,
                    hazards, non_compliances, recommendations, iso_clauses, image_base64)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (
                    user_id,
                    fac_id,
                    norm,
                    result["compliance_score"],
                    result["status"],
                    result["risk_level"],
                    json.dumps(result["hazards"]),
                    json.dumps(result["non_compliances"]),
                    json.dumps(result["recommendations"]),
                    json.dumps(result["iso_clauses"]),
                    img_base64,
                ),
            )
            audit_id = cur.fetchone()["id"]
            conn.commit()
            result["id"] = audit_id
            result["image_base64"] = img_base64
            return result
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"DB error during audit save: {e}")
            raise HTTPException(status_code=500, detail="Błąd zapisu audytu")
        finally:
            if conn:
                cur.close()
                conn.close()

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        raise HTTPException(status_code=500, detail=f"AI zwróciła niepoprawny JSON: {e}")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout: analiza trwała >10 min")
    except Exception as e:
        logger.error(f"Analiza error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Błąd analizy: {e}")

@app.post("/api/analyze-video")
async def analyze_video(
    file: UploadFile = File(...),
    norm: str = Form("PN-ISO 45001:2018"),
    user_id: str = Form(...),
    facility_id: Optional[str] = Form(""),
):
    if not shutil.which("ffmpeg"):
        raise HTTPException(status_code=500, detail="FFmpeg nie jest zainstalowany w kontenerze")

    content = await file.read()
    logger.info(f"Video upload: {file.filename}, size: {len(content)/1024/1024:.1f} MB")

    if len(content) > MAX_REQUEST_SIZE:
        raise HTTPException(status_code=413, detail="Plik jest za duży (max 200MB)")

    with tempfile.TemporaryDirectory() as tmpdir:
        vid_path = os.path.join(tmpdir, "video.mp4")
        with open(vid_path, "wb") as f:
            f.write(content)

        frames_dir = os.path.join(tmpdir, "frames")
        os.makedirs(frames_dir)

        result = subprocess.run(
            [
                "ffmpeg",
                "-i", vid_path,
                "-vf", "fps=0.5",
                "-vframes", "10",
                os.path.join(frames_dir, "frame_%03d.jpg"),
                "-y"
            ],
            capture_output=True,
            text=True
        )
        if result.returncode!= 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {result.stderr}")

        frames = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))
        if not frames:
            raise HTTPException(status_code=400, detail="Nie udało się wyodrębnić klatek z wideo")

        frames = frames[:5]
        all_hazards: List[Dict[str, Any]] = []
        all_non_comp: List[str] = []
        all_rec: List[str] = []
        all_clauses: Set[str] = set()
        scores: List[int] = []
        not_workplace_count = 0
        first_img_b64 = ""

        for idx, frame_path in enumerate(frames):
            with open(frame_path, "rb") as fp:
                frame_b64 = base64.b64encode(fp.read()).decode()
            if idx == 0:
                first_img_b64 = frame_b64

            prompt = f"""Ekspert BHP audytuje klatkę #{idx+1} z nagrania wideo zgodnie z normą {norm}.
Jeśli klatka NIE przedstawia środowiska pracy zwróć {{"not_workplace":true}}.
Inaczej zwróć czysty JSON:
{{"not_workplace":false,"compliance_score":0-100,"status":"Zgodne|Częściowo zgodne|Niezgodne",
"risk_level":"niskie|średnie|wysokie|krytyczne",
"hazards":[{{"name":"...","severity":"..."}}],
"non_compliances":["..."],"recommendations":["..."],"iso_clauses":["..."]}}"""

            try:
                async with httpx.AsyncClient(timeout=600.0) as client:
                    resp = await client.post(
                        f"{OLLAMA_URL}/api/generate",
                        json={
                            "model": OLLAMA_MODEL,
                            "prompt": prompt,
                            "images": [frame_b64],
                            "stream": False,
                            "format": "json",
                            "options": {"temperature": 0.1, "num_predict": 512},
                        },
                    )
                if resp.status_code!= 200:
                    logger.warning(f"Frame {idx+1} failed: {resp.status_code} {resp.text}")
                    continue

                raw = resp.json().get("response", "").strip()
                cleaned = raw.strip()
                for tag in ("```json", "```"):
                    if cleaned.startswith(tag):
                        cleaned = cleaned[len(tag):].strip()
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3].strip()
                r = json.loads(cleaned)
            except Exception as e:
                logger.warning(f"Frame {idx+1} error: {e}")
                continue

            if r.get("not_workplace"):
                not_workplace_count += 1
                continue

            scores.append(r.get("compliance_score", 50))
            all_hazards.extend(r.get("hazards", []))
            all_non_comp.extend(r.get("non_compliances", []))
            all_rec.extend(r.get("recommendations", []))
            all_clauses.update(r.get("iso_clauses", []))

        if not_workplace_count == len(frames):
            return {"not_workplace": True}

        avg_score = int(sum(scores) / max(len(scores), 1))
        risk_level = (
            "niskie" if avg_score >= 80
            else "średnie" if avg_score >= 60
            else "wysokie" if avg_score >= 40
            else "krytyczne"
        )
        status = (
            "Zgodne" if avg_score >= 80
            else "Częściowo zgodne" if avg_score >= 50
            else "Niezgodne"
        )

        seen_h: Set[str] = set()
        unique_hazards = []
        for h in all_hazards:
            k = h.get("name", "")
            if k not in seen_h:
                seen_h.add(k)
                unique_hazards.append(h)
        unique_hazards = unique_hazards[:6]

        fac_id = int(facility_id) if facility_id and facility_id.isdigit() else None

        conn = None
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO audits
                   (user_id, facility_id, norm, compliance_score, status, risk_level,
                    hazards, non_compliances, recommendations, iso_clauses, image_base64)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (
                    user_id,
                    fac_id,
                    norm,
                    avg_score,
                    status,
                    risk_level,
                    json.dumps(unique_hazards[:4]),
                    json.dumps(list(dict.fromkeys(all_non_comp))[:5]),
                    json.dumps(list(dict.fromkeys(all_rec))[:5]),
                    json.dumps(list(all_clauses)),
                    first_img_b64,
                ),
            )
            audit_id = cur.fetchone()["id"]
            conn.commit()
            return {
                "id": audit_id,
                "not_workplace": False,
                "compliance_score": avg_score,
                "status": status,
                "risk_level": risk_level,
                "hazards": unique_hazards[:4],
                "non_compliances": list(dict.fromkeys(all_non_comp))[:5],
                "recommendations": list(dict.fromkeys(all_rec))[:5],
                "iso_clauses": list(all_clauses),
                "image_base64": first_img_b64,
            }
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"DB error during video audit save: {e}")
            raise HTTPException(status_code=500, detail="Błąd zapisu audytu wideo")
        finally:
            if conn:
                cur.close()
                conn.close()

@app.patch("/api/audit/{audit_id}/notes")
async def update_notes(audit_id: int, notes: str = Form(...)):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE audits SET user_notes = %s WHERE id = %s RETURNING id",
            (notes, audit_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Nie znaleziono audytu")
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Update notes error: {e}")
        raise HTTPException(status_code=500, detail="Błąd aktualizacji notatek")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.get("/api/history/{user_id}")
async def get_history(
    user_id: str,
    facility_id: Optional[int] = Query(None),
    risk_level: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        query = """
            SELECT a.id, a.created_at, a.norm, a.status, a.compliance_score,
                   a.risk_level, a.facility_id, f.name AS facility_name
            FROM audits a
            LEFT JOIN facilities f ON f.id = a.facility_id
            WHERE a.user_id = %s
        """
        params: List[Any] = [user_id]

        if facility_id:
            query += " AND a.facility_id = %s"
            params.append(facility_id)
        if risk_level:
            query += " AND a.risk_level = %s"
            params.append(risk_level)
        if date_from:
            query += " AND a.created_at >= %s"
            params.append(date_from)
        if date_to:
            query += " AND a.created_at <= %s"
            params.append(f"{date_to} 23:59:59")

        query += " ORDER BY a.created_at DESC LIMIT 100"
        cur.execute(query, params)
        return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Get history error: {e}")
        raise HTTPException(status_code=500, detail="Błąd pobierania historii")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.get("/api/audit/{audit_id}")
async def get_audit(audit_id: int):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """SELECT a.*, f.name AS facility_name, f.logo_base64 AS facility_logo
               FROM audits a
               LEFT JOIN facilities f ON f.id = a.facility_id
               WHERE a.id = %s""",
            (audit_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Audit not found")
        return dict(row)
    except Exception as e:
        logger.error(f"Get audit error: {e}")
        raise HTTPException(status_code=500, detail="Błąd pobierania audytu")
    finally:
        if conn:
            cur.close()
            conn.close()

@app.get("/health")
async def health():
    return {"status": "ok", "model": OLLAMA_MODEL}