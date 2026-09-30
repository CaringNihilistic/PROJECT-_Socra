"""The masterplan stream: Anthropic prefill and the fall-through to Groq.

A fake Anthropic client stands in for the real one (no network, no key needed).
"""
import asyncio
import sys
import types

import pytest

import llm_client as L


class _FakeStream:
    def __init__(self, tokens, fail_before_first):
        self._tokens = tokens
        self._fail = fail_before_first

    async def __aenter__(self):
        if self._fail:
            raise RuntimeError("credit balance is too low")
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    def text_stream(self):
        async def gen():
            for t in self._tokens:
                yield t
        return gen()


def _install_fake_anthropic(monkeypatch, tokens, fail_before_first=False):
    calls = []

    class _Messages:
        def stream(self, **kwargs):
            calls.append(kwargs)
            return _FakeStream(tokens, fail_before_first)

    class AsyncAnthropic:
        def __init__(self, api_key):
            self.messages = _Messages()

    monkeypatch.setitem(sys.modules, "anthropic", types.SimpleNamespace(AsyncAnthropic=AsyncAnthropic))
    monkeypatch.setattr(L.settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(L.settings, "google_api_key", "")
    return calls


async def _collect(system="sys", msgs=None):
    msgs = msgs or [{"role": "user", "content": "STARTUP IDEA: invoices"}]
    return "".join([t async for t in L._stream_synthesis_tokens(system, msgs)])


def test_anthropic_masterplan_starts_from_the_prefilled_heading(monkeypatch):
    calls = _install_fake_anthropic(monkeypatch, ["\n\n**Build it.** The council agreed.", "\n\n## Tech Stack"])
    plan = asyncio.run(_collect())
    # the saved plan includes the prefill, followed by the model's continuation
    assert plan.startswith("## Chairman's Verdict\n\n**Build it.**")
    sent = calls[0]["messages"]
    assert sent[-1] == {"role": "assistant", "content": L.SYNTHESIS_PREFILL}
    assert sent[-2]["role"] == "user"
    assert not L.SYNTHESIS_PREFILL[-1].isspace()  # Anthropic rejects a prefill ending in whitespace


def test_an_anthropic_failure_before_any_text_still_falls_through_to_groq(monkeypatch):
    _install_fake_anthropic(monkeypatch, [], fail_before_first=True)

    async def fake_groq(system, msgs, model=None, max_tokens=None):
        assert max_tokens == L.GROQ_SYNTHESIS_MAX_TOKENS
        yield "## Chairman's Verdict\n\nfrom groq"

    monkeypatch.setattr(L, "_stream_groq_tokens", fake_groq)
    assert asyncio.run(_collect()) == "## Chairman's Verdict\n\nfrom groq"


def test_synthesis_prompt_is_a_fill_in_template():
    prompt = L._build_synthesis_prompt([])
    assert "| Layer | Tool | Why |" in prompt
    assert "| Risk | Mitigation |" in prompt
    assert "add NOTHING before, between or after" in prompt


def test_chat_hard_rules_include_bold():
    prompt = L._build_streaming_system_prompt({k: 0.3 for k in [
        "problem_clarity", "scale_constraints", "tech_context", "success_definition", "risk_awareness",
    ]})
    assert prompt.rstrip().endswith("(bold, not *italics*).")


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q"]))
