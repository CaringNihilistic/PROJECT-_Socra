"""Contract tests for the generating prompts.

The frontend splits the masterplan on its ## headings and picks the presenting trainer by
heading words (frontend/src/episode/sections.ts, pixel/cast.ts), so the headings the
synthesis prompt asks for must not drift.
"""
import re

import llm_client as L

# Heading -> trainer, as in frontend/src/pixel/cast.ts trainerForHeading
EXPECTED_HEADINGS = [
    "Chairman's Verdict",  # Kai
    "Tech Stack",  # Dex
    "Phase 1: MVP (Weeks 1-8)",  # Kai
    "Phase 2: Growth (Months 3-9)",  # Kai
    "Phase 3: Scale/Moat (Months 9-18)",  # Kai
    "Risk Register",  # Marin
    "First 3 Files",  # Dex
]
SECTION_WORDS = re.compile(r"verdict|tech stack|phase|mvp|growth|moat|risk|files", re.I)


def test_synthesis_prompt_asks_for_the_headings_the_frontend_splits_on():
    prompt = L._build_synthesis_prompt([{"title": "The Banker", "content": "- **Math fails.** CAC is $30."}])
    headings = re.findall(r"^## (.+)$", prompt, re.M)
    assert headings == EXPECTED_HEADINGS
    assert all(SECTION_WORDS.search(h) for h in headings)


def test_synthesis_prompt_is_crisp_and_bold():
    prompt = L._build_synthesis_prompt([])
    assert "AT MOST 450 WORDS" in prompt
    assert "in bold" in prompt
    # the hard limits come last, where the model weighs them most
    assert prompt.rstrip().endswith("never drop the Risk Register or First 3 Files.")


def test_every_council_seat_uses_the_shared_crisp_format():
    assert len(L.COUNCIL_SEATS) == 5
    for seat in L.COUNCIL_SEATS:
        assert seat["prompt"].endswith(L.AGENT_FORMAT), seat["key"]
    assert "Exactly 4 bullets" in L.AGENT_FORMAT
    assert "**bold verdict" in L.AGENT_FORMAT


def test_chat_prompt_caps_length_and_bolds_key_terms():
    prompt = L._build_streaming_system_prompt({k: 0.3 for k in [
        "problem_clarity", "scale_constraints", "tech_context", "success_definition", "risk_awareness",
    ]})
    assert "at most 60 words" in prompt
    assert "**double asterisks**" in prompt


def test_groq_keeps_a_larger_synthesis_budget_than_anthropic():
    # Groq's reasoning models spend hidden thinking from max_tokens
    assert L.GROQ_SYNTHESIS_MAX_TOKENS > L.SYNTHESIS_MAX_TOKENS >= 1500


def test_opening_question_prompt_is_crisp_too():
    # Session creation asks the first question through call_architect_llm, a separate prompt
    import inspect
    src = inspect.getsource(L.call_architect_llm)
    assert "At most 60 words" in src
    assert "**double asterisks**" in src


def test_groq_fallback_chat_prompt_is_crisp_too():
    # Used for every chat turn once the Anthropic key is dead or out of credit
    prompt = L._build_groq_conversation_prompt({k: 0.3 for k in [
        "problem_clarity", "scale_constraints", "tech_context", "success_definition", "risk_awareness",
    ]}, 2)
    assert "At most 60 words" in prompt
    assert "**double asterisks**" in prompt
