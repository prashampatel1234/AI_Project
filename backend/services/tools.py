"""
backend/services/tools.py
Implements the Calculator and Web Search tools.
"""

import math
import requests
import os
from typing import Dict


# ---------------------------------------------------------------------------
# CALCULATOR TOOL
# ---------------------------------------------------------------------------

def calculator(expression: str) -> Dict:
    """
    Safely evaluate a mathematical expression and return the result.

    Supports: +, -, *, /, **, sqrt, sin, cos, tan, log, abs, round, etc.

    Args:
        expression: A string math expression, e.g. "2 ** 10 + sqrt(16)"

    Returns:
        {"result": <value>, "expression": <original>} or {"error": <msg>}
    """
    # Strip away the keyword "calculate" if the user included it
    cleaned = (
        expression
        .lower()
        .replace("calculate", "")
        .replace("what is", "")
        .replace("solve", "")
        .strip()
    )

    # Allowed math names (no builtins, no __import__, etc.)
    safe_globals = {
        "__builtins__": {},
        "abs": abs,
        "round": round,
        "sqrt": math.sqrt,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "log": math.log,
        "log10": math.log10,
        "log2": math.log2,
        "exp": math.exp,
        "pi": math.pi,
        "e": math.e,
        "pow": math.pow,
        "ceil": math.ceil,
        "floor": math.floor,
        "factorial": math.factorial,
    }

    try:
        result = eval(cleaned, safe_globals)  # noqa: S307
        return {
            "tool": "calculator",
            "expression": cleaned,
            "result": result,
        }
    except ZeroDivisionError:
        return {"tool": "calculator", "error": "Division by zero is undefined."}
    except Exception as exc:
        return {"tool": "calculator", "error": f"Could not evaluate: {exc}"}


# ---------------------------------------------------------------------------
# WEB SEARCH TOOL
# ---------------------------------------------------------------------------

def web_search(query: str) -> Dict:
    """
    Perform a lightweight web search using the DuckDuckGo Instant Answer API
    (no API key required).  Falls back to a mock response if the request fails.

    Args:
        query: The search query string.

    Returns:
        {"tool": "web_search", "query": ..., "answer": ..., "url": ...}
    """
    # Strip keyword
    cleaned_query = (
        query
        .lower()
        .replace("search", "")
        .replace("look up", "")
        .replace("find", "")
        .strip()
    )

    try:
        response = requests.get(
            "https://api.duckduckgo.com/",
            params={
                "q": cleaned_query,
                "format": "json",
                "no_redirect": "1",
                "no_html": "1",
                "skip_disambig": "1",
            },
            timeout=8,
            headers={"User-Agent": "AI-Student-Assistant/1.0"},
        )
        response.raise_for_status()
        data = response.json()

        abstract = data.get("AbstractText") or data.get("Answer") or ""
        source_url = data.get("AbstractURL") or data.get("AbstractSource") or ""

        if abstract:
            return {
                "tool": "web_search",
                "query": cleaned_query,
                "answer": abstract,
                "url": source_url,
            }

        # DuckDuckGo returned nothing useful — try RelatedTopics
        topics = data.get("RelatedTopics", [])
        snippets = []
        for topic in topics[:3]:
            if isinstance(topic, dict) and "Text" in topic:
                snippets.append(topic["Text"])

        if snippets:
            return {
                "tool": "web_search",
                "query": cleaned_query,
                "answer": " | ".join(snippets),
                "url": source_url or "https://duckduckgo.com/?q=" + cleaned_query.replace(" ", "+"),
            }

        # Final fallback — still provide a useful response
        return {
            "tool": "web_search",
            "query": cleaned_query,
            "answer": (
                f"I searched for '{cleaned_query}' but couldn't retrieve a direct answer. "
                "Please try a more specific query or visit a search engine directly."
            ),
            "url": "https://duckduckgo.com/?q=" + cleaned_query.replace(" ", "+"),
        }

    except requests.RequestException as exc:
        return {
            "tool": "web_search",
            "query": cleaned_query,
            "answer": f"Web search is temporarily unavailable ({exc}). Here's what I know from my training data.",
            "url": "",
        }


# ---------------------------------------------------------------------------
# TOOL DISPATCHER
# ---------------------------------------------------------------------------

def dispatch_tool(user_message: str) -> Dict | None:
    """
    Inspect the user message and route to the correct tool.

    Rules:
      - Contains "calculate" → use calculator
      - Contains "search"    → use web search

    Returns the tool result dict, or None if no tool is needed.
    """
    lower = user_message.lower()

    if "calculate" in lower:
        return calculator(user_message)

    if "search" in lower:
        return web_search(user_message)

    return None
