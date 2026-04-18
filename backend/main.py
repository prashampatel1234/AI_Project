"""
backend/main.py
Entry point for the AI Student Assistant FastAPI application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes.chat import router as chat_router
from models.schemas import HealthResponse

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Student Assistant API",
    description=(
        "A FastAPI backend that uses Groq (Llama3-70b) to help students learn, "
        "with integrated calculator and web-search tools and persistent memory."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow React frontend (adjust origins in production)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(chat_router)

# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------

@app.get(
    "/",
    response_model=HealthResponse,
    summary="Root / health check",
    tags=["Health"],
)
async def root():
    """Health-check endpoint — confirms the server is running."""
    return HealthResponse(
        status="ok",
        message="AI Student Assistant API is live 🎓. Visit /docs for the API explorer.",
    )

# ---------------------------------------------------------------------------
# Run directly with `python main.py` (alternative to uvicorn CLI)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)