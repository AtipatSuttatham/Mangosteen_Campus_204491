"""
นำเข้าบัญชีผู้ใช้จากไฟล์ CSV (UC-04 — ขั้น 2.4) — อ้างอิง docs/api.md §7.4, การตัดสินใจก้อน 2 ใน CLAUDE.md

ขั้นตอนของไฟล์ 1 ไฟล์:
    read_csv_upload()   อ่านไฟล์: จำกัดขนาด → ถอดรหัสภาษา (UTF-8 / TIS-620) → แยกแถว → ตรวจหัวตาราง
                        ปัญหาระดับไฟล์ → ApiError (csv_unreadable, csv_too_large, ...) ทันที
"""

import codecs
import csv
import io
from dataclasses import dataclass

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

from common.exceptions import ApiError

# คอลัมน์ที่ไฟล์ต้องมี (ตามข้อตกลง "รหัสผ่านตอนนำเข้า CSV" ใน CLAUDE.md) — ลำดับในไฟล์เรียงแบบไหนก็ได้
COLUMNS = ["email", "student_or_staff_id", "first_name", "last_name", "role"]
# ความยาวสูงสุดของ "ค่าในไฟล์" ที่ส่งกลับในรายงาน (กันคำตอบใหญ่เกินเมื่อมีช่องยาวผิดปกติ)
REPORT_VALUE_MAX = 200


@dataclass
class CsvRow:
    """แถวข้อมูล 1 แถวจากไฟล์"""

    # เลขแถวแบบ Excel: แถวหัวตาราง = 1 → แถวข้อมูลแรก = 2 (แถวว่างที่ข้ามไปยังนับเลขด้วย)
    number: int
    # ค่าตามชื่อคอลัมน์ (ตัดช่องว่างหัว-ท้ายแล้ว ; ช่องที่แถวนี้ไม่มี = "")
    values: dict[str, str]


def _unreadable(detail: str) -> ApiError:
    """ไฟล์อ่านไม่ออก (ไม่ใช่ข้อความ UTF-8 / TIS-620 หรือรูปแบบ CSV เสีย)"""
    return ApiError("csv_unreadable", detail)


def decode_csv_bytes(raw: bytes) -> str:
    """
    แปลงไฟล์เป็นข้อความ ตรวจการเข้ารหัสอัตโนมัติ (การตัดสินใจ "การเข้ารหัสไฟล์ CSV"):
    1. มี BOM ของ UTF-8 (Excel "CSV UTF-8") → UTF-8
    2. ลองอ่านเป็น UTF-8 → ผ่าน = UTF-8 (ไฟล์ภาษาไทยแบบ TIS-620 แทบไม่มีทางผ่านโดยบังเอิญ)
    3. ไม่ผ่าน → อ่านเป็น cp874 (TIS-620 ฉบับ Windows ที่ Excel ไทยใช้ — มีอักขระเพิ่มเช่น “ ” …)
    อ่านไม่ได้ทั้งหมด หรือมีอักขระ NUL (เช่น ไฟล์ .xlsx / UTF-16) → csv_unreadable
    """
    if raw.startswith(codecs.BOM_UTF8):
        raw = raw[len(codecs.BOM_UTF8) :]
        encodings = ["utf-8"]
    else:
        encodings = ["utf-8", "cp874"]

    for encoding in encodings:
        try:
            text = raw.decode(encoding)
        except UnicodeDecodeError:
            continue
        # ไฟล์ข้อความจริงไม่มี NUL — มีแปลว่าเป็นไฟล์ชนิดอื่น (ไฟล์ Excel, UTF-16 ฯลฯ)
        if "\x00" in text:
            break
        return text
    raise _unreadable("The file is not a UTF-8 or TIS-620 CSV file.")


def _normalize_header(name: str) -> str:
    """ชื่อคอลัมน์: ตัดช่องว่าง + ตัวพิมพ์เล็ก (พิมพ์ "Email " ก็ใช้ได้)"""
    return name.strip().lstrip("﻿").strip().lower()


def read_csv_upload(upload: UploadedFile) -> list[CsvRow]:
    """
    อ่านไฟล์ที่อัปโหลดเป็นรายการแถวข้อมูล — ปัญหาระดับไฟล์โยน ApiError (400) ทันที:
    - csv_too_large        ไฟล์ใหญ่เกิน CSV_IMPORT_MAX_BYTES (1 MB)
    - csv_unreadable       ถอดรหัสภาษาไม่ได้ / รูปแบบ CSV เสีย
    - csv_empty            ไม่มีหัวตาราง หรือไม่มีแถวข้อมูลเลย
    - csv_missing_columns  ขาดคอลัมน์ที่บังคับ → แนบ {"fields": {"ชื่อคอลัมน์": ["required"]}}
    - csv_too_many_rows    แถวข้อมูลเกิน CSV_IMPORT_MAX_ROWS (500)
    แถวว่างทั้งแถวถูกข้าม (Excel มักทิ้งไว้ท้ายไฟล์) แต่เลขแถวของแถวถัดไปยังตรงกับ Excel ; คอลัมน์เกินไม่สนใจ
    """
    max_bytes = settings.CSV_IMPORT_MAX_BYTES
    # อ่านไม่เกินเพดาน + 1 ไบต์ — พอรู้ว่าเกินหรือไม่ โดยไม่อ่านไฟล์ใหญ่ทั้งไฟล์เข้าหน่วยความจำ
    raw = upload.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ApiError("csv_too_large", f"The file is larger than {max_bytes} bytes.")

    text = decode_csv_bytes(raw)
    # newline="" ตามคู่มือของโมดูล csv — ให้ช่องที่มีขึ้นบรรทัดใหม่ในเครื่องหมายคำพูดอ่านถูก
    reader = csv.reader(io.StringIO(text, newline=""))
    try:
        records = list(reader)
    except csv.Error as error:
        raise _unreadable(f"Malformed CSV: {error}") from error

    if not records:
        raise ApiError("csv_empty", "The file is empty.")

    # แถวแรก = หัวตาราง ; ชื่อซ้ำ → ใช้คอลัมน์แรกที่เจอ
    positions: dict[str, int] = {}
    for index, name in enumerate(records[0]):
        positions.setdefault(_normalize_header(name), index)
    missing = [column for column in COLUMNS if column not in positions]
    if missing:
        raise ApiError(
            "csv_missing_columns",
            "Missing columns: " + ", ".join(missing),
            extra={"fields": {column: ["required"] for column in missing}},
        )

    max_rows = settings.CSV_IMPORT_MAX_ROWS
    rows: list[CsvRow] = []
    # เลขแถวแบบ Excel: นับ "ระเบียน" ไม่ใช่บรรทัด (ช่องที่มีขึ้นบรรทัดใหม่ยังเป็นแถวเดียวใน Excel)
    for number, record in enumerate(records[1:], start=2):
        values = {
            column: record[index].strip() if index < len(record) else ""
            for column, index in positions.items()
            if column in COLUMNS
        }
        # แถวว่างทั้งแถว (ไม่สนคอลัมน์เกิน) → ข้าม
        if not any(values.values()):
            continue
        rows.append(CsvRow(number=number, values=values))
        if len(rows) > max_rows:
            raise ApiError("csv_too_many_rows", f"The file has more than {max_rows} data rows.")

    if not rows:
        raise ApiError("csv_empty", "The file has no data rows.")
    return rows
