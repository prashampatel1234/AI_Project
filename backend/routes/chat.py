"""
backend/routes/chat.py
Chat API router — exposes POST /chat and GET /chat/history.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from models.schemas import ChatRequest, ChatResponse
from services.llm import chat_with_ai
from services.memory import load_memory, clear_memory

router = APIRouter(prefix="/chat", tags=["Chat"])


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=ChatResponse,
    summary="Send a message to the AI Student Assistant",
    status_code=status.HTTP_200_OK,
)
async def chat(request: ChatRequest):
    """
    Accept a user message and return the AI assistant's reply.

    - Dispatches to **calculator** tool if message contains "calculate".
    - Dispatches to **web search** tool if message contains "search".
    - Otherwise calls the LLM directly with full chat history as context.
    """
    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    try:
        result = chat_with_ai(request.message)
    except EnvironmentError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {exc}",
        )

    return ChatResponse(
        reply=result["reply"],
        tool_used=result.get("tool_used"),
        sources=result.get("sources"),
    )


# ---------------------------------------------------------------------------
# GET /chat/history
# ---------------------------------------------------------------------------

@router.get(
    "/history",
    summary="Retrieve full chat history",
    status_code=status.HTTP_200_OK,
)
async def get_history():
    """Return the full persisted chat history from memory.json."""
    history = load_memory()
    return JSONResponse(content={"history": history, "count": len(history)})


# ---------------------------------------------------------------------------
# DELETE /chat/history
# ---------------------------------------------------------------------------

@router.delete(
    "/history",
    summary="Clear all chat history",
    status_code=status.HTTP_200_OK,
)
async def delete_history():
    """Wipe the memory.json chat history."""
    clear_memory()
    return JSONResponse(content={"message": "Chat history cleared successfully."})
