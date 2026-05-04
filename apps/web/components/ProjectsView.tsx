"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, X, Sparkles, ArrowUp, ArrowRight, ArrowDown, CheckCircle2, Circle,
  Share2, Link2, Copy, Check, Trash2, Eye, EyeOff, MessageSquare,
  FileText, ChevronLeft, ExternalLink, Send, Users, FolderOpen, PenLine,
  Pencil, Archive, Search,
} from "lucide-react";
import DocumentEditor from "./shared/DocumentEditor";
import { cn } from "../lib/cn";
import { formatDue, relTime } from "../lib/date";
import { useToast } from "./shared/Toast";
import Modal from "./shared/Modal";
import TextInput from "./shared/TextInput";
import SelectInput from "./shared/SelectInput";

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  progress: number;
  due_date: string | null;
  color: string;
  task_count: string;
  tasks_done: string;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done" | "cancelled";
  due_at: string | null;
  tags: string[];
  source: string | null;
  client_visible: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ShareItem {
  id: string;
  token: string;
  client_name: string | null;
  client_email: string | null;
  permissions: string;
  is_active: boolean;
  last_viewed_at: string | null;
  created_at: string;
}

interface ProjectUpdate {
  id: string;
  title: string | null;
  body: string;
  ai_generated: boolean;
  published_at: string | null;
  created_at: string;
}

interface Comment {
  id: string;
  task_id: string | null;
  author_type: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

interface ProjectFile {
  id: string;
  name: string;
  kind: string;
  mime_type: string | null;
  size_bytes: number;
  client_visible: boolean;
  created_at: string;
  folder_name: string | null;
  folder_path: string | null;
}

interface AvailableFile {
  id: string;
  name: string;
  kind: string;
  size_bytes: number;
  created_at: string;
  folder_name: string | null;
  folder_path: string | null;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "editor" | "viewer";
  created_at: string;
}

interface TaskForm {
  title: string;
  description: string;
  priority: string;
  status: string;
  due_at: string;
  tags: string;
}

interface Document {
  id: string;
  title: string;
  excerpt: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAGE_COLORS: Record<string, string> = {
  backlog: "bg-navy-400",
  discovery: "bg-purple-500",
  in_progress: "bg-blue-500",
  review: "bg-amber-500",
  done: "bg-green-500",
};

const STAGE_LABELS: Record<string, string> = {
  backlog: "Backlog",
  discovery: "Discovery",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function localToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [sharePanel, setSharePanel] = useState<Project | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/projects", { credentials: "include" });
      const d = await r.json();
      setProjects(d.projects || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {selected ? (
        <ProjectDetail
          project={selected}
          onBack={() => { setSelected(null); load(); }}
          onShare={() => setSharePanel(selected)}
          onUpdated={(updated) => setSelected(updated)}
        />
      ) : (
        <>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-[28px] font-extrabold text-navy-900 tracking-tight leading-tight m-0">Projects</h1>
              <div className="text-sm text-navy-500 mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-navy-200 rounded-lg px-3 py-2">
                <Search size={14} className="text-navy-400 shrink-0" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search projects…"
                  className="bg-transparent border-none outline-none text-[13px] w-40 text-navy-800 font-[inherit]"
                />
              </div>
              <button
                onClick={() => setShowNew(true)}
                className="bg-blue-500 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-2 font-[inherit] hover:bg-blue-600 transition-all"
              >
                <Plus size={14} /> New project
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-navy-500 text-[13px] p-6">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="bg-white border border-navy-200 rounded-xl p-10 text-center">
              <p className="text-navy-500 text-sm mb-4">No projects yet.</p>
              <button
                onClick={() => setShowNew(true)}
                className="bg-blue-500 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer inline-flex items-center gap-2 font-[inherit] hover:bg-blue-600 transition-all"
              >
                <Plus size={14} /> Create your first project
              </button>
            </div>
          ) : (
            <>
              {q && projects.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).length === 0 ? (
                <div className="bg-white border border-navy-200 rounded-xl p-8 text-center text-navy-500 text-sm">
                  No projects match &ldquo;{q}&rdquo;
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
                  {projects
                    .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()))
                    .map(p => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        onClick={() => setSelected(p)}
                        onShare={() => setSharePanel(p)}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}

      {sharePanel && (
        <ShareModal
          project={sharePanel}
          onClose={() => setSharePanel(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProjectCard                                                        */
/* ------------------------------------------------------------------ */

function ProjectCard({ project: p, onClick, onShare }: { project: Project; onClick: () => void; onShare: () => void }) {
  const total = Number(p.task_count);
  const done = Number(p.tasks_done);
  const pct = total > 0 ? Math.round((done / total) * 100) : p.progress;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-navy-200 rounded-[14px] p-4 cursor-pointer transition-all hover:border-blue-400 hover:-translate-y-px group"
    >
      <div className="flex items-start gap-3">
        <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: p.color }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-navy-900 truncate">{p.name}</div>
          {p.description && <div className="text-[11px] text-navy-500 mt-0.5 truncate">{p.description}</div>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onShare(); }}
          className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
          title="Share with client"
        >
          <Share2 size={14} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 bg-navy-100 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
        </div>
        <span className="text-[11px] font-bold text-navy-500 font-mono">{pct}%</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-navy-500">
        <span className="flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", STAGE_COLORS[p.stage] || "bg-navy-400")} />
          {STAGE_LABELS[p.stage] || p.stage}
        </span>
        <span>{total} task{total !== 1 ? "s" : ""}</span>
        {p.due_date && <span>Due {new Date(p.due_date).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProjectDetail — tasks with visibility toggles                      */
/* ------------------------------------------------------------------ */

function ProjectDetail({ project: initialProject, onBack, onShare, onUpdated }: {
  project: Project; onBack: () => void; onShare: () => void;
  onUpdated?: (p: Project) => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [availableFiles, setAvailableFiles] = useState<AvailableFile[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editingDoc, setEditingDoc] = useState<Document | null | "new">(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<Document | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, filesRes, docsRes] = await Promise.all([
        fetch(`/api/tasks?project_id=${project.id}`, { credentials: "include" }),
        fetch(`/api/projects/${project.id}/files`, { credentials: "include" }),
        fetch(`/api/documents?project_id=${project.id}`, { credentials: "include" }),
      ]);
      const [tasksData, filesData, docsData] = await Promise.all([
        tasksRes.json(), filesRes.json(), docsRes.json(),
      ]);
      setTasks(tasksData.tasks || []);
      setProjectFiles(filesData.files || []);
      setDocuments(docsData.documents || []);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function loadAvailable() {
    const r = await fetch(`/api/projects/${project.id}/available-files`, { credentials: "include" });
    const d = await r.json();
    setAvailableFiles(d.files || []);
    setShowFilePicker(true);
  }

  async function linkFile(fileId: string) {
    await fetch(`/api/projects/${project.id}/files/${fileId}`, {
      method: "POST", credentials: "include",
    });
    setShowFilePicker(false);
    load();
    toast("success", "File added to project");
  }

  async function unlinkFile(fileId: string) {
    await fetch(`/api/projects/${project.id}/files/${fileId}`, {
      method: "DELETE", credentials: "include",
    });
    toast("success", "File removed from project.");
    load();
  }

  function openFile(file: ProjectFile) {
    const mime = file.mime_type || "";
    const inlineUrl = `/api/files/${file.id}/download?inline=1`;
    const downloadUrl = `/api/files/${file.id}/download`;

    if (mime.startsWith("image/")) {
      setPreview({ url: inlineUrl, name: file.name, mime });
    } else if (mime === "application/pdf" || mime.startsWith("video/") || mime.startsWith("audio/")) {
      window.open(inlineUrl, "_blank");
    } else {
      window.open(downloadUrl, "_blank");
    }
  }

  async function toggleFileVisibility(file: ProjectFile) {
    await fetch(`/api/files/${file.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_visible: !file.client_visible }),
    });
    setProjectFiles(prev => prev.map(f => f.id === file.id ? { ...f, client_visible: !f.client_visible } : f));
    toast("success", file.client_visible ? "Hidden from client" : "Visible to client");
  }

  async function toggleVisibility(task: Task) {
    await fetch(`/api/projects/${project.id}/tasks/${task.id}/visibility`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_visible: !task.client_visible }),
    });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, client_visible: !t.client_visible } : t));
    toast("success", task.client_visible ? "Hidden from client" : "Visible to client");
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    setEditing(null);
    load();
  }

  async function moveTask(taskId: string, newStatus: string) {
    const prev = tasks.find(t => t.id === taskId);
    if (!prev || prev.status === newStatus) return;
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: prev.status } : t));
      toast("error", "Failed to move task.");
    }
  }

  const columns = [
    { key: "open", title: "To Do", color: "bg-navy-500", filter: (t: Task) => t.status === "open" },
    { key: "in_progress", title: "In Progress", color: "bg-blue-500", filter: (t: Task) => t.status === "in_progress" },
    { key: "done", title: "Done", color: "bg-green-500", filter: (t: Task) => t.status === "done" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="bg-navy-50 border border-navy-200 text-navy-600 p-2 rounded-lg cursor-pointer hover:bg-navy-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <h2 className="text-xl font-extrabold text-navy-900 m-0">{project.name}</h2>
        <button
          onClick={() => setEditingProject(true)}
          className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-blue-500 hover:bg-blue-50 transition-all"
          title="Edit project"
        >
          <Pencil size={14} />
        </button>
        <div className="ml-auto flex gap-2">
          {confirmingArchive ? (
            <>
              <span className="text-[12px] text-navy-600 self-center">Archive this project?</span>
              <button
                onClick={async () => {
                  await fetch(`/api/projects/${project.id}`, { method: "DELETE", credentials: "include" });
                  onBack();
                }}
                className="bg-red-600 text-white border-none px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmingArchive(false)}
                className="bg-navy-50 text-navy-700 border border-navy-200 px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmingArchive(true)}
                className="bg-navy-50 text-navy-500 border border-navy-200 px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-navy-100 transition-colors"
                title="Archive project"
              >
                <Archive size={12} /> Archive
              </button>
              <button
                onClick={onShare}
                className="bg-navy-50 text-navy-700 border border-navy-200 px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-navy-100 transition-colors"
              >
                <Share2 size={12} /> Share
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="bg-blue-500 text-white border-none px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-blue-600 transition-all"
              >
                <Plus size={12} /> New task
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-navy-500 text-[13px] p-6">Loading...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {columns.map(col => {
            const items = tasks.filter(col.filter);
            const isOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                className={cn(
                  "rounded-xl p-3 min-h-[300px] transition-colors",
                  isOver ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : "bg-navy-50"
                )}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  if (draggedId) moveTask(draggedId, col.key);
                  setDraggedId(null);
                  setDragOverCol(null);
                }}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={cn("w-2 h-2 rounded-full", col.color)} />
                  <span className="text-[11px] font-bold text-navy-600 uppercase tracking-wider">{col.title}</span>
                  <span className="text-[11px] font-bold text-navy-400 ml-auto">{items.length}</span>
                </div>
                {items.length === 0 && !draggedId && (
                  <div className="text-[12px] text-navy-400 text-center py-6">No tasks</div>
                )}
                {items.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedId(task.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                    className={cn(
                      "bg-white rounded-[10px] p-3 mb-2 border border-navy-200 transition-all hover:border-navy-300 group cursor-grab active:cursor-grabbing select-none",
                      task.client_visible && "ring-1 ring-blue-300",
                      draggedId === task.id && "opacity-40"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setEditing(task)}
                      >
                        <div className="text-[13px] font-semibold text-navy-900 leading-snug">{task.title}</div>
                        <div className="text-[11px] text-navy-500 mt-0.5">
                          {task.priority} {task.due_at ? `\u00b7 ${formatDue(task.due_at)}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleVisibility(task)}
                        className={cn(
                          "bg-transparent border-none cursor-pointer p-1 rounded-md transition-all",
                          task.client_visible
                            ? "text-blue-500 hover:text-blue-700"
                            : "text-navy-300 hover:text-navy-500 opacity-0 group-hover:opacity-100"
                        )}
                        title={task.client_visible ? "Visible to client — click to hide" : "Hidden from client — click to share"}
                      >
                        {task.client_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                    {task.client_visible && (
                      <div className="text-[10px] text-blue-500 font-semibold mt-1 flex items-center gap-1">
                        <Users size={10} /> Shared with client
                      </div>
                    )}
                  </div>
                ))}
                {isOver && draggedId && (
                  <div className="h-14 rounded-[10px] border-2 border-dashed border-blue-300 bg-blue-50/60 mb-2" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Project Files ──────────────────────────────────────── */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-navy-800 flex items-center gap-2 m-0">
            <FileText size={15} className="text-navy-500" />
            Project Files
            {projectFiles.length > 0 && (
              <span className="text-[11px] font-bold text-navy-400 bg-navy-100 px-2 py-0.5 rounded-full">{projectFiles.length}</span>
            )}
          </h3>
          <button
            onClick={loadAvailable}
            className="bg-navy-50 text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-navy-100 transition-colors"
          >
            <Plus size={11} /> Add from Library
          </button>
        </div>

        {projectFiles.length === 0 ? (
          <div className="bg-white border border-navy-200 rounded-xl p-6 text-center text-navy-500 text-[12px]">
            No files linked to this project yet. Click "Add from Library" to attach files.
          </div>
        ) : (
          <div className="bg-white border border-navy-200 rounded-[14px] overflow-hidden">
            {(() => {
              // Group by folder
              const grouped: Record<string, ProjectFile[]> = {};
              for (const f of projectFiles) {
                const key = f.folder_name || "(No folder)";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(f);
              }
              const entries = Object.entries(grouped);

              return entries.map(([folder, files]) => (
                <div key={folder}>
                  {entries.length > 1 && (
                    <div className="px-4 py-2 bg-navy-50 border-b border-navy-200 text-[11px] font-bold text-navy-600 uppercase tracking-wider flex items-center gap-1.5">
                      <FolderOpen size={12} />
                      {folder}
                    </div>
                  )}
                  {files.map(file => {
                    const KIND_ICONS_MAP: Record<string, string> = { image: "bg-pink-500/10 text-pink-600", audio: "bg-violet-500/10 text-violet-600", video: "bg-red-500/10 text-red-600", pdf: "bg-amber-500/10 text-amber-600", sheet: "bg-green-500/10 text-green-600", doc: "bg-blue-500/10 text-blue-600" };
                    const colorClass = KIND_ICONS_MAP[file.kind] || "bg-navy-100 text-navy-600";
                    return (
                      <div key={file.id} className="px-4 py-2.5 border-b border-navy-100 flex items-center gap-3 group last:border-b-0">
                        <div
                          onClick={() => openFile(file)}
                          className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold uppercase cursor-pointer hover:scale-110 transition-transform", colorClass)}
                        >
                          {file.kind.slice(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openFile(file)}>
                          <div className="text-[13px] font-medium text-navy-900 truncate hover:text-blue-600 transition-colors">{file.name}</div>
                          <div className="text-[11px] text-navy-500">
                            {file.kind} · {file.size_bytes < 1048576 ? `${Math.round(file.size_bytes / 1024)} KB` : `${(file.size_bytes / 1048576).toFixed(1)} MB`}
                            {file.client_visible && <span className="text-blue-500 ml-2 font-semibold">Shared</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleFileVisibility(file)}
                          className={cn(
                            "bg-transparent border-none cursor-pointer p-1 rounded-md transition-all",
                            file.client_visible ? "text-blue-500" : "text-navy-300 opacity-0 group-hover:opacity-100"
                          )}
                          title={file.client_visible ? "Visible to client" : "Hidden from client"}
                        >
                          {file.client_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => confirm("Remove this file from the project?") && unlinkFile(file.id)}
                          className="bg-transparent border-none cursor-pointer p-1 text-navy-300 hover:text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove from project"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* File picker modal */}
      {showFilePicker && (
        <Modal onClose={() => setShowFilePicker(false)}>
          <div className="px-5 py-4 border-b border-navy-200 flex items-center">
            <h3 className="m-0 text-base font-bold text-navy-900">Add files from Library</h3>
            <button onClick={() => setShowFilePicker(false)} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
              <X size={16} />
            </button>
          </div>
          <div className="p-5 max-h-[60vh] overflow-auto">
            {availableFiles.length === 0 ? (
              <div className="text-navy-500 text-[13px] text-center py-6">
                No unlinked files found. Upload files in the Library first.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {availableFiles.map(f => (
                  <button
                    key={f.id}
                    onClick={() => linkFile(f.id)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-navy-200 bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left font-[inherit] w-full"
                  >
                    <FileText size={16} className="text-navy-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-navy-900 truncate">{f.name}</div>
                      <div className="text-[11px] text-navy-500">
                        {f.kind} · {f.size_bytes < 1048576 ? `${Math.round(f.size_bytes / 1024)} KB` : `${(f.size_bytes / 1048576).toFixed(1)} MB`}
                        {f.folder_name && <span className="ml-2">in {f.folder_name}</span>}
                      </div>
                    </div>
                    <Plus size={14} className="text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Image preview modal */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 bg-[rgba(10,15,30,0.85)] z-[100] flex items-center justify-center p-5 backdrop-blur-sm cursor-pointer"
        >
          <div onClick={e => e.stopPropagation()} className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 w-full">
              <span className="text-white text-sm font-semibold truncate flex-1">{preview.name}</span>
              <a
                href={preview.url.replace("?inline=1", "")}
                download={preview.name}
                className="bg-white/10 text-white border-none px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-white/20 transition-colors no-underline"
                onClick={e => e.stopPropagation()}
              >
                Download
              </a>
              <button
                onClick={() => setPreview(null)}
                className="bg-white/10 text-white border-none p-1.5 rounded-lg cursor-pointer hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {preview.mime.startsWith("image/") ? (
              <img
                src={preview.url}
                alt={preview.name}
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            ) : (
              <iframe
                src={preview.url}
                className="w-[80vw] h-[80vh] rounded-xl border-none bg-white"
                title={preview.name}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Project Documents ─────────────────────────────────── */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-navy-800 flex items-center gap-2 m-0">
            <PenLine size={15} className="text-navy-500" />
            Documents
            {documents.length > 0 && (
              <span className="text-[11px] font-bold text-navy-400 bg-navy-100 px-2 py-0.5 rounded-full">{documents.length}</span>
            )}
          </h3>
          <button
            onClick={() => setEditingDoc("new")}
            className="bg-navy-50 text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-navy-100 transition-colors"
          >
            <Plus size={11} /> New Document
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="bg-white border border-navy-200 rounded-xl p-6 text-center text-navy-500 text-[12px]">
            No documents yet. Click &quot;New Document&quot; to create one.
          </div>
        ) : (
          <div className="bg-white border border-navy-200 rounded-[14px] overflow-hidden">
            {documents.map((doc, i) => (
              <div
                key={doc.id}
                onClick={() => setEditingDoc(doc)}
                className={cn(
                  "px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-navy-50 transition-colors group",
                  i < documents.length - 1 && "border-b border-navy-100"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-navy-900 truncate">{doc.title}</div>
                  {doc.excerpt && (
                    <div className="text-[11px] text-navy-500 mt-0.5 line-clamp-1">{doc.excerpt.replace(/<[^>]*>/g, "")}</div>
                  )}
                  <div className="text-[10px] text-navy-400 mt-0.5">{relTime(doc.updated_at)}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteDocTarget(doc); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-red-500 shrink-0"
                  title="Delete document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <TaskModal
          task={null}
          projectId={project.id}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {editing && (
        <TaskModal
          task={editing}
          projectId={project.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onDelete={() => deleteTask(editing.id)}
        />
      )}
      {deleteDocTarget && (
        <Modal onClose={() => setDeleteDocTarget(null)}>
          <div className="p-6">
            <h3 className="text-base font-bold text-navy-900 mb-2">Delete document</h3>
            <p className="text-sm text-navy-600 mb-6">
              Delete <span className="font-semibold">{deleteDocTarget.title}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteDocTarget(null)}
                className="bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/documents/${deleteDocTarget.id}`, { method: "DELETE", credentials: "include" });
                  setDeleteDocTarget(null);
                  load();
                }}
                className="bg-red-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingDoc && (
        <DocumentEditor
          docId={editingDoc === "new" ? undefined : editingDoc.id}
          initialTitle={editingDoc === "new" ? undefined : editingDoc.title}
          projectId={project.id}
          onClose={() => setEditingDoc(null)}
          onSaved={() => load()}
          onDeleted={() => { setEditingDoc(null); load(); }}
        />
      )}
      {editingProject && (
        <EditProjectModal
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={(updated) => {
            setProject(updated);
            onUpdated?.(updated);
            setEditingProject(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ShareModal                                                         */
/* ------------------------------------------------------------------ */

function ShareModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<"members" | "links" | "updates" | "comments">("members");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // New share form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [permissions, setPermissions] = useState("view");
  const [creating, setCreating] = useState(false);

  // New member form
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("editor");
  const [inviting, setInviting] = useState(false);

  // New comment
  const [commentBody, setCommentBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sharesRes, updatesRes, commentsRes, membersRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/shares`, { credentials: "include" }),
        fetch(`/api/projects/${project.id}/updates`, { credentials: "include" }),
        fetch(`/api/projects/${project.id}/comments`, { credentials: "include" }),
        fetch(`/api/projects/${project.id}/members`, { credentials: "include" }),
      ]);
      const [sharesData, updatesData, commentsData, membersData] = await Promise.all([
        sharesRes.json(), updatesRes.json(), commentsRes.json(), membersRes.json(),
      ]);
      setShares(sharesData.shares || []);
      setUpdates(updatesData.updates || []);
      setComments(commentsData.comments || []);
      setMembers(membersData.members || []);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function inviteMember() {
    if (!memberEmail.trim()) return;
    setInviting(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail.trim().toLowerCase(), role: memberRole }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast("error", d.error || "Failed to invite");
        return;
      }
      toast("success", `${d.member.email} added as ${d.member.role}`);
      setMemberEmail("");
      load();
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member from the project?")) return;
    await fetch(`/api/projects/${project.id}/members/${userId}`, {
      method: "DELETE", credentials: "include",
    });
    load();
  }

  async function changeMemberRole(userId: string, newRole: string) {
    await fetch(`/api/projects/${project.id}/members/${userId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  }

  async function createShare() {
    setCreating(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/shares`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim() || undefined,
          client_email: clientEmail.trim() || undefined,
          permissions,
        }),
      });
      const d = await r.json();
      if (d.portal_url) {
        await navigator.clipboard.writeText(d.portal_url).catch(() => {});
        toast("success", "Share link created and copied!");
      }
      setClientName("");
      setClientEmail("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function revokeShare(shareId: string) {
    if (!confirm("Revoke this client's portal access? Their link will stop working immediately.")) return;
    await fetch(`/api/projects/${project.id}/shares/${shareId}`, {
      method: "DELETE", credentials: "include",
    });
    load();
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function publishUpdate(updateId: string) {
    await fetch(`/api/projects/${project.id}/updates/${updateId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish: true }),
    });
    toast("success", "Update published to client portal");
    load();
  }

  async function postComment() {
    if (!commentBody.trim()) return;
    await fetch(`/api/projects/${project.id}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody.trim() }),
    });
    setCommentBody("");
    load();
  }

  const tabs = [
    { key: "members" as const, label: "Team", icon: Users, count: members.length },
    { key: "links" as const, label: "Clients", icon: Link2, count: shares.filter(s => s.is_active).length },
    { key: "updates" as const, label: "Updates", icon: FileText, count: updates.length },
    { key: "comments" as const, label: "Comments", icon: MessageSquare, count: comments.length },
  ];

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center gap-3">
        <Share2 size={16} className="text-blue-500" />
        <div>
          <h3 className="m-0 text-base font-bold text-navy-900">Client Portal</h3>
          <div className="text-[11px] text-navy-500">{project.name}</div>
        </div>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-navy-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2.5 text-[12px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 border-b-2 transition-colors bg-transparent border-x-0 border-t-0 font-[inherit]",
              tab === t.key
                ? "text-blue-600 border-blue-600"
                : "text-navy-500 border-transparent hover:text-navy-700"
            )}
          >
            <t.icon size={13} />
            {t.label}
            {t.count > 0 && <span className="bg-navy-100 text-navy-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="p-5 max-h-[60vh] overflow-auto">
        {loading ? (
          <div className="text-navy-500 text-[13px] text-center py-4">Loading...</div>
        ) : tab === "members" ? (
          <div className="flex flex-col gap-4">
            {/* Invite form */}
            <div className="bg-navy-50 rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="text-[12px] font-bold text-navy-700">Invite team member</div>
              <div className="flex gap-2">
                <input
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") inviteMember(); }}
                  placeholder="Email address"
                  className="flex-1 px-2.5 py-2 text-[12px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white"
                />
                <select
                  value={memberRole}
                  onChange={e => setMemberRole(e.target.value)}
                  className="px-2.5 py-2 text-[12px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={inviteMember}
                  disabled={inviting || !memberEmail.trim()}
                  className="bg-blue-600 text-white border-none px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {inviting ? "..." : "Invite"}
                </button>
              </div>
              <div className="text-[10px] text-navy-400">They must have a workspace account. Editors can manage tasks and shares. Viewers can only view.</div>
            </div>

            {/* Member list */}
            {members.map(m => (
              <div key={m.id} className="border border-navy-200 rounded-xl p-3 bg-white flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
                  m.role === "owner" ? "bg-gradient-to-br from-amber-500 to-orange-600" :
                  m.role === "editor" ? "bg-gradient-to-br from-blue-500 to-blue-700" :
                  "bg-gradient-to-br from-navy-400 to-navy-600"
                )}>
                  {(m.name || m.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-navy-900 truncate">{m.name || m.email}</div>
                  <div className="text-[11px] text-navy-500">{m.email}</div>
                </div>
                {m.role === "owner" ? (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Owner</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={m.role}
                      onChange={e => changeMemberRole(m.id, e.target.value)}
                      className="text-[11px] border border-navy-200 rounded-md px-1.5 py-1 font-[inherit] text-navy-700 bg-white cursor-pointer"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="bg-transparent border-none cursor-pointer p-1 text-navy-400 hover:text-red-500 rounded-lg"
                      title="Remove member"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === "links" ? (
          <div className="flex flex-col gap-4">
            {/* Create new share */}
            <div className="bg-navy-50 rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="text-[12px] font-bold text-navy-700">Create share link</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Client name"
                  className="px-2.5 py-2 text-[12px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white"
                />
                <input
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="px-2.5 py-2 text-[12px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white"
                />
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={permissions}
                  onChange={e => setPermissions(e.target.value)}
                  className="px-2.5 py-2 text-[12px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white flex-1"
                >
                  <option value="view">View only</option>
                  <option value="comment">View + Comment</option>
                </select>
                <button
                  onClick={createShare}
                  disabled={creating}
                  className="bg-blue-600 text-white border-none px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>

            {/* Existing shares */}
            {shares.length === 0 ? (
              <div className="text-[13px] text-navy-500 text-center py-4">No share links yet</div>
            ) : (
              shares.map(share => (
                <div key={share.id} className={cn(
                  "border rounded-xl p-3 flex flex-col gap-2",
                  share.is_active ? "border-navy-200 bg-white" : "border-navy-100 bg-navy-50 opacity-60"
                )}>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-navy-900 truncate">
                        {share.client_name || "Unnamed client"}
                      </div>
                      <div className="text-[11px] text-navy-500">
                        {share.client_email || "No email"} · {share.permissions} · {share.is_active ? "Active" : "Revoked"}
                      </div>
                    </div>
                    {share.is_active && (
                      <>
                        <button
                          onClick={() => copyLink(share.token)}
                          className={cn(
                            "bg-transparent border-none cursor-pointer p-1.5 rounded-lg transition-colors",
                            copiedToken === share.token ? "text-green-500" : "text-navy-400 hover:text-blue-500"
                          )}
                          title={copiedToken === share.token ? "Copied!" : "Copy portal link"}
                        >
                          {copiedToken === share.token ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => revokeShare(share.id)}
                          className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 hover:text-red-500 rounded-lg"
                          title="Revoke access"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                  {share.last_viewed_at && (
                    <div className="text-[10px] text-navy-400">Last viewed {relTime(share.last_viewed_at)}</div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : tab === "updates" ? (
          <div className="flex flex-col gap-3">
            {updates.length === 0 ? (
              <div className="text-[13px] text-navy-500 text-center py-4">
                No updates yet. Ask the AI assistant to generate one.
              </div>
            ) : (
              updates.map(u => (
                <div key={u.id} className="border border-navy-200 rounded-xl p-3.5 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    {u.ai_generated && <Sparkles size={12} className="text-blue-500" />}
                    <span className="text-[13px] font-bold text-navy-900">{u.title || "Update"}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto",
                      u.published_at
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    )}>
                      {u.published_at ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="text-[12px] text-navy-700 whitespace-pre-wrap leading-relaxed">{u.body}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-navy-400">{relTime(u.created_at)}</span>
                    {!u.published_at && (
                      <button
                        onClick={() => publishUpdate(u.id)}
                        className="ml-auto bg-green-600 text-white border-none px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer font-[inherit] hover:bg-green-700 transition-colors"
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.length === 0 ? (
              <div className="text-[13px] text-navy-500 text-center py-4">No comments yet</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className={cn(
                  "rounded-xl p-3 text-[12px]",
                  c.author_type === "owner"
                    ? "bg-blue-50 border border-blue-200 ml-6"
                    : "bg-white border border-navy-200 mr-6"
                )}>
                  <div className="font-bold text-navy-800 text-[11px] mb-1">
                    {c.author_name || (c.author_type === "owner" ? "You" : "Client")}
                    <span className="font-normal text-navy-400 ml-2">{relTime(c.created_at)}</span>
                  </div>
                  <div className="text-navy-700 whitespace-pre-wrap">{c.body}</div>
                </div>
              ))
            )}
            <div className="flex gap-2 mt-1">
              <input
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") postComment(); }}
                placeholder="Reply to client..."
                className="flex-1 px-3 py-2 text-[12px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white"
              />
              <button
                onClick={postComment}
                disabled={!commentBody.trim()}
                className="bg-blue-600 text-white border-none p-2 rounded-lg cursor-pointer disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  EditProjectModal                                                   */
/* ------------------------------------------------------------------ */

const PRESET_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
  "#f59e0b", "#10b981", "#ef4444", "#64748b",
];

function EditProjectModal({ project, onClose, onSaved }: {
  project: Project; onClose: () => void; onSaved: (updated: Project) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [stage, setStage] = useState(project.stage);
  const [dueDate, setDueDate] = useState(project.due_date ? project.due_date.slice(0, 10) : "");
  const [color, setColor] = useState(project.color);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          stage,
          due_date: dueDate || null,
          color,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast("error", d.error || "Failed to save"); return; }
      onSaved(d.project);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">Edit project</h3>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-3">
        <TextInput label="Project name *" value={name} onChange={setName} />
        <div>
          <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Description</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
            className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SelectInput label="Stage" value={stage} onChange={setStage}
            options={[["backlog","Backlog"],["discovery","Discovery"],["in_progress","In Progress"],["review","Review"],["done","Done"]]} />
          <div>
            <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Due date</div>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
            />
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Color</div>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110",
                  color === c ? "border-navy-900 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-7 h-7 rounded-full border border-navy-200 cursor-pointer p-0 bg-transparent"
              title="Custom color"
            />
          </div>
        </div>
        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className={cn(
            "bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit] mt-1",
            !name.trim() || saving ? "opacity-60 cursor-wait" : "cursor-pointer",
          )}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  NewProjectModal                                                    */
/* ------------------------------------------------------------------ */

function NewProjectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast("error", d.error || "Failed to create project.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">New project</h3>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-2.5">
        <TextInput label="Project name *" value={name} onChange={setName} autoFocus />
        <div>
          <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Description</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
            className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border resize-y"
          />
        </div>
        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className={cn(
            "bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit]",
            !name.trim() || saving ? "opacity-60 cursor-wait" : "cursor-pointer",
          )}
        >
          {saving ? "Creating..." : "Create project"}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskModal (create + edit)                                          */
/* ------------------------------------------------------------------ */

function TaskModal({ task, projectId, onClose, onSaved, onDelete }: {
  task: Task | null;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const isEdit = !!task;
  const [f, setF] = useState<TaskForm>(
    task
      ? {
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          status: task.status,
          due_at: isoToLocal(task.due_at),
          tags: (task.tags || []).join(", "),
        }
      : { title: "", description: "", priority: "medium", status: "open", due_at: "", tags: "" }
  );
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: f.title.trim(),
        description: f.description.trim() || null,
        priority: f.priority,
        status: f.status,
        due_at: localToIso(f.due_at),
        tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        project_id: projectId,
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
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">{isEdit ? "Edit task" : "New task"}</h3>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-2.5">
        <TextInput label="Title *" value={f.title} onChange={v => setF({ ...f, title: v })} autoFocus />
        <div>
          <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Description</div>
          <textarea
            value={f.description}
            onChange={e => setF({ ...f, description: e.target.value })}
            rows={3}
            placeholder="Optional description"
            className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SelectInput label="Priority" value={f.priority} onChange={v => setF({ ...f, priority: v })}
            options={[["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
          <SelectInput label="Status" value={f.status} onChange={v => setF({ ...f, status: v })}
            options={[["open", "To Do"], ["in_progress", "In Progress"], ["done", "Done"]]} />
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
          <TextInput label="Tags (comma sep.)" value={f.tags} onChange={v => setF({ ...f, tags: v })} />
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={save}
            disabled={!f.title.trim() || saving}
            className={cn(
              "flex-1 bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit]",
              !f.title.trim() || saving ? "opacity-60 cursor-wait" : "cursor-pointer",
            )}
          >
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create task"}
          </button>
          {isEdit && onDelete && (
            <button
              onClick={onDelete}
              className="bg-navy-100 text-red-500 border border-navy-200 px-4 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] hover:bg-red-50 hover:border-red-200 transition-all"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
