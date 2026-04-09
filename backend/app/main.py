import base64
import io
import json
import re
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
import ollama

app = FastAPI(
    title="Smart Safety Auditor API v2.0 - Local Ollama",
    description="Backend dla analizy BHP z użyciem lokalnego modelu Gemma3:4b",
    version="2.0.0"
)

# Inicjalizacja klienta Ollama
client = ollama.Client(host='http://localhost:11434')

MODEL_NAME = "gemma3:4b"

PROMPT_BHP = """Jesteś ekspertem BHP na budowie. Przeanalizuj zdjęcie i oceń zgodność z przepisami bezpieczeństwa.
Zwróć WYŁĄCZNIE poprawny JSON w formacie:
{
  "naruszenia": [
    {
      "opis": "krótki opis naruszenia",
      "powaga": "niska/srednia/wysoka/krytyczna",
      "przepis": "odniesienie do przepisu BHP jeśli znasz"
    }
  ],
  "zalecenia": ["lista zaleceń"],
  "ocena_ogolna": "krótka ocena słowna",
  "poziom_zagrozenia": "niski/sredni/wysoki"
}
Jeśli nie ma naruszeń, zwróć pustą listę w "naruszenia". Nie dodawaj żadnego tekstu poza JSON, nie używaj znaczników markdown ```."""

@app.get("/")
def read_root():
    return {"status": "Smart Safety Auditor API działa", "model": MODEL_NAME}

@app.get("/debug/models")
def debug_models():
    """Sprawdza połączenie z Ollamą i listuje dostępne modele"""
    try:
        models = client.list()
        return {
            "status": "Połączono z Ollama",
            "host": "http://localhost:11434",
            "dostepne_modele": [m['name'] for m in models['models']]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brak połączenia z Ollama: {str(e)}")

@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Endpoint przyjmujący zdjęcie i analizujący je przy pomocy lokalnej Gemma3:4b przez Ollama.
    Obsługuje jpg, png, webp, bmp - konwertuje wszystko do JPEG.
    """
    
    # 1. Walidacja typu pliku
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Plik musi być obrazem")
    
    try:
        # 2. Wczytaj obraz i konwertuj do RGB JPEG
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=95)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Nie można przetworzyć obrazu: {str(e)}")
    
    # 3. Wyślij do Ollamy
    try:
        response = client.chat(
            model=MODEL_NAME,
            messages=[{
                'role': 'user',
                'content': PROMPT_BHP,
                'images': [img_str]
            }]
        )
        
        raw_output = response['message']['content'].strip()
        
        # 4. Usuń znaczniki markdown ```json ``` jak Gemma je doda
        raw_output = re.sub(r'^```json\s*', '', raw_output)
        raw_output = re.sub(r'^```\s*', '', raw_output)
        raw_output = re.sub(r'\s*```$', '', raw_output)
        raw_output = raw_output.strip()
        
        # 5. Bezpieczne parsowanie JSON
        try:
            gemma_result = json.loads(raw_output)
        except json.JSONDecodeError:
            gemma_result = {
                "error": "Model nie zwrócił poprawnego JSON",
                "raw_output": raw_output,
                "uwaga": "Sprawdź prompt lub model"
            }
        
        return JSONResponse(content=gemma_result)
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Błąd podczas komunikacji z Ollama: {str(e)}"
        )