"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { toast, ToastContainer } from "@/components/ui/Toast";

function LoginContent() {
  const searchParams = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const response = await api.get("/auth/google");
      const { url } = response.data.data;
      window.location.href = url;
    } catch {
      toast.error("Failed to initiate Google login");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Sign in to continue
        </h2>
        <p className="text-sm text-gray-500">
          Secure. Fast. No passwords needed.
        </p>
      </div>

      {/* Google Sign In */}
      <button
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGoogleLoading ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
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
            Connecting to Google...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </>
        )}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs text-gray-400 font-medium">OR</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {/* QR Login */}
      <a
        href="/qr-login"
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all"
      >
        📷 Sign in with QR Code
      </a>

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <p className="text-xs font-semibold text-blue-700 mb-2">
          🔒 Why Google Sign-In?
        </p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>• No password to remember</li>
          <li>• Verified email automatically</li>
          <li>• Enterprise-grade security</li>
          <li>• Sign in with one click</li>
        </ul>
      </div>

      {/* Terms */}
      <p className="text-center text-xs text-gray-400 mt-6">
        By signing in, you agree to our{" "}
        <span className="text-gray-500">Terms of Service</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <ToastContainer />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-3xl">📁</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">PocketDrive</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Your personal document vault
            </p>
          </div>

          <Suspense
            fallback={
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                Loading...
              </div>
            }
          >
            <LoginContent />
          </Suspense>
        </div>
      </div>
    </>
  );
}