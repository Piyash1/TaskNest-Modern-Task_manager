from django import forms
from .models import Task


class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = [
            "title",
            "description",
            "priority",
            "due_date",
            "category",
            "completed",
        ]
        widgets = {
            "title": forms.TextInput(attrs={"class": "input", "placeholder": "Task title"}),
            "description": forms.Textarea(attrs={"class": "textarea", "rows": 3, "placeholder": "Details"}),
            "priority": forms.Select(attrs={"class": "select"}),
            "due_date": forms.DateInput(attrs={"type": "date", "class": "input"}),
            "category": forms.Select(attrs={"class": "select"}),
            "completed": forms.CheckboxInput(attrs={"class": "checkbox"}),
        }

