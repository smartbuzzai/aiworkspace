"use client";
import { useState, useEffect, type FormEvent } from "react";
import { Sparkles, Mail, ArrowRight } from "lucide-react";
import { cn } from "../lib/cn";
import type { User } from "../lib/types";

interface LoginProps {
  onSuccess: (user: User) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  // Auto-fill invite code from ?invite= URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      setInviteCode(invite);
      setShowInvite(true);
    }
  }, []);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body: any = { email };
      if (inviteCode.trim()) body.invite_code = inviteCode.trim();
      const r = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json();
        if (r.status === 403) {
          setShowInvite(true);
          setError(d.error || "An invite code is required.");
          return;
        }
        setError(d.error || "Something went wrong.");
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0a0f1e 0%, #1e3a5f 50%, #0a0f1e 100%)" }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)" }}
      />

      <div className="w-full max-w-[420px] relative z-10 bg-navy-900/70 backdrop-blur-[20px] border border-white/[0.08] rounded-[20px] p-9">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center mb-5">
          <Sparkles color="white" size={22} />
        </div>

        <h1 className="text-white text-[26px] font-extrabold tracking-tight m-0 mb-1.5">
          Sign in
        </h1>
        <p className="text-navy-400 text-sm m-0 mb-6 leading-relaxed">
          Enter your email. We&apos;ll send a one-time link.
        </p>

        {sent ? (
          <div className="bg-green-500/10 border border-green-500/25 text-green-400 p-3.5 rounded-[10px] text-[13px] leading-relaxed">
            Check your inbox. The link expires in 15 minutes.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-[10px] px-3.5 py-2.5 mb-3.5">
              <Mail size={16} className="text-navy-500" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-transparent border-none outline-none text-white text-sm w-full"
              />
            </div>
            {showInvite && (
              <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-[10px] px-3.5 py-2.5 mb-3.5">
                <ArrowRight size={16} className="text-navy-500" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Invite code"
                  className="bg-transparent border-none outline-none text-white text-sm w-full"
                />
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-3 py-2 rounded-[10px] text-[13px] mb-3.5">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              className={cn(
                "w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white border-none",
                "py-[11px] px-4 rounded-[10px] text-sm font-semibold",
                "flex items-center justify-center gap-1.5 cursor-pointer",
                (loading || !email) && "opacity-60 cursor-wait"
              )}
            >
              {loading ? "Sending…" : <>Send link <ArrowRight size={15} /></>}
            </button>
            {!showInvite && (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="w-full bg-transparent border-none text-navy-500 text-xs mt-3 cursor-pointer hover:text-navy-300"
              >
                Have an invite code?
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
