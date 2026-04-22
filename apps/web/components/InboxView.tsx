"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { Sparkles, Reply, Archive, Star, Mail, Trash2, Send, X } from "lucide-react";
import { cn } from "../lib/cn";

/* ------------------------------------------------------------------ */
/*  TypeScript interfaces                                              */
/* ------------------------------------------------------------------ */

interface Thread {
  id: string;
  subject: string;
  participants: string[];
  unread_count: number;
  is_starred: boolean;
  ai_summary: string | null;
  last_message_at: string;
  account_id: string;
  ai_priority: number | null;
}

interface EmailMessage {
  id: string;
  from_name: string | null;
  from_address: string;
  is_sent: boolean;
  received_at: string;
  body_text: string | null;
  message_id: string;
}

interface EmailAccount {
  id: string;
  label: string;
}

interface ThreadDetailProps {
  thread: Thread;
  messages: EmailMessage[];
  onBack: () => void;
  isMobile: boolean;
  onStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSent: () => void;
}

interface FilterChipProps {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}

interface IconBtnProps {
  children: ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function InboxView() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showDetail, setShowDetail] = useState<boolean>(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadThreads(); loadAccounts(); }, [filter]);

  async function loadAccounts() {
    try {
      const r = await fetch("/api/accounts", { credentials: "include" });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } catch { /* swallow */ }
  }

  async function loadThreads() {
    setLoading(true);
    const qs = filter === "all" ? "" : `?account_id=${filter}`;
    try {
      const r = await fetch(`/api/emails/threads${qs}`, { credentials: "include" });
      const d = await r.json();
      setThreads(d.threads || []);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(thread: Thread) {
    setSelected(thread);
    setShowDetail(true);
    try {
      const r = await fetch(`/api/emails/threads/${thread.id}`, { credentials: "include" });
      const d = await r.json();
      setMessages(d.messages || []);
      setThreads((t) => t.map((x) => (x.id === thread.id ? { ...x, unread_count: 0 } : x)));
    } catch { /* swallow */ }
  }

  if (accounts.length === 0 && !loading) {
    return <EmptyInbox />;
  }

  return (
    <div
      className={cn(
        "bg-white border border-navy-200 rounded-[14px] overflow-hidden min-h-[500px]",
        "h-[calc(100vh-160px)] grid",
        isMobile ? "grid-cols-1" : "grid-cols-[380px_1fr]",
      )}
    >
      {/* LIST */}
      <div
        className={cn(
          "flex flex-col min-h-0",
          !isMobile && "border-r border-navy-200",
          isMobile && showDetail && "hidden",
        )}
      >
        {accounts.length > 1 && (
          <div className="p-3 border-b border-navy-200 flex gap-1.5 overflow-x-auto">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All accounts · {threads.length}
            </FilterChip>
            {accounts.map((a) => (
              <FilterChip key={a.id} active={filter === a.id} onClick={() => setFilter(a.id)}>
                {a.label}
              </FilterChip>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-navy-500 text-[13px]">Loading…</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-navy-500 text-[13px] text-center">
              No messages yet.<br />First IMAP sync may take a minute.
            </div>
          ) : (
            threads.map((t) => (
              <div
                key={t.id}
                onClick={() => openThread(t)}
                className={cn(
                  "p-3.5 border-b border-navy-100 cursor-pointer border-l-[3px]",
                  selected?.id === t.id
                    ? "bg-navy-50 border-l-blue-500"
                    : "bg-white border-l-transparent",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      t.unread_count > 0 ? "bg-blue-500" : "bg-transparent",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[13px] text-navy-900 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
                      t.unread_count > 0 ? "font-bold" : "font-medium",
                    )}
                  >
                    {t.participants?.[0] || "Unknown"}
                  </span>
                  {t.is_starred && <Star size={12} className="text-amber-500 fill-amber-500" />}
                  <span className="text-[11px] text-navy-500 font-mono">
                    {relTime(t.last_message_at)}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-[13px] text-navy-800 mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap",
                    t.unread_count > 0 ? "font-semibold" : "font-medium",
                  )}
                >
                  {t.subject}
                </div>
                {t.ai_summary && (
                  <div className="mt-2 px-2.5 py-1.5 bg-blue-500/[0.06] border border-blue-500/[0.15] rounded-[7px] text-[11px] text-blue-600 flex items-start gap-1.5 leading-snug">
                    <Sparkles size={11} className="mt-0.5 shrink-0" />
                    <span>{t.ai_summary}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* DETAIL */}
      <div
        className={cn(
          "flex flex-col min-h-0",
          isMobile && !showDetail && "hidden",
        )}
      >
        {selected ? (
          <ThreadDetail
            thread={selected}
            messages={messages}
            onBack={() => setShowDetail(false)}
            isMobile={isMobile}
            onStar={async (id: string) => {
              const r = await fetch(`/api/emails/threads/${id}/star`, { method: "PATCH", credentials: "include" });
              if (r.ok) {
                const d = await r.json();
                setSelected((s) => (s ? { ...s, is_starred: d.is_starred } : s));
                setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, is_starred: d.is_starred } : t)));
              }
            }}
            onArchive={async (id: string) => {
              const r = await fetch(`/api/emails/threads/${id}/archive`, { method: "PATCH", credentials: "include" });
              if (r.ok) {
                setThreads((ts) => ts.filter((t) => t.id !== id));
                setSelected(null);
                setShowDetail(false);
              }
            }}
            onDelete={async (id: string) => {
              const r = await fetch(`/api/emails/threads/${id}`, { method: "DELETE", credentials: "include" });
              if (r.ok) {
                setThreads((ts) => ts.filter((t) => t.id !== id));
                setSelected(null);
                setShowDetail(false);
              }
            }}
            onSent={() => openThread(selected)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">
            Select a thread to read
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Thread detail                                                      */
/* ------------------------------------------------------------------ */

function ThreadDetail({ thread, messages, onBack, isMobile, onStar, onArchive, onDelete, onSent }: ThreadDetailProps) {
  const [replyOpen, setReplyOpen] = useState<boolean>(false);
  const [replyBody, setReplyBody] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    if (!replyBody.trim() || sending) return;
    setSending(true);
    try {
      const lastMsg = messages[messages.length - 1];
      const r = await fetch("/api/emails/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: thread.account_id,
          to: [lastMsg?.from_address || thread.participants?.[0]].filter(Boolean),
          subject: thread.subject?.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
          body_text: replyBody,
          in_reply_to: lastMsg?.message_id || undefined,
          thread_id: thread.id,
        }),
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
      {/* Header bar */}
      <div className="p-4 border-b border-navy-200 flex items-center gap-2">
        {isMobile && (
          <button
            onClick={onBack}
            className="bg-transparent border-none p-1 cursor-pointer text-navy-700 text-xl"
          >
            ←
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-navy-900 mb-0.5">{thread.subject}</div>
          <div className="text-xs text-navy-500">{thread.participants?.join(", ")}</div>
        </div>
        <IconBtn
          title="Reply"
          onClick={() => {
            setReplyOpen(!replyOpen);
            setTimeout(() => textareaRef.current?.focus(), 100);
          }}
        >
          <Reply size={15} />
        </IconBtn>
        <IconBtn
          title={thread.is_starred ? "Unstar" : "Star"}
          onClick={() => onStar?.(thread.id)}
          active={thread.is_starred}
        >
          <Star size={15} className={thread.is_starred ? "fill-amber-500 text-amber-500" : ""} />
        </IconBtn>
        <IconBtn title="Archive" onClick={() => onArchive?.(thread.id)}>
          <Archive size={15} />
        </IconBtn>
        <IconBtn
          title="Delete"
          onClick={() => {
            if (confirm("Delete this thread?")) onDelete?.(thread.id);
          }}
        >
          <Trash2 size={15} />
        </IconBtn>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {thread.ai_summary && (
          <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-xl p-4 mb-5 text-white">
            <div className="flex items-center gap-[7px] mb-2 text-[11px] font-bold uppercase tracking-widest text-blue-400">
              <Sparkles size={12} /> AI SUMMARY
            </div>
            <div className="text-sm leading-relaxed text-navy-200">{thread.ai_summary}</div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "mb-4 p-4 rounded-[10px] border",
              m.is_sent
                ? "bg-blue-500/[0.04] border-blue-500/[0.15]"
                : "bg-navy-50 border-navy-200",
            )}
          >
            <div className="flex justify-between mb-2 text-xs">
              <span className="font-semibold text-navy-900">
                {m.is_sent ? "You" : (m.from_name || m.from_address)}
              </span>
              <span className="text-navy-500 font-mono">
                {new Date(m.received_at).toLocaleString()}
              </span>
            </div>
            <div className="text-[13px] text-navy-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-auto">
              {m.body_text || "(no text content)"}
            </div>
          </div>
        ))}
      </div>

      {/* Reply composer */}
      {replyOpen && (
        <div className="border-t border-navy-200 p-4 bg-navy-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-navy-700">
              Reply to{" "}
              {messages[messages.length - 1]?.from_name ||
                messages[messages.length - 1]?.from_address ||
                "sender"}
            </span>
            <button
              onClick={() => setReplyOpen(false)}
              className="bg-transparent border-none cursor-pointer text-navy-500 p-1"
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write your reply…"
            rows={4}
            className="w-full resize-y bg-white border border-navy-200 rounded-[10px] p-3 text-[13px] font-[inherit] text-navy-900 outline-none box-border"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setReplyOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-transparent border border-navy-200 text-navy-700 cursor-pointer font-[inherit]"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !replyBody.trim()}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white border-none cursor-pointer font-[inherit] flex items-center gap-1.5",
                (sending || !replyBody.trim()) && "opacity-50",
              )}
            >
              <Send size={12} /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */

function FilterChip({ children, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-[11px] py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap font-[inherit] border",
        active
          ? "bg-navy-900 text-white border-navy-900"
          : "bg-navy-50 text-navy-700 border-navy-200",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, title, active }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-2 rounded-[9px] cursor-pointer flex text-navy-700 border",
        active
          ? "bg-amber-500/[0.08] border-amber-500/30"
          : "bg-transparent border-navy-200",
      )}
    >
      {children}
    </button>
  );
}

function EmptyInbox() {
  return (
    <div className="bg-white border border-navy-200 rounded-[14px] p-10 text-center">
      <div className="w-14 h-14 rounded-[14px] bg-blue-500/10 inline-flex items-center justify-center mb-3.5">
        <Mail size={26} className="text-blue-500" />
      </div>
      <h3 className="text-base font-bold text-navy-900 m-0">No email accounts connected</h3>
      <p className="text-[13px] text-navy-500 mt-2 mb-4 leading-relaxed max-w-[380px] mx-auto">
        Head to Settings to add Gmail, Outlook, Fastmail, or any IMAP account. The sync worker pulls
        new messages every 2 minutes.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}
