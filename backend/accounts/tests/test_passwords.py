"""
test ของตัวสุ่มรหัสชั่วคราว (accounts/passwords.py) และตัวเข้ารหัสแบบเบา (accounts/hashers.py) — ขั้น 2.4
"""

import pytest
from django.contrib.auth.hashers import check_password, get_hasher, make_password
from django.contrib.auth.password_validation import validate_password

from accounts import passwords
from accounts.hashers import TemporaryPasswordHasher
from accounts.models import User
from accounts.passwords import ALPHABET, LENGTH, generate_temporary_password


class TestGenerateTemporaryPassword:
    def test_length_and_alphabet(self) -> None:
        for _ in range(50):
            password = generate_temporary_password()
            assert len(password) == LENGTH
            assert set(password) <= set(ALPHABET)

    def test_alphabet_has_no_confusing_or_formula_characters(self) -> None:
        assert not set("lI1oO0=+-@") & set(ALPHABET)
        assert len(set(ALPHABET)) == 56

    def test_passwords_are_unique(self) -> None:
        assert len({generate_temporary_password() for _ in range(200)}) == 200

    def test_passes_password_validators_for_the_user(self) -> None:
        user = User(email="somchai@example.com", first_name="สมชาย", last_name="ใจดี")
        validate_password(generate_temporary_password(user), user)

    def test_retries_until_validators_pass(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # 2 รอบแรกสุ่มได้ตัวเลขล้วน (ไม่ผ่านกฎ) → ต้องสุ่มใหม่จนได้รหัสที่ผ่าน
        picks = iter(["2"] * 24 + ["a", "B", "3"] * 4)
        monkeypatch.setattr(passwords.secrets, "choice", lambda _alphabet: next(picks))
        assert generate_temporary_password() == "aB3" * 4

    def test_gives_up_after_max_attempts(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(passwords.secrets, "choice", lambda _alphabet: "2")
        with pytest.raises(RuntimeError):
            generate_temporary_password()


class TestTemporaryPasswordHasher:
    def test_registered_but_not_the_default(self) -> None:
        assert get_hasher().algorithm == "pbkdf2_sha256"
        assert get_hasher(TemporaryPasswordHasher.algorithm).iterations == 2_000
        assert TemporaryPasswordHasher.iterations < get_hasher().iterations

    def test_hash_and_check(self) -> None:
        encoded = make_password("aB3aB3aB3aB3", hasher=TemporaryPasswordHasher.algorithm)
        assert encoded.startswith("pbkdf2_sha256_temp$2000$")
        assert check_password("aB3aB3aB3aB3", encoded)
        assert not check_password("wrong-pass-123", encoded)
