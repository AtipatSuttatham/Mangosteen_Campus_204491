"""
test ของตัวสุ่มรหัสเข้าร่วม (academics/join_codes.py)
"""

import re

import pytest

from academics.join_codes import (
    JOIN_CODE_ALPHABET,
    JOIN_CODE_LENGTH,
    JOIN_CODE_PATTERN,
    MAX_ATTEMPTS,
    generate_join_code,
    normalize_join_code,
)


def never_taken(_code: str) -> bool:
    """ตัวจำลอง: ไม่มีรหัสใดถูกใช้ (test ไม่ต้องแตะฐานข้อมูล)"""
    return False


def test_codes_use_only_the_allowed_characters() -> None:
    """สุ่ม 500 ครั้ง: ยาว 8 ตัว ใช้เฉพาะตัวที่อนุญาต และไม่มีตัวที่สับสนง่าย"""
    for _ in range(500):
        code = generate_join_code(is_taken=never_taken)
        assert len(code) == JOIN_CODE_LENGTH
        assert set(code) <= set(JOIN_CODE_ALPHABET)
        assert not set(code) & set("0O1IL")


def test_alphabet_matches_database_pattern() -> None:
    """ชุดตัวอักษรในโค้ดกับรูปแบบที่ฐานข้อมูลตรวจต้องตรงกัน (กันแก้ที่เดียวแล้วลืมอีกที่)"""
    assert len(JOIN_CODE_ALPHABET) == 31
    for char in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789":
        allowed_by_db = re.fullmatch(JOIN_CODE_PATTERN, char * JOIN_CODE_LENGTH) is not None
        assert allowed_by_db == (char in JOIN_CODE_ALPHABET), char


def test_codes_are_random() -> None:
    """สุ่ม 200 ครั้งไม่ควรได้รหัสซ้ำกันเลย (31^8 แบบ)"""
    codes = {generate_join_code(is_taken=never_taken) for _ in range(200)}
    assert len(codes) == 200


def test_retries_when_code_is_taken() -> None:
    """สุ่มได้รหัสที่ถูกใช้แล้ว → สุ่มใหม่จนได้รหัสว่าง"""
    seen: list[str] = []

    def taken_twice(code: str) -> bool:
        seen.append(code)
        return len(seen) <= 2

    code = generate_join_code(is_taken=taken_twice)

    assert len(seen) == 3
    assert code == seen[-1]


def test_gives_up_after_max_attempts() -> None:
    """ซ้ำทุกครั้ง (ผิดปกติ) → หยุดหลังลองครบ MAX_ATTEMPTS ครั้ง ไม่วนไม่รู้จบ"""
    calls: list[str] = []

    def always_taken(code: str) -> bool:
        calls.append(code)
        return True

    with pytest.raises(RuntimeError):
        generate_join_code(is_taken=always_taken)
    assert len(calls) == MAX_ATTEMPTS


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(" k7q2xm9a ", "K7Q2XM9A"), ("K7Q2XM9A", "K7Q2XM9A"), ("k7Q2xM9a\n", "K7Q2XM9A")],
)
def test_normalize_join_code(raw: str, expected: str) -> None:
    """รหัสที่ผู้เรียนกรอก: ตัดช่องว่าง + ตัวพิมพ์ใหญ่"""
    assert normalize_join_code(raw) == expected
