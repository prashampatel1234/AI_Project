"""
backend/services/llm.py
Groq LLM integration - drop-in replacement for Gemini
"""

import os
from typing import Dict, List, Optional

from groq import Groq
from dotenv import load_dotenv

from services.memory import load_memory, add_to_memory
from services.tools import dispatch_tool

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
MODEL_NAME: str = os.getenv("GROQ_MODEL", "llama3-70b-8192")

SYSTEM_PROMPT: str = (
    "You are an AI Student Assistant who explains concepts step-by-step. "
    "Break down complex topics into simple, easy-to-understand parts. "
    "If a tool result is provided in the conversation, incorporate it naturally into your explanation. "
    "Be encouraging, precise, and educational."
)

# ---------------------------------------------------------------------------
# Validate API key at startup — fail fast with a clear message
# ---------------------------------------------------------------------------

if not GROQ_API_KEY:
    raise EnvironmentError(
        "\n\n❌ GROQ_API_KEY is not set!\n"
        "Steps to fix:\n"
        "  1. Open backend/.env\n"
        "  2. Add: GROQ_API_KEY=your_key_here\n"
        "  3. Get your key at: https://console.groq.com\n"
        "  4. Make sure you run uvicorn from inside the backend/ folder.\n"
    )

client = Groq(api_key=GROQ_API_KEY)

# ---------------------------------------------------------------------------
# Helper: convert history to Groq message format
# ---------------------------------------------------------------------------

def _build_groq_history(raw_history: List[Dict]) -> List[Dict]:
    """
    Convert memory.json entries into Groq message format.
    memory.json roles : "user" | "assistant"
    Groq roles        : "user" | "assistant"  ← same, no mapping needed
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for entry in raw_history:
        role = entry.get("role", "user")
        content = entry.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    return messages

# ---------------------------------------------------------------------------
# Core chat function
# ---------------------------------------------------------------------------

def chat_with_ai(user_message: str) -> Dict:
    """
    Processes a user message, optionally dispatches a tool,
    calls Groq, persists memory, and returns the reply.
    """
    tool_name: Optional[str] = None
    sources: Optional[str] = None
    augmented_message = user_message

    # --- Step 1: Tool dispatch ---
    tool_result = dispatch_tool(user_message)
    if tool_result:
        tool_name = tool_result.get("tool")

        if tool_name == "calculator":
            if "error" in tool_result:
                augmented_message = (
                    f"{user_message}\n\n"
                    f"[Calculator Error: {tool_result['error']}]"
                )
            else:
                augmented_message = (
                    f"{user_message}\n\n"
                    f"[Calculator Result: {tool_result['expression']} = {tool_result['result']}]"
                )

        elif tool_name == "web_search":
            sources = tool_result.get("url", "")
            augmented_message = (
                f"{user_message}\n\n"
                f"[Web Search Result for '{tool_result['query']}': {tool_result.get('answer', '')}]"
            )

    # --- Step 2: Build messages (history + new user message) ---
    raw_history = load_memory()
    messages = _build_groq_history(raw_history)
    messages.append({"role": "user", "content": augmented_message})

    # --- Step 3: Call Groq API ---
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content.strip()

    except Exception as exc:
        reply = f"⚠️ Groq API error: {exc}"

    # --- Step 4: Persist to memory ---
    add_to_memory("user", user_message)
    add_to_memory("assistant", reply)

    return {
        "reply": reply,
        "tool_used": tool_name,
        "sources": sources if sources else None,
    }