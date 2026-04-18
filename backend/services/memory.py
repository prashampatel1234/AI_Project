"""
backend/services/memory.py
Handles persistent chat history stored in memory.json.
"""

import json
import os
from datetime import datetime
from typing import List, Dict

# Path to the memory file (relative to backend directory)
MEMORY_FILE = os.path.join(os.path.dirname(__file__), "..", "memory.json")


def load_memory() -> List[Dict]:
    """
    Load chat history from memory.json.
    Returns a list of message dicts: [{"role": ..., "content": ...}, ...]
    """
    if not os.path.exists(MEMORY_FILE):
        return []
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError) as e:
        print(f"[Memory] Warning: Could not load memory.json — {e}")
        return []


def save_memory(history: List[Dict]) -> None:
    """
    Persist the full chat history list to memory.json.
    """
    try:
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"[Memory] Error: Could not save memory.json — {e}")


def add_to_memory(role: str, content: str) -> List[Dict]:
    """
    Append a single message to the stored history.

    Args:
        role    : "user" | "assistant" | "system"
        content : The message text

    Returns:
        The updated history list.
    """
    history = load_memory()
    history.append({
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })
    save_memory(history)
    return history


def get_conversation_messages(system_prompt: str) -> List[Dict]:
    """
    Build the messages list that OpenAI expects:
    [system_prompt, ...history without timestamps].
    """
    history = load_memory()
    messages = [{"role": "system", "content": system_prompt}]
    for entry in history:
        messages.append({"role": entry["role"], "content": entry["content"]})
    return messages


def clear_memory() -> None:
    """Wipe all stored chat history."""
    save_memory([])
    print("[Memory] Chat history cleared.")
