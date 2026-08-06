"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface LoadingState {
  isVisible: boolean;
  message: string;
}

let loadingListeners: ((state: LoadingState) => void)[] = [];

const updateLoading = (state: LoadingState) => {
  loadingListeners.forEach((listener) => listener(state));
};

/**
 * Show global loading overlay
 */
export const showLoading = (message = "Please wait...") => {
  updateLoading({ isVisible: true, message });
};

/**
 * Hide global loading overlay
 */
export const hideLoading = () => {
  updateLoading({ isVisible: false, message: "" });
};

/**
 * Run async operation with loading overlay
 */
export const withLoading = async <T,>(
  fn: () => Promise<T>,
  message = "Please wait..."
): Promise<T> => {
  showLoading(message);
  try {
    return await fn();
  } finally {
    hideLoading();
  }
};

export function LoadingOverlay() {
  const [state, setState] = useState<LoadingState>({
    isVisible: false,
    message: "",
  });

  useEffect(() => {
    loadingListeners.push(setState);
    return () => {
      loadingListeners = loadingListeners.filter((l) => l !== setState);
    };
  }, []);

  if (!state.isVisible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-64 animate-in">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>

        {/* Message */}
        <p className="text-sm font-medium text-gray-700 text-center">
          {state.message}
        </p>
      </div>
    </div>,
    document.body
  );
}