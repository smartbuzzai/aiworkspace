"use client";
import { useEffect, useState } from "react";
import { Sparkles, Reply, Archive, MoreHorizontal, Star, Mail } from "lucide-react";

const theme = {
  navy950:"#0a0f1e", navy900:"#0f172a", navy800:"#1e293b",
  navy700:"#334155", navy500:"#64748b", navy400:"#94a3b8",
  navy300:"#cbd5e1", navy200:"#e2e8f0", navy100:"#f1f5f9", navy50:"#f8fafc",
  blue600:"#2563eb", blue500:"#3b82f6", blue400:"#60a5fa",
  green500:"#10b981", red500:"#ef4444", amber500:"#f59e0b",
  white:"#ffffff"
};

export default function InboxView() {
  const [threads, setThreads] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadThreads(); loadAccounts(); }, [filter]);

  async function loadAccounts() {
    try {
      const r = await fetch("/api/accounts", { credentials:"include" });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } catch {}
  }

  async function loadThreads() {
    setLoading(true);
    const qs = filter === "all" ? "" : `?account_id=${filter}`;
    try {
      const r = await fetch(`/api/emails/threads${qs}`, { credentials:"include" });
      const d = await r.json();
      setThreads(d.threads || []);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(thread) {
    setSelected(thread);
    setShowDetail(true);
    try {
      const r = await fetch(`/api/emails/threads/${thread.id}`, { credentials:"include" });
      const d = await r.json();
      setMessages(d.messages || []);
      // Optimistically mark as read locally
      setThreads(t => t.map(x => x.id === thread.id ? { ...x, unread_count: 0 } : x));
    } catch {}
  }

  if (accounts.length === 0 && !loading) {
    return (
      <EmptyInbox />
    );
  }

  return (
    <div style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, overflow:"hidden",
      display:"grid",
      gridTemplateColumns: isMobile ? "1fr" : "380px 1fr",
      height:"calc(100vh - 160px)", minHeight:500
    }}>
      {/* LIST */}
      <div style={{
        borderRight: isMobile ? "none" : `1px solid ${theme.navy200}`,
        display: (isMobile && showDetail) ? "none" : "flex",
        flexDirection:"column", minHeight:0
      }}>
        {accounts.length > 1 && (
          <div style={{
            padding:12, borderBottom:`1px solid ${theme.navy200}`,
            display:"flex", gap:6, overflowX:"auto"
          }}>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All accounts · {threads.length}
            </FilterChip>
            {accounts.map(a => (
              <FilterChip key={a.id} active={filter === a.id} onClick={() => setFilter(a.id)}>
                {a.label}
              </FilterChip>
            ))}
          </div>
        )}

        <div style={{ flex:1, overflowY:"auto" }}>
          {loading ? (
            <div style={{ padding:24, color:theme.navy500, fontSize:13 }}>Loading…</div>
          ) : threads.length === 0 ? (
            <div style={{ padding:24, color:theme.navy500, fontSize:13, textAlign:"center" }}>
              No messages yet.<br />First IMAP sync may take a minute.
            </div>
          ) : threads.map(t => (
            <div key={t.id} onClick={() => openThread(t)} style={{
              padding:14, borderBottom:`1px solid ${theme.navy100}`,
              cursor:"pointer",
              background: selected?.id === t.id ? theme.navy50 : theme.white,
              borderLeft: selected?.id === t.id ? `3px solid ${theme.blue500}` : "3px solid transparent"
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <div style={{
                  width:6, height:6, borderRadius:"50%",
                  background: t.unread_count > 0 ? theme.blue500 : "transparent"
                }} />
                <span style={{
                  fontSize:13, fontWeight: t.unread_count > 0 ? 700 : 500,
                  color:theme.navy900, flex:1,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                }}>{t.participants?.[0] || "Unknown"}</span>
                {t.is_starred && <Star size={12} color={theme.amber500} fill={theme.amber500} />}
                <span style={{ fontSize:11, color:theme.navy500, fontFamily:"'JetBrains Mono', monospace" }}>
                  {relTime(t.last_message_at)}
                </span>
              </div>
              <div style={{
                fontSize:13, fontWeight: t.unread_count > 0 ? 600 : 500,
                color:theme.navy800, marginBottom:3,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
              }}>{t.subject}</div>
              {t.ai_summary && (
                <div style={{
                  marginTop:8, padding:"6px 9px",
                  background:"rgba(59,130,246,0.06)",
                  border:"1px solid rgba(59,130,246,0.15)",
                  borderRadius:7, fontSize:11, color:theme.blue600,
                  display:"flex", alignItems:"flex-start", gap:6, lineHeight:1.4
                }}>
                  <Sparkles size={11} style={{ marginTop:2, flexShrink:0 }} />
                  <span>{t.ai_summary}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DETAIL */}
      <div style={{
        display: (isMobile && !showDetail) ? "none" : "flex",
        flexDirection:"column", minHeight:0
      }}>
        {selected ? (
          <ThreadDetail
            thread={selected} messages={messages}
            onBack={() => setShowDetail(false)} isMobile={isMobile}
          />
        ) : (
          <div style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center",
            color:theme.navy400, fontSize:14
          }}>Select a thread to read</div>
        )}
      </div>
    </div>
  );
}

function ThreadDetail({ thread, messages, onBack, isMobile }) {
  return (
    <>
      <div style={{
        padding:16, borderBottom:`1px solid ${theme.navy200}`,
        display:"flex", alignItems:"center", gap:10
      }}>
        {isMobile && (
          <button onClick={onBack} style={{
            background:"transparent", border:"none", padding:4,
            cursor:"pointer", color:theme.navy700, fontSize:20
          }}>←</button>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:700, color:theme.navy900, marginBottom:2 }}>
            {thread.subject}
          </div>
          <div style={{ fontSize:12, color:theme.navy500 }}>
            {thread.participants?.join(", ")}
          </div>
        </div>
        <IconBtn><Reply size={15} /></IconBtn>
        <IconBtn><Archive size={15} /></IconBtn>
        <IconBtn><MoreHorizontal size={15} /></IconBtn>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {thread.ai_summary && (
          <div style={{
            background:`linear-gradient(135deg, ${theme.navy900}, ${theme.navy800})`,
            borderRadius:12, padding:16, marginBottom:20, color:theme.white
          }}>
            <div style={{
              display:"flex", alignItems:"center", gap:7, marginBottom:8,
              fontSize:11, fontWeight:700, textTransform:"uppercase",
              letterSpacing:1, color:theme.blue400
            }}>
              <Sparkles size={12} /> AI SUMMARY
            </div>
            <div style={{ fontSize:14, lineHeight:1.6, color:theme.navy200 }}>
              {thread.ai_summary}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} style={{
            marginBottom:16, padding:16,
            background:theme.navy50, borderRadius:10,
            border:`1px solid ${theme.navy200}`
          }}>
            <div style={{
              display:"flex", justifyContent:"space-between", marginBottom:8,
              fontSize:12
            }}>
              <span style={{ fontWeight:600, color:theme.navy900 }}>
                {m.from_name || m.from_address}
              </span>
              <span style={{ color:theme.navy500, fontFamily:"'JetBrains Mono', monospace" }}>
                {new Date(m.received_at).toLocaleString()}
              </span>
            </div>
            <div style={{
              fontSize:13, color:theme.navy700, lineHeight:1.6,
              whiteSpace:"pre-wrap",
              maxHeight:300, overflow:"auto"
            }}>{m.body_text || "(no text content)"}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? theme.navy900 : theme.navy50,
      color: active ? theme.white : theme.navy700,
      border: `1px solid ${active ? theme.navy900 : theme.navy200}`,
      padding:"6px 11px", borderRadius:8,
      fontSize:12, fontWeight:600, cursor:"pointer",
      whiteSpace:"nowrap", fontFamily:"inherit"
    }}>{children}</button>
  );
}

function IconBtn({ children }) {
  return (
    <button style={{
      background:"transparent", border:`1px solid ${theme.navy200}`,
      color:theme.navy700, padding:8, borderRadius:9,
      cursor:"pointer", display:"flex"
    }}>{children}</button>
  );
}

function EmptyInbox() {
  return (
    <div style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, padding:40, textAlign:"center"
    }}>
      <div style={{
        width:56, height:56, borderRadius:14,
        background:"rgba(59,130,246,0.1)",
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        marginBottom:14
      }}>
        <Mail size={26} color={theme.blue500} />
      </div>
      <h3 style={{ fontSize:16, fontWeight:700, color:theme.navy900, margin:0 }}>
        No email accounts connected
      </h3>
      <p style={{ fontSize:13, color:theme.navy500, margin:"8px 0 16px", lineHeight:1.6, maxWidth:380, marginLeft:"auto", marginRight:"auto" }}>
        Head to Settings to add Gmail, Outlook, Fastmail, or any IMAP account.
        The sync worker pulls new messages every 2 minutes.
      </p>
    </div>
  );
}

function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d`;
  return d.toLocaleDateString();
}
