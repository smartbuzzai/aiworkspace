"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Sparkles, Reply, Archive, Star, Mail, Trash2, Send, X, Search, Plus, Pencil } from "lucide-react";
import { cn } from "../lib/cn";
import { useToast } from "./shared/Toast";
import Modal from "./shared/Modal";

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
  ai_priority: string | null;
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
  email_address: string;
}

interface ComposeModalProps {
  accounts: EmailAccount[];
  onClose: () => void;
  onSent: () => void;
}

interface ThreadDetailProps {
  thread: Thread;
  messages: EmailMessage[];
  loadingMessages: boolean;
  onBack: () => void;
  isMobile: boolean;
  onStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
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
  const { toast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [showCompose, setShowCompose] = useState<boolean>(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadThreads(); loadAccounts(); }, [filter]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(loadThreads, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function loadAccounts() {
    try {
      const r = await fetch("/api/accounts", { credentials: "include" });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } catch { /* swallow */ }
  }

  async function loadThreads() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("account_id", filter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    const qs = params.toString() ? `?${params}` : "";
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
    setMessages([]);
    setLoadingMessages(true);
    try {
      const r = await fetch(`/api/emails/threads/${thread.id}`, { credentials: "include" });
      const d = await r.json();
      setMessages(d.messages || []);
      setThreads((t) => t.map((x) => (x.id === thread.id ? { ...x, unread_count: 0 } : x)));
    } catch { /* swallow */ } finally {
      setLoadingMessages(false);
    }
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
        {/* Search + Compose bar */}
        <div className="p-2.5 border-b border-navy-200 flex gap-2 items-center">
          <div className="flex items-center gap-2 flex-1 bg-navy-50 border border-navy-200 rounded-lg px-2.5 py-[6px]">
            <Search size={14} className="text-navy-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emails…"
              className="bg-transparent border-none outline-none text-[13px] w-full text-navy-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="bg-transparent border-none p-0 cursor-pointer text-navy-400"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCompose(true)}
            title="Compose"
            className="bg-blue-600 text-white border-none p-[7px] rounded-lg cursor-pointer flex items-center justify-center shrink-0"
          >
            <Pencil size={14} />
          </button>
        </div>

        {accounts.length > 1 && (
          <div className="px-2.5 py-2 border-b border-navy-200 flex gap-1.5 overflow-x-auto">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All · {threads.length}
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
              {searchQuery
                ? `No results for "${searchQuery}"`
                : <>No messages yet.<br />First IMAP sync may take a minute.</>}
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
            loadingMessages={loadingMessages}
            onBack={() => setShowDetail(false)}
            isMobile={isMobile}
            onStar={async (id: string) => {
              const r = await fetch(`/api/emails/threads/${id}/star`, { method: "PATCH", credentials: "include" });
              if (r.ok) {
                const d = await r.json();
                setSelected((s) => (s ? { ...s, is_starred: d.is_starred } : s));
                setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, is_starred: d.is_starred } : t)));
              } else {
                toast("error", "Failed to update star.");
              }
            }}
            onArchive={async (id: string) => {
              const r = await fetch(`/api/emails/threads/${id}/archive`, { method: "PATCH", credentials: "include" });
              if (r.ok) {
                setThreads((ts) => ts.filter((t) => t.id !== id));
                setSelected(null);
                setShowDetail(false);
                toast("success", "Thread archived.");
              } else {
                toast("error", "Failed to archive thread.");
              }
            }}
            onDelete={async (id: string) => {
              const r = await fetch(`/api/emails/threads/${id}`, { method: "DELETE", credentials: "include" });
              if (r.ok) {
                setThreads((ts) => ts.filter((t) => t.id !== id));
                setSelected(null);
                setShowDetail(false);
                toast("success", "Thread deleted.");
              } else {
                toast("error", "Failed to delete thread.");
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

      {showCompose && (
        <ComposeModal
          accounts={accounts}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); loadThreads(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Thread detail                                                      */
/* ------------------------------------------------------------------ */

function ThreadDetail({ thread, messages, loadingMessages, onBack, isMobile, onStar, onArchive, onDelete, onSent }: ThreadDetailProps) {
  const [replyOpen, setReplyOpen] = useState<boolean>(false);
  const [replyBody, setReplyBody] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

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
        toast("success", "Reply sent.");
        setReplyBody("");
        setReplyOpen(false);
        if (onSent) onSent();
      } else {
        const d = await r.json().catch(() => ({}));
        toast("error", d.error || "Failed to send reply.");
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
          onClick={() => setReplyOpen(!replyOpen)}
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
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 size={15} />
        </IconBtn>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {loadingMessages ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(i => (
              <div key={i} className="rounded-[10px] border border-navy-200 bg-navy-50 p-4 space-y-2.5">
                <div className="flex justify-between">
                  <div className="h-3.5 bg-navy-200 rounded w-32" />
                  <div className="h-3 bg-navy-100 rounded w-24" />
                </div>
                <div className="h-3 bg-navy-100 rounded w-full" />
                <div className="h-3 bg-navy-100 rounded w-5/6" />
                <div className="h-3 bg-navy-100 rounded w-4/6" />
              </div>
            ))}
          </div>
        ) : (
        <>
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
                {relTime(m.received_at)}
              </span>
            </div>
            <div className="text-[13px] text-navy-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-auto">
              {m.body_text || "(no text content)"}
            </div>
          </div>
        ))}
        </>
        )}
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
            autoFocus
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
              title={!replyBody.trim() ? "Message required" : undefined}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white border-none cursor-pointer font-[inherit] flex items-center gap-1.5",
                (sending || !replyBody.trim()) && "opacity-50 cursor-not-allowed",
              )}
            >
              <Send size={12} /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <Modal onClose={() => { if (!deleting) setConfirmingDelete(false); }}>
          <div className="p-6">
            <h3 className="text-base font-bold text-navy-900 mb-2">Delete thread</h3>
            <p className="text-sm text-navy-600 mb-6">
              Delete <span className="font-semibold">{thread.subject || "(no subject)"}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className={cn("bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors", deleting && "opacity-60 cursor-not-allowed")}
              >
                Cancel
              </button>
              <button
                onClick={async () => { setDeleting(true); try { await onDelete?.(thread.id); } finally { setDeleting(false); setConfirmingDelete(false); } }}
                disabled={deleting}
                className={cn("bg-red-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors", deleting && "opacity-60 cursor-not-allowed")}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
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

/* ------------------------------------------------------------------ */
/*  Compose modal                                                      */
/* ------------------------------------------------------------------ */

function ComposeModal({ accounts, onClose, onSent }: ComposeModalProps) {
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || "");
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [showCc, setShowCc] = useState<boolean>(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const { toast } = useToast();

  function handleDiscard() {
    if (to.trim() || subject.trim() || body.trim()) {
      setConfirmingDiscard(true);
    } else {
      onClose();
    }
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || sending) return;
    setSending(true);
    try {
      const toList = to.split(",").map(e => e.trim()).filter(Boolean);
      const ccList = cc.split(",").map(e => e.trim()).filter(Boolean);
      const r = await fetch("/api/emails/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          to: toList,
          cc: ccList.length ? ccList : undefined,
          subject,
          body_text: body,
        }),
      });
      if (r.ok) {
        toast("success", "Email sent.");
        onSent();
      } else {
        const d = await r.json().catch(() => ({}));
        toast("error", d.error || "Failed to send email.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4"
      onClick={handleDiscard}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-navy-200 flex items-center gap-3">
          <Pencil size={16} className="text-blue-500" />
          <h3 className="m-0 text-base font-bold text-navy-900 flex-1">New Email</h3>
          <button
            onClick={handleDiscard}
            className="bg-transparent border-none text-navy-500 cursor-pointer p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 flex flex-col gap-3">
          {accounts.length > 1 && (
            <div>
              <label className="block text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1">From</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-navy-200 rounded-lg outline-none text-navy-900 bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.label} ({a.email_address})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1">To</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 text-[13px] border border-navy-200 rounded-lg outline-none text-navy-900 bg-white box-border"
            />
          </div>

          {showCc ? (
            <div>
              <label className="block text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1">CC</label>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="w-full px-3 py-2 text-[13px] border border-navy-200 rounded-lg outline-none text-navy-900 bg-white box-border"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowCc(true)}
              className="text-[11px] text-blue-600 font-semibold bg-transparent border-none cursor-pointer p-0 self-start"
            >
              + Add CC
            </button>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 text-[13px] border border-navy-200 rounded-lg outline-none text-navy-900 bg-white box-border"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={8}
              className="w-full px-3 py-2 text-[13px] border border-navy-200 rounded-lg outline-none text-navy-900 bg-white resize-y box-border"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-navy-200 flex justify-end gap-2">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-transparent border border-navy-200 text-navy-700 cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
            title={!to.trim() ? "Recipient required" : !subject.trim() ? "Subject required" : undefined}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white border-none cursor-pointer flex items-center gap-1.5",
              (sending || !to.trim() || !subject.trim()) && "opacity-50 cursor-not-allowed",
            )}
          >
            <Send size={12} /> {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>

    {confirmingDiscard && (
      <div
        className="fixed inset-0 bg-[rgba(10,15,30,0.55)] z-[110] flex items-center justify-center p-5 backdrop-blur-sm"
        onClick={() => setConfirmingDiscard(false)}
      >
        <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-[400px] w-full border border-navy-200">
          <h3 className="text-base font-bold text-navy-900 mb-2">Discard draft?</h3>
          <p className="text-sm text-navy-600 mb-6">Your message will be lost.</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmingDiscard(false)}
              className="bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors"
            >
              Keep editing
            </button>
            <button
              onClick={onClose}
              className="bg-red-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-red-700 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    )}
  </>
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
