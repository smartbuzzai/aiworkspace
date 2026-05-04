"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Undo2, Redo2, ChevronLeft, FileText,
  FolderOpen, ChevronDown, Check, Briefcase, Trash2,
  Link2, Link2Off, Underline as UnderlineIcon, Highlighter, ListChecks, FileCode,
} from "lucide-react";
import { cn } from "../../lib/cn";

const lowlight = createLowlight(common);

interface DocumentEditorProps {
  docId?: string;
  projectId?: string | null;
  folderId?: string | null;
  initialTitle?: string;
  onClose: () => void;
  onSaved?: (doc: DocRecord) => void;
  onDeleted?: () => void;
}

interface DocRecord {
  id: string;
  title: string;
  content: Record<string, unknown>;
  content_html: string;
  project_id: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface Folder {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
}

export default function DocumentEditor({
  docId,
  projectId,
  folderId,
  initialTitle,
  onClose,
  onSaved,
  onDeleted,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle || "");
  const [docIdState, setDocIdState] = useState<string | undefined>(docId);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savedTime, setSavedTime] = useState<Date | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId ?? null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId ?? null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [documentLoaded, setDocumentLoaded] = useState(!docId);
  const [pendingContent, setPendingContent] = useState<{ content: Record<string, unknown>; content_html: string } | null>(null);

  const titleRef = useRef(title);
  const docIdRef = useRef(docIdState);
  const selectedProjectIdRef = useRef<string | null>(projectId ?? null);
  const selectedFolderIdRef = useRef<string | null>(folderId ?? null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const locationPickerRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { docIdRef.current = docIdState; }, [docIdState]);
  useEffect(() => { selectedProjectIdRef.current = selectedProjectId; }, [selectedProjectId]);
  useEffect(() => { selectedFolderIdRef.current = selectedFolderId; }, [selectedFolderId]);

  // Close location picker on outside click
  useEffect(() => {
    if (!showLocationPicker) return;
    const handler = (e: MouseEvent) => {
      if (locationPickerRef.current && !locationPickerRef.current.contains(e.target as Node)) {
        setShowLocationPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLocationPicker]);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects", { credentials: "include" }).then(r => r.json()),
      fetch("/api/files/folders?all=true", { credentials: "include" }).then(r => r.json()),
    ]).then(([projData, folderData]) => {
      setProjects(projData.projects || []);
      setFolders(folderData.folders || []);
    }).catch(() => {});
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Link.configure({ openOnClick: false }),
      CharacterCount,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "ProseMirror focus:outline-none min-h-[400px]" },
    },
    onUpdate: () => { scheduleSave(); },
  });

  // Fetch document data independently of editor readiness
  useEffect(() => {
    if (!docId) return;
    fetch(`/api/documents/${docId}`, { credentials: "include" })
      .then(r => r.json())
      .then((doc: DocRecord) => {
        setTitle(doc.title);
        titleRef.current = doc.title;
        setSelectedProjectId(doc.project_id);
        selectedProjectIdRef.current = doc.project_id;
        setSelectedFolderId(doc.folder_id);
        selectedFolderIdRef.current = doc.folder_id;
        setPendingContent({ content: doc.content, content_html: doc.content_html });
      })
      .catch(err => console.error("Failed to load document:", err))
      .finally(() => setDocumentLoaded(true));
  }, [docId]);

  // Apply fetched content once editor is ready
  useEffect(() => {
    if (!editor || !pendingContent) return;
    if (pendingContent.content && typeof pendingContent.content === "object" && Object.keys(pendingContent.content).length > 0) {
      editor.commands.setContent(pendingContent.content as any);
    } else if (pendingContent.content_html) {
      editor.commands.setContent(pendingContent.content_html);
    }
    setPendingContent(null);
  }, [editor, pendingContent]);

  const save = useCallback(async () => {
    if (isSavingRef.current || !editor) return;
    isSavingRef.current = true;
    setSaveStatus("saving");

    const currentTitle = titleRef.current || "Untitled";
    const currentDocId = docIdRef.current;
    const currentProjectId = selectedProjectIdRef.current;
    const currentFolderId = selectedFolderIdRef.current;
    const content = editor.getJSON();
    const content_html = editor.getHTML();

    try {
      let doc: DocRecord;
      if (currentDocId) {
        const r = await fetch(`/api/documents/${currentDocId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: currentTitle, content, content_html, project_id: currentProjectId, folder_id: currentFolderId }),
        });
        doc = await r.json();
      } else {
        const r = await fetch("/api/documents", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: currentTitle, content, content_html, project_id: currentProjectId ?? null, folder_id: currentFolderId ?? null }),
        });
        doc = await r.json();
        setDocIdState(doc.id);
        docIdRef.current = doc.id;
      }
      setSaveStatus("saved");
      setSavedTime(new Date());
      onSaved?.(doc);
    } catch (err) {
      console.error("Document save failed:", err);
      setSaveStatus("idle");
    } finally {
      isSavingRef.current = false;
    }
  }, [editor, onSaved]);

  // Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { save(); }, 2000);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    titleRef.current = e.target.value;
    scheduleSave();
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); editor?.commands.focus(); }
  }

  function selectProject(id: string | null) {
    setSelectedProjectId(id);
    selectedProjectIdRef.current = id;
    setSelectedFolderId(null);
    selectedFolderIdRef.current = null;
    setShowLocationPicker(false);
    if (docIdRef.current) scheduleSave();
  }

  function selectFolder(id: string | null) {
    setSelectedFolderId(id);
    selectedFolderIdRef.current = id;
    setSelectedProjectId(null);
    selectedProjectIdRef.current = null;
    setShowLocationPicker(false);
    if (docIdRef.current) scheduleSave();
  }

  function handleLinkButton() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      setLinkUrl(editor.getAttributes("link").href || "");
      setShowLinkInput(true);
      setTimeout(() => linkInputRef.current?.focus(), 0);
    }
  }

  function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    const url = linkUrl.trim();
    if (url) {
      const href = url.startsWith("http") ? url : `https://${url}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const text = editor?.getText() ?? "";
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const charCount = editor?.storage.characterCount?.characters?.() ?? 0;

  function formatSavedTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const locationLabel = selectedProjectId
    ? (projects.find(p => p.id === selectedProjectId)?.name ?? "Project")
    : selectedFolderId
    ? (folders.find(f => f.id === selectedFolderId)?.name ?? "Folder")
    : "Library";

  const showSkeleton = !editor || !documentLoaded;

  return (
    <>
      <style>{`
        .ProseMirror h1 { font-size: 1.75rem; font-weight: 800; margin: 1rem 0 0.5rem; }
        .ProseMirror h2 { font-size: 1.375rem; font-weight: 700; margin: 0.875rem 0 0.4rem; }
        .ProseMirror h3 { font-size: 1.125rem; font-weight: 700; margin: 0.75rem 0 0.375rem; }
        .ProseMirror p { margin: 0.5rem 0; line-height: 1.65; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; }
        .ProseMirror li { margin: 0.25rem 0; }
        .ProseMirror blockquote { border-left: 3px solid #94a3b8; padding-left: 1rem; color: #64748b; margin: 0.75rem 0; }
        .ProseMirror code { background: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.875em; font-family: monospace; }
        .ProseMirror pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.75rem 0; }
        .ProseMirror pre code { background: none; padding: 0; color: inherit; font-size: 0.875em; }
        .ProseMirror hr { border: none; border-top: 2px solid #e2e8f0; margin: 1.5rem 0; }
        .ProseMirror a { color: #2563eb; text-decoration: underline; cursor: pointer; }
        .ProseMirror mark { background-color: #fef08a; padding: 0 2px; border-radius: 2px; }
        .ProseMirror u { text-decoration: underline; }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; margin: 0.5rem 0; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .ProseMirror ul[data-type="taskList"] li > label { display: flex; align-items: center; margin-top: 0.3rem; user-select: none; }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; accent-color: #2563eb; }
        .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { opacity: 0.5; text-decoration: line-through; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #94a3b8; pointer-events: none; height: 0; }
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #c792ea; }
        .hljs-string, .hljs-attr-value, .hljs-template-variable { color: #c3e88d; }
        .hljs-number, .hljs-literal { color: #f78c6c; }
        .hljs-comment { color: #546e7a; font-style: italic; }
        .hljs-function .hljs-title, .hljs-title.function_ { color: #82aaff; }
        .hljs-attr, .hljs-type, .hljs-class .hljs-title { color: #ffcb6b; }
        .hljs-variable, .hljs-params { color: #f07178; }
        .hljs-operator, .hljs-punctuation { color: #89ddff; }
        .hljs-tag { color: #f07178; }
        .hljs-meta { color: #89ddff; }
        .hljs-selector-class, .hljs-selector-id { color: #ffcb6b; }
        .hljs-name { color: #f07178; }
      `}</style>

      <div className="fixed inset-0 z-[70] bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={onClose}
            className="bg-slate-50 border border-slate-200 text-slate-600 p-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-[12px] font-semibold font-[inherit]"
          >
            <ChevronLeft size={15} />
            Back
          </button>

          <FileText size={15} className="text-slate-400 shrink-0" />

          {/* Location picker */}
          <div className="relative shrink-0" ref={locationPickerRef}>
            <button
              onClick={() => setShowLocationPicker(p => !p)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer font-[inherit]"
            >
              {selectedProjectId ? <Briefcase size={10} /> : <FolderOpen size={10} />}
              {locationLabel}
              <ChevronDown size={10} />
            </button>
            {showLocationPicker && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Library</div>
                <button
                  onClick={() => selectFolder(null)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 cursor-pointer border-none font-[inherit]",
                    !selectedProjectId && !selectedFolderId ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <FolderOpen size={12} className="shrink-0" />
                  <span className="flex-1 truncate">Root</span>
                  {!selectedProjectId && !selectedFolderId && <Check size={11} className="shrink-0" />}
                </button>
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => selectFolder(f.id)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 cursor-pointer border-none font-[inherit]",
                      selectedFolderId === f.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <FolderOpen size={12} className="shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    {selectedFolderId === f.id && <Check size={11} className="shrink-0" />}
                  </button>
                ))}
                {projects.length > 0 && (
                  <>
                    <div className="border-t border-slate-100 mt-1 pt-1 px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Projects</div>
                    {projects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => selectProject(p.id)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 cursor-pointer border-none font-[inherit]",
                          selectedProjectId === p.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Briefcase size={12} className="shrink-0" />
                        <span className="flex-1 truncate">{p.name}</span>
                        {selectedProjectId === p.id && <Check size={11} className="shrink-0" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-slate-400">
              {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount} chars
            </span>

            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500">
                <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                Saving…
              </span>
            )}
            {saveStatus === "saved" && savedTime && (
              <span className="text-[11px] font-semibold text-green-600">
                Saved {formatSavedTime(savedTime)}
              </span>
            )}

            {docIdState && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-transparent border border-slate-200 text-slate-400 p-1.5 rounded-lg cursor-pointer hover:border-red-300 hover:text-red-500 transition-colors font-[inherit]"
                title="Delete document"
              >
                <Trash2 size={14} />
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-semibold text-red-700">Delete this document?</span>
                <button
                  onClick={async () => {
                    if (!docIdState) return;
                    await fetch(`/api/documents/${docIdState}`, { method: "DELETE", credentials: "include" });
                    onDeleted?.();
                    onClose();
                  }}
                  className="bg-red-600 text-white border-none px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-transparent border-none text-slate-500 text-[11px] cursor-pointer font-[inherit] hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={save}
              disabled={saveStatus === "saving"}
              className="bg-blue-600 text-white border-none px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] hover:bg-blue-700 transition-colors disabled:opacity-60"
              title="Save (Ctrl+S)"
            >
              Save
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0 flex-wrap">
          {editor ? (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)"><Bold size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)"><Italic size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)"><UnderlineIcon size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><Strikethrough size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight"><Highlighter size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code"><Code size={14} /></ToolbarButton>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1"><Heading1 size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2"><Heading2 size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3"><Heading3 size={14} /></ToolbarButton>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list"><List size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered list"><ListOrdered size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task list"><ListChecks size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote"><Quote size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block"><FileCode size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule"><Minus size={14} /></ToolbarButton>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <ToolbarButton onClick={handleLinkButton} active={editor.isActive("link")} title={editor.isActive("link") ? "Remove link" : "Add link"}>
                {editor.isActive("link") ? <Link2Off size={14} /> : <Link2 size={14} />}
              </ToolbarButton>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}><Undo2 size={14} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()}><Redo2 size={14} /></ToolbarButton>
              {showLinkInput && (
                <form onSubmit={handleLinkSubmit} className="flex items-center gap-1.5 ml-2 bg-white border border-blue-200 rounded-lg px-2.5 py-1 shadow-sm">
                  <Link2 size={11} className="text-slate-400 shrink-0" />
                  <input
                    ref={linkInputRef}
                    type="text"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="text-[12px] border-none outline-none w-44 font-[inherit] bg-transparent text-slate-800 placeholder:text-slate-300"
                    onKeyDown={e => {
                      if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); }
                    }}
                  />
                  <button type="submit" className="text-[11px] bg-blue-600 text-white px-2 py-0.5 rounded cursor-pointer border-none font-[inherit] hover:bg-blue-700 transition-colors">
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}
                    className="text-[11px] text-slate-400 cursor-pointer border-none bg-transparent font-[inherit] hover:text-slate-700"
                  >
                    ✕
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="h-7 w-full rounded bg-slate-100 animate-pulse" />
          )}
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-y-auto">
          {showSkeleton ? (
            <div className="max-w-3xl mx-auto px-8 py-8 space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg w-2/3" />
              <div className="space-y-3 pt-4">
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-5/6" />
                <div className="h-4 bg-slate-100 rounded w-4/6" />
                <div className="h-4 bg-slate-100 rounded w-full pt-2" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-8 py-8">
              <input
                value={title}
                onChange={handleTitleChange}
                onKeyDown={handleTitleKeyDown}
                placeholder="Untitled"
                className="w-full text-[2rem] font-bold text-slate-900 border-none outline-none bg-transparent font-[inherit] mb-6 placeholder:text-slate-300 leading-tight"
              />
              <EditorContent editor={editor} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ToolbarButton({
  onClick, active, title, disabled, children,
}: {
  onClick: () => void; active: boolean; title: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded-md cursor-pointer border-none font-[inherit] transition-colors",
        active ? "bg-slate-800 text-white" : "bg-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}
