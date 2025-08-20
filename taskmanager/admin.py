from django.contrib import admin
from .models import Task, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "color", "created_at")
    search_fields = ("name",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "priority", "completed", "due_date", "order", "created_at")
    list_filter = ("completed", "priority", "category")
    search_fields = ("title", "description")
    list_editable = ("completed", "order")
    ordering = ("order", "-created_at")
