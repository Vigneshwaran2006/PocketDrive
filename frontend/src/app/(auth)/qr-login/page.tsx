"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import api, { setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { toast, ToastContainer } from "@/components/ui/Toast";

type QRStatus = "loading" | "ready" | "scanned" | "confirmed" | "expired" | "error";

export default function QRLoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [status, setStatus] = useState<QRStatus>("loading");
  const [sessionId, setSessionId] = useState("");
  const [qrData, setQrData] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    generateQR();
    return () => {
      clearIntervals();
    };
  }, []);

  const clearIntervals = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const generateQR = async () => {
    setStatus("loading");
    clearIntervals();

    try {
      const res = await api.post("/qr/generate");
      const { session_id, qr_data, expires_at, expires_in } =
        res.data.data;

      setSessionId(session_id);
      setQrData(qr_data);
      setExpiresAt(new Date(expires_at));
      setTimeLeft(expires_in);
      setStatus("ready");

      // Start countdown timer
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearIntervals();
            setStatus("expired");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start polling every 2 seconds
      pollIntervalRef.current = setInterval(async () => {
        await checkStatus(session_id);
      }, 2000);
    } catch {
      setStatus("error");
      toast.error("Failed to generate QR code");
    }
  };

  const checkStatus = async (sid: string) => {
    try {
      const res = await api.get(`/qr/poll/${sid}`);
      const { status: qrStatus, access_token } = res.data.data;

      if (qrStatus === "confirmed" && access_token) {
        clearIntervals();
        setStatus("confirmed");

        // Login with access token
        setAccessToken(access_token);

        try {
          const userRes = await api.get("/auth/me");
          const user = userRes.data.data.user;
          login(access_token, user);
          toast.success(`Welcome, ${user.full_name}!`);
          setTimeout(() => router.push("/dashboard"), 1500);
        } catch {
          toast.error("Failed to get user info");
          setStatus("error");
        }
      } else if (qrStatus === "expired") {
        clearIntervals();
        setStatus("expired");
      } else if (qrStatus === "scanned") {
        setStatus("scanned");
      }
    } catch {
      // Ignore poll errors
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <ToastContainer />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-2xl">📁</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">QR Login</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Scan with your phone to login instantly
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {/* Loading State */}
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
                <p className="text-sm text-gray-500">
                  Generating QR code...
                </p>
              </div>
            )}

            {/* Ready State */}
            {status === "ready" && qrData && (
              <div className="flex flex-col items-center gap-5">
                {/* QR Code */}
                <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
                  <QRCode
                    value={qrData}
                    size={180}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox="0 0 256 256"
                  />
                </div>

                {/* Timer */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      timeLeft > 60 ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      timeLeft > 60 ? "text-gray-600" : "text-red-500"
                    }`}
                  >
                    Expires in {formatTime(timeLeft)}
                  </span>
                </div>

                {/* Instructions */}
                <div className="w-full bg-blue-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-2">
                    How to use:
                  </p>
                  <ol className="text-xs text-blue-600 space-y-1.5 list-decimal list-inside">
                    <li>Open PocketDrive on your phone</li>
                    <li>Go to Settings → QR Login</li>
                    <li>Scan this QR code</li>
                    <li>Tap &quot;Confirm Login&quot; on your phone</li>
                    <li>This page will automatically log in</li>
                  </ol>
                </div>

                <button
                  onClick={generateQR}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Generate new QR code
                </button>
              </div>
            )}

            {/* Scanned State */}
            {status === "scanned" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">📱</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    QR Code Scanned!
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Confirm login on your phone...
                  </p>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
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
                  <span className="text-sm">Waiting for confirmation...</span>
                </div>
              </div>
            )}

            {/* Confirmed State */}
            {status === "confirmed" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Login Confirmed!
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Redirecting to dashboard...
                  </p>
                </div>
                <div className="flex items-center gap-2 text-green-600">
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
                  <span className="text-sm">Logging you in...</span>
                </div>
              </div>
            )}

            {/* Expired State */}
            {status === "expired" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">⏰</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    QR Code Expired
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    The QR code is only valid for 5 minutes
                  </p>
                </div>
                <button
                  onClick={generateQR}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate New QR Code
                </button>
              </div>
            )}

            {/* Error State */}
            {status === "error" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">❌</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Something went wrong
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Failed to generate QR code
                  </p>
                </div>
                <button
                  onClick={generateQR}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Back to login */}
            <p className="text-center text-sm text-gray-500 mt-6">
              <Link
                href="/login"
                className="text-blue-600 font-medium hover:underline"
              >
                ← Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}