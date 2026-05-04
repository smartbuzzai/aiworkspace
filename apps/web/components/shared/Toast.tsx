"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "../../lib/cn";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 py-3 px-4 rounded-xl shadow-lg text-[13px] font-medium animate-[slideIn_200ms_ease-out]",
              "min-w-[280px] max-w-[420px] border",
              t.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            )}
          >
            {t.type === "success"
              ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              : <AlertCircle size={16} className="text-red-500 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="bg-transparent border-none p-0.5 cursor-pointer opacity-50 hover:opacity-100 text-current"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
