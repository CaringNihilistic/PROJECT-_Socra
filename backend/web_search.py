import asyncio
import httpx
from core.config import settings


async def _tavily_search(query: str, max_results: int = 3) -> list[dict]:
    """Single Tavily search. Returns empty list on any error."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            return resp.json().get("results", [])
    except Exception:
        return []


async def gather_web_context(conversation_history: list[dict]) -> tuple[str, list[str]]:
    """
    Run 2 targeted searches based on the startup idea.
    Returns (formatted_context_string, queries_used).
    Returns ("", []) if TAVILY_API_KEY is not set.
    """
    if not settings.tavily_api_key:
        return "", []

    idea = conversation_history[0]["content"].strip() if conversation_history else ""
    idea_short = idea[:80]

    queries = [
        f"{idea_short} competitors market size funding 2024",
        f"{idea_short} startup regulations risks compliance",
    ]

    results_list = await asyncio.gather(*[_tavily_search(q, max_results=3) for q in queries])

    lines = []
    for results in results_list:
        for r in results:
            title = r.get("title", "").strip()
            content = r.get("content", "").strip()[:250]
            url = r.get("url", "")
            if title and content:
                lines.append(f"- **{title}**: {content} (Source: {url})")

    if not lines:
        return "", queries

    context = "## Live Web Research (cite these sources where relevant)\n" + "\n".join(lines)
    return context, queries
