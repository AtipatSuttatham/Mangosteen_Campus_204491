"""
เส้นทางของ API เนื้อหารายวิชา (ขั้น 4.3) — ต่ออยู่ใต้ /api/v1/courses/ (config/urls.py)
รายละเอียด docs/api.md §10 ; คำอธิบายแต่ละที่อยู่อยู่ใน content/views.py
"""

from django.urls import path

from content.views import (
    ContentActionView,
    ContentCreateView,
    ContentDetailView,
    ModuleActionView,
    ModuleDetailView,
    ModuleListView,
)

urlpatterns = [
    # ---------- หน่วยการเรียน ----------
    path("<int:pk>/modules/", ModuleListView.as_view(), name="course-modules"),
    path("<int:pk>/modules/<int:module_id>/", ModuleDetailView.as_view(), name="module-detail"),
    path(
        "<int:pk>/modules/<int:module_id>/publish/",
        ModuleActionView.as_view(action="publish"),
        name="module-publish",
    ),
    path(
        "<int:pk>/modules/<int:module_id>/unpublish/",
        ModuleActionView.as_view(action="unpublish"),
        name="module-unpublish",
    ),
    path(
        "<int:pk>/modules/<int:module_id>/move/",
        ModuleActionView.as_view(action="move"),
        name="module-move",
    ),
    # ---------- เพิ่มเนื้อหาในหน่วย ----------
    path(
        "<int:pk>/modules/<int:module_id>/contents/text/",
        ContentCreateView.as_view(kind="text"),
        name="content-create-text",
    ),
    path(
        "<int:pk>/modules/<int:module_id>/contents/link/",
        ContentCreateView.as_view(kind="link"),
        name="content-create-link",
    ),
    # ---------- เนื้อหา 1 ชิ้น ----------
    path("<int:pk>/contents/<int:content_id>/", ContentDetailView.as_view(), name="content-detail"),
    path(
        "<int:pk>/contents/<int:content_id>/publish/",
        ContentActionView.as_view(action="publish"),
        name="content-publish",
    ),
    path(
        "<int:pk>/contents/<int:content_id>/unpublish/",
        ContentActionView.as_view(action="unpublish"),
        name="content-unpublish",
    ),
    path(
        "<int:pk>/contents/<int:content_id>/move/",
        ContentActionView.as_view(action="move"),
        name="content-move",
    ),
]
