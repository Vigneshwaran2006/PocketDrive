"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Global toast state
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

const updateToasts = (newToasts: Toast[]) => {
  toasts = newToasts;
  toastListeners.forEach((listener) => listener(toasts));
};

export const toast = {
  success: (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    updateToasts([...toasts, { id, message, type: "success" }]);
    setTimeout(() => {
      updateToasts(toasts.filter((t) => t.id !== id));
    }, 4000);
  },
  error: (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    updateToasts([...toasts, { id, message, type: "error" }]);
    setTimeout(() => {
      updateToasts(toasts.filter((t) => t.id !== id));
    }, 4000);
  },
  info: (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    updateToasts([...toasts, { id, message, type: "info" }]);
    setTimeout(() => {
      updateToasts(toasts.filter((t) => t.id !== id));
    }, 4000);
  },
  warning: (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    updateToasts([...toasts, { id, message, type: "warning" }]);
    setTimeout(() => {
      updateToasts(toasts.filter((t) => t.id !== id));
    }, 4000);
  },
};

export function ToastContainer() {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setToastList);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setToastList);
    };
  }, []);

  if (toastList.length === 0) return null;

  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
    warning: "⚠️",
  };

  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  };

  return createPortal(
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toastList.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg border
            shadow-lg text-sm font-medium min-w-[280px] max-w-[380px]
            animate-in slide-in-from-right duration-300
            ${colors[t.type]}
          `}
        >
          <span>{icons[t.type]}</span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => updateToasts(toasts.filter((toast) => toast.id !== t.id))}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}