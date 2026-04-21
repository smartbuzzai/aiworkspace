"use client";
import { useState } from "react";
import { Sparkles, Mail, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0f1e 0%, #1e3a5f 50%, #0a0f1e 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, position: "relative", overflow: "hidden"
    }}>
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 800, height: 400,
        background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)",
        pointerEvents: "none"
      }} />

      <div style={{
        width: "100%", maxWidth: 420, position: "relative", zIndex: 1,
        background: "rgba(15,23,42,0.7)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: 36
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "linear-gradient(135deg, #3b82f6, #10b981)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20
        }}>
          <Sparkles color="white" size={22} />
        </div>

        <h1 style={{
          color: "white", fontSize: 26, fontWeight: 800,
          letterSpacing: "-0.8px", margin: "0 0 6px"
        }}>Sign in</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
          Enter your email. We'll send a one-time link.
        </p>

        {sent ? (
          <div style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "#34d399",
            padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 1.5
          }}>
            Check your inbox. The link expires in 15 minutes.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 14
            }}>
              <Mail size={16} color="#64748b" />
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  background: "transparent", border: "none", outline: "none",
                  color: "white", fontSize: 14, width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </div>
            <button type="submit" disabled={loading || !email} style={{
              width: "100%",
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              color: "white", border: "none",
              padding: "11px 16px", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit", opacity: (loading || !email) ? 0.6 : 1
            }}>
              {loading ? "Sending…" : <>Send link <ArrowRight size={15} /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
