import React, { useState, useRef, useEffect } from "react";
import {
  Inbox, Users, Calendar, FolderKanban, FileStack, Mic, Send,
  Search, Bell, Menu, X, Plus, ChevronRight, Mail, Phone,
  Video, Paperclip, MoreHorizontal, Sparkles, CheckCircle2,
  Circle, Clock, TrendingUp, AlertCircle, MessageSquare,
  Home, Settings, LogOut, Filter, Star, Archive, Trash2,
  Reply, Forward, Download, Eye, Edit3, Folder, Image as ImageIcon,
  FileText, Film, Music, ArrowUpRight, ChevronDown, Zap,
  Activity, Target, Headphones, Volume2, Square
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  DESIGN TOKENS — navy + white + blue + green, no pink/purple
// ═══════════════════════════════════════════════════════════
const theme = {
  navy950: "#0a0f1e", navy900: "#0f172a", navy800: "#1e293b",
  navy700: "#334155", navy600: "#475569", navy500: "#64748b",
  navy400: "#94a3b8", navy300: "#cbd5e1", navy200: "#e2e8f0",
  navy100: "#f1f5f9", navy50:  "#f8fafc",
  blue700: "#1d4ed8", blue600: "#2563eb", blue500: "#3b82f6", blue400: "#60a5fa",
  green500:"#10b981", green400:"#34d399",
  amber500:"#f59e0b", red500: "#ef4444", teal500: "#14b8a6",
  white:   "#ffffff"
};

// ═══════════════════════════════════════════════════════════
//  SEED DATA
// ═══════════════════════════════════════════════════════════
const seedContacts = [
  { id: 1, name: "Sarah Mitchell", company: "Harrison Capital", role: "VP Operations", email: "sarah@harrisoncap.com", phone: "+1 555 0134", score: 92, tag: "Hot", lastTouch: "2h ago", avatar: "SM" },
  { id: 2, name: "David Chen", company: "Meridian Labs", role: "CEO", email: "david@meridian.io", phone: "+1 555 0142", score: 78, tag: "Active", lastTouch: "1d ago", avatar: "DC" },
  { id: 3, name: "Priya Anand", company: "Northwind BD", role: "Head of Compliance", email: "priya@northwind.co", phone: "+1 555 0198", score: 65, tag: "Nurture", lastTouch: "4d ago", avatar: "PA" },
  { id: 4, name: "Marcus Webb", company: "Ridgeline Advisors", role: "Partner", email: "marcus@ridgeline.com", phone: "+1 555 0221", score: 84, tag: "Hot", lastTouch: "5h ago", avatar: "MW" },
  { id: 5, name: "Elena Reyes", company: "Clearwater Group", role: "CFO", email: "elena@clearwater.io", phone: "+1 555 0267", score: 71, tag: "Active", lastTouch: "2d ago", avatar: "ER" }
];

const seedEmails = [
  { id: 1, from: "Sarah Mitchell", account: "work", subject: "Re: Q4 proposal — timing update", preview: "Thanks for the revised deck. The board meets Thursday. Can you join by phone for the pricing section?", time: "8:42 AM", unread: true, starred: true, aiSummary: "Wants you on Thursday board call for pricing Q&A. Needs RSVP today." },
  { id: 2, from: "Stripe", account: "work", subject: "Payment received — $14,400", preview: "Clearwater Group successfully paid invoice INV-2188.", time: "7:15 AM", unread: true, starred: false, aiSummary: "Clearwater paid. Q4 cash target now 68% complete." },
  { id: 3, from: "David Chen", account: "work", subject: "Intro — partnership idea", preview: "Introducing you to Rebecca Okafor at Fulcrum. She runs their accelerator cohort and wants a conversation.", time: "Yesterday", unread: false, starred: true, aiSummary: "Warm intro to Fulcrum accelerator. Reply within 48h." },
  { id: 4, from: "Calendar", account: "personal", subject: "Dentist reminder — tomorrow 3:15 PM", preview: "You have an appointment with Dr. Patel tomorrow.", time: "Yesterday", unread: false, starred: false, aiSummary: "Personal reminder. No action needed." },
  { id: 5, from: "Priya Anand", account: "work", subject: "Compliance doc revisions", preview: "I flagged three items in the attached redline. Section 4.2 is the only blocker.", time: "Mon", unread: false, starred: false, aiSummary: "Section 4.2 blocks signing. Two other items are cosmetic." },
  { id: 6, from: "GitHub", account: "dev", subject: "PR #284 approved", preview: "Marcus Webb approved your pull request.", time: "Mon", unread: false, starred: false, aiSummary: "Safe to merge. CI green." }
];

const seedEvents = [
  { id: 1, title: "Sarah Mitchell — Pricing review", time: "10:00 AM", duration: "45m", type: "call", color: theme.blue500, day: 0 },
  { id: 2, title: "Team standup", time: "11:30 AM", duration: "15m", type: "internal", color: theme.navy600, day: 0 },
  { id: 3, title: "Deep work block", time: "2:00 PM", duration: "2h", type: "focus", color: theme.green500, day: 0 },
  { id: 4, title: "Marcus Webb — Discovery", time: "9:30 AM", duration: "30m", type: "call", color: theme.blue500, day: 1 },
  { id: 5, title: "Board prep", time: "3:00 PM", duration: "1h", type: "focus", color: theme.green500, day: 1 },
  { id: 6, title: "Harrison Capital board call", time: "10:00 AM", duration: "1h", type: "call", color: theme.amber500, day: 2 }
];

const seedProjects = [
  { id: 1, name: "Q4 Harrison rollout", stage: "In progress", owner: "You", due: "Nov 18", progress: 62, tasks: 14, tasksDone: 9 },
  { id: 2, name: "Fulcrum partnership", stage: "Discovery", owner: "You + David", due: "Dec 1", progress: 20, tasks: 8, tasksDone: 2 },
  { id: 3, name: "Website refresh", stage: "Review", owner: "Elena", due: "Oct 30", progress: 85, tasks: 22, tasksDone: 19 },
  { id: 4, name: "2026 planning doc", stage: "Backlog", owner: "You", due: "Dec 15", progress: 0, tasks: 6, tasksDone: 0 }
];

const seedTasks = [
  { id: 1, text: "Reply to Sarah on Thursday board call", done: false, priority: "high", project: "Q4 Harrison rollout" },
  { id: 2, text: "Review Fulcrum intro email — draft reply", done: false, priority: "high", project: "Fulcrum partnership" },
  { id: 3, text: "Fix compliance doc section 4.2", done: false, priority: "medium", project: "Q4 Harrison rollout" },
  { id: 4, text: "Approve Elena's homepage copy", done: true, priority: "medium", project: "Website refresh" },
  { id: 5, text: "Block 2h for 2026 planning draft", done: false, priority: "low", project: "2026 planning doc" }
];

const seedFiles = [
  { id: 1, name: "Harrison_Proposal_v4.pdf", kind: "pdf", size: "2.4 MB", modified: "2h ago", folder: "Clients / Harrison" },
  { id: 2, name: "Q4_pricing_deck.key", kind: "slides", size: "18.1 MB", modified: "Yesterday", folder: "Sales" },
  { id: 3, name: "Fulcrum_intro_notes.md", kind: "doc", size: "12 KB", modified: "Yesterday", folder: "Partnerships" },
  { id: 4, name: "Brand_photo_shoot_02.jpg", kind: "image", size: "4.8 MB", modified: "Mon", folder: "Marketing" },
  { id: 5, name: "Board_call_recording.m4a", kind: "audio", size: "42 MB", modified: "Mon", folder: "Meetings" },
  { id: 6, name: "Product_demo.mp4", kind: "video", size: "112 MB", modified: "Last week", folder: "Sales" },
  { id: 7, name: "2026_model.xlsx", kind: "sheet", size: "380 KB", modified: "Last week", folder: "Finance" },
  { id: 8, name: "Compliance_checklist.pdf", kind: "pdf", size: "890 KB", modified: "2 weeks", folder: "Legal" }
];

const seedChat = [
  { id: 1, role: "ai", text: "Good morning. You have 3 priorities today. Want the briefing?", time: "7:32 AM" },
  { id: 2, role: "user", text: "Yes — quick version.", time: "7:33 AM" },
  { id: 3, role: "ai", text: "One: Sarah Mitchell needs a yes on Thursday's board call. Two: reply to David's Fulcrum intro before end of day. Three: section 4.2 on the Harrison compliance doc is blocking the close. Want me to draft the Sarah reply now?", time: "7:33 AM" }
];

// ═══════════════════════════════════════════════════════════
//  ROOT COMPONENT
// ═══════════════════════════════════════════════════════════
export default function App() {
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

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "inbox",     label: "Unified Inbox", icon: Inbox },
    { id: "crm",       label: "CRM",          icon: Users },
    { id: "calendar",  label: "Calendar",     icon: Calendar },
    { id: "projects",  label: "Projects",     icon: FolderKanban },
    { id: "library",   label: "Library",      icon: FileStack }
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: theme.navy50,
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: theme.navy800,
      display: "flex",
      WebkitFontSmoothing: "antialiased"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ═══ SIDEBAR ═══ */}
      <Sidebar
        items={navItems}
        current={view}
        onNav={(id) => { setView(id); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />

      {/* ═══ MAIN ═══ */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        marginLeft: isMobile ? 0 : 240
      }}>
        <TopBar
          onMenu={() => setSidebarOpen(true)}
          onAssistant={() => setAssistantOpen(true)}
          isMobile={isMobile}
          view={view}
        />

        <main style={{ flex: 1, padding: isMobile ? 16 : 32, paddingBottom: 120 }}>
          {view === "dashboard" && <Dashboard setView={setView} openAssistant={() => setAssistantOpen(true)} />}
          {view === "inbox"     && <UnifiedInbox />}
          {view === "crm"       && <CRM />}
          {view === "calendar"  && <CalendarView isMobile={isMobile} />}
          {view === "projects"  && <Projects />}
          {view === "library"   && <Library />}
        </main>
      </div>

      {/* ═══ AI ASSISTANT — always accessible ═══ */}
      <AssistantLauncher
        open={assistantOpen}
        onToggle={() => setAssistantOpen(!assistantOpen)}
        isMobile={isMobile}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════════════════
function Sidebar({ items, current, onNav, open, onClose, isMobile }) {
  const content = (
    <div style={{
      width: 240,
      height: "100vh",
      background: theme.navy950,
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      position: "fixed",
      top: 0,
      left: isMobile ? (open ? 0 : -260) : 0,
      transition: "left 0.25s ease",
      zIndex: 60
    }}>
      {/* Brand */}
      <div style={{ padding: "20px 20px 28px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `linear-gradient(135deg, ${theme.blue500}, ${theme.green500})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 800, color: theme.white, fontSize: 13
        }}>AI</div>
        <div>
          <div style={{ color: theme.white, fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>
            Workspace
          </div>
          <div style={{ color: theme.navy400, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            v1.0 · live
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "transparent", border: "none",
            color: theme.navy400, cursor: "pointer", padding: 4
          }}><X size={20} /></button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(item => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10,
                background: active ? "rgba(59,130,246,0.12)" : "transparent",
                border: active ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
                color: active ? theme.blue400 : theme.navy300,
                fontSize: 14, fontWeight: active ? 600 : 500,
                cursor: "pointer", textAlign: "left", width: "100%",
                fontFamily: "inherit", transition: "all 0.15s"
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{
        padding: 12, margin: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        display: "flex", alignItems: "center", gap: 10
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: `linear-gradient(135deg, ${theme.blue500}, ${theme.teal500})`,
          color: theme.white, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 13
        }}>JC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: theme.white, fontSize: 13, fontWeight: 600 }}>Jordan Cole</div>
          <div style={{ color: theme.navy500, fontSize: 11 }}>jordan@firm.co</div>
        </div>
        <Settings size={15} color={theme.navy500} style={{ cursor: "pointer" }} />
      </div>
    </div>
  );

  return (
    <>
      {isMobile && open && (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 55, backdropFilter: "blur(2px)"
        }} />
      )}
      {content}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  TOP BAR
// ═══════════════════════════════════════════════════════════
function TopBar({ onMenu, onAssistant, isMobile, view }) {
  const titles = {
    dashboard: "Good morning, Jordan",
    inbox: "Unified Inbox",
    crm: "CRM",
    calendar: "Calendar",
    projects: "Projects",
    library: "Library"
  };
  return (
    <header style={{
      height: 64,
      background: theme.white,
      borderBottom: `1px solid ${theme.navy200}`,
      display: "flex", alignItems: "center",
      padding: isMobile ? "0 16px" : "0 32px",
      gap: 12,
      position: "sticky", top: 0, zIndex: 40
    }}>
      {isMobile && (
        <button onClick={onMenu} style={{
          background: "transparent", border: "none", padding: 6,
          cursor: "pointer", color: theme.navy700
        }}><Menu size={22} /></button>
      )}

      <h1 style={{
        fontSize: isMobile ? 17 : 21,
        fontWeight: 700,
        letterSpacing: "-0.4px",
        color: theme.navy900,
        margin: 0
      }}>{titles[view]}</h1>

      <div style={{
        flex: 1, maxWidth: 420,
        marginLeft: isMobile ? "auto" : 32,
        display: isMobile ? "none" : "flex",
        alignItems: "center", gap: 8,
        background: theme.navy50,
        border: `1px solid ${theme.navy200}`,
        borderRadius: 10, padding: "7px 12px"
      }}>
        <Search size={15} color={theme.navy500} />
        <input
          placeholder="Ask AI or search anything..."
          style={{
            border: "none", background: "transparent", outline: "none",
            width: "100%", fontSize: 13, color: theme.navy800,
            fontFamily: "inherit"
          }}
        />
        <kbd style={{
          fontSize: 10, color: theme.navy500,
          background: theme.white, padding: "2px 6px",
          borderRadius: 4, border: `1px solid ${theme.navy200}`,
          fontFamily: "'JetBrains Mono', monospace"
        }}>⌘K</kbd>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: isMobile ? 0 : "auto" }}>
        <IconBtn><Bell size={18} /></IconBtn>
        <button
          onClick={onAssistant}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: `linear-gradient(135deg, ${theme.blue600}, ${theme.blue500})`,
            color: theme.white, border: "none", padding: "8px 14px",
            borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)"
          }}
        >
          <Sparkles size={14} />
          {isMobile ? "AI" : "Ask AI"}
        </button>
      </div>
    </header>
  );
}

function IconBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: `1px solid ${theme.navy200}`,
      color: theme.navy700, padding: 8, borderRadius: 9,
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
    }}>{children}</button>
  );
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════
function Dashboard({ setView, openAssistant }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
      {/* Hero briefing */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.navy950} 0%, #1e3a5f 60%, ${theme.navy900} 100%)`,
        borderRadius: 20,
        padding: 28,
        color: theme.white,
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 240, height: 240,
          background: `radial-gradient(circle, rgba(59,130,246,0.15), transparent 65%)`,
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 60% 50% at 20% 40%, black 20%, transparent 70%)",
          pointerEvents: "none"
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.22)",
            padding: "5px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, color: theme.blue400,
            marginBottom: 16
          }}>
            <Sparkles size={12} /> Daily briefing · 7:32 AM
          </div>
          <h2 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.8px",
            lineHeight: 1.15, margin: 0, maxWidth: 640
          }}>
            Three things move the needle today.
          </h2>
          <p style={{ color: theme.navy300, marginTop: 10, fontSize: 14, lineHeight: 1.6, maxWidth: 600 }}>
            Sarah Mitchell needs an RSVP for Thursday's board call. The Fulcrum intro from David goes stale after 48 hours. Section 4.2 on the Harrison compliance doc is blocking the close.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={openAssistant} style={{
              background: theme.white, color: theme.navy900,
              border: "none", padding: "9px 16px", borderRadius: 10,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit"
            }}>
              <MessageSquare size={14} /> Open assistant
            </button>
            <button onClick={() => setView("inbox")} style={{
              background: "rgba(255,255,255,0.06)",
              color: theme.white,
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "9px 16px", borderRadius: 10,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              fontFamily: "inherit"
            }}>View inbox →</button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard label="Unread" value="7" trend="+2 today" color={theme.blue500} icon={Inbox} />
        <StatCard label="Meetings today" value="3" trend="4h 15m" color={theme.green500} icon={Calendar} />
        <StatCard label="Open tasks" value="14" trend="3 high priority" color={theme.amber500} icon={Target} />
        <StatCard label="Pipeline" value="$184k" trend="+12% wk" color={theme.teal500} icon={TrendingUp} />
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card title="Today's priorities" action="Open tasks" onAction={() => setView("projects")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {seedTasks.filter(t => !t.done).slice(0, 4).map(t => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </Card>

        <Card title="Next up" action="Full calendar" onAction={() => setView("calendar")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {seedEvents.filter(e => e.day === 0).map(e => (
              <div key={e.id} style={{
                display: "flex", gap: 12, padding: 10,
                background: theme.navy50, borderRadius: 10,
                border: `1px solid ${theme.navy200}`
              }}>
                <div style={{
                  width: 4, borderRadius: 2, background: e.color, flexShrink: 0
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.navy800 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: theme.navy500, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {e.time} · {e.duration}
                  </div>
                </div>
                {e.type === "call" && <Video size={14} color={theme.navy500} style={{ alignSelf: "center" }} />}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card title="Recent activity" action="">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { icon: Mail, color: theme.blue500, text: "Sarah Mitchell replied to Q4 proposal", time: "8:42 AM" },
            { icon: CheckCircle2, color: theme.green500, text: "Stripe payment received — $14,400 from Clearwater", time: "7:15 AM" },
            { icon: Users, color: theme.teal500, text: "Marcus Webb's lead score moved to 84", time: "5:20 AM" },
            { icon: FileText, color: theme.amber500, text: "AI drafted follow-up for David Chen intro", time: "Yesterday" }
          ].map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 0",
                borderBottom: i < 3 ? `1px solid ${theme.navy100}` : "none"
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: `${a.color}14`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Icon size={15} color={a.color} />
                </div>
                <div style={{ flex: 1, fontSize: 13, color: theme.navy800 }}>{a.text}</div>
                <div style={{ fontSize: 11, color: theme.navy500, fontFamily: "'JetBrains Mono', monospace" }}>{a.time}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, trend, color, icon: Icon }) {
  return (
    <div style={{
      background: theme.white,
      border: `1px solid ${theme.navy200}`,
      borderRadius: 14, padding: 16,
      display: "flex", flexDirection: "column", gap: 6
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${color}14`,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 12, color: theme.navy500, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: theme.navy900,
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px"
      }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.navy500 }}>{trend}</div>
    </div>
  );
}

function Card({ title, action, onAction, children }) {
  return (
    <div style={{
      background: theme.white,
      border: `1px solid ${theme.navy200}`,
      borderRadius: 14, padding: 18
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy900, margin: 0, letterSpacing: "-0.2px" }}>
          {title}
        </h3>
        {action && (
          <button onClick={onAction} style={{
            fontSize: 12, color: theme.blue600, background: "transparent",
            border: "none", cursor: "pointer", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit"
          }}>
            {action} <ArrowUpRight size={12} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function TaskRow({ task }) {
  const [done, setDone] = useState(task.done);
  const priorityColor = task.priority === "high" ? theme.red500
                      : task.priority === "medium" ? theme.amber500 : theme.navy400;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 10, borderRadius: 9,
      background: theme.navy50, border: `1px solid ${theme.navy200}`,
      opacity: done ? 0.55 : 1
    }}>
      <button onClick={() => setDone(!done)} style={{
        background: "transparent", border: "none", padding: 0,
        cursor: "pointer", display: "flex"
      }}>
        {done
          ? <CheckCircle2 size={18} color={theme.green500} />
          : <Circle size={18} color={theme.navy400} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: theme.navy800, fontWeight: 500,
          textDecoration: done ? "line-through" : "none"
        }}>{task.text}</div>
        <div style={{ fontSize: 11, color: theme.navy500, marginTop: 2 }}>{task.project}</div>
      </div>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", background: priorityColor
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  UNIFIED INBOX
// ═══════════════════════════════════════════════════════════
function UnifiedInbox() {
  const [selected, setSelected] = useState(seedEmails[0]);
  const [filter, setFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filtered = filter === "all" ? seedEmails : seedEmails.filter(e => e.account === filter);

  return (
    <div style={{
      background: theme.white,
      border: `1px solid ${theme.navy200}`,
      borderRadius: 14,
      overflow: "hidden",
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "360px 1fr",
      height: "calc(100vh - 160px)",
      minHeight: 500
    }}>
      {/* List */}
      <div style={{
        borderRight: isMobile ? "none" : `1px solid ${theme.navy200}`,
        display: (isMobile && mobileShowDetail) ? "none" : "flex",
        flexDirection: "column",
        minHeight: 0
      }}>
        {/* Account filter */}
        <div style={{
          padding: 12, borderBottom: `1px solid ${theme.navy200}`,
          display: "flex", gap: 6, overflowX: "auto"
        }}>
          {[
            { id: "all", label: "All accounts", count: seedEmails.length },
            { id: "work", label: "Work", count: seedEmails.filter(e => e.account === "work").length },
            { id: "personal", label: "Personal", count: 1 },
            { id: "dev", label: "Dev", count: 1 }
          ].map(acc => (
            <button key={acc.id} onClick={() => setFilter(acc.id)} style={{
              background: filter === acc.id ? theme.navy900 : theme.navy50,
              color: filter === acc.id ? theme.white : theme.navy700,
              border: `1px solid ${filter === acc.id ? theme.navy900 : theme.navy200}`,
              padding: "6px 11px", borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              whiteSpace: "nowrap", fontFamily: "inherit"
            }}>
              {acc.label} <span style={{ opacity: 0.6 }}>{acc.count}</span>
            </button>
          ))}
        </div>

        {/* Email list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map(email => (
            <div
              key={email.id}
              onClick={() => { setSelected(email); setMobileShowDetail(true); }}
              style={{
                padding: 14,
                borderBottom: `1px solid ${theme.navy100}`,
                cursor: "pointer",
                background: selected.id === email.id ? theme.navy50 : theme.white,
                borderLeft: selected.id === email.id ? `3px solid ${theme.blue500}` : "3px solid transparent"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: email.unread ? theme.blue500 : "transparent"
                }} />
                <span style={{
                  fontSize: 13, fontWeight: email.unread ? 700 : 500,
                  color: theme.navy900, flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{email.from}</span>
                {email.starred && <Star size={12} color={theme.amber500} fill={theme.amber500} />}
                <span style={{ fontSize: 11, color: theme.navy500, fontFamily: "'JetBrains Mono', monospace" }}>
                  {email.time}
                </span>
              </div>
              <div style={{
                fontSize: 13, fontWeight: email.unread ? 600 : 500,
                color: theme.navy800, marginBottom: 3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>{email.subject}</div>
              <div style={{
                fontSize: 12, color: theme.navy500, lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
              }}>{email.preview}</div>
              <div style={{
                marginTop: 8, padding: "6px 9px",
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.15)",
                borderRadius: 7, fontSize: 11, color: theme.blue600,
                display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4
              }}>
                <Sparkles size={11} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{email.aiSummary}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{
        display: (isMobile && !mobileShowDetail) ? "none" : "flex",
        flexDirection: "column",
        minHeight: 0
      }}>
        <div style={{
          padding: 16, borderBottom: `1px solid ${theme.navy200}`,
          display: "flex", alignItems: "center", gap: 10
        }}>
          {isMobile && (
            <button onClick={() => setMobileShowDetail(false)} style={{
              background: "transparent", border: "none", padding: 4,
              cursor: "pointer", color: theme.navy700
            }}>←</button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.navy900, marginBottom: 2 }}>
              {selected.subject}
            </div>
            <div style={{ fontSize: 12, color: theme.navy500 }}>
              From <b>{selected.from}</b> · {selected.time}
            </div>
          </div>
          <IconBtn><Reply size={15} /></IconBtn>
          <IconBtn><Archive size={15} /></IconBtn>
          <IconBtn><MoreHorizontal size={15} /></IconBtn>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{
            background: `linear-gradient(135deg, ${theme.navy900}, ${theme.navy800})`,
            borderRadius: 12, padding: 16, marginBottom: 20,
            color: theme.white
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginBottom: 8,
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 1, color: theme.blue400
            }}>
              <Sparkles size={12} /> AI SUMMARY
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: theme.navy200 }}>
              {selected.aiSummary}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button style={{
                background: theme.blue500, color: theme.white, border: "none",
                padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit"
              }}>Draft reply</button>
              <button style={{
                background: "rgba(255,255,255,0.08)", color: theme.white,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit"
              }}>Schedule reminder</button>
              <button style={{
                background: "rgba(255,255,255,0.08)", color: theme.white,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit"
              }}>Add task</button>
            </div>
          </div>

          <div style={{ fontSize: 14, color: theme.navy700, lineHeight: 1.75 }}>
            <p style={{ margin: "0 0 14px" }}>Hi Jordan,</p>
            <p style={{ margin: "0 0 14px" }}>
              {selected.preview}
            </p>
            <p style={{ margin: "0 0 14px" }}>
              Let me know what works on your end. Happy to adjust the agenda if that helps.
            </p>
            <p style={{ margin: 0 }}>— {selected.from}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CRM
// ═══════════════════════════════════════════════════════════
function CRM() {
  const [selected, setSelected] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter bar */}
      <div style={{
        background: theme.white, border: `1px solid ${theme.navy200}`,
        borderRadius: 12, padding: 14,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={15} color={theme.navy500} />
          <input placeholder="Search contacts..." style={{
            border: "none", outline: "none", background: "transparent",
            fontSize: 13, width: "100%", color: theme.navy800, fontFamily: "inherit"
          }} />
        </div>
        <button style={{
          background: theme.navy50, border: `1px solid ${theme.navy200}`,
          padding: "7px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: theme.navy700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit"
        }}><Filter size={13} /> Filters</button>
        <button style={{
          background: theme.blue600, color: theme.white, border: "none",
          padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: "inherit"
        }}><Plus size={13} /> New contact</button>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {seedContacts.map(c => (
          <div key={c.id} onClick={() => setSelected(c)} style={{
            background: theme.white, border: `1px solid ${theme.navy200}`,
            borderRadius: 14, padding: 16,
            display: "flex", gap: 14, cursor: "pointer",
            transition: "all 0.15s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = theme.blue400;
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = theme.navy200;
            e.currentTarget.style.transform = "translateY(0)";
          }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.blue500}, ${theme.teal500})`,
              color: theme.white, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14, flexShrink: 0
            }}>{c.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.navy900 }}>{c.name}</span>
                <TagPill tag={c.tag} />
              </div>
              <div style={{ fontSize: 12, color: theme.navy500, marginTop: 2 }}>
                {c.role} · {c.company}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: theme.navy600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail size={11} /> {c.email}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {c.lastTouch}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 22, fontWeight: 800,
                color: c.score >= 80 ? theme.green500 : c.score >= 60 ? theme.amber500 : theme.navy500,
                letterSpacing: "-0.5px"
              }}>{c.score}</div>
              <div style={{ fontSize: 10, color: theme.navy500, textTransform: "uppercase", letterSpacing: 0.5 }}>
                score
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && <ContactDetail contact={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TagPill({ tag }) {
  const colors = {
    Hot: { bg: "rgba(239,68,68,0.1)", fg: theme.red500 },
    Active: { bg: "rgba(16,185,129,0.1)", fg: theme.green500 },
    Nurture: { bg: "rgba(59,130,246,0.1)", fg: theme.blue500 }
  };
  const c = colors[tag] || colors.Active;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      borderRadius: 5, background: c.bg, color: c.fg,
      textTransform: "uppercase", letterSpacing: 0.5
    }}>{tag}</span>
  );
}

function ContactDetail({ contact, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(10,15,30,0.5)",
      zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, backdropFilter: "blur(4px)"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: theme.white, borderRadius: 16, maxWidth: 560, width: "100%",
        maxHeight: "85vh", overflow: "auto",
        border: `1px solid ${theme.navy200}`
      }}>
        <div style={{
          padding: 24,
          background: `linear-gradient(135deg, ${theme.navy900}, ${theme.navy800})`,
          color: theme.white
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{
                width: 58, height: 58, borderRadius: "50%",
                background: `linear-gradient(135deg, ${theme.blue500}, ${theme.teal500})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 20
              }}>{contact.avatar}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px" }}>{contact.name}</div>
                <div style={{ fontSize: 13, color: theme.navy300, marginTop: 2 }}>
                  {contact.role} · {contact.company}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.08)", border: "none",
              color: theme.white, padding: 6, borderRadius: 8, cursor: "pointer"
            }}><X size={16} /></button>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.2)",
            padding: 14, borderRadius: 12, marginBottom: 18
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: theme.blue600,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
              display: "flex", alignItems: "center", gap: 6
            }}><Sparkles size={12} /> AI insight</div>
            <div style={{ fontSize: 13, color: theme.navy700, lineHeight: 1.5 }}>
              Engagement up 18% this month. Last three emails opened within 20 minutes. Strong candidate for the Q1 upsell conversation.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <DetailCell label="Email" value={contact.email} />
            <DetailCell label="Phone" value={contact.phone} />
            <DetailCell label="Score" value={contact.score} mono />
            <DetailCell label="Last touch" value={contact.lastTouch} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              flex: 1, background: theme.blue600, color: theme.white, border: "none",
              padding: 10, borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit"
            }}><Mail size={14} /> Email</button>
            <button style={{
              flex: 1, background: theme.navy50, color: theme.navy800,
              border: `1px solid ${theme.navy200}`,
              padding: 10, borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit"
            }}><Phone size={14} /> Call</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCell({ label, value, mono }) {
  return (
    <div style={{
      background: theme.navy50, border: `1px solid ${theme.navy200}`,
      borderRadius: 9, padding: 10
    }}>
      <div style={{ fontSize: 10, color: theme.navy500, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, color: theme.navy900, fontWeight: 600, marginTop: 3,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit"
      }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════════
function CalendarView({ isMobile }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const hours = ["9:00", "10:00", "11:00", "12:00", "1:00", "2:00", "3:00", "4:00", "5:00"];
  const todayIdx = 0;

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {days.map((d, i) => (
          <div key={d} style={{
            background: theme.white, border: `1px solid ${theme.navy200}`,
            borderRadius: 12, padding: 14
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 10
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: i === todayIdx ? theme.blue600 : theme.navy900
              }}>{d}</div>
              {i === todayIdx && <span style={{
                fontSize: 10, fontWeight: 700, color: theme.blue600,
                background: "rgba(59,130,246,0.1)", padding: "2px 7px", borderRadius: 4
              }}>TODAY</span>}
            </div>
            {seedEvents.filter(e => e.day === i).length === 0 ? (
              <div style={{ fontSize: 12, color: theme.navy500 }}>No events</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {seedEvents.filter(e => e.day === i).map(e => (
                  <div key={e.id} style={{
                    borderLeft: `3px solid ${e.color}`,
                    paddingLeft: 10, paddingTop: 4, paddingBottom: 4
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.navy900 }}>{e.title}</div>
                    <div style={{
                      fontSize: 11, color: theme.navy500, marginTop: 2,
                      fontFamily: "'JetBrains Mono', monospace"
                    }}>{e.time} · {e.duration}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background: theme.white, border: `1px solid ${theme.navy200}`,
      borderRadius: 14, overflow: "hidden"
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "70px repeat(5, 1fr)",
        borderBottom: `1px solid ${theme.navy200}`,
        background: theme.navy50
      }}>
        <div />
        {days.map((d, i) => (
          <div key={d} style={{
            padding: 14, textAlign: "center",
            borderLeft: `1px solid ${theme.navy200}`
          }}>
            <div style={{ fontSize: 11, color: theme.navy500, fontWeight: 600, letterSpacing: 0.5 }}>
              {d.toUpperCase()}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 700,
              color: i === todayIdx ? theme.blue600 : theme.navy900,
              marginTop: 2, fontFamily: "'JetBrains Mono', monospace"
            }}>{18 + i}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", height: 540, overflowY: "auto" }}>
        {hours.map((h, hi) => (
          <div key={h} style={{
            display: "grid", gridTemplateColumns: "70px repeat(5, 1fr)",
            height: 60, borderBottom: `1px solid ${theme.navy100}`
          }}>
            <div style={{
              padding: "4px 10px", fontSize: 11, color: theme.navy500,
              fontFamily: "'JetBrains Mono', monospace", textAlign: "right"
            }}>{h}</div>
            {days.map((_, di) => (
              <div key={di} style={{
                borderLeft: `1px solid ${theme.navy100}`, position: "relative"
              }}>
                {seedEvents.filter(e => e.day === di && e.time.startsWith(h.split(":")[0])).map(e => (
                  <div key={e.id} style={{
                    position: "absolute", top: 2, left: 4, right: 4,
                    background: `${e.color}14`,
                    borderLeft: `3px solid ${e.color}`,
                    borderRadius: 6, padding: "5px 7px",
                    height: e.duration.includes("2h") ? 115 : e.duration.includes("1h") ? 55 : 40,
                    fontSize: 11, overflow: "hidden", cursor: "pointer"
                  }}>
                    <div style={{ fontWeight: 600, color: theme.navy900, fontSize: 11, lineHeight: 1.3 }}>
                      {e.title}
                    </div>
                    <div style={{ color: theme.navy500, fontSize: 10, marginTop: 1 }}>{e.time}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PROJECTS
// ═══════════════════════════════════════════════════════════
function Projects() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {seedProjects.map(p => (
          <div key={p.id} style={{
            background: theme.white, border: `1px solid ${theme.navy200}`,
            borderRadius: 14, padding: 18
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy900, margin: 0, letterSpacing: "-0.2px" }}>
                {p.name}
              </h3>
              <StageBadge stage={p.stage} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 11, color: theme.navy500, marginBottom: 14
            }}>
              <span>{p.owner}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Due {p.due}</span>
            </div>
            <div style={{
              height: 5, background: theme.navy100, borderRadius: 3, overflow: "hidden", marginBottom: 8
            }}>
              <div style={{
                height: "100%",
                width: `${p.progress}%`,
                background: `linear-gradient(90deg, ${theme.blue500}, ${theme.green500})`,
                borderRadius: 3
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: theme.navy500, fontFamily: "'JetBrains Mono', monospace"
            }}>
              <span>{p.tasksDone}/{p.tasks} tasks</span>
              <span>{p.progress}%</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: theme.white, border: `1px solid ${theme.navy200}`,
        borderRadius: 14, padding: 18
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy900, marginBottom: 14, letterSpacing: "-0.2px" }}>
          All tasks
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {seedTasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      </div>
    </div>
  );
}

function StageBadge({ stage }) {
  const map = {
    "In progress": { bg: "rgba(59,130,246,0.1)", fg: theme.blue600 },
    "Discovery": { bg: "rgba(20,184,166,0.1)", fg: theme.teal500 },
    "Review": { bg: "rgba(245,158,11,0.1)", fg: theme.amber500 },
    "Backlog": { bg: theme.navy100, fg: theme.navy600 }
  };
  const c = map[stage] || map.Backlog;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 8px",
      borderRadius: 5, background: c.bg, color: c.fg,
      textTransform: "uppercase", letterSpacing: 0.5
    }}>{stage}</span>
  );
}

// ═══════════════════════════════════════════════════════════
//  LIBRARY
// ═══════════════════════════════════════════════════════════
function Library() {
  const iconMap = {
    pdf: { icon: FileText, color: theme.red500 },
    slides: { icon: FileText, color: theme.amber500 },
    doc: { icon: FileText, color: theme.blue500 },
    image: { icon: ImageIcon, color: theme.teal500 },
    audio: { icon: Music, color: theme.green500 },
    video: { icon: Film, color: theme.blue600 },
    sheet: { icon: FileText, color: theme.green500 }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        background: theme.white, border: `1px solid ${theme.navy200}`,
        borderRadius: 12, padding: 12,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={15} color={theme.navy500} />
          <input placeholder="Search files..." style={{
            border: "none", outline: "none", background: "transparent",
            fontSize: 13, width: "100%", color: theme.navy800, fontFamily: "inherit"
          }} />
        </div>
        <button style={{
          background: theme.blue600, color: theme.white, border: "none",
          padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: "inherit"
        }}><Plus size={13} /> Upload</button>
      </div>

      <div style={{
        background: theme.white, border: `1px solid ${theme.navy200}`,
        borderRadius: 14, overflow: "hidden"
      }}>
        {seedFiles.map((f, i) => {
          const cfg = iconMap[f.kind] || iconMap.doc;
          const Icon = cfg.icon;
          return (
            <div key={f.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: 14,
              borderBottom: i < seedFiles.length - 1 ? `1px solid ${theme.navy100}` : "none",
              cursor: "pointer"
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.navy50}
            onMouseLeave={e => e.currentTarget.style.background = theme.white}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: `${cfg.color}14`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
              }}>
                <Icon size={17} color={cfg.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: theme.navy900,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>{f.name}</div>
                <div style={{ fontSize: 11, color: theme.navy500, marginTop: 2 }}>
                  {f.folder} · {f.size} · {f.modified}
                </div>
              </div>
              <button style={{
                background: "transparent", border: "none", padding: 6,
                color: theme.navy500, cursor: "pointer"
              }}><MoreHorizontal size={15} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  AI ASSISTANT — voice + text, always-on
// ═══════════════════════════════════════════════════════════
function AssistantLauncher({ open, onToggle, isMobile }) {
  const [messages, setMessages] = useState(seedChat);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = (text) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text, time: "now" };
    setMessages(m => [...m, userMsg]);
    setInput("");

    // Simulated response
    setTimeout(() => {
      const responses = [
        "On it. I'll draft that and put it in your outbox for review.",
        "Done. I scheduled 30 minutes at 2 PM and added prep notes from the last three meetings.",
        "Pulled the file. It was in Clients / Harrison. Opening it now.",
        "Sarah's last four emails averaged a 14-minute reply time. Send it now and you'll likely hear back before noon."
      ];
      const reply = responses[Math.floor(Math.random() * responses.length)];
      setMessages(m => [...m, { id: Date.now() + 1, role: "ai", text: reply, time: "now" }]);
    }, 700);
  };

  const toggleListen = () => {
    setListening(l => !l);
    if (!listening) {
      setTimeout(() => {
        setListening(false);
        send("What's on my calendar after 2 today?");
      }, 2200);
    }
  };

  if (!open) {
    return (
      <button onClick={onToggle} style={{
        position: "fixed", bottom: 24, right: 24,
        width: 58, height: 58, borderRadius: "50%",
        background: `linear-gradient(135deg, ${theme.blue600}, ${theme.green500})`,
        border: "none", cursor: "pointer",
        boxShadow: "0 10px 28px rgba(37,99,235,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: theme.white, zIndex: 80
      }}>
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed",
      bottom: isMobile ? 0 : 24,
      right: isMobile ? 0 : 24,
      left: isMobile ? 0 : "auto",
      top: isMobile ? 0 : "auto",
      width: isMobile ? "100%" : 400,
      height: isMobile ? "100%" : 600,
      maxHeight: isMobile ? "100%" : "calc(100vh - 48px)",
      background: theme.navy950,
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: isMobile ? 0 : 18,
      boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
      display: "flex", flexDirection: "column", zIndex: 80,
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: 16, borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 12,
        background: `linear-gradient(135deg, ${theme.navy900}, ${theme.navy950})`
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: `linear-gradient(135deg, ${theme.blue500}, ${theme.green500})`,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <Sparkles size={17} color={theme.white} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: theme.white, fontSize: 14, fontWeight: 700 }}>AI Assistant</div>
          <div style={{
            color: theme.green400, fontSize: 11,
            display: "flex", alignItems: "center", gap: 5
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: theme.green400,
              animation: "pulse 2s infinite"
            }} />
            Connected · voice + text
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: "rgba(255,255,255,0.06)", border: "none",
          color: theme.navy300, padding: 7, borderRadius: 8, cursor: "pointer"
        }}><X size={15} /></button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 12
      }}>
        {messages.map(m => (
          <div key={m.id} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start"
          }}>
            <div style={{
              maxWidth: "82%",
              padding: "10px 14px",
              borderRadius: 14,
              background: m.role === "user"
                ? `linear-gradient(135deg, ${theme.blue600}, ${theme.blue500})`
                : "rgba(255,255,255,0.04)",
              border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.06)",
              color: m.role === "user" ? theme.white : theme.navy200,
              fontSize: 13, lineHeight: 1.55
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {listening && (
          <div style={{
            alignSelf: "center",
            padding: "8px 14px", borderRadius: 20,
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: theme.green400, fontSize: 12, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: theme.green400,
              animation: "pulse 1s infinite"
            }} />
            Listening...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div style={{
        padding: "0 16px 12px", display: "flex", gap: 6, overflowX: "auto"
      }}>
        {["Draft reply to Sarah", "Summarize today", "Move my 3pm", "Find Harrison proposal"].map(s => (
          <button key={s} onClick={() => send(s)} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: theme.navy300, padding: "6px 11px",
            borderRadius: 16, fontSize: 11, cursor: "pointer",
            whiteSpace: "nowrap", fontFamily: "inherit"
          }}>{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: 14, borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", gap: 8, alignItems: "center",
        background: "rgba(15,23,42,0.6)"
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(input); }}
          placeholder="Ask anything or say a command..."
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: theme.white, padding: "9px 13px", borderRadius: 10,
            fontSize: 13, outline: "none", fontFamily: "inherit"
          }}
        />
        <button onClick={toggleListen} style={{
          width: 38, height: 38, borderRadius: 10,
          background: listening
            ? `linear-gradient(135deg, ${theme.green500}, ${theme.teal500})`
            : "rgba(255,255,255,0.06)",
          border: listening ? "none" : "1px solid rgba(255,255,255,0.1)",
          color: theme.white, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {listening ? <Square size={15} /> : <Mic size={15} />}
        </button>
        <button onClick={() => send(input)} style={{
          width: 38, height: 38, borderRadius: 10,
          background: `linear-gradient(135deg, ${theme.blue600}, ${theme.blue500})`,
          border: "none", color: theme.white, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <Send size={14} />
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  );
}
