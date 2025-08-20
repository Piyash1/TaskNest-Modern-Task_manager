from django.db.models import Q
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, render, redirect
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm

from .forms import TaskForm
from .models import Task, Category


def landing(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("task_list")
    return render(request, "landing.html")


@login_required
def task_list(request: HttpRequest) -> HttpResponse:
    query = request.GET.get("q", "").strip()
    status = request.GET.get("status", "all")
    priority = request.GET.get("priority")
    category_id = request.GET.get("category")
    sort = request.GET.get("sort", "created")

    tasks = Task.objects.select_related("category").filter(user=request.user)

    if query:
        tasks = tasks.filter(Q(title__icontains=query) | Q(description__icontains=query))

    if status == "active":
        tasks = tasks.filter(completed=False)
    elif status == "completed":
        tasks = tasks.filter(completed=True)

    if priority in {Task.PRIORITY_HIGH, Task.PRIORITY_MEDIUM, Task.PRIORITY_LOW}:
        tasks = tasks.filter(priority=priority)

    if category_id:
        tasks = tasks.filter(category_id=category_id)

    if sort == "due":
        tasks = tasks.order_by("due_date", "order", "created_at")
    elif sort == "priority":
        tasks = tasks.order_by("priority", "order", "created_at")
    elif sort == "alpha":
        tasks = tasks.order_by("title")
    else:
        tasks = tasks.order_by("order", "-created_at")

    categories = Category.objects.all()
    form = TaskForm()
    # Dashboard-like metrics (per-user)
    total_all = Task.objects.filter(user=request.user).count()
    completed_all = Task.objects.filter(user=request.user, completed=True).count()
    pending_all = max(total_all - completed_all, 0)
    low_count = Task.objects.filter(user=request.user, priority=Task.PRIORITY_LOW).count()
    med_count = Task.objects.filter(user=request.user, priority=Task.PRIORITY_MEDIUM).count()
    high_count = Task.objects.filter(user=request.user, priority=Task.PRIORITY_HIGH).count()
    completion_rate = int(round((completed_all / total_all) * 100)) if total_all else 0
    recent = (
        Task.objects.select_related("category")
        .filter(user=request.user)
        .order_by("-updated_at")[:5]
    )
    context = {
        "tasks": tasks,
        "categories": categories,
        "form": form,
        "q": query,
        "current_status": status,
        "current_priority": priority or "",
        "current_category": str(category_id or ""),
        "current_sort": sort,
        # Metrics
        "total_all": total_all,
        "completed_all": completed_all,
        "pending_all": pending_all,
        "low_count": low_count,
        "med_count": med_count,
        "high_count": high_count,
        "completion_rate": completion_rate,
        "recent": recent,
    }
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return render(request, "taskmanager/task_list.html", context)
    return render(request, "taskmanager/task_list.html", context)


@login_required
@require_http_methods(["POST"]) 
def task_create(request: HttpRequest) -> HttpResponse:
    form = TaskForm(request.POST)
    if form.is_valid():
        task = form.save(commit=False)
        task.user = request.user
        task.save()
        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            return render(request, "taskmanager/partials/task_item.html", {"task": task})
        return redirect("task_list")
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return render(request, "taskmanager/partials/task_form.html", {"form": form}, status=400)
    return redirect("task_list")


@login_required
@require_http_methods(["POST"]) 
def task_update(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task, pk=pk, user=request.user)
    form = TaskForm(request.POST, instance=task)
    if form.is_valid():
        task = form.save()
        if request.headers.get("x-requested-with") == "XMLHttpRequest":
            return render(request, "taskmanager/partials/task_item.html", {"task": task})
        return redirect("task_list")
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return render(request, "taskmanager/partials/task_form.html", {"form": form}, status=400)
    return redirect("task_list")


@login_required
@require_http_methods(["POST"]) 
def task_delete(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task, pk=pk, user=request.user)
    task.delete()
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return JsonResponse({"ok": True})
    return redirect("task_list")


@login_required
@require_http_methods(["POST"]) 
def task_toggle_complete(request: HttpRequest, pk: int) -> HttpResponse:
    task = get_object_or_404(Task, pk=pk, user=request.user)
    task.completed = not task.completed
    task.save(update_fields=["completed", "updated_at"])
    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return render(request, "taskmanager/partials/task_item.html", {"task": task})
    return redirect("task_list")


@login_required
@require_http_methods(["POST"]) 
def task_reorder(request: HttpRequest) -> HttpResponse:
    # Expected payload: order[]=<id>&order[]=<id>...
    order_list = request.POST.getlist("order[]") or request.POST.getlist("order")
    for index, task_id in enumerate(order_list):
        try:
            Task.objects.filter(id=int(task_id), user=request.user).update(order=index)
        except (ValueError, TypeError):
            continue
    return JsonResponse({"ok": True})


def signup(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("task_list")
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("login")
    else:
        form = UserCreationForm()
    return render(request, "auth/signup.html", {"form": form})
