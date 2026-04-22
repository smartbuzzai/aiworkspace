"use client";

import { useEffect, useState, useRef } from "react";
import {
  Inbox, Users, Calendar, FolderKanban, FileStack,
  Home, Sparkles, Send, Mic, X, Menu, Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Settings from "./Settings";
import InboxView from "./InboxView";
import CRMView from "./CRMView";
import CalendarView from "./CalendarView";
import { cn } from "../lib/cn";
import type { User } from "../lib/types";

interface AppProps {
  user: User;
  onLogout: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "inbox", label: "Unified Inbox", icon: Inbox },
  { id: "crm", label: "CRM", icon: Users },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "library", label: "Library", icon: FileStack },
];

export default function App({ user, onLogout }: AppProps) {
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    onLogout();
  }

  return (
    <div className="min-h-screen bg-navy-50 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "w-60 h-screen bg-navy-950 border-r border-white/[0.06] fixed top-0 z-[60] flex flex-col transition-[left] duration-[250ms] ease-in-out",
          isMobile ? (sidebarOpen ? "left-0" : "-left-[260px]") : "left-0"
        )}
      >
        <div className="px-5 pt-5 pb-7 flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center font-mono font-extrabold text-white text-[13px]">
            AI
          </div>
          <div className="text-white font-bold text-[15px]">Workspace</div>
        </div>

        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setView(item.id); setSidebarOpen(false); }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-sm w-full text-left cursor-pointer",
                  active
                    ? "bg-blue-500/[0.12] border-blue-500/20 text-blue-400 font-semibold"
                    : "bg-transparent border-transparent text-navy-300 font-medium"
                )}
              >
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 m-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white flex items-center justify-center font-bold text-[13px]">
              {(user.name || user.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[13px] font-semibold">
                {user.name || user.email.split("@")[0]}
              </div>
              <div className="text-navy-500 text-[11px] truncate">{user.email}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => { setView("settings"); setSidebarOpen(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-[7px] px-2 rounded-lg text-[11px] font-semibold cursor-pointer",
                view === "settings"
                  ? "bg-blue-500/[0.12] border border-blue-500/20 text-blue-400"
                  : "bg-white/[0.04] border border-white/[0.06] text-navy-300"
              )}
            >
              <SettingsIcon size={12} /> Settings
            </button>
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-navy-400 py-[7px] px-2.5 rounded-lg cursor-pointer"
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={cn("flex-1 flex flex-col", !isMobile && "ml-60")}>
        <header className={cn(
          "h-16 bg-white border-b border-navy-200 flex items-center gap-3 sticky top-0 z-40",
          isMobile ? "px-4" : "px-8"
        )}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="bg-transparent border-none p-1.5 cursor-pointer text-navy-700"
            >
              <Menu size={22} />
            </button>
          )}
          <h1 className={cn(
            "font-bold tracking-tight text-navy-900 m-0",
            isMobile ? "text-[17px]" : "text-[21px]"
          )}>
            {view === "dashboard"
              ? `Good morning, ${user.name || user.email.split("@")[0]}`
              : view === "settings"
                ? "Settings"
                : view.charAt(0).toUpperCase() + view.slice(1)}
          </h1>
          <button
            onClick={() => setAssistantOpen(true)}
            className="ml-auto flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-blue-500 text-white border-none py-2 px-3.5 rounded-[10px] text-[13px] font-semibold cursor-pointer"
          >
            <Sparkles size={14} /> {isMobile ? "AI" : "Ask AI"}
          </button>
        </header>

        <main className={cn("flex-1", isMobile ? "p-4" : "p-8")}>
          {view === "dashboard" && <Dashboard user={user} />}
          {view === "inbox" && <InboxView />}
          {view === "crm" && <CRMView />}
          {view === "calendar" && <CalendarView />}
          {view === "projects" && <ResourceList endpoint="projects" render={renderProject} empty="No projects yet." />}
          {view === "library" && <ResourceList endpoint="files" render={renderFile} empty="No files uploaded." />}
          {view === "settings" && <Settings user={user} />}
        </main>
      </div>

      <Assistant open={assistantOpen} onToggle={() => setAssistantOpen(!assistantOpen)} isMobile={isMobile} />
    </div>
  );
}

// ─── Generic resource list ───────────────────────────────────
interface ResourceListProps {
  endpoint: string;
  render: (item: any) => React.ReactNode;
  empty: string;
}

function ResourceList({ endpoint, render, empty }: ResourceListProps) {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    fetch(`/api/${endpoint}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const key = Object.keys(data).find(k => Array.isArray(data[k]));
        setItems(data[key!] || []);
      })
      .catch(() => setItems([]));
  }, [endpoint]);

  if (items === null) return <div className="text-navy-500">Loading…</div>;
  if (items.length === 0) {
    return (
      <div className="bg-white border border-navy-200 rounded-[14px] p-10 text-center text-navy-500 text-sm">
        {empty}
      </div>
    );
  }
  return <div className="flex flex-col gap-2.5">{items.map(render)}</div>;
}

const CARD = "bg-white border border-navy-200 rounded-xl p-4";

const renderProject = (p: any) => (
  <div key={p.id} className={CARD}>
    <div className="flex justify-between">
      <div className="text-sm font-semibold">{p.name}</div>
      <span className="text-[11px] text-navy-500">{p.stage}</span>
    </div>
    <div className="h-1 bg-navy-100 rounded-sm mt-2.5 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-green-500"
        style={{ width: `${p.progress}%` }}
      />
    </div>
    <div className="text-[11px] text-navy-500 mt-1.5">
      {p.tasks_done || 0}/{p.task_count || 0} tasks · {p.progress}%
    </div>
  </div>
);

const renderFile = (f: any) => (
  <div key={f.id} className={CARD}>
    <div className="text-sm font-semibold">{f.name}</div>
    <div className="text-xs text-navy-500 mt-1">
      {f.kind} · {(f.size_bytes / 1024).toFixed(0)} KB · {new Date(f.created_at).toLocaleDateString()}
    </div>
  </div>
);

// ─── Dashboard ───────────────────────────────────────────────
interface DashboardData {
  events: any[];
  tasks: any[];
  unreadThreads: any[];
}

function Dashboard({ user }: { user: User }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const [eventsRes, tasksRes, threadsRes] = await Promise.all([
        fetch(`/api/events?from=${today}T00:00:00Z&to=${tomorrow}T00:00:00Z`, { credentials: "include" }).then(r => r.json()).catch(() => ({ events: [] })),
        fetch("/api/tasks", { credentials: "include" }).then(r => r.json()).catch(() => ({ tasks: [] })),
        fetch("/api/emails/threads?unread=true", { credentials: "include" }).then(r => r.json()).catch(() => ({ threads: [] })),
      ]);
      setData({
        events: eventsRes.events || [],
        tasks: (tasksRes.tasks || []).filter((t: any) => t.status !== "done" && t.status !== "cancelled"),
        unreadThreads: threadsRes.threads || [],
      });
    }
    load();
  }, []);

  if (!data) return <div className="text-navy-500">Loading dashboard…</div>;

  const priorityTasks = data.tasks.filter((t: any) => t.priority === "high" || t.priority === "medium");
  const highTasks = data.tasks.filter((t: any) => t.priority === "high");
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const eventTypeBadge = (type: string) => cn(
    "text-[10px] font-semibold py-0.5 px-2 rounded-md",
    type === "meeting" ? "bg-blue-500/10 text-blue-600"
      : type === "focus" ? "bg-green-500/10 text-green-500"
      : "bg-navy-500/10 text-navy-500"
  );

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      <div
        className="rounded-[20px] p-7 text-white"
        style={{ background: "linear-gradient(135deg, #0a0f1e, #1e3a5f, #0f172a)" }}
      >
        <div className="inline-flex items-center gap-[7px] bg-blue-500/[0.12] border border-blue-500/[0.22] py-[5px] px-3 rounded-full text-xs font-semibold text-blue-400 mb-4">
          <Sparkles size={12} /> {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h2 className="text-[26px] font-extrabold tracking-tight m-0">
          {greeting}, {user.name || user.email.split("@")[0]}.
        </h2>
        <p className="text-navy-300 mt-2.5 text-sm leading-relaxed m-0">
          {data.events.length} event{data.events.length !== 1 ? "s" : ""} today
          {" · "}{highTasks.length} high-priority task{highTasks.length !== 1 ? "s" : ""}
          {" · "}{data.unreadThreads.length} unread thread{data.unreadThreads.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
        <DashWidget title="Today's Schedule" icon={Calendar} count={data.events.length} emptyText="No events today">
          {data.events.slice(0, 5).map((e: any) => (
            <div key={e.id} className="flex items-center gap-2.5 py-2 border-b border-navy-100">
              <div className="w-[42px] text-center text-xs font-bold text-blue-600 font-mono">
                {new Date(e.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-navy-900 truncate">{e.title}</div>
                {e.location && <div className="text-[11px] text-navy-500">{e.location}</div>}
              </div>
              <div className={eventTypeBadge(e.event_type)}>{e.event_type}</div>
            </div>
          ))}
        </DashWidget>

        <DashWidget title="Priority Tasks" icon={FolderKanban} count={priorityTasks.length} emptyText="No priority tasks">
          {priorityTasks.slice(0, 6).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2.5 py-2 border-b border-navy-100">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                t.priority === "high" ? "bg-red-500" : "bg-amber-500"
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-navy-900 truncate">{t.title}</div>
                {t.project_name && <div className="text-[11px] text-navy-500">{t.project_name}</div>}
              </div>
              {t.due_at && (
                <div className="text-[11px] text-navy-500 font-mono">
                  {new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              )}
            </div>
          ))}
        </DashWidget>

        <DashWidget title="Unread Emails" icon={Inbox} count={data.unreadThreads.length} emptyText="Inbox zero!">
          {data.unreadThreads.slice(0, 5).map((t: any) => (
            <div key={t.id} className="py-2 border-b border-navy-100">
              <div className="flex justify-between items-center">
                <div className="text-[13px] font-semibold text-navy-900 truncate flex-1">{t.subject}</div>
                <span className="text-[11px] text-navy-500 ml-2 whitespace-nowrap">{t.unread_count}</span>
              </div>
              {t.ai_summary && (
                <div className="text-[11px] text-blue-600 mt-0.5 flex items-center gap-1">
                  <Sparkles size={10} /> {t.ai_summary}
                </div>
              )}
            </div>
          ))}
        </DashWidget>
      </div>
    </div>
  );
}

interface DashWidgetProps {
  title: string;
  icon: LucideIcon;
  count: number;
  emptyText: string;
  children?: React.ReactNode;
}

function DashWidget({ title, icon: Icon, count, emptyText, children }: DashWidgetProps) {
  return (
    <div className="bg-white border border-navy-200 rounded-[14px] p-5 flex flex-col">
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-[34px] h-[34px] rounded-[9px] bg-blue-500/[0.08] flex items-center justify-center">
          <Icon size={16} className="text-blue-500" />
        </div>
        <div className="flex-1 text-sm font-bold text-navy-900">{title}</div>
        <div className="text-xs font-bold text-blue-600 bg-blue-500/[0.08] py-0.5 px-2.5 rounded-lg">
          {count}
        </div>
      </div>
      {count === 0 ? (
        <div className="text-navy-400 text-[13px] text-center py-4">{emptyText}</div>
      ) : children}
    </div>
  );
}

// ─── Assistant (streaming chat) ──────────────────────────────
interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface AssistantProps {
  open: boolean;
  onToggle: () => void;
  isMobile: boolean;
}

function Assistant({ open, onToggle, isMobile }: AssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMessage = { id: Date.now(), role: "user", content: text };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setStreaming(true);

    const asstMsg: ChatMessage = { id: Date.now() + 1, role: "assistant", content: "" };
    setMessages(m => [...m, asstMsg]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, message: text }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop()!;

        for (const evt of events) {
          const lines = evt.split("\n");
          let eventType: string | null = null;
          let data: any = null;
          for (const l of lines) {
            if (l.startsWith("event: ")) eventType = l.slice(7);
            if (l.startsWith("data: ")) data = JSON.parse(l.slice(6));
          }
          if (eventType === "thread") setThreadId(data.thread_id);
          if (eventType === "token") {
            asstMsg.content += data.text;
            setMessages(m => [...m.slice(0, -1), { ...asstMsg }]);
          }
          if (eventType === "tool_result") {
            asstMsg.content += `\n\n✓ ${data.tool}`;
            setMessages(m => [...m.slice(0, -1), { ...asstMsg }]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStreaming(false);
    }
  }

  async function toggleListen() {
    if (listening) {
      mediaRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "voice.webm");
        const r = await fetch("/api/assistant/voice/transcribe", {
          method: "POST", credentials: "include", body: fd,
        });
        const { text } = await r.json();
        if (text) send(text);
      };
      mediaRef.current = mr;
      mr.start();
      setListening(true);
    } catch {
      alert("Mic access denied");
    }
  }

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-[58px] h-[58px] rounded-full bg-gradient-to-br from-blue-600 to-green-500 border-none cursor-pointer shadow-[0_10px_28px_rgba(37,99,235,0.4)] flex items-center justify-center text-white z-[80]"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div className={cn(
      "fixed bg-navy-950 border border-white/[0.08] flex flex-col z-[80] shadow-[0_25px_60px_rgba(0,0,0,0.35)]",
      isMobile
        ? "inset-0 w-full h-full rounded-none"
        : "bottom-6 right-6 w-[400px] h-[600px] rounded-[18px]"
    )}>
      <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-[38px] h-[38px] rounded-[11px] bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
          <Sparkles size={17} color="white" />
        </div>
        <div className="flex-1">
          <div className="text-white text-sm font-bold">AI Assistant</div>
          <div className="text-green-400 text-[11px]">Ready</div>
        </div>
        <button
          onClick={onToggle}
          className="bg-white/[0.06] border-none text-navy-300 p-[7px] rounded-lg cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-navy-400 text-[13px] text-center mt-10">
            Ask me anything. I can search your data, draft replies,<br />
            schedule events, and create tasks.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[82%] px-3.5 py-2.5 rounded-[14px] text-[13px] leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white"
                : "bg-white/[0.04] border border-white/[0.06] text-navy-200"
            )}>
              {m.content}
              {streaming && m.role === "assistant" && m === messages[messages.length - 1] && (
                <span className="opacity-60">▋</span>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3.5 border-t border-white/[0.06] flex gap-2 items-center">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(input); }}
          placeholder="Ask or say a command…"
          disabled={streaming}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white py-[9px] px-[13px] rounded-[10px] text-[13px] outline-none"
        />
        <button
          onClick={toggleListen}
          className={cn(
            "w-[38px] h-[38px] rounded-[10px] text-white cursor-pointer flex items-center justify-center",
            listening
              ? "bg-gradient-to-br from-green-500 to-teal-500 border-none"
              : "bg-white/[0.06] border border-white/10"
          )}
        >
          <Mic size={15} />
        </button>
        <button
          onClick={() => send(input)}
          disabled={streaming || !input.trim()}
          className={cn(
            "w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-blue-600 to-blue-500 border-none text-white cursor-pointer flex items-center justify-center",
            (streaming || !input.trim()) && "opacity-50"
          )}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
