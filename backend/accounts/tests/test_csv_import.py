"""
test ของส่วนอ่าน/ตรวจไฟล์ CSV สำหรับนำเข้าบัญชี (ขั้น 2.4) — accounts/csv_import.py
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (@example.com)
"""

import codecs

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from accounts.csv_import import decode_csv_bytes, read_csv_upload
from common.exceptions import ApiError

HEADER = "email,student_or_staff_id,first_name,last_name,role"


def upload(content: str | bytes, encoding: str = "utf-8") -> SimpleUploadedFile:
    """ไฟล์ CSV จำลองที่อัปโหลดมา"""
    raw = content.encode(encoding) if isinstance(content, str) else content
    return SimpleUploadedFile("users.csv", raw, content_type="text/csv")


def error_code(content: str | bytes) -> str:
    """อ่านไฟล์แล้วคืนรหัส error ระดับไฟล์ที่ได้"""
    with pytest.raises(ApiError) as error:
        read_csv_upload(upload(content))
    return error.value.get_codes()


# --- การเข้ารหัสภาษา ---


class TestDecode:
    THAI = "สมชาย,ใจดี"

    def test_utf8_without_bom(self) -> None:
        assert decode_csv_bytes(self.THAI.encode("utf-8")) == self.THAI

    def test_utf8_with_bom_is_stripped(self) -> None:
        assert decode_csv_bytes(codecs.BOM_UTF8 + self.THAI.encode("utf-8")) == self.THAI

    def test_tis620_from_thai_excel(self) -> None:
        assert decode_csv_bytes(self.THAI.encode("cp874")) == self.THAI

    def test_cp874_extra_characters(self) -> None:
        # Excel ไทยบันทึกเครื่องหมายคำพูดโค้งเป็นรหัสของ cp874 (ไม่มีใน TIS-620 ล้วน)
        text = "“ชื่อเล่น”"
        assert decode_csv_bytes(text.encode("cp874")) == text

    def test_bytes_not_in_cp874_are_unreadable(self) -> None:
        with pytest.raises(ApiError) as error:
            decode_csv_bytes(b"abc\xff\xfe")
        assert error.value.get_codes() == "csv_unreadable"

    @pytest.mark.parametrize(
        "raw",
        [
            # ไฟล์ Excel (.xlsx เป็นไฟล์ zip — มี NUL)
            b"PK\x03\x04\x14\x00\x06\x00",
            # ข้อความ UTF-16 (Excel "Unicode Text")
            HEADER.encode("utf-16"),
        ],
    )
    def test_binary_or_utf16_is_unreadable(self, raw: bytes) -> None:
        with pytest.raises(ApiError) as error:
            decode_csv_bytes(raw)
        assert error.value.get_codes() == "csv_unreadable"


# --- อ่านแถวและหัวตาราง ---


class TestReadRows:
    def test_reads_rows_with_excel_row_numbers(self) -> None:
        rows = read_csv_upload(
            upload(
                f"{HEADER}\n"
                "a@example.com,690000001,สมชาย,ใจดี,student\n"
                "b@example.com,,สมหญิง,รักเรียน,teacher\n"
            )
        )
        assert [row.number for row in rows] == [2, 3]
        assert rows[0].values == {
            "email": "a@example.com",
            "student_or_staff_id": "690000001",
            "first_name": "สมชาย",
            "last_name": "ใจดี",
            "role": "student",
        }
        assert rows[1].values["student_or_staff_id"] == ""

    def test_header_any_order_case_and_spaces(self) -> None:
        rows = read_csv_upload(
            upload(
                " Role , FIRST_NAME,last_name ,Email,student_or_staff_id,note\n"
                "student,สมชาย,ใจดี,a@example.com,,คอลัมน์เกินไม่สนใจ\n"
            )
        )
        assert rows[0].values == {
            "role": "student",
            "first_name": "สมชาย",
            "last_name": "ใจดี",
            "email": "a@example.com",
            "student_or_staff_id": "",
        }

    def test_cells_are_trimmed_and_short_rows_padded(self) -> None:
        rows = read_csv_upload(upload(f"{HEADER}\n  a@example.com , 69 ,สมชาย\n"))
        assert rows[0].values["email"] == "a@example.com"
        assert rows[0].values["student_or_staff_id"] == "69"
        assert rows[0].values["role"] == ""

    def test_blank_rows_are_skipped_but_numbering_matches_excel(self) -> None:
        rows = read_csv_upload(
            upload(
                f"{HEADER}\na@example.com,,ก,ข,student\n,,,,\n\nb@example.com,,ค,ง,student\n,,,,\n"
            )
        )
        assert [row.number for row in rows] == [2, 5]

    def test_quoted_cell_with_newline_counts_as_one_row(self) -> None:
        rows = read_csv_upload(
            upload(f'{HEADER}\na@example.com,,"สม\nชาย",ใจดี,student\nb@example.com,,ก,ข,student\n')
        )
        assert [row.number for row in rows] == [2, 3]
        assert rows[0].values["first_name"] == "สม\nชาย"

    def test_utf8_bom_header_from_excel(self) -> None:
        raw = codecs.BOM_UTF8 + f"{HEADER}\na@example.com,,ก,ข,student\n".encode()
        assert read_csv_upload(upload(raw))[0].values["email"] == "a@example.com"

    def test_tis620_file(self) -> None:
        rows = read_csv_upload(upload(f"{HEADER}\na@example.com,,สมชาย,ใจดี,ผู้เรียน\n", "cp874"))
        assert rows[0].values["first_name"] == "สมชาย"
        assert rows[0].values["role"] == "ผู้เรียน"


# --- ปัญหาระดับไฟล์ ---


class TestFileErrors:
    def test_empty_file(self) -> None:
        assert error_code("") == "csv_empty"

    def test_header_only(self) -> None:
        assert error_code(f"{HEADER}\n,,,,\n") == "csv_empty"

    def test_missing_columns_lists_them(self) -> None:
        with pytest.raises(ApiError) as error:
            read_csv_upload(upload("email,frist_name,last_name\na@example.com,ก,ข\n"))
        assert error.value.get_codes() == "csv_missing_columns"
        assert error.value.extra == {
            "fields": {
                "student_or_staff_id": ["required"],
                "first_name": ["required"],
                "role": ["required"],
            }
        }

    @override_settings(CSV_IMPORT_MAX_BYTES=100)
    def test_too_large(self) -> None:
        assert error_code("x" * 101) == "csv_too_large"

    @override_settings(CSV_IMPORT_MAX_BYTES=100)
    def test_exactly_at_size_limit_is_allowed(self) -> None:
        content = f"{HEADER}\na@example.com,,ก,ข,student\n"
        content += " " * (100 - len(content.encode()))
        assert len(read_csv_upload(upload(content))) == 1

    @override_settings(CSV_IMPORT_MAX_ROWS=3)
    def test_too_many_rows(self) -> None:
        body = "".join(f"u{i}@example.com,,ก,ข,student\n" for i in range(4))
        assert error_code(f"{HEADER}\n{body}") == "csv_too_many_rows"

    @override_settings(CSV_IMPORT_MAX_ROWS=3)
    def test_row_limit_ignores_blank_rows(self) -> None:
        body = "".join(f"u{i}@example.com,,ก,ข,student\n,,,,\n" for i in range(3))
        assert len(read_csv_upload(upload(f"{HEADER}\n{body}"))) == 3

    def test_malformed_csv_is_unreadable(self) -> None:
        # ช่องยาวเกินเพดานของโมดูล csv (131,072 ตัว) → csv.Error
        assert error_code(f'{HEADER}\n"{"x" * 140_000}",,,,\n') == "csv_unreadable"
