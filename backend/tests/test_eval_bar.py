import pytest

from eval_bar import (
    WEIGHTS,
    compute_total_score,
    apply_delta,
    get_phase,
    get_score_explanation,
    get_refusal_message,
)

ZERO_SCORES = {dim: 0.0 for dim in WEIGHTS}
FULL_SCORES = {dim: 1.0 for dim in WEIGHTS}


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_compute_total_score_all_zero():
    assert compute_total_score(ZERO_SCORES) == 0.0


def test_compute_total_score_all_full():
    assert compute_total_score(FULL_SCORES) == pytest.approx(1.0)


def test_compute_total_score_weighted_average():
    scores = dict(ZERO_SCORES)
    scores["problem_clarity"] = 1.0  # 25% weight
    assert compute_total_score(scores) == pytest.approx(0.25)


def test_apply_delta_increments_score():
    updated = apply_delta(ZERO_SCORES, {"problem_clarity": 0.3})
    assert updated["problem_clarity"] == pytest.approx(0.3)


def test_apply_delta_clamps_above_one():
    updated = apply_delta(FULL_SCORES, {"problem_clarity": 0.5})
    assert updated["problem_clarity"] == 1.0


def test_apply_delta_clamps_below_zero():
    updated = apply_delta(ZERO_SCORES, {"problem_clarity": -0.5})
    assert updated["problem_clarity"] == 0.0


def test_apply_delta_ignores_unknown_dimension():
    updated = apply_delta(ZERO_SCORES, {"not_a_real_dimension": 0.9})
    assert "not_a_real_dimension" not in updated
    assert updated == ZERO_SCORES


def test_apply_delta_does_not_mutate_input():
    original = dict(ZERO_SCORES)
    apply_delta(original, {"problem_clarity": 0.5})
    assert original == ZERO_SCORES


@pytest.mark.parametrize(
    "total_score,expected_phase",
    [
        (0.0, "intake"),
        (0.39, "intake"),
        (0.40, "debate"),
        (0.69, "debate"),
        (0.70, "stress_test"),
        (0.79, "stress_test"),
        (0.80, "masterplan"),
        (1.0, "masterplan"),
    ],
)
def test_get_phase_thresholds(total_score, expected_phase):
    assert get_phase(total_score) == expected_phase


def test_get_score_explanation_covers_every_dimension():
    explanations = get_score_explanation(ZERO_SCORES)
    assert len(explanations) == len(ZERO_SCORES)
    assert {e["dimension"] for e in explanations} == set(WEIGHTS)


@pytest.mark.parametrize(
    "score,band",
    [(0.0, "low"), (0.34, "low"), (0.35, "mid"), (0.69, "mid"), (0.70, "high"), (1.0, "high")],
)
def test_get_score_explanation_status_band(score, band):
    scores = {**ZERO_SCORES, "problem_clarity": score}
    explanations = get_score_explanation(scores)
    entry = next(e for e in explanations if e["dimension"] == "problem_clarity")

    low_text = "What problem are you actually solving? Not the feature — the underlying pain."
    mid_text = "Problem understood. Now articulate it as a user would, not as a developer."
    high_text = "Clear. I understand the problem, its context, and why existing solutions fall short."
    expected = {"low": low_text, "mid": mid_text, "high": high_text}[band]

    assert entry["status_text"] == expected


def test_get_refusal_message_below_threshold():
    assert get_refusal_message(0.39) is not None


def test_get_refusal_message_at_threshold_is_none():
    assert get_refusal_message(0.40) is None


def test_get_refusal_message_high_score_is_none():
    assert get_refusal_message(0.95) is None
