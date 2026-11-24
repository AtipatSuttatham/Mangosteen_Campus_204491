"""
test กติกาการตั้งชื่อที่แสดงในหน้า Django admin (/admin/) — docs/database.md §1

ผู้ใช้เลือก (2026-11-25): หน้า /admin/ แสดงชื่อให้ตรงกับเอกสาร docs/database.md และฐานข้อมูลจริง
แทนชื่อภาษาไทย เพื่อเปิด /admin/ คู่กับเอกสาร หรือคู่กับ psql / DBeaver แล้วเทียบกันได้ทันที
- ชื่อกลุ่ม (app)    = ชื่อ app เช่น "academics"
- ชื่อตาราง (model)  = "ชื่อ model (ชื่อตารางจริง)" เช่น "Course (academics_course)"
- ชื่อคอลัมน์ (field) = ชื่อ field เช่น "is_published"

test นี้ตรวจทุก model ของระบบอัตโนมัติ — model ใหม่ในก้อนถัดไปที่ลืมตั้งชื่อตามกติกาจะทำให้ test แดง
"""

import pytest
from django.apps import apps
from django.db import models

# app ของระบบที่มีตาราง (common มีแค่ model ต้นแบบ abstract จึงไม่อยู่ในรายการ)
PROJECT_APPS = ["accounts", "academics", "enrollment", "content", "audit"]

# field ที่ User ได้มาจากคลาสของ Django (AbstractBaseUser / PermissionsMixin) — Django ตั้งชื่อเอง
# เป็นภาษาอังกฤษอยู่แล้ว (เช่น "last login") ; ไม่เขียนทับ เพื่อไม่ต้องประกาศ field ของ Django ซ้ำ
DJANGO_BUILTIN_FIELDS = {"password", "last_login", "is_superuser", "groups", "user_permissions"}


def project_models() -> list[type[models.Model]]:
    """model ทุกตัว (ที่เป็นตารางจริง) ของ app ในระบบ"""
    return [model for label in PROJECT_APPS for model in apps.get_app_config(label).get_models()]


def test_every_project_app_has_tables() -> None:
    """รายการ app ในไฟล์นี้ยังตรงกับของจริง (กันกรณีเพิ่ม app ใหม่แล้ว test ไม่ได้ตรวจ)"""
    for label in PROJECT_APPS:
        assert list(apps.get_app_config(label).get_models()), label


@pytest.mark.parametrize("label", PROJECT_APPS)
def test_app_group_name_is_app_label(label: str) -> None:
    """ชื่อกลุ่มในหน้า /admin/ = ชื่อ app (คำนำหน้าของชื่อตารางจริง)"""
    assert apps.get_app_config(label).verbose_name == label


@pytest.mark.parametrize("model", project_models(), ids=lambda model: model.__name__)
def test_table_name_is_model_and_db_table(model: type[models.Model]) -> None:
    """ชื่อตารางในหน้า /admin/ = "ชื่อ model (ชื่อตารางจริง)" ทั้งแบบเอกพจน์และพหูพจน์"""
    expected = f"{model.__name__} ({model._meta.db_table})"

    assert model._meta.verbose_name == expected
    assert model._meta.verbose_name_plural == expected


@pytest.mark.parametrize("model", project_models(), ids=lambda model: model.__name__)
def test_column_name_is_field_name(model: type[models.Model]) -> None:
    """ชื่อคอลัมน์ในหน้า /admin/ = ชื่อ field ทุกตัว (ยกเว้น id ที่ Django สร้างเอง และ field ของ Django)"""
    fields = [
        field
        for field in model._meta.get_fields(include_parents=True)
        if field.concrete and not field.auto_created and field.name not in DJANGO_BUILTIN_FIELDS
    ]

    assert fields
    for field in fields:
        assert field.verbose_name == field.name, f"{model.__name__}.{field.name}"
