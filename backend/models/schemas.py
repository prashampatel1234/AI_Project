"""
backend/models/schemas.py
Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    """Incoming chat request payload."""
    message: str = Field(..., min_length=1, description="User's message to the AI assistant")


class ChatResponse(BaseModel):
    """Response payload returned to the client."""
    reply: str = Field(..., description="AI assistant's response")
    tool_used: Optional[str] = Field(None, description="Name of the tool used, if any")
    sources: Optional[str] = Field(None, description="Source info if web search was performed")


class HealthResponse(BaseModel):
    """Health-check endpoint response."""
    status: str
    message: str
