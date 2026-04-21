"use client";

// ═══════════════════════════════════════════════════════════════
//  Main App shell — wires to the real API
//
//  This imports the full UI from the earlier prototype but swaps
//  seed data for live fetch calls. The components, layout, and
//  styling are identical to the design reference.
//
//  For brevity in this scaffold, this file shows the shape. Drop
//  in the full component tree from the `ai-workspace.jsx` artifact
//  produced in the first turn, then replace seedData with:
//
//    const [contacts, setContacts]   = useState([]);
//    useEffect(() => {
//      fetch('/api/contacts', { credentials:'include' })
//        .then(r => r.json())
//        .then(d => setContacts(d.contacts));
//    }, []);
//
//  Same pattern for emails, events, projects, tasks, files.
//  The assistant chat panel opens an EventSource to
//  /api/assistant/chat and appends streaming tokens.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from "react";
import {
  Inbox, Users, Calendar, FolderKanban, FileStack,
  Home, Sparkles, Send, Mic, X, Menu, Bell, Search, Settings as SettingsIcon,
  LogOut
} from "lucide-react";
import Settings from "./Settings";
import InboxView from "./InboxView";
import CRMView from "./CRMView";
import CalendarView from "./CalendarView";
import { theme } from "../lib/theme";

export default function App({ user, onLogout }) {
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

  // Register service worker — enables offline shell + push notifications
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const navItems = [
    { id:"dashboard", label:"Dashboard", icon:Home },
    { id:"inbox",     label:"Unified Inbox", icon:Inbox },
    { id:"crm",       label:"CRM", icon:Users },
    { id:"calendar",  label:"Calendar", icon:Calendar },
    { id:"projects",  label:"Projects", icon:FolderKanban },
    { id:"library",   label:"Library", icon:FileStack }
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method:"POST", credentials:"include" });
    onLogout();
  }

  return (
    <div style={{ minHeight:"100vh", background:theme.navy50, display:"flex" }}>
      {/* Sidebar */}
      <aside style={{
        width:240, height:"100vh",
        background:theme.navy950,
        borderRight:"1px solid rgba(255,255,255,0.06)",
        position:"fixed", top:0,
        left: isMobile ? (sidebarOpen ? 0 : -260) : 0,
        transition:"left 0.25s ease", zIndex:60,
        display:"flex", flexDirection:"column"
      }}>
        <div style={{ padding:"20px 20px 28px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:34, height:34, borderRadius:9,
            background:`linear-gradient(135deg, ${theme.blue500}, ${theme.green500})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'JetBrains Mono', monospace",
            fontWeight:800, color:theme.white, fontSize:13
          }}>AI</div>
          <div style={{ color:theme.white, fontWeight:700, fontSize:15 }}>Workspace</div>
        </div>
        <nav style={{ flex:1, padding:"0 12px", display:"flex", flexDirection:"column", gap:2 }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id}
                onClick={() => { setView(item.id); setSidebarOpen(false); }}
                style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px", borderRadius:10,
                  background: active ? "rgba(59,130,246,0.12)" : "transparent",
                  border: active ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
                  color: active ? theme.blue400 : theme.navy300,
                  fontSize:14, fontWeight: active ? 600 : 500,
                  cursor:"pointer", textAlign:"left", width:"100%",
                  fontFamily:"inherit"
                }}>
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div style={{
          padding:12, margin:12,
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:12
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{
              width:34, height:34, borderRadius:"50%",
              background:`linear-gradient(135deg, ${theme.blue500}, ${theme.teal500})`,
              color:theme.white, display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:13
            }}>{(user.name || user.email || "?")[0].toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:theme.white, fontSize:13, fontWeight:600 }}>
                {user.name || user.email.split("@")[0]}
              </div>
              <div style={{ color:theme.navy500, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {user.email}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={() => { setView("settings"); setSidebarOpen(false); }} style={{
              flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              background: view === "settings" ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
              border: view === "settings" ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(255,255,255,0.06)",
              color: view === "settings" ? theme.blue400 : theme.navy300,
              padding:"7px 8px", borderRadius:8, fontSize:11, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit"
            }}><SettingsIcon size={12} /> Settings</button>
            <button onClick={logout} title="Sign out" style={{
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.06)",
              color:theme.navy400, padding:"7px 10px", borderRadius:8,
              cursor:"pointer"
            }}><LogOut size={12} /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, marginLeft: isMobile ? 0 : 240, display:"flex", flexDirection:"column" }}>
        <header style={{
          height:64, background:theme.white,
          borderBottom:`1px solid ${theme.navy200}`,
          display:"flex", alignItems:"center",
          padding: isMobile ? "0 16px" : "0 32px",
          gap:12, position:"sticky", top:0, zIndex:40
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{
              background:"transparent", border:"none", padding:6, cursor:"pointer", color:theme.navy700
            }}><Menu size={22} /></button>
          )}
          <h1 style={{
            fontSize: isMobile ? 17 : 21, fontWeight:700, letterSpacing:"-0.4px",
            color:theme.navy900, margin:0
          }}>
            {view === "dashboard"
              ? `Good morning, ${user.name || user.email.split("@")[0]}`
              : view === "settings"
                ? "Settings"
                : view.charAt(0).toUpperCase() + view.slice(1)}
          </h1>
          <button onClick={() => setAssistantOpen(true)} style={{
            marginLeft:"auto",
            display:"flex", alignItems:"center", gap:6,
            background:`linear-gradient(135deg, ${theme.blue600}, ${theme.blue500})`,
            color:theme.white, border:"none", padding:"8px 14px",
            borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer",
            fontFamily:"inherit"
          }}>
            <Sparkles size={14} /> {isMobile ? "AI" : "Ask AI"}
          </button>
        </header>

        <main style={{ flex:1, padding: isMobile ? 16 : 32 }}>
          {view === "dashboard" && <Dashboard user={user} />}
          {view === "inbox"     && <InboxView />}
          {view === "crm"       && <CRMView />}
          {view === "calendar"  && <CalendarView />}
          {view === "projects"  && <ResourceList endpoint="projects" render={renderProject} empty="No projects yet." />}
          {view === "library"   && <ResourceList endpoint="files" render={renderFile} empty="No files uploaded." />}
          {view === "settings"  && <Settings user={user} />}
        </main>
      </div>

      <Assistant open={assistantOpen} onToggle={() => setAssistantOpen(!assistantOpen)} isMobile={isMobile} />
    </div>
  );
}

// ─── Generic resource list — one component handles every list view
function ResourceList({ endpoint, render, empty }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    fetch(`/api/${endpoint}`, { credentials:"include" })
      .then(r => r.json())
      .then(data => {
        const key = Object.keys(data).find(k => Array.isArray(data[k]));
        setItems(data[key] || []);
      })
      .catch(() => setItems([]));
  }, [endpoint]);

  if (items === null) return <div style={{ color:theme.navy500 }}>Loading…</div>;
  if (items.length === 0) {
    return (
      <div style={{
        background:theme.white, border:`1px solid ${theme.navy200}`,
        borderRadius:14, padding:40, textAlign:"center",
        color:theme.navy500, fontSize:14
      }}>{empty}</div>
    );
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {items.map(render)}
    </div>
  );
}

const renderThread = t => (
  <div key={t.id} style={card()}>
    <div style={{ fontSize:14, fontWeight:600 }}>{t.subject}</div>
    <div style={{ fontSize:12, color:theme.navy500, marginTop:4 }}>
      {t.participants?.join(", ")} · {t.unread_count > 0 ? `${t.unread_count} unread` : "read"}
    </div>
    {t.ai_summary && <div style={{ marginTop:8, fontSize:12, color:theme.blue600 }}>{t.ai_summary}</div>}
  </div>
);

const renderContact = c => (
  <div key={c.id} style={card()}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div style={{ fontSize:14, fontWeight:600 }}>{c.name}</div>
        <div style={{ fontSize:12, color:theme.navy500 }}>{c.role} · {c.company}</div>
      </div>
      <div style={{ fontFamily:"'JetBrains Mono', monospace", fontWeight:800, color:theme.blue600 }}>
        {c.score}
      </div>
    </div>
  </div>
);

const renderEvent = e => (
  <div key={e.id} style={card()}>
    <div style={{ fontSize:14, fontWeight:600 }}>{e.title}</div>
    <div style={{ fontSize:12, color:theme.navy500, marginTop:4 }}>
      {new Date(e.starts_at).toLocaleString()} · {e.location || "no location"}
    </div>
  </div>
);

const renderProject = p => (
  <div key={p.id} style={card()}>
    <div style={{ display:"flex", justifyContent:"space-between" }}>
      <div style={{ fontSize:14, fontWeight:600 }}>{p.name}</div>
      <span style={{ fontSize:11, color:theme.navy500 }}>{p.stage}</span>
    </div>
    <div style={{
      height:4, background:theme.navy100, borderRadius:2, marginTop:10, overflow:"hidden"
    }}>
      <div style={{
        height:"100%", width:`${p.progress}%`,
        background:`linear-gradient(90deg, ${theme.blue500}, ${theme.green500})`
      }} />
    </div>
    <div style={{ fontSize:11, color:theme.navy500, marginTop:6 }}>
      {p.tasks_done || 0}/{p.task_count || 0} tasks · {p.progress}%
    </div>
  </div>
);

const renderFile = f => (
  <div key={f.id} style={card()}>
    <div style={{ fontSize:14, fontWeight:600 }}>{f.name}</div>
    <div style={{ fontSize:12, color:theme.navy500, marginTop:4 }}>
      {f.kind} · {(f.size_bytes / 1024).toFixed(0)} KB · {new Date(f.created_at).toLocaleDateString()}
    </div>
  </div>
);

const card = () => ({
  background:theme.white, border:`1px solid ${theme.navy200}`,
  borderRadius:12, padding:16
});

// ─── Dashboard ───────────────────────────────────────────────
function Dashboard({ user }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const [eventsRes, tasksRes, threadsRes] = await Promise.all([
        fetch(`/api/events?from=${today}T00:00:00Z&to=${tomorrow}T00:00:00Z`, { credentials:"include" }).then(r => r.json()).catch(() => ({ events:[] })),
        fetch("/api/tasks", { credentials:"include" }).then(r => r.json()).catch(() => ({ tasks:[] })),
        fetch("/api/emails/threads?unread=true", { credentials:"include" }).then(r => r.json()).catch(() => ({ threads:[] })),
      ]);
      setData({
        events: eventsRes.events || [],
        tasks: (tasksRes.tasks || []).filter(t => t.status !== "done" && t.status !== "cancelled"),
        unreadThreads: threadsRes.threads || [],
      });
    }
    load();
  }, []);

  if (!data) return <div style={{ color:theme.navy500 }}>Loading dashboard…</div>;

  const highTasks = data.tasks.filter(t => t.priority === "high");
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div style={{ maxWidth:1200, display:"flex", flexDirection:"column", gap:20 }}>
      {/* Hero banner */}
      <div style={{
        background:`linear-gradient(135deg, ${theme.navy950}, #1e3a5f, ${theme.navy900})`,
        borderRadius:20, padding:28, color:theme.white
      }}>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7,
          background:"rgba(59,130,246,0.12)",
          border:"1px solid rgba(59,130,246,0.22)",
          padding:"5px 12px", borderRadius:20,
          fontSize:12, fontWeight:600, color:theme.blue400, marginBottom:16
        }}>
          <Sparkles size={12} /> {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
        </div>
        <h2 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.8px", margin:0 }}>
          {greeting}, {user.name || user.email.split("@")[0]}.
        </h2>
        <p style={{ color:theme.navy300, marginTop:10, fontSize:14, lineHeight:1.6, margin:"10px 0 0" }}>
          {data.events.length} event{data.events.length !== 1 ? "s" : ""} today
          {" · "}{highTasks.length} high-priority task{highTasks.length !== 1 ? "s" : ""}
          {" · "}{data.unreadThreads.length} unread thread{data.unreadThreads.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Widgets grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", gap:16 }}>
        {/* Today's Events */}
        <DashWidget title="Today's Schedule" icon={Calendar} count={data.events.length} emptyText="No events today">
          {data.events.slice(0, 5).map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${theme.navy100}` }}>
              <div style={{
                width:42, textAlign:"center", fontSize:12, fontWeight:700, color:theme.blue600,
                fontFamily:"'JetBrains Mono', monospace"
              }}>
                {new Date(e.starts_at).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:theme.navy900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.title}</div>
                {e.location && <div style={{ fontSize:11, color:theme.navy500 }}>{e.location}</div>}
              </div>
              <div style={{
                fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:6,
                background: e.event_type === "meeting" ? "rgba(59,130,246,0.1)" : e.event_type === "focus" ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
                color: e.event_type === "meeting" ? theme.blue600 : e.event_type === "focus" ? theme.green500 : theme.navy500
              }}>{e.event_type}</div>
            </div>
          ))}
        </DashWidget>

        {/* Priority Tasks */}
        <DashWidget title="Priority Tasks" icon={FolderKanban} count={data.tasks.filter(t => t.priority === "high" || t.priority === "medium").length} emptyText="No priority tasks">
          {data.tasks.filter(t => t.priority === "high" || t.priority === "medium").slice(0, 6).map(t => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${theme.navy100}` }}>
              <div style={{
                width:8, height:8, borderRadius:"50%",
                background: t.priority === "high" ? "#ef4444" : "#f59e0b",
                flexShrink:0
              }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:theme.navy900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</div>
                {t.project_name && <div style={{ fontSize:11, color:theme.navy500 }}>{t.project_name}</div>}
              </div>
              {t.due_at && <div style={{ fontSize:11, color:theme.navy500, fontFamily:"'JetBrains Mono', monospace" }}>
                {new Date(t.due_at).toLocaleDateString("en-US", { month:"short", day:"numeric" })}
              </div>}
            </div>
          ))}
        </DashWidget>

        {/* Unread Emails */}
        <DashWidget title="Unread Emails" icon={Inbox} count={data.unreadThreads.length} emptyText="Inbox zero!">
          {data.unreadThreads.slice(0, 5).map(t => (
            <div key={t.id} style={{ padding:"8px 0", borderBottom:`1px solid ${theme.navy100}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:13, fontWeight:600, color:theme.navy900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                  {t.subject}
                </div>
                <span style={{ fontSize:11, color:theme.navy500, marginLeft:8, whiteSpace:"nowrap" }}>
                  {t.unread_count}
                </span>
              </div>
              {t.ai_summary && (
                <div style={{ fontSize:11, color:theme.blue600, marginTop:3, display:"flex", alignItems:"center", gap:4 }}>
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

function DashWidget({ title, icon: Icon, count, emptyText, children }) {
  return (
    <div style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, padding:20, display:"flex", flexDirection:"column"
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{
          width:34, height:34, borderRadius:9,
          background:"rgba(59,130,246,0.08)",
          display:"flex", alignItems:"center", justifyContent:"center"
        }}><Icon size={16} color={theme.blue500} /></div>
        <div style={{ flex:1, fontSize:14, fontWeight:700, color:theme.navy900 }}>{title}</div>
        <div style={{
          fontSize:12, fontWeight:700, color:theme.blue600,
          background:"rgba(59,130,246,0.08)", padding:"3px 10px", borderRadius:8
        }}>{count}</div>
      </div>
      {count === 0 ? (
        <div style={{ color:theme.navy400, fontSize:13, textAlign:"center", padding:"16px 0" }}>{emptyText}</div>
      ) : children}
    </div>
  );
}

// ─── Assistant (streaming chat) ──────────────────────────────
function Assistant({ open, onToggle, isMobile }) {
  const [messages, setMessages] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, streaming]);

  async function send(text) {
    if (!text.trim() || streaming) return;
    const userMsg = { id:Date.now(), role:"user", content:text };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setStreaming(true);

    const asstMsg = { id:Date.now() + 1, role:"assistant", content:"" };
    setMessages(m => [...m, asstMsg]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method:"POST",
        credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ thread_id: threadId, message: text })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream:true });
        const events = buf.split("\n\n");
        buf = events.pop();

        for (const evt of events) {
          const lines = evt.split("\n");
          let eventType = null, data = null;
          for (const l of lines) {
            if (l.startsWith("event: ")) eventType = l.slice(7);
            if (l.startsWith("data: "))  data = JSON.parse(l.slice(6));
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const mr = new MediaRecorder(stream, { mimeType:"audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type:"audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "voice.webm");
        const r = await fetch("/api/assistant/voice/transcribe", {
          method:"POST", credentials:"include", body: fd
        });
        const { text } = await r.json();
        if (text) send(text);
      };
      mediaRef.current = mr;
      mr.start();
      setListening(true);
    } catch (err) {
      alert("Mic access denied");
    }
  }

  if (!open) {
    return (
      <button onClick={onToggle} style={{
        position:"fixed", bottom:24, right:24,
        width:58, height:58, borderRadius:"50%",
        background:`linear-gradient(135deg, ${theme.blue600}, ${theme.green500})`,
        border:"none", cursor:"pointer",
        boxShadow:"0 10px 28px rgba(37,99,235,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
        color:theme.white, zIndex:80
      }}><Sparkles size={24} /></button>
    );
  }

  return (
    <div style={{
      position:"fixed",
      bottom: isMobile ? 0 : 24, right: isMobile ? 0 : 24,
      left: isMobile ? 0 : "auto", top: isMobile ? 0 : "auto",
      width: isMobile ? "100%" : 400,
      height: isMobile ? "100%" : 600,
      background:theme.navy950,
      border:"1px solid rgba(255,255,255,0.08)",
      borderRadius: isMobile ? 0 : 18,
      display:"flex", flexDirection:"column", zIndex:80,
      boxShadow:"0 25px 60px rgba(0,0,0,0.35)"
    }}>
      <div style={{
        padding:16, borderBottom:"1px solid rgba(255,255,255,0.06)",
        display:"flex", alignItems:"center", gap:12
      }}>
        <div style={{
          width:38, height:38, borderRadius:11,
          background:`linear-gradient(135deg, ${theme.blue500}, ${theme.green500})`,
          display:"flex", alignItems:"center", justifyContent:"center"
        }}><Sparkles size={17} color="white" /></div>
        <div style={{ flex:1 }}>
          <div style={{ color:theme.white, fontSize:14, fontWeight:700 }}>AI Assistant</div>
          <div style={{ color:theme.green400, fontSize:11 }}>Ready</div>
        </div>
        <button onClick={onToggle} style={{
          background:"rgba(255,255,255,0.06)", border:"none",
          color:theme.navy300, padding:7, borderRadius:8, cursor:"pointer"
        }}><X size={15} /></button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        {messages.length === 0 && (
          <div style={{ color:theme.navy400, fontSize:13, textAlign:"center", marginTop:40 }}>
            Ask me anything. I can search your data, draft replies,<br />
            schedule events, and create tasks.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{
            display:"flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start"
          }}>
            <div style={{
              maxWidth:"82%", padding:"10px 14px", borderRadius:14,
              background: m.role === "user"
                ? `linear-gradient(135deg, ${theme.blue600}, ${theme.blue500})`
                : "rgba(255,255,255,0.04)",
              border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.06)",
              color: m.role === "user" ? theme.white : theme.navy200,
              fontSize:13, lineHeight:1.55, whiteSpace:"pre-wrap"
            }}>{m.content}{streaming && m.role === "assistant" && m === messages[messages.length-1] && <span style={{ opacity:0.6 }}>▋</span>}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{
        padding:14, borderTop:"1px solid rgba(255,255,255,0.06)",
        display:"flex", gap:8, alignItems:"center"
      }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(input); }}
          placeholder="Ask or say a command…"
          disabled={streaming}
          style={{
            flex:1, background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            color:theme.white, padding:"9px 13px", borderRadius:10,
            fontSize:13, outline:"none", fontFamily:"inherit"
          }}
        />
        <button onClick={toggleListen} style={{
          width:38, height:38, borderRadius:10,
          background: listening
            ? `linear-gradient(135deg, ${theme.green500}, ${theme.teal500})`
            : "rgba(255,255,255,0.06)",
          border: listening ? "none" : "1px solid rgba(255,255,255,0.1)",
          color:theme.white, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center"
        }}><Mic size={15} /></button>
        <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{
          width:38, height:38, borderRadius:10,
          background:`linear-gradient(135deg, ${theme.blue600}, ${theme.blue500})`,
          border:"none", color:theme.white, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          opacity: (streaming || !input.trim()) ? 0.5 : 1
        }}><Send size={14} /></button>
      </div>
    </div>
  );
}
