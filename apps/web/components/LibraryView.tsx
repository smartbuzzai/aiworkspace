"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Search, Upload, X, Trash2, Download, FileText, Image, Music,
  Video, File, Table2, Presentation, BookOpen,
  FolderOpen, FolderPlus, ChevronRight, PenLine, Pencil, Check,
} from "lucide-react";
import DocumentEditor from "./shared/DocumentEditor";
import { cn } from "../lib/cn";
import { useToast } from "./shared/Toast";
import { relTime } from "../lib/date";
import Modal from "./shared/Modal";

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface FileItem {
  id: string;
  name: string;
  kind: "image" | "audio" | "video" | "pdf" | "sheet" | "slides" | "doc" | "other";
  mime_type: string;
  size_bytes: number;
  created_at: string;
  extracted_text: string | null;
}

interface FolderItem {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  created_at: string;
}

interface FolderRef {
  id: string;
  name: string;
  path: string;
}

interface Document {
  id: string;
  title: string;
  excerpt: string;
  project_id: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

const KIND_ICONS: Record<string, any> = {
  image: Image,
  audio: Music,
  video: Video,
  pdf: FileText,
  sheet: Table2,
  slides: Presentation,
  doc: BookOpen,
  other: File,
};

const KIND_COLORS: Record<string, string> = {
  image: "bg-pink-500/10 text-pink-600",
  audio: "bg-violet-500/10 text-violet-600",
  video: "bg-red-500/10 text-red-600",
  pdf: "bg-amber-500/10 text-amber-600",
  sheet: "bg-green-500/10 text-green-600",
  slides: "bg-orange-500/10 text-orange-600",
  doc: "bg-blue-500/10 text-blue-600",
  other: "bg-navy-100 text-navy-600",
};

const KIND_FILTER_LABELS: Record<string, string> = {
  image: "Images",
  doc: "Documents",
  pdf: "Documents",
  audio: "Audio",
  video: "Video",
  sheet: "Sheets",
  slides: "Slides",
  other: "Other",
};

const FILTER_CHIPS = ["Images", "Documents", "Audio", "Video", "Sheets", "Slides", "Other"] as const;

function kindMatchesFilter(kind: string, filter: string): boolean {
  if (filter === "Documents") return kind === "doc" || kind === "pdf";
  return KIND_FILTER_LABELS[kind] === filter;
}

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export default function LibraryView() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Folder navigation
  const [currentFolder, setCurrentFolder] = useState<FolderRef | null>(null);
  const [folderStack, setFolderStack] = useState<FolderRef[]>([]);

  // Kind filter
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderItem | null>(null);

  // New folder creation
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderRef = useRef<HTMLInputElement>(null);

  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editingDoc, setEditingDoc] = useState<Document | null | "new">(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<Document | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (currentFolder) params.set("folder_id", currentFolder.id);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const folderParams = new URLSearchParams();
      if (currentFolder) folderParams.set("parent_id", currentFolder.id);
      const fqs = folderParams.toString() ? `?${folderParams.toString()}` : "";

      const docParams = new URLSearchParams();
      if (currentFolder) {
        docParams.set("folder_id", currentFolder.id);
      } else {
        docParams.set("location", "library");
      }
      const dqs = `?${docParams.toString()}`;

      const [filesRes, foldersRes, docsRes] = await Promise.all([
        fetch(`/api/files${qs}`, { credentials: "include" }),
        fetch(`/api/files/folders${fqs}`, { credentials: "include" }),
        fetch(`/api/documents${dqs}`, { credentials: "include" }),
      ]);
      const filesData = await filesRes.json();
      const foldersData = await foldersRes.json();
      const docsData = await docsRes.json();
      setFiles(filesData.files || []);
      setFolders(foldersData.folders || []);
      setDocuments(docsData.documents || []);
    } finally {
      setLoading(false);
    }
  }, [q, currentFolder]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (showNewFolder && newFolderRef.current) {
      newFolderRef.current.focus();
    }
  }, [showNewFolder]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const all = Array.from(fileList);
    setUploading(true);
    setUploadProgress({ done: 0, total: all.length });
    let failed = 0;
    try {
      for (let i = 0; i < all.length; i++) {
        const fd = new FormData();
        if (currentFolder) fd.append("folder_id", currentFolder.id);
        fd.append("file", all[i]);
        const r = await fetch("/api/files", { method: "POST", credentials: "include", body: fd });
        if (!r.ok) failed++;
        setUploadProgress({ done: i + 1, total: all.length });
      }
      load();
      if (failed > 0) {
        toast("error", `${failed} of ${all.length} file${all.length > 1 ? "s" : ""} failed to upload.`);
      } else {
        toast("success", `${all.length} file${all.length > 1 ? "s" : ""} uploaded.`);
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function downloadFile(file: FileItem) {
    try {
      const a = document.createElement("a");
      a.href = `/api/files/${file.id}/download`;
      a.download = file.name;
      a.click();
    } catch {
      toast("error", "Download failed.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const r = await fetch(`/api/files/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      setDeleteTarget(null);
      load();
    } catch {
      toast("error", "Failed to delete file.");
    }
  }

  function navigateToFolder(folder: FolderItem) {
    const ref: FolderRef = { id: folder.id, name: folder.name, path: folder.path };
    setFolderStack(prev => [...prev, ...(currentFolder ? [currentFolder] : [])]);
    setCurrentFolder(ref);
  }

  function navigateToBreadcrumb(index: number) {
    if (index < 0) {
      // Root
      setCurrentFolder(null);
      setFolderStack([]);
    } else {
      setCurrentFolder(folderStack[index]);
      setFolderStack(prev => prev.slice(0, index));
    }
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const r = await fetch("/api/files/folders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parent_id: currentFolder?.id || null }),
      });
      if (!r.ok) {
        toast("error", "Failed to create folder.");
        return;
      }
      setNewFolderName("");
      setShowNewFolder(false);
      load();
    } catch {
      toast("error", "Failed to create folder.");
    }
  }

  async function confirmDeleteFolder() {
    if (!deleteFolderTarget) return;
    try {
      const r = await fetch(`/api/files/folders/${deleteFolderTarget.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      setDeleteFolderTarget(null);
      load();
    } catch {
      toast("error", "Failed to delete folder.");
    }
  }

  async function renameFolder(folderId: string, name: string) {
    try {
      const r = await fetch(`/api/files/folders/${folderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error();
      load();
    } catch {
      toast("error", "Failed to rename folder.");
      load();
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }

  // Client-side kind filtering
  const filteredFiles = kindFilter
    ? files.filter(f => kindMatchesFilter(f.kind, kindFilter))
    : files;

  // Count files per filter chip
  const kindCounts: Record<string, number> = {};
  for (const chip of FILTER_CHIPS) kindCounts[chip] = 0;
  for (const f of files) {
    const label = KIND_FILTER_LABELS[f.kind];
    if (label && kindCounts[label] !== undefined) kindCounts[label]++;
  }

  return (
    <div
      className="flex flex-col gap-4"
      onDragOver={e => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="bg-white border border-navy-200 rounded-xl p-3.5 flex gap-2.5 items-center flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-navy-50 border border-navy-200 rounded-lg px-3 py-[7px]">
          <Search size={15} className="text-navy-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search files by name or content"
            className="border-none outline-none bg-transparent text-[13px] w-full text-navy-800 font-[inherit]"
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => uploadFiles(e.target.files)}
        />
        <button
          onClick={() => setShowNewFolder(true)}
          className="bg-navy-50 text-navy-700 border border-navy-200 px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-navy-100 transition-colors"
        >
          <FolderPlus size={13} /> New Folder
        </button>
        <button
          onClick={() => setEditingDoc("new")}
          className="bg-navy-50 text-navy-700 border border-navy-200 px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-navy-100 transition-colors"
        >
          <PenLine size={13} /> New Doc
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "bg-blue-600 text-white border-none px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit]",
            uploading && "opacity-60 cursor-wait"
          )}
        >
          <Upload size={13} /> {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : uploading ? "Uploading\u2026" : "Upload"}
        </button>
      </div>

      {/* Breadcrumb bar */}
      {(currentFolder || folderStack.length > 0) && (
        <div className="flex items-center gap-1 text-[13px] px-1">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="bg-transparent border-none cursor-pointer text-blue-600 hover:underline font-semibold font-[inherit] p-0"
          >
            Library
          </button>
          {folderStack.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight size={12} className="text-navy-400" />
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className="bg-transparent border-none cursor-pointer text-blue-600 hover:underline font-semibold font-[inherit] p-0"
              >
                {f.name}
              </button>
            </span>
          ))}
          {currentFolder && (
            <span className="flex items-center gap-1">
              <ChevronRight size={12} className="text-navy-400" />
              <span className="text-navy-800 font-semibold">{currentFolder.name}</span>
            </span>
          )}
        </div>
      )}

      {/* New folder inline input */}
      {showNewFolder && (
        <div className="bg-white border border-navy-200 rounded-xl p-3 flex gap-2 items-center">
          <FolderOpen size={16} className="text-blue-500 shrink-0" />
          <input
            ref={newFolderRef}
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") createFolder();
              if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
            }}
            placeholder="Folder name"
            className="border-none outline-none bg-transparent text-[13px] flex-1 text-navy-800 font-[inherit]"
          />
          <button
            onClick={createFolder}
            disabled={!newFolderName.trim()}
            className={cn(
              "bg-blue-600 text-white border-none px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer font-[inherit]",
              !newFolderName.trim() && "opacity-40 cursor-not-allowed"
            )}
          >
            Create
          </button>
          <button
            onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
            className="bg-transparent border-none cursor-pointer p-1 text-navy-400 hover:text-navy-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Kind filter chips */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <button
            onClick={() => setKindFilter(null)}
            className={cn(
              "border rounded-full px-3 py-1 text-[12px] font-semibold cursor-pointer transition-colors font-[inherit]",
              kindFilter === null
                ? "bg-navy-800 text-white border-navy-800"
                : "bg-white text-navy-600 border-navy-200 hover:bg-navy-50"
            )}
          >
            All ({files.length})
          </button>
          {FILTER_CHIPS.map(chip => {
            const count = kindCounts[chip] || 0;
            if (count === 0) return null;
            const isActive = kindFilter === chip;
            // Find a representative color for this chip
            const sampleKind = Object.entries(KIND_FILTER_LABELS).find(([, label]) => label === chip)?.[0] || "other";
            const activeColor = KIND_COLORS[sampleKind] || KIND_COLORS.other;
            return (
              <button
                key={chip}
                onClick={() => setKindFilter(isActive ? null : chip)}
                className={cn(
                  "border rounded-full px-3 py-1 text-[12px] font-semibold cursor-pointer transition-colors font-[inherit]",
                  isActive
                    ? `${activeColor} border-transparent`
                    : "bg-white text-navy-600 border-navy-200 hover:bg-navy-50"
                )}
              >
                {chip} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Drop zone overlay */}
      {dragOver && (
        <div className="border-2 border-dashed border-blue-400 bg-blue-500/[0.04] rounded-xl p-10 text-center text-blue-600 text-sm font-semibold">
          Drop files here to upload
        </div>
      )}

      {/* Folder + file list */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white border border-navy-200 rounded-[14px] p-4 flex gap-3.5 animate-pulse">
              <div className="w-[46px] h-[46px] rounded-xl bg-navy-100 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2 py-1">
                <div className="h-3.5 bg-navy-100 rounded w-3/4" />
                <div className="h-2.5 bg-navy-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : folders.length === 0 && filteredFiles.length === 0 ? (
        <div className="bg-white border border-navy-200 rounded-xl p-10 text-center text-navy-500 text-sm">
          {q ? "No files match that search." : "No files uploaded yet. Drag & drop or click Upload."}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
          {folders.map(folder => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onClick={() => navigateToFolder(folder)}
              onDelete={() => setDeleteFolderTarget(folder)}
              onRename={(name) => renameFolder(folder.id, name)}
            />
          ))}
          {filteredFiles.map(f => (
            <FileCard
              key={f.id}
              file={f}
              onDownload={() => downloadFile(f)}
              onDelete={() => setDeleteTarget(f)}
            />
          ))}
        </div>
      )}

      {/* Documents section */}
      {documents.length > 0 && (
        <div className="mt-2">
          <h3 className="text-sm font-bold text-navy-800 flex items-center gap-2 mb-3">
            <PenLine size={15} className="text-navy-500" />
            Documents
            <span className="text-[11px] font-bold text-navy-400 bg-navy-100 px-2 py-0.5 rounded-full">{documents.length}</span>
          </h3>
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
        </div>
      )}

      {/* Delete document confirmation modal */}
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
                  try {
                    const r = await fetch(`/api/documents/${deleteDocTarget.id}`, { method: "DELETE", credentials: "include" });
                    if (!r.ok) throw new Error();
                    setDeleteDocTarget(null);
                    load();
                  } catch {
                    toast("error", "Failed to delete document.");
                  }
                }}
                className="bg-red-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete file confirmation modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="p-6">
            <h3 className="text-base font-bold text-navy-900 mb-2">Delete file</h3>
            <p className="text-sm text-navy-600 mb-6">
              Delete <span className="font-semibold">{deleteTarget.name}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete folder confirmation modal */}
      {deleteFolderTarget && (
        <Modal onClose={() => setDeleteFolderTarget(null)}>
          <div className="p-6">
            <h3 className="text-base font-bold text-navy-900 mb-2">Delete folder</h3>
            <p className="text-sm text-navy-600 mb-6">
              Delete <span className="font-semibold">{deleteFolderTarget.name}</span>? Files inside will be moved to the root.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteFolderTarget(null)}
                className="bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFolder}
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
          folderId={editingDoc === "new" ? (currentFolder?.id ?? null) : editingDoc.folder_id}
          initialTitle={editingDoc === "new" ? undefined : editingDoc.title}
          onClose={() => setEditingDoc(null)}
          onSaved={() => load()}
          onDeleted={() => { setEditingDoc(null); load(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FolderCard                                                         */
/* ------------------------------------------------------------------ */

function FolderCard({
  folder, onClick, onDelete, onRename,
}: {
  folder: FolderItem; onClick: () => void; onDelete: () => void; onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename(e: React.MouseEvent) {
    e.stopPropagation();
    setDraftName(folder.name);
    setRenaming(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  }

  function commitRename(e?: React.MouseEvent) {
    e?.stopPropagation();
    const name = draftName.trim();
    if (name && name !== folder.name) onRename(name);
    setRenaming(false);
  }

  return (
    <div
      onClick={renaming ? undefined : onClick}
      className={cn(
        "bg-white border border-navy-200 rounded-[14px] p-4 flex gap-3.5 group transition-all hover:border-blue-400 hover:-translate-y-px",
        renaming ? "cursor-default" : "cursor-pointer"
      )}
    >
      <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600">
        <FolderOpen size={20} />
      </div>
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input
            ref={inputRef}
            value={draftName}
            autoFocus
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
              if (e.key === "Escape") { setRenaming(false); }
            }}
            onClick={e => e.stopPropagation()}
            className="w-full text-sm font-semibold text-navy-900 border border-blue-400 rounded-md px-1.5 py-0.5 outline-none font-[inherit] bg-white"
          />
        ) : (
          <div className="text-sm font-semibold text-navy-900 truncate">{folder.name}</div>
        )}
        <div className="text-[11px] text-navy-500 mt-0.5 flex items-center gap-2">
          <span className="uppercase font-bold">Folder</span>
          <span>&middot;</span>
          <span>{relTime(folder.created_at)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {renaming ? (
          <button
            onClick={commitRename}
            className="bg-transparent border-none cursor-pointer p-1.5 text-blue-500 rounded-lg hover:text-blue-700"
            title="Save rename"
          >
            <Check size={14} />
          </button>
        ) : (
          <button
            onClick={startRename}
            className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-navy-700"
            title="Rename folder"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-red-500"
          title="Delete folder"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FileCard                                                           */
/* ------------------------------------------------------------------ */

function FileCard({ file, onDownload, onDelete }: { file: FileItem; onDownload: () => void; onDelete: () => void }) {
  const Icon = KIND_ICONS[file.kind] || File;
  const colorClass = KIND_COLORS[file.kind] || KIND_COLORS.other;
  const [expanded, setExpanded] = useState(false);
  const hasLongText = file.extracted_text && file.extracted_text.length > 80;

  return (
    <div className="bg-white border border-navy-200 rounded-[14px] p-4 flex gap-3.5 group transition-all hover:border-blue-400 hover:-translate-y-px">
      <div className={cn("w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0", colorClass)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-navy-900 truncate">{file.name}</div>
        <div className="text-[11px] text-navy-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="uppercase font-bold">{file.kind}</span>
          <span>&middot;</span>
          <span>{formatSize(file.size_bytes)}</span>
          <span>&middot;</span>
          <span>{relTime(file.created_at)}</span>
        </div>
        {file.extracted_text && (
          <div className="text-[11px] text-navy-400 mt-1">
            {expanded ? (
              <span className="whitespace-pre-wrap break-words">{file.extracted_text}</span>
            ) : (
              <span>{file.extracted_text.slice(0, 80)}{hasLongText ? "\u2026" : ""}</span>
            )}
            {hasLongText && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
                className="bg-transparent border-none text-blue-500 text-[11px] cursor-pointer p-0 ml-1 font-[inherit]"
              >
                {expanded ? "show less" : "show more"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDownload}
          className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-blue-500"
          title="Download"
        >
          <Download size={14} />
        </button>
        <button
          onClick={onDelete}
          className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-red-500"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
