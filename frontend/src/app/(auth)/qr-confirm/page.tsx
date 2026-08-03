"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { toast, ToastContainer } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

interface SessionInfo {
  session_id: string;
  device_info: string;
  expires_at: string;
}

function QRConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const sessionId = searchParams.get("session");

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "confirming" | "confirmed" | "error" | "expired"
  >("loading");
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    if (!isAuthenticated) {
      // Save session ID and redirect to login
      router.push(
        `/login?redirect=/qr-confirm?session=${sessionId}`
      );
      return;
    }

    fetchSessionInfo();
  }, [sessionId, isAuthenticated]);

  const fetchSessionInfo = async () => {
    try {
      const res = await api.get(`/qr/session/${sessionId}`);
      setSessionInfo(res.data.data);
      setStatus("ready");
    } catch (error: any) {
      const message = error.response?.data?.message || "Session not found";
      if (message.includes("expired")) {
        setStatus("expired");
      } else {
        setStatus("error");
        toast.error(message);
      }
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setStatus("confirming");

    try {
      const res = await api.post("/qr/confirm", {
        session_id: sessionId,
      });

      setStatus("confirmed");
      toast.success(res.data.message);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to confirm login";
      toast.error(message);
      setStatus("error");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeny = () => {
    router.push("/dashboard");
  };

  const getDeviceLabel = (deviceInfo: string): string => {
    if (deviceInfo.includes("Windows")) return "Windows PC";
    if (deviceInfo.includes("Mac")) return "Mac";
    if (deviceInfo.includes("Linux")) return "Linux";
    if (deviceInfo.includes("Chrome")) return "Chrome Browser";
    return "Desktop Device";
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      {/* Loading */}
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-12 h-12 bg-blue-100 rounded-full animate-pulse" />
          <p className="text-sm text-gray-500">Loading session info...</p>
        </div>
      )}

      {/* Ready to confirm */}
      {status === "ready" && sessionInfo && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <div className="text-5xl mb-3">🖥️</div>
            <h2 className="text-xl font-bold text-gray-900">
              Login Request
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Someone wants to login to PocketDrive
            </p>
          </div>

          {/* Device info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Device Details
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">💻</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {getDeviceLabel(sessionInfo.device_info)}
                </p>
                <p className="text-xs text-gray-400 truncate max-w-xs">
                  {sessionInfo.device_info.substring(0, 60)}...
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
            <p className="text-xs text-yellow-700 font-medium mb-1">
              ⚠️ Security Notice
            </p>
            <p className="text-xs text-yellow-600">
              Only confirm if you are trying to login on this device.
              Never confirm if you did not initiate this request.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleDeny}
              className="flex-1"
            >
              ✗ Deny
            </Button>
            <Button
              onClick={handleConfirm}
              isLoading={isConfirming}
              className="flex-1"
            >
              ✓ Confirm Login
            </Button>
          </div>
        </div>
      )}

      {/* Confirming */}
      {status === "confirming" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
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
          </div>
          <p className="text-sm text-gray-600">Confirming login...</p>
        </div>
      )}

      {/* Confirmed */}
      {status === "confirmed" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Login Confirmed!
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              The desktop device is now logging in
            </p>
          </div>
          <Button
            onClick={() => router.push("/dashboard")}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      )}

      {/* Expired */}
      {status === "expired" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">⏰</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Session Expired
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              This QR code has expired. Please generate a new one.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">❌</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Invalid Session
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              This QR code is invalid or has already been used
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

export default function QRConfirmPage() {
  return (
    <>
      <ToastContainer />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-2xl">📁</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              PocketDrive
            </h1>
          </div>

          <Suspense
            fallback={
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-500 text-sm">Loading...</p>
              </div>
            }
          >
            <QRConfirmContent />
          </Suspense>
        </div>
      </div>
    </>
  );
}