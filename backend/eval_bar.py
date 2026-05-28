"""
Eval Bar — 5-dimension scoring system.

Dimensions:
  problem_clarity     (25%) — Is the actual problem understood?
  scale_constraints   (20%) — Users, data volume, budget, team size
  tech_context        (20%) — Existing stack, non-negotiables, flexibility
  success_definition  (20%) — What does "done" look like, measurably?
  risk_awareness      (15%) — What could kill this project?
"""

WEIGHTS = {
    "problem_clarity": 0.25,
    "scale_constraints": 0.20,
    "tech_context": 0.20,
    "success_definition": 0.20,
    "risk_awareness": 0.15,
}

PHASE_THRESHOLDS = {
    "intake": 0.0,
    "debate": 0.40,
    "stress_test": 0.70,
    "masterplan": 0.80,
}


def compute_total_score(scores: dict) -> float:
    """Weighted average of all 5 dimensions."""
    return sum(scores[dim] * weight for dim, weight in WEIGHTS.items())


def apply_delta(current_scores: dict, delta: dict) -> dict:
    """
    Apply an eval delta from LLM response.
    Clamps each score to [0.0, 1.0].
    """
    updated = dict(current_scores)
    for dim, increment in delta.items():
        if dim in updated:
            updated[dim] = min(1.0, max(0.0, updated[dim] + float(increment)))
    return updated


def get_phase(total_score: float) -> str:
    """Determine which phase we're in based on total score."""
    if total_score >= PHASE_THRESHOLDS["masterplan"]:
        return "masterplan"
    elif total_score >= PHASE_THRESHOLDS["stress_test"]:
        return "stress_test"
    elif total_score >= PHASE_THRESHOLDS["debate"]:
        return "debate"
    else:
        return "intake"


def get_score_explanation(scores: dict) -> list[dict]:
    """Return human-readable explanation for each dimension's score."""
    explanations = []

    dimension_info = {
        "problem_clarity": {
            "label": "Problem Clarity",
            "weight": "25%",
            "low": "What problem are you actually solving? Not the feature — the underlying pain.",
            "mid": "Problem understood. Now articulate it as a user would, not as a developer.",
            "high": "Clear. I understand the problem, its context, and why existing solutions fall short.",
        },
        "scale_constraints": {
            "label": "Scale & Constraints",
            "weight": "20%",
            "low": "How many users? What's your budget? What's your team size and timeline?",
            "mid": "Basic constraints captured. Need more detail on infrastructure budget and data volume.",
            "high": "Constraints fully defined. I can make concrete architectural tradeoffs now.",
        },
        "tech_context": {
            "label": "Tech Context",
            "weight": "20%",
            "low": "What's your existing stack? What are your non-negotiables vs flexibility zones?",
            "mid": "Stack known. What integrations must you support? Any compliance requirements?",
            "high": "Tech context complete. I know what you must keep, what you can change, and what you're comfortable with.",
        },
        "success_definition": {
            "label": "Success Definition",
            "weight": "20%",
            "low": "What does 'done and working' look like? Give me a measurable outcome, not 'users love it'.",
            "mid": "Rough success criteria exist. Make them time-bound and quantified.",
            "high": "Success is clearly defined. I can tell you whether each architectural decision serves it.",
        },
        "risk_awareness": {
            "label": "Risk Awareness",
            "weight": "15%",
            "low": "What's been tried before? What could kill this project in month 3?",
            "mid": "Some risks identified. Haven't stress-tested the critical path failure modes yet.",
            "high": "Key risks documented with mitigations. Ready to bake these into the architecture.",
        },
    }

    for dim, score in scores.items():
        info = dimension_info.get(dim, {})
        if score < 0.35:
            status = info.get("low", "")
        elif score < 0.70:
            status = info.get("mid", "")
        else:
            status = info.get("high", "")

        explanations.append({
            "dimension": dim,
            "label": info.get("label", dim),
            "weight": info.get("weight", ""),
            "score": score,
            "status_text": status,
        })

    return explanations


def get_refusal_message(total_score: float) -> str | None:
    """
    Return a refusal message if score is too low to generate output.
    Returns None if score is acceptable.
    """
    if total_score < 0.40:
        return (
            "Keep going — answer the questions above to unlock your full analysis. "
            "Each specific answer moves the bar closer to your masterplan."
        )
    return None
