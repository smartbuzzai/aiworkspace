"use client";
import { useEffect, useState } from "react";
import {
  Search, Plus, X, CheckCircle2, Circle, Clock, ArrowUp, ArrowRight,
  ArrowDown, Trash2, Calendar, Tag, FolderKanban, Filter,
} from "lucide-react";
import { cn } from "../lib/cn";
import { formatDue } from "../lib/date";
import { useToast } from "./shared/Toast";
import Modal from "./shared/Modal";
import TextInput from "./shared/TextInput";
import SelectInput from "./shared/SelectInput";

interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done" | "cancelled";
  due_at: string | null;
  tags: string[];
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  project_name: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface TaskForm {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done" | "cancelled";
  due_at: string;
  project_id: string;
  tags: string;
}

const EMPTY_FORM: TaskForm = {
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  due_at: "",
  project_id: "",
  tags: "",
};

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("tasks.statusFilter") ?? "active") : "active"
  );
  const [priorityFilter, setPriorityFilter] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("tasks.priorityFilter") ?? "all") : "all"
  );
  const [projectFilter, setProjectFilter] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("tasks.projectFilter") ?? "all") : "all"
  );
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { load(); loadProjects(); }, []);
  useEffect(() => { localStorage.setItem("tasks.statusFilter", statusFilter); }, [statusFilter]);
  useEffect(() => { localStorage.setItem("tasks.priorityFilter", priorityFilter); }, [priorityFilter]);
  useEffect(() => { localStorage.setItem("tasks.projectFilter", projectFilter); }, [projectFilter]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/tasks", { credentials: "include" });
      const d = await r.json();
      setTasks(d.tasks || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const r = await fetch("/api/projects", { credentials: "include" });
      const d = await r.json();
      setProjects(d.projects || []);
    } catch { /* swallow */ }
  }

  async function toggleStatus(task: Task) {
    const next = task.status === "done" ? "open" : "done";
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: next as Task["status"], completed_at: next === "done" ? new Date().toISOString() : null } : t
    ));
    try {
      const r = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error();
      toast("success", next === "done" ? "Task completed!" : "Task reopened.");
    } catch {
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: task.status, completed_at: task.completed_at } : t
      ));
      toast("error", "Failed to update task.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      toast("success", "Task deleted.");
      setDeleteTarget(null);
      load();
    } catch {
      toast("error", "Failed to delete task.");
    } finally {
      setDeleting(false);
    }
  }

  const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const filtered = tasks
    .filter(t => {
      if (statusFilter === "active" && (t.status === "done" || t.status === "cancelled")) return false;
      if (statusFilter === "done" && t.status !== "done") return false;
      if (statusFilter === "cancelled" && t.status !== "cancelled") return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (projectFilter !== "all" && t.project_id !== projectFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const now = Date.now();
      const aOverdue = a.due_at && new Date(a.due_at).getTime() < now;
      const bOverdue = b.due_at && new Date(b.due_at).getTime() < now;
      // Overdue first
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      // Both have due dates — sort ascending
      if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      // Due date before no due date
      if (a.due_at && !b.due_at) return -1;
      if (!a.due_at && b.due_at) return 1;
      // Fall back to priority
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });

  const counts = {
    active: tasks.filter(t => t.status !== "done" && t.status !== "cancelled").length,
    done: tasks.filter(t => t.status === "done").length,
    all: tasks.length,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-white border border-navy-200 rounded-xl p-3.5 flex gap-2.5 items-center flex-wrap">
        <div className="flex gap-1.5">
          <FilterChip active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>
            Active ({counts.active})
          </FilterChip>
          <FilterChip active={statusFilter === "done"} onClick={() => setStatusFilter("done")}>
            Done ({counts.done})
          </FilterChip>
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            All ({counts.all})
          </FilterChip>
        </div>

        <div className="flex gap-1.5 ml-1">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-[6px] rounded-lg text-xs font-semibold border border-navy-200 bg-navy-50 text-navy-700 cursor-pointer font-[inherit] outline-none"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="px-2.5 py-[6px] rounded-lg text-xs font-semibold border border-navy-200 bg-navy-50 text-navy-700 cursor-pointer font-[inherit] outline-none"
            >
              <option value="all">All projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {(priorityFilter !== "all" || projectFilter !== "all") && !loading && (
          <span className="text-[11px] text-navy-500 font-medium">
            {filtered.length} shown
          </span>
        )}

        <button
          onClick={() => { setEditing(null); setShowCreate(true); }}
          className="ml-auto bg-blue-600 text-white border-none px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit]"
        >
          <Plus size={13} /> New task
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white border border-navy-200 rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-5 h-5 rounded-full bg-navy-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-navy-100 rounded w-2/5" />
                <div className="h-2.5 bg-navy-100 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-navy-200 rounded-xl p-10 text-center text-navy-500 text-sm">
          {tasks.length === 0 ? 'No tasks yet. Click "New task" to create one.' : "No tasks match the current filters."}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggleStatus(t)}
              onEdit={() => { setEditing(t); setShowCreate(true); }}
              onDelete={() => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <TaskModal
          task={editing}
          projects={projects}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}

      {deleteTarget && (
        <Modal onClose={() => { if (!deleting) setDeleteTarget(null); }}>
          <div className="p-6">
            <h3 className="text-base font-bold text-navy-900 mb-2">Delete task</h3>
            <p className="text-sm text-navy-600 mb-6">
              Delete <span className="font-semibold">{deleteTarget.title}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className={cn("bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors", deleting && "opacity-60 cursor-not-allowed")}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={cn("bg-red-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors", deleting && "opacity-60 cursor-not-allowed")}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskRow({ task, onToggle, onEdit, onDelete }: TaskRowProps) {
  const done = task.status === "done";
  const PriorityIcon = task.priority === "high" ? ArrowUp : task.priority === "low" ? ArrowDown : ArrowRight;
  const priorityColor = task.priority === "high" ? "text-red-500" : task.priority === "low" ? "text-navy-400" : "text-amber-500";
  const statusColor = task.status === "in_progress" ? "text-blue-500" : task.status === "cancelled" ? "text-navy-400" : "";

  return (
    <div
      className={cn(
        "bg-white border border-navy-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all hover:border-blue-400 hover:-translate-y-px group",
        done && "opacity-60"
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="bg-transparent border-none cursor-pointer p-0 text-navy-500 shrink-0"
        title={done ? "Reopen" : "Complete"}
      >
        {done ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} />}
      </button>

      <div className="flex-1 min-w-0" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold text-navy-900", done && "line-through")}>{task.title}</span>
          {task.status === "in_progress" && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wide bg-blue-500/10 text-blue-500">
              in progress
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-navy-500 flex-wrap">
          <span className={cn("flex items-center gap-0.5", priorityColor)}>
            <PriorityIcon size={11} /> {task.priority}
          </span>
          {task.project_name && (
            <span className="flex items-center gap-0.5">
              <FolderKanban size={11} /> {task.project_name}
            </span>
          )}
          {task.due_at && (() => {
            const isOverdue = !done && new Date(task.due_at) < new Date();
            return (
              <span className="flex items-center gap-1">
                <Calendar size={11} className={isOverdue ? "text-red-500" : ""} />
                {isOverdue && (
                  <span className="bg-red-500/10 text-red-600 text-[10px] font-bold px-1.5 py-px rounded-[4px]">Overdue</span>
                )}
                <span className={isOverdue ? "text-red-500 font-semibold" : ""}>{formatDue(task.due_at)}</span>
              </span>
            );
          })()}
          {task.tags.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Tag size={11} /> {task.tags.join(", ")}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:text-red-500"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

interface TaskModalProps {
  task: Task | null;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}

function TaskModal({ task, projects, onClose, onSaved }: TaskModalProps) {
  const isEdit = !!task;
  const { toast } = useToast();
  const [f, setF] = useState<TaskForm>(
    task
      ? {
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          status: task.status,
          due_at: task.due_at ? task.due_at.slice(0, 16) : "",
          project_id: task.project_id || "",
          tags: task.tags.join(", "),
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        title: f.title.trim(),
        description: f.description.trim() || null,
        priority: f.priority,
        status: f.status,
        due_at: f.due_at ? new Date(f.due_at).toISOString() : null,
        project_id: f.project_id || null,
        tags: f.tags ? f.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
      };
      const r = await fetch(isEdit ? `/api/tasks/${task!.id}` : "/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast("error", d.error || "Failed to save task.");
        return;
      }
      toast("success", isEdit ? "Task saved." : "Task created.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const disabled = !f.title.trim() || saving;

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">{isEdit ? "Edit task" : "New task"}</h3>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-2.5">
        <TextInput label="Title *" value={f.title} onChange={v => setF({ ...f, title: v })} />
        <div>
          <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Description</div>
          <textarea
            value={f.description}
            onChange={e => setF({ ...f, description: e.target.value })}
            rows={3}
            className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SelectInput label="Priority" value={f.priority} onChange={v => setF({ ...f, priority: v as any })}
            options={[["high","High"],["medium","Medium"],["low","Low"]]} />
          <SelectInput label="Status" value={f.status} onChange={v => setF({ ...f, status: v as any })}
            options={[["open","Open"],["in_progress","In progress"],["done","Done"],["cancelled","Cancelled"]]} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Due date</div>
            <input
              type="datetime-local"
              value={f.due_at}
              onChange={e => setF({ ...f, due_at: e.target.value })}
              className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
            />
          </div>
          {projects.length > 0 && (
            <SelectInput label="Project" value={f.project_id} onChange={v => setF({ ...f, project_id: v })}
              options={[["", "None"], ...projects.map(p => [p.id, p.name])]} />
          )}
        </div>
        <TextInput label="Tags (comma-separated)" value={f.tags} onChange={v => setF({ ...f, tags: v })} />
        <button
          onClick={save}
          disabled={disabled}
          className={cn(
            "bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit] mt-1",
            disabled ? "opacity-60 cursor-wait" : "cursor-pointer",
          )}
        >
          {saving ? "Saving\u2026" : isEdit ? "Save changes" : "Create task"}
        </button>
      </div>
    </Modal>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-[11px] py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap font-[inherit] border",
        active ? "bg-navy-900 text-white border-navy-900" : "bg-navy-50 text-navy-700 border-navy-200",
      )}
    >
      {children}
    </button>
  );
}
