import os
from dotenv import load_dotenv
import base64
import tempfile

# Load environment variables from .env file
load_dotenv()
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import json

# PDF extraction
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = FastAPI(title="Student AI Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Models
TEXT_MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"  # Groq vision model

SYSTEM_PROMPT = """You are an expert Student AI Assistant. You help students:
- Understand complex topics simply and clearly
- Analyze documents, PDFs, and images they upload
- Answer questions about course material
- Explain concepts step-by-step
- Help with assignments and research

When analyzing uploaded files:
- For PDFs: summarize key points, answer questions about the content
- For images: describe what you see and answer questions about it
- Always be encouraging, educational, and thorough

Use markdown formatting in your responses for better readability."""


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    stream: bool = True


def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    if not PDF_SUPPORT:
        return "[PDF extraction not available - install PyMuPDF: pip install pymupdf]"
    
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts = []
        for page_num, page in enumerate(doc, 1):
            text = page.get_text()
            if text.strip():
                text_parts.append(f"--- Page {page_num} ---\n{text.strip()}")
        doc.close()
        
        if not text_parts:
            return "[PDF appears to contain only images or no extractable text]"
        
        full_text = "\n\n".join(text_parts)
        # Limit to ~12000 chars to stay within context
        if len(full_text) > 12000:
            full_text = full_text[:12000] + "\n\n[... document truncated for length ...]"
        return full_text
    except Exception as e:
        return f"[Error extracting PDF: {str(e)}]"


@app.get("/health")
async def health():
    return {"status": "ok", "pdf_support": PDF_SUPPORT}


@app.post("/chat")
async def chat(request: ChatRequest):
    """Text-only streaming chat endpoint."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in request.messages]

    async def stream_response():
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": TEXT_MODEL,
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.7,
                    "max_tokens": 2048,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'content': delta})}\n\n"
                        except Exception:
                            continue

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@app.post("/chat-with-file")
async def chat_with_file(
    message: str = Form(...),
    history: str = Form(default="[]"),
    file: Optional[UploadFile] = File(None),
):
    """Chat endpoint supporting PDF and image uploads."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    parsed_history = json.loads(history)
    
    # Build base messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add history
    for h in parsed_history:
        messages.append({"role": h["role"], "content": h["content"]})

    use_vision = False
    user_content = message

    if file:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_file"
        ext = Path(filename).suffix.lower()

        if ext == ".pdf":
            # Extract PDF text and inject into context
            pdf_text = extract_pdf_text(file_bytes)
            user_content = (
                f"{message}\n\n"
                f"[Attached PDF: {filename}]\n\n"
                f"PDF CONTENT:\n{pdf_text}"
            )
            messages.append({"role": "user", "content": user_content})
            model = TEXT_MODEL

        elif ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
            # Vision: send image as base64
            b64_image = base64.b64encode(file_bytes).decode()
            media_type_map = {
                ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"
            }
            media_type = media_type_map.get(ext, "image/jpeg")
            
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{b64_image}"
                        }
                    },
                    {"type": "text", "text": message}
                ]
            })
            use_vision = True
            model = VISION_MODEL
        else:
            # Try reading as text
            try:
                text_content = file_bytes.decode("utf-8")
                user_content = f"{message}\n\n[Attached file: {filename}]\n\n{text_content[:8000]}"
            except Exception:
                user_content = f"{message}\n\n[Attached file: {filename} - binary file, cannot read as text]"
            messages.append({"role": "user", "content": user_content})
            model = TEXT_MODEL
    else:
        messages.append({"role": "user", "content": user_content})
        model = TEXT_MODEL

    async def stream_response():
        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream(
                "POST",
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.7,
                    "max_tokens": 2048,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'content': delta})}\n\n"
                        except Exception:
                            continue

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@app.post("/upload-analyze")
async def upload_analyze(
    file: UploadFile = File(...),
    question: str = Form(default="Please analyze and summarize this file."),
):
    """Quick file analysis endpoint (non-streaming)."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    
    file_bytes = await file.read()
    filename = file.filename or "file"
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        pdf_text = extract_pdf_text(file_bytes)
        content = f"{question}\n\nPDF: {filename}\n\nCONTENT:\n{pdf_text}"
        model = TEXT_MODEL
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content}
        ]
    elif ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        b64_image = base64.b64encode(file_bytes).decode()
        media_type_map = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"
        }
        media_type = media_type_map.get(ext, "image/jpeg")
        model = VISION_MODEL
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64_image}"}},
                {"type": "text", "text": question}
            ]}
        ]
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(
            f"{GROQ_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "temperature": 0.7, "max_tokens": 2048}
        )
        data = response.json()
        
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"]["message"])
    
    return {"analysis": data["choices"][0]["message"]["content"], "filename": filename}
