"use client";
import { useEffect, useState } from "react";

interface VerifyPageProps {
  searchParams?: { token?: string };
}

export default function Verify({ searchParams }: VerifyPageProps) {
  const [status, setStatus] = useState<"verifying" | "error">("verifying");
  const token = searchParams?.token;

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(() => { window.location.href = "/"; })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 text-navy-300 text-sm">
      {status === "verifying"
        ? "Signing you in…"
        : "Link expired or invalid. Request a new one."}
    </div>
  );
}
