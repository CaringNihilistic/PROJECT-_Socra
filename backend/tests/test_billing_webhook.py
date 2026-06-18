import hashlib
import hmac

import pytest

from api.routes.billing import _verify_signature

SECRET = "test_webhook_secret"
PAYLOAD = b'{"event":"payment_link.paid","payload":{"payment_link":{"entity":{"status":"paid"}}}}'


def _sign(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def test_valid_signature_passes():
    sig = _sign(PAYLOAD, SECRET)
    assert _verify_signature(PAYLOAD, sig, SECRET) is True


def test_tampered_payload_fails():
    sig = _sign(PAYLOAD, SECRET)
    tampered_payload = PAYLOAD.replace(b"paid", b"free")
    assert _verify_signature(tampered_payload, sig, SECRET) is False


def test_tampered_signature_fails():
    sig = _sign(PAYLOAD, SECRET)
    tampered_sig = sig[:-1] + ("0" if sig[-1] != "0" else "1")
    assert _verify_signature(PAYLOAD, tampered_sig, SECRET) is False


def test_wrong_secret_fails():
    sig = _sign(PAYLOAD, "a_different_secret")
    assert _verify_signature(PAYLOAD, sig, SECRET) is False


def test_empty_signature_fails():
    assert _verify_signature(PAYLOAD, "", SECRET) is False


def test_signature_is_not_substring_match():
    # Ensures comparison is exact, not a prefix/substring check.
    sig = _sign(PAYLOAD, SECRET)
    assert _verify_signature(PAYLOAD, sig[:-2], SECRET) is False
