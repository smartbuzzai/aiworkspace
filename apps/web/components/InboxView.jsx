"use client";
import { useEffect, useState, useRef } from "react";
import { Sparkles, Reply, Archive, MoreHorizontal, Star, Mail, Trash2, Send, X } from "lucide-react";
import { theme } from "../lib/theme";

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
            onStar={async (id) => {
              const r = await fetch(`/api/emails/threads/${id}/star`, { method:"PATCH", credentials:"include" });
              if (r.ok) {
                const d = await r.json();
                setSelected(s => ({ ...s, is_starred: d.is_starred }));
                setThreads(ts => ts.map(t => t.id === id ? { ...t, is_starred: d.is_starred } : t));
              }
            }}
            onArchive={async (id) => {
              const r = await fetch(`/api/emails/threads/${id}/archive`, { method:"PATCH", credentials:"include" });
              if (r.ok) {
                setThreads(ts => ts.filter(t => t.id !== id));
                setSelected(null);
                setShowDetail(false);
              }
            }}
            onDelete={async (id) => {
              const r = await fetch(`/api/emails/threads/${id}`, { method:"DELETE", credentials:"include" });
              if (r.ok) {
                setThreads(ts => ts.filter(t => t.id !== id));
                setSelected(null);
                setShowDetail(false);
              }
            }}
            onSent={() => openThread(selected)}
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

function ThreadDetail({ thread, messages, onBack, isMobile, onStar, onArchive, onDelete, onSent }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  async function handleSend() {
    if (!replyBody.trim() || sending) return;
    setSending(true);
    try {
      const lastMsg = messages[messages.length - 1];
      const r = await fetch("/api/emails/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: thread.account_id,
          to: [lastMsg?.from_address || thread.participants?.[0]].filter(Boolean),
          subject: thread.subject?.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
          body_text: replyBody,
          in_reply_to: lastMsg?.message_id || undefined,
          thread_id: thread.id,
        })
      });
      if (r.ok) {
        setReplyBody("");
        setReplyOpen(false);
        if (onSent) onSent();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div style={{
        padding:16, borderBottom:`1px solid ${theme.navy200}`,
        display:"flex", alignItems:"center", gap:8
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
        <IconBtn title="Reply" onClick={() => { setReplyOpen(!replyOpen); setTimeout(() => textareaRef.current?.focus(), 100); }}>
          <Reply size={15} />
        </IconBtn>
        <IconBtn title={thread.is_starred ? "Unstar" : "Star"} onClick={() => onStar?.(thread.id)} active={thread.is_starred}>
          <Star size={15} fill={thread.is_starred ? "#f59e0b" : "none"} color={thread.is_starred ? "#f59e0b" : undefined} />
        </IconBtn>
        <IconBtn title="Archive" onClick={() => onArchive?.(thread.id)}>
          <Archive size={15} />
        </IconBtn>
        <IconBtn title="Delete" onClick={() => { if (confirm("Delete this thread?")) onDelete?.(thread.id); }}>
          <Trash2 size={15} />
        </IconBtn>
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
            background: m.is_sent ? "rgba(59,130,246,0.04)" : theme.navy50,
            borderRadius:10,
            border:`1px solid ${m.is_sent ? "rgba(59,130,246,0.15)" : theme.navy200}`
          }}>
            <div style={{
              display:"flex", justifyContent:"space-between", marginBottom:8,
              fontSize:12
            }}>
              <span style={{ fontWeight:600, color:theme.navy900 }}>
                {m.is_sent ? "You" : (m.from_name || m.from_address)}
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

      {/* Reply composer */}
      {replyOpen && (
        <div style={{
          borderTop:`1px solid ${theme.navy200}`, padding:16,
          background:theme.navy50
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:theme.navy700 }}>
              Reply to {messages[messages.length - 1]?.from_name || messages[messages.length - 1]?.from_address || "sender"}
            </span>
            <button onClick={() => setReplyOpen(false)} style={{
              background:"transparent", border:"none", cursor:"pointer", color:theme.navy500, padding:4
            }}><X size={14} /></button>
          </div>
          <textarea
            ref={textareaRef}
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder="Write your reply…"
            rows={4}
            style={{
              width:"100%", resize:"vertical",
              background:theme.white, border:`1px solid ${theme.navy200}`,
              borderRadius:10, padding:12, fontSize:13,
              fontFamily:"inherit", color:theme.navy900,
              outline:"none", boxSizing:"border-box"
            }}
          />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
            <button onClick={() => setReplyOpen(false)} style={{
              padding:"8px 14px", borderRadius:8, fontSize:12, fontWeight:600,
              background:"transparent", border:`1px solid ${theme.navy200}`,
              color:theme.navy700, cursor:"pointer", fontFamily:"inherit"
            }}>Cancel</button>
            <button onClick={handleSend} disabled={sending || !replyBody.trim()} style={{
              padding:"8px 16px", borderRadius:8, fontSize:12, fontWeight:600,
              background:theme.blue600, color:theme.white, border:"none",
              cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6,
              opacity: (sending || !replyBody.trim()) ? 0.5 : 1
            }}>
              <Send size={12} /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
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

function IconBtn({ children, onClick, title, active }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? "rgba(245,158,11,0.08)" : "transparent",
      border:`1px solid ${active ? "rgba(245,158,11,0.3)" : theme.navy200}`,
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
