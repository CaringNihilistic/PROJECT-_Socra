"""
LangGraph council graph — admin-only parallel pipeline (Phase 1).

Architecture:
  START -> web_research -> agent_finance ─┐
                        -> agent_market  ─┤
                        -> agent_comp   ─┼-> synthesis -> devils_advocate -> END
                        -> agent_tech   ─┤
                        -> agent_risk   ─┘

All 5 agent nodes run in parallel (same LangGraph superstep).
Synthesis waits for all 5 via static edges — LangGraph barrier semantics.

Token streaming uses get_stream_writer() so raw provider streaming
(_stream_synthesis_tokens) runs unchanged inside the node.

Fallback: stub mode and Groq-only paths delegate to the legacy pipeline
rather than duplicating that logic here.
"""
import asyncio
import operator
import logging
from typing import TypedDict, Annotated, Optional

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.config import get_stream_writer

from core.config import settings

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class CouncilState(TypedDict):
    session_id: str
    conversation_history: list[dict]
    # Web research outputs
    web_context: str
    search_queries: list[str]
    # operator.add reducer: each of the 5 agent nodes returns
    # {"agent_reports": [one_report]} and LangGraph concatenates them.
    # This replaces the asyncio.as_completed accumulation in the legacy pipeline.
    agent_reports: Annotated[list[dict], operator.add]
    masterplan: str


# ---------------------------------------------------------------------------
# Nodes — each calls existing llm_client functions unchanged
# ---------------------------------------------------------------------------

async def web_research_node(state: CouncilState) -> dict:
    writer = get_stream_writer()
    from web_search import gather_web_context
    web_context, search_queries = await gather_web_context(state["conversation_history"])
    if search_queries:
        writer({"type": "web_research", "queries": search_queries})
    return {
        "web_context": web_context or "",
        "search_queries": search_queries or [],
    }


def _make_agent_node(agent_cfg: dict):
    """Factory that returns a node coroutine for one specialist agent seat."""
    async def _agent_node(state: CouncilState) -> dict:
        writer = get_stream_writer()
        from llm_client import run_specialist_agent, _build_agent_msgs
        shared_msgs = _build_agent_msgs(
            state["conversation_history"],
            state.get("web_context", ""),
        )
        report = await run_specialist_agent(agent_cfg, shared_msgs)
        writer({"type": "agent_report", "report": report})
        return {"agent_reports": [report]}

    _agent_node.__name__ = f"agent_{agent_cfg['key']}"
    _agent_node.__qualname__ = f"agent_{agent_cfg['key']}"
    return _agent_node


async def synthesis_node(state: CouncilState) -> dict:
    writer = get_stream_writer()
    from llm_client import _build_synthesis_prompt, _build_agent_msgs, _stream_synthesis_tokens
    system = _build_synthesis_prompt(state["agent_reports"])
    msgs = _build_agent_msgs(state["conversation_history"])
    synthesis_text = ""
    try:
        async for token in _stream_synthesis_tokens(system, msgs):
            synthesis_text += token
            writer({"type": "synthesis_token", "delta": token})
    except Exception as exc:
        log.warning("LangGraph synthesis streaming error: %s", exc)
    writer({"type": "synthesis_done", "text": synthesis_text})
    return {"masterplan": synthesis_text}


async def devils_advocate_node(state: CouncilState) -> dict:
    writer = get_stream_writer()
    from llm_client import run_devils_advocate
    masterplan = state.get("masterplan", "")
    if masterplan:
        try:
            devil_report = await run_devils_advocate(
                masterplan, state["conversation_history"]
            )
            writer({"type": "agent_report", "report": devil_report})
        except Exception as exc:
            log.warning("LangGraph devil's advocate error: %s", exc)
    return {}


# ---------------------------------------------------------------------------
# Graph assembly — built once, reused across requests
# ---------------------------------------------------------------------------

_memory = MemorySaver()
_council_app = None


def _build_graph() -> object:
    from llm_client import SPECIALIST_AGENTS

    builder = StateGraph(CouncilState)

    # Nodes
    builder.add_node("web_research", web_research_node)
    for agent_cfg in SPECIALIST_AGENTS:
        node_name = f"agent_{agent_cfg['key']}"
        builder.add_node(node_name, _make_agent_node(agent_cfg))
    builder.add_node("synthesis", synthesis_node)
    builder.add_node("devils_advocate", devils_advocate_node)

    # Edges: START -> web_research -> (all 5 agents in parallel) -> synthesis -> DA -> END
    builder.add_edge(START, "web_research")
    for agent_cfg in SPECIALIST_AGENTS:
        builder.add_edge("web_research", f"agent_{agent_cfg['key']}")
        builder.add_edge(f"agent_{agent_cfg['key']}", "synthesis")
    builder.add_edge("synthesis", "devils_advocate")
    builder.add_edge("devils_advocate", END)

    return builder.compile(checkpointer=_memory)


def get_council_app():
    global _council_app
    if _council_app is None:
        _council_app = _build_graph()
        log.info("LangGraph council graph compiled (MemorySaver, Phase 1)")
    return _council_app


# ---------------------------------------------------------------------------
# Public interface — drop-in replacement for stream_multi_agent_masterplan()
# Yields identical event dicts so the route's SSE mapping is unchanged.
# ---------------------------------------------------------------------------

async def stream_council_graph(
    session_id: str,
    conversation_history: list[dict],
):
    """
    Admin-only LangGraph council pipeline.
    Yields the same event dicts as stream_multi_agent_masterplan():
      {"type": "web_research", "queries": [...]}
      {"type": "agent_report",  "report":  {...}}
      {"type": "synthesis_token", "delta": str}
      {"type": "synthesis_done",  "text":  str}
    Falls back to the legacy pipeline when:
      - STUB_MODE is active
      - No Anthropic / Google API key (Groq-only path — single combined call
        doesn't map cleanly to 5 parallel nodes in Phase 1)
    """
    needs_legacy = settings.is_stub or not (
        settings.anthropic_api_key or settings.google_api_key
    )
    if needs_legacy:
        log.info("LangGraph: falling back to legacy pipeline (stub=%s)", settings.is_stub)
        from llm_client import stream_multi_agent_masterplan
        async for event in stream_multi_agent_masterplan(conversation_history):
            yield event
        return

    log.info("LangGraph council pipeline starting for session %s", session_id)
    app = get_council_app()

    initial_state: CouncilState = {
        "session_id": session_id,
        "conversation_history": conversation_history,
        "web_context": "",
        "search_queries": [],
        "agent_reports": [],
        "masterplan": "",
    }
    config = {"configurable": {"thread_id": session_id}}

    try:
        async for chunk in app.astream(initial_state, config, stream_mode="custom"):
            yield chunk
    except Exception as exc:
        log.error("LangGraph council graph error: %s", exc, exc_info=True)
        raise
