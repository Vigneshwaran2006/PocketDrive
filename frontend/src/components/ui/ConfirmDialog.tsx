"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

interface ConfirmOptions {
  title: string;
  message: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirmAsync?: () => Promise<void>; // NEW - keeps dialog open until async completes
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

let confirmListeners: ((state: ConfirmState | null) => void)[] = [];
let currentConfirm: ConfirmState | null = null;
let isConfirmActive = false;

const updateConfirm = (state: ConfirmState | null) => {
  currentConfirm = state;
  confirmListeners.forEach((listener) => listener(state));
};

/**
 * Promise-based confirm dialog
 * If onConfirmAsync is provided, dialog stays open until async completes
 */
export const confirm = (options: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isConfirmActive) {
      resolve(false);
      return;
    }

    isConfirmActive = true;

    updateConfirm({
      ...options,
      isOpen: true,
      onConfirm: () => {
        isConfirmActive = false;
        updateConfirm(null);
        resolve(true);
      },
      onCancel: () => {
        isConfirmActive = false;
        updateConfirm(null);
        resolve(false);
      },
    });
  });
};

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    confirmListeners.push(setState);
    return () => {
      confirmListeners = confirmListeners.filter((l) => l !== setState);
    };
  }, []);

  useEffect(() => {
    setIsProcessing(false);
  }, [state?.isOpen]);

  useEffect(() => {
    if (!state?.isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (isProcessing) return;
      if (e.key === "Escape") state.onCancel();
      if (e.key === "Enter") {
        setIsProcessing(true);
        state.onConfirm();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEsc);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [state, isProcessing]);

  if (!state?.isOpen) return null;

  const variant = state.variant || "danger";

  const variants = {
    danger: {
      iconBg: "bg-red-100",
      icon: "⚠️",
      confirmBg: "bg-red-600 hover:bg-red-700",
      ring: "focus:ring-red-500",
    },
    warning: {
      iconBg: "bg-yellow-100",
      icon: "⚠️",
      confirmBg: "bg-yellow-600 hover:bg-yellow-700",
      ring: "focus:ring-yellow-500",
    },
    info: {
      iconBg: "bg-blue-100",
      icon: "ℹ️",
      confirmBg: "bg-blue-600 hover:bg-blue-700",
      ring: "focus:ring-blue-500",
    },
    success: {
      iconBg: "bg-green-100",
      icon: "✓",
      confirmBg: "bg-green-600 hover:bg-green-700",
      ring: "focus:ring-green-500",
    },
  };

  const v = variants[variant];

  const handleConfirm = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    state.onConfirm();
  };

  const handleCancel = () => {
    if (isProcessing) return;
    state.onCancel();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) handleCancel();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden animate-in">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 ${v.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
            >
              <span className="text-2xl">{v.icon}</span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {state.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {isProcessing
                  ? "Please wait, this may take a few seconds..."
                  : state.message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.cancelLabel || "Cancel"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 ${v.confirmBg} ${v.ring} transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            autoFocus
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processing...
              </>
            ) : (
              state.confirmLabel || "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}