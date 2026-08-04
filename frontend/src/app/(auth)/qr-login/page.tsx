"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import api, { setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { toast, ToastContainer } from "@/components/ui/Toast";

type QRStatus = "loading" | "ready" | "confirmed" | "expired" | "error";

export default function QRLoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [status, setStatus] = useState<QRStatus>("loading");
  const [qrData, setQrData] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>("");

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
      const { session_id, qr_data, expires_in } = res.data.data;

      sessionIdRef.current = session_id;
      setQrData(qr_data);
      setTimeLeft(expires_in);
      setStatus("ready");

      // Countdown timer
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

      // Poll every 2 seconds
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/qr/poll/${sessionIdRef.current}`);
          const { status: qrStatus, access_token } = res.data.data;

          if (qrStatus === "confirmed" && access_token) {
            clearIntervals();
            setStatus("confirmed");

            setAccessToken(access_token);

            const userRes = await api.get("/auth/me");
            const user = userRes.data.data.user;
            login(access_token, user);
            toast.success(`Welcome, ${user.full_name}!`);
            setTimeout(() => router.push("/dashboard"), 1500);
          } else if (qrStatus === "expired") {
            clearIntervals();
            setStatus("expired");
          }
        } catch {
          // Ignore poll errors
        }
      }, 2000);
    } catch {
      setStatus("error");
      toast.error("Failed to generate QR code");
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
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-2xl">📁</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">QR Login</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Scan with PocketDrive mobile app
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {/* Loading */}
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
                <p className="text-sm text-gray-500">Generating QR code...</p>
              </div>
            )}

            {/* Ready */}
            {status === "ready" && qrData && (
              <div className="flex flex-col items-center gap-5">
                <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
                  <QRCode
                    value={qrData}
                    size={200}
                    style={{
                      height: "auto",
                      maxWidth: "100%",
                      width: "100%",
                    }}
                    viewBox="0 0 256 256"
                  />
                </div>

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

                <div className="w-full bg-blue-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-2">
                    How to scan:
                  </p>
                  <ol className="text-xs text-blue-600 space-y-1.5 list-decimal list-inside">
                    <li>Open PocketDrive on your phone</li>
                    <li>Tap &quot;Scan QR&quot; in the sidebar</li>
                    <li>Point camera at this QR code</li>
                    <li>Tap &quot;Confirm Login&quot;</li>
                    <li>This page will log you in automatically</li>
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

            {/* Confirmed */}
            {status === "confirmed" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Login Confirmed!
                </h3>
                <p className="text-sm text-gray-500">
                  Redirecting to dashboard...
                </p>
              </div>
            )}

            {/* Expired */}
            {status === "expired" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">⏰</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  QR Code Expired
                </h3>
                <p className="text-sm text-gray-500">
                  QR codes are valid for 5 minutes
                </p>
                <button
                  onClick={generateQR}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Generate New QR Code
                </button>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">❌</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Something went wrong
                </h3>
                <button
                  onClick={generateQR}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            )}

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