"use client";

import { useEffect, useState, useRef } from "react";
import {
  Inbox, Users, Calendar, FolderKanban, FileStack, Bell, CheckCircle2,
  Home, Sparkles, Send, Mic, X, Menu, Settings as SettingsIcon,
  LogOut, ArrowRight, Moon, Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Settings from "./Settings";
import InboxView from "./InboxView";
import CRMView from "./CRMView";
import CalendarView from "./CalendarView";
import TasksView from "./TasksView";
import ProjectsView from "./ProjectsView";
import LibraryView from "./LibraryView";
import NotificationsView from "./NotificationsView";
import { cn } from "../lib/cn";
import { ToastProvider } from "./shared/Toast";
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
  { id: "tasks", label: "Tasks", icon: CheckCircle2 },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "library", label: "Library", icon: FileStack },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function App({ user, onLogout }: AppProps) {
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const chat = useChat();

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

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

  useEffect(() => {
    fetch("/api/push/notifications?limit=50", { credentials: "include" })
      .then(r => r.json())
      .then(d => setUnreadNotifCount((d.notifications || []).filter((n: any) => !n.read_at).length))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    onLogout();
  }

  return (
    <ToastProvider>
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
            const showBadge = item.id === "notifications" && unreadNotifCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "notifications") setUnreadNotifCount(0);
                  setView(item.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-sm w-full text-left cursor-pointer",
                  active
                    ? "bg-blue-500/[0.12] border-blue-500/20 text-blue-400 font-semibold"
                    : "bg-transparent border-transparent text-navy-300 font-medium"
                )}
              >
                <div className="relative shrink-0">
                  <Icon size={17} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                      {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                    </span>
                  )}
                </div>
                {item.label}
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
              onClick={toggleTheme}
              title={theme === "light" ? "Dark mode" : "Light mode"}
              className="flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-navy-300 py-[7px] px-2.5 rounded-lg cursor-pointer hover:text-amber-400 transition-colors"
            >
              {theme === "light" ? <Moon size={12} /> : <Sun size={12} />}
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

      {/* Main content — shifts right for sidebar, shifts left for panel */}
      <div className={cn(
        "flex-1 flex flex-col transition-[margin,padding] duration-300 ease-in-out",
        !isMobile && "ml-60",
        !isMobile && panelOpen && "pr-[360px]"
      )}>
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
              : NAV_ITEMS.find(n => n.id === view)?.label || view.charAt(0).toUpperCase() + view.slice(1)}
          </h1>
          {isMobile && (
            <button
              onClick={() => setPanelOpen(true)}
              className="ml-auto flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-blue-500 text-white border-none py-2 px-3.5 rounded-[10px] text-[13px] font-semibold cursor-pointer"
            >
              <Sparkles size={14} /> AI
            </button>
          )}
        </header>

        <main className={cn("flex-1", isMobile ? "p-4" : "p-8")}>
          {view === "dashboard" && <Dashboard user={user} setView={setView} />}
          {view === "inbox" && <InboxView />}
          {view === "crm" && <CRMView />}
          {view === "calendar" && <CalendarView />}
          {view === "tasks" && <TasksView />}
          {view === "projects" && <ProjectsView />}
          {view === "library" && <LibraryView />}
          {view === "notifications" && <NotificationsView />}
          {view === "settings" && <Settings user={user} />}
        </main>
      </div>

      {/* Assistant panel (docked right) */}
      {isMobile ? (
        <MobileAssistant open={panelOpen} onClose={() => setPanelOpen(false)} chat={chat} />
      ) : (
        <>
          <AssistantPanel open={panelOpen} onCollapse={() => setPanelOpen(false)} chat={chat} />
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="fixed top-20 right-0 bg-white border border-navy-200 border-r-0 py-2.5 px-2 rounded-l-lg z-[91] text-navy-600 cursor-pointer hover:text-navy-900 hover:bg-navy-50 transition-all"
              title="Open Assistant"
            >
              <Sparkles size={16} />
            </button>
          )}
        </>
      )}
    </div>
    </ToastProvider>
  );
}

// ─── Dashboard ────────���──────────────────────────────────────
interface DashboardData {
  events: any[];
  tasks: any[];
  unreadThreads: any[];
}

function Dashboard({ user, setView }: { user: User; setView: (v: string) => void }) {
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
        <DashWidget title="Today's Schedule" icon={Calendar} count={data.events.length} emptyText="No events today — add one in Calendar" onMore={data.events.length > 5 ? () => setView("calendar") : undefined}>
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

        <DashWidget title="Priority Tasks" icon={FolderKanban} count={priorityTasks.length} emptyText="All caught up — add tasks in Tasks" onMore={priorityTasks.length > 6 ? () => setView("tasks") : undefined}>
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

        <DashWidget title="Unread Emails" icon={Inbox} count={data.unreadThreads.length} emptyText="Inbox zero — connect an account in Settings" onMore={data.unreadThreads.length > 5 ? () => setView("inbox") : undefined}>
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
  onMore?: () => void;
  children?: React.ReactNode;
}

function DashWidget({ title, icon: Icon, count, emptyText, onMore, children }: DashWidgetProps) {
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
      ) : (
        <>
          {children}
          {onMore && (
            <button
              onClick={onMore}
              className="mt-2.5 text-[12px] font-semibold text-blue-600 bg-transparent border-none cursor-pointer p-0 self-start hover:underline"
            >
              +{count - (title === "Priority Tasks" ? 6 : 5)} more →
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Shared chat hook (single source of truth) ──────────────
interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
  input: string;
  setInput: (v: string) => void;
  send: (text: string) => void;
  listening: boolean;
  toggleListen: () => void;
}

function useChat(): ChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
    };
  }, []);

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
            asstMsg.content += `\n\n${data.tool}`;
            setMessages(m => [...m.slice(0, -1), { ...asstMsg }]);
          }
        }
      }
    } catch {
      setMessages(m => [
        ...m.slice(0, -1),
        { ...asstMsg, content: "⚠ Something went wrong — please try again." },
      ]);
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
      // Pick a supported mime type — Safari doesn't support audio/webm
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "audio/wav";
      const ext = mime === "audio/webm" ? "webm" : mime === "audio/mp4" ? "m4a" : "wav";
      const mr = new MediaRecorder(stream, ...(MediaRecorder.isTypeSupported(mime) ? [{ mimeType: mime }] : []));
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size === 0) return;
        const fd = new FormData();
        fd.append("file", blob, `voice.${ext}`);
        try {
          const r = await fetch("/api/assistant/voice/transcribe", {
            method: "POST", credentials: "include", body: fd,
          });
          if (!r.ok) {
            setMessages(m => [...m, { id: Date.now(), role: "assistant", content: "⚠ Voice transcription failed — please try typing instead." }]);
            return;
          }
          const data = await r.json();
          if (data.text?.trim()) send(data.text.trim());
        } catch {
          setMessages(m => [...m, { id: Date.now(), role: "assistant", content: "⚠ Voice transcription failed — please try typing instead." }]);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setListening(true);
    } catch {
      setMessages(m => [...m, { id: Date.now(), role: "assistant", content: "⚠ Microphone access was denied. Allow mic access in your browser settings and try again." }]);
    }
  }

  return { messages, streaming, input, setInput, send, listening, toggleListen };
}

// ─── Assistant Panel (docked right, light theme) ─────────────
function AssistantPanel({ open, onCollapse, chat }: { open: boolean; onCollapse: () => void; chat: ChatState }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.streaming]);

  return (
    <aside className={cn(
      "fixed top-0 right-0 bottom-0 w-[360px] bg-white border-l border-navy-200 z-[90] flex flex-col transition-transform duration-300 ease-in-out",
      open ? "translate-x-0" : "translate-x-[360px]"
    )}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center font-mono font-extrabold text-white text-[11px]">
          A
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-navy-900">Assistant</div>
          <div className="text-[11px] text-green-500 font-mono">Online</div>
        </div>
        <button
          onClick={onCollapse}
          className="bg-transparent border-none text-navy-500 p-1 rounded-lg cursor-pointer hover:text-navy-800 hover:bg-navy-50 transition-all"
          title="Collapse panel"
        >
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {chat.messages.length === 0 && (
          <div className="text-navy-400 text-[13px] text-center mt-10 leading-relaxed">
            Ask me anything. I can search your data, draft replies,<br />
            schedule events, and create tasks.
          </div>
        )}
        {chat.messages.map(m => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse self-end" : "self-start")}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-extrabold font-mono text-white",
              m.role === "user"
                ? "bg-gradient-to-br from-amber-500 to-red-500"
                : "bg-gradient-to-br from-blue-500 to-green-500"
            )}>
              {m.role === "user" ? "U" : "AI"}
            </div>
            <div className={cn(
              "max-w-[80%] px-4 py-3 rounded-[14px] text-sm leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "bg-blue-500 text-white rounded-br-[4px]"
                : "bg-white border border-navy-200 text-navy-800 rounded-bl-[4px]"
            )}>
              {m.content}
              {chat.streaming && m.role === "assistant" && m === chat.messages[chat.messages.length - 1] && (
                <span className="opacity-60">|</span>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="px-4 py-3 border-t border-navy-200 flex gap-2 items-end">
        <textarea
          value={chat.input}
          onChange={e => chat.setInput(e.target.value)}
          onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chat.send(chat.input); } }}
          placeholder="Ask anything… Shift+Enter for newline"
          disabled={chat.streaming}
          rows={1}
          className="flex-1 bg-navy-50 border border-navy-200 text-navy-800 py-2 px-3 rounded-lg text-[13px] outline-none font-[inherit] resize-none overflow-hidden"
        />
        <button
          onClick={chat.toggleListen}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0",
            chat.listening
              ? "bg-gradient-to-br from-blue-500 to-green-500 text-white border-none"
              : "bg-navy-50 border border-navy-200 text-navy-600"
          )}
          title="Voice input"
        >
          <Mic size={14} />
        </button>
        <button
          onClick={() => chat.send(chat.input)}
          disabled={chat.streaming || !chat.input.trim()}
          className={cn(
            "w-8 h-8 rounded-lg bg-blue-600 border-none text-white cursor-pointer flex items-center justify-center shrink-0 transition-opacity",
            (chat.streaming || !chat.input.trim()) && "opacity-40"
          )}
          title="Send"
        >
          <Send size={13} />
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile Assistant (fullscreen overlay) ───────────────────
function MobileAssistant({ open, onClose, chat }: { open: boolean; onClose: () => void; chat: ChatState }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.streaming]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-navy-950 flex flex-col z-[80]">
      <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-[38px] h-[38px] rounded-[11px] bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
          <Sparkles size={17} color="white" />
        </div>
        <div className="flex-1">
          <div className="text-white text-sm font-bold">AI Assistant</div>
          <div className="text-green-400 text-[11px]">Ready</div>
        </div>
        <button onClick={onClose} className="bg-white/[0.06] border-none text-navy-300 p-[7px] rounded-lg cursor-pointer">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {chat.messages.length === 0 && (
          <div className="text-navy-400 text-[13px] text-center mt-10">
            Ask me anything.
          </div>
        )}
        {chat.messages.map(m => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[82%] px-3.5 py-2.5 rounded-[14px] text-[13px] leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white"
                : "bg-white/[0.04] border border-white/[0.06] text-navy-200"
            )}>
              {m.content}
              {chat.streaming && m.role === "assistant" && m === chat.messages[chat.messages.length - 1] && (
                <span className="opacity-60">|</span>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-3.5 border-t border-white/[0.06] flex gap-2 items-end">
        <textarea
          value={chat.input}
          onChange={e => chat.setInput(e.target.value)}
          onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chat.send(chat.input); } }}
          placeholder="Ask anything… Shift+Enter for newline"
          disabled={chat.streaming}
          rows={1}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white py-[9px] px-[13px] rounded-[10px] text-[13px] outline-none resize-none overflow-hidden"
        />
        <button
          onClick={chat.toggleListen}
          className={cn(
            "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center cursor-pointer transition-all",
            chat.listening
              ? "bg-gradient-to-br from-blue-500 to-green-500 text-white border-none"
              : "bg-white/[0.04] border border-white/[0.08] text-navy-300"
          )}
          title="Voice input"
        >
          <Mic size={15} />
        </button>
        <button
          onClick={() => chat.send(chat.input)}
          disabled={chat.streaming || !chat.input.trim()}
          className={cn(
            "w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-blue-600 to-blue-500 border-none text-white cursor-pointer flex items-center justify-center",
            (chat.streaming || !chat.input.trim()) && "opacity-50"
          )}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
