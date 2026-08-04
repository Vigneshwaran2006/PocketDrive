"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

interface SessionInfo {
  session_id: string;
  device_info: string;
  expires_at: string;
}

export default function QRScannerPage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "permission" | "scanning" | "confirming" | "confirmed" | "error" | "denied"
  >("permission");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scannedSessionId, setScannedSessionId] = useState("");
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current
          .stop()
          .then(() => {
            if (scannerRef.current) {
              scannerRef.current.clear();
            }
          })
          .catch(() => {});
      } catch {}
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    // First check if camera is available
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      // Stop the test stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (error: any) {
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setStatus("denied");
        return;
      }
      if (error.name === "NotFoundError") {
        toast.error("No camera found on this device");
        setStatus("error");
        return;
      }
      toast.error("Could not access camera");
      setStatus("error");
      return;
    }

    setStatus("scanning");

    // Small delay to let DOM render
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            disableFlip: false,
          },
          onScanSuccess,
          () => {}
        );
      } catch (error: any) {
        console.error("Scanner start error:", error);
        toast.error("Failed to start camera");
        setStatus("error");
      }
    }, 500);
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanner();

    try {
      let sessionId = "";

      // Try parsing as URL
      try {
        const url = new URL(decodedText);
        sessionId = url.searchParams.get("session") || "";
      } catch {
        // If not a URL, use as is
        sessionId = decodedText;
      }

      if (!sessionId) {
        toast.error("Invalid QR code");
        setStatus("error");
        return;
      }

      setScannedSessionId(sessionId);

      const res = await api.get(`/qr/session/${sessionId}`);
      setSessionInfo(res.data.data);
      setStatus("confirming");
    } catch (error: any) {
      const message = error.response?.data?.message || "Invalid QR code";
      toast.error(message);
      setStatus("error");
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await api.post("/qr/confirm", {
        session_id: scannedSessionId,
      });
      setStatus("confirmed");
      toast.success("Login confirmed! Desktop is now logged in.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to confirm login"
      );
      setStatus("error");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeny = () => {
    toast.info("Login denied");
    router.push("/dashboard");
  };

  const handleRetry = () => {
    stopScanner();
    setSessionInfo(null);
    setScannedSessionId("");
    setStatus("permission");
  };

  const getDeviceLabel = (deviceInfo: string): string => {
    if (deviceInfo.includes("Windows")) return "Windows PC";
    if (deviceInfo.includes("Mac")) return "Mac";
    if (deviceInfo.includes("Linux")) return "Linux PC";
    if (deviceInfo.includes("Chrome")) return "Chrome Browser";
    if (deviceInfo.includes("Firefox")) return "Firefox Browser";
    if (deviceInfo.includes("Safari")) return "Safari Browser";
    return "Desktop Device";
  };

  return (
    <div>
      <TopBar title="Scan QR" subtitle="Login on another device" />

      <div className="p-4 lg:p-6 max-w-md mx-auto">
        {/* Permission */}
        {status === "permission" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📷</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Camera Access Needed
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                PocketDrive needs your camera to scan the QR code
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                What will happen:
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-medium">
                      Tap the button below
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Your browser will ask for camera permission
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-medium">
                      Tap &quot;Allow&quot; when prompted
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      This lets PocketDrive use your camera to scan
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-medium">
                      Point at QR code on desktop
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Camera will auto-detect the QR code
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-3 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">🔒</span>
                <p className="text-xs text-green-700">
                  Camera is only used for scanning. No photos or videos are
                  saved.
                </p>
              </div>
            </div>

            <Button onClick={startScanner} className="w-full" size="lg">
              📷 Open Camera & Scan
            </Button>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full text-center text-sm text-gray-400 mt-4 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Denied */}
        {status === "denied" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🚫</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Camera Access Denied
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Camera permission is required to scan QR codes
            </p>

            <div className="bg-yellow-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-yellow-700 mb-2">
                How to enable camera:
              </p>
              <div className="flex flex-col gap-3">
                <div className="text-xs text-yellow-600">
                  <p className="font-medium mb-1">📱 Android Chrome:</p>
                  <p>Tap the 🔒 lock icon in address bar → Permissions → Camera → Allow</p>
                </div>
                <div className="text-xs text-yellow-600">
                  <p className="font-medium mb-1">🍎 iPhone Safari:</p>
                  <p>Settings → Safari → Camera → Allow</p>
                </div>
                <div className="text-xs text-yellow-600">
                  <p className="font-medium mb-1">💡 Quick Fix:</p>
                  <p>Refresh this page and tap &quot;Allow&quot; when prompted</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  setStatus("permission");
                }}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Scanning */}
        {status === "scanning" && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 overflow-hidden">
              <div
                id="qr-reader"
                className="rounded-xl overflow-hidden"
                style={{ width: "100%" }}
              />

              <div className="flex items-center justify-center gap-2 mt-4 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-600 font-medium">
                  Point camera at QR code...
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                stopScanner();
                router.push("/dashboard");
              }}
              className="w-full text-center py-2.5 text-sm text-gray-500 hover:text-gray-700 bg-white rounded-xl border border-gray-100"
            >
              Cancel Scanning
            </button>
          </div>
        )}

        {/* Confirming */}
        {status === "confirming" && sessionInfo && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🖥️</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Login Request
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Confirm to login on this device
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Requesting Device
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💻</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {getDeviceLabel(sessionInfo.device_info)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {sessionInfo.device_info.substring(0, 60)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">⚠️</span>
                <p className="text-xs text-yellow-700">
                  Only confirm if you scanned a QR code on this device.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="danger" onClick={handleDeny} className="flex-1">
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

        {/* Confirmed */}
        {status === "confirmed" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Login Confirmed!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Desktop is now logged in
            </p>
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Something Went Wrong
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Make sure you are scanning a valid PocketDrive QR code
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="flex-1"
              >
                Dashboard
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                📷 Scan Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}