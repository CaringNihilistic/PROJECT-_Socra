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


def test_chat_prompt_shows_the_weighted_total_and_never_declares_readiness():
    # A plain average read ~85% while the weighted total (what gates the council) was under
    # 80%: Socra said "Analysis is ready." and nothing followed.
    from eval_bar import compute_total_score
    scores = {"problem_clarity": 0.6, "scale_constraints": 0.95, "tech_context": 0.95,
              "success_definition": 0.95, "risk_awareness": 0.95}
    weighted = compute_total_score(scores)
    plain = sum(scores.values()) / 5
    assert f"{weighted:.0%}" != f"{plain:.0%}"
    for prompt in (L._build_streaming_system_prompt(scores), L._build_groq_conversation_prompt(scores, 2)):
        assert f"{weighted:.0%}" in prompt
    streaming = L._build_streaming_system_prompt(scores)
    assert "Never announce that the analysis is ready" in streaming
    assert "confirming analysis is ready" not in streaming


SCORES = {"problem_clarity": 1.0, "scale_constraints": 0.85, "tech_context": 0.3, "success_definition": 0.7, "risk_awareness": 0.65}


def test_chat_prompts_aim_at_the_weakest_stat_and_forbid_repeats():
    """Socra repeated the acquisition/CAC question four times in a recorded run while tech sat lowest."""
    for prompt in (L._build_streaming_system_prompt(SCORES), L._build_groq_conversation_prompt(SCORES, 4)):
        assert "The weakest stat is tech_context." in prompt
        assert "do not ask about these again: problem_clarity, scale_constraints." in prompt
        assert "Never ask the same thing twice" in prompt
        assert "Every turn must open a topic you have not asked about yet." in prompt


def test_focus_rule_names_nothing_as_covered_at_the_start():
    rule = L._build_focus_rule({k: 0.0 for k in SCORES})
    assert "The weakest stat is problem_clarity." in rule  # ties go to the first stat
    assert "Already covered" not in rule


def test_the_format_example_does_not_plant_a_topic():
    # The old example asked about "day 1" and CAC, and the model echoed it in every session
    prompt = L._build_streaming_system_prompt(SCORES)
    example = prompt.split("OUTPUT FORMAT", 1)[1].split(L.SEPARATOR, 2)[1]
    assert "CAC" not in example
    assert "shows the FORMAT only" in prompt

