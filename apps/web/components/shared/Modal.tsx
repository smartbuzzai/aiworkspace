"use client";
import { useEffect } from "react";

export default function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} className="fixed inset-0 bg-[rgba(10,15,30,0.55)] z-[90] flex items-center justify-center p-5 backdrop-blur-sm">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl max-w-[560px] w-full max-h-[90vh] overflow-auto border border-navy-200">
        {children}
      </div>
    </div>
  );
}
