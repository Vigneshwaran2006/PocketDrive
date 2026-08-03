"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import api, { setAccessToken } from "@/lib/api";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuthStore();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      handleGoogleLogin(token);
    } else {
      router.push("/login?error=Authentication failed");
    }
  }, [token]);

  const handleGoogleLogin = async (accessToken: string) => {
    try {
      setAccessToken(accessToken);
      const userResponse = await api.get("/auth/me");
      const user = userResponse.data.data.user;
      login(accessToken, user);
      router.push("/dashboard");
    } catch {
      router.push("/login?error=Authentication failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center animate-pulse">
          <span className="text-2xl">📁</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
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
          <span className="text-sm">Signing you in...</span>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}