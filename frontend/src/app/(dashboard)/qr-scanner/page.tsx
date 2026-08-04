"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeScanner } from "html5-qrcode";
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
    "scanning" | "confirming" | "confirmed" | "error"
  >("scanning");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scannedSessionId, setScannedSessionId] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      },
      false
    );

    scanner.render(onScanSuccess, onScanFailure);
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    // Stop scanner
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
    }

    // Extract session ID from URL
    try {
      const url = new URL(decodedText);
      const sessionId = url.searchParams.get("session");

      if (!sessionId) {
        toast.error("Invalid QR code");
        setStatus("error");
        return;
      }

      setScannedSessionId(sessionId);

      // Get session info
      const res = await api.get(`/qr/session/${sessionId}`);
      setSessionInfo(res.data.data);
      setStatus("confirming");
    } catch {
      toast.error("Invalid QR code");
      setStatus("error");
    }
  };

  const onScanFailure = (error: string) => {
    // Ignore scan failures (camera still scanning)
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const res = await api.post("/qr/confirm", {
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
    setStatus("scanning");
    setSessionInfo(null);
    setScannedSessionId("");

    // Re-initialize scanner
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        false
      );
      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }, 100);
  };

  const getDeviceLabel = (deviceInfo: string): string => {
    if (deviceInfo.includes("Windows")) return "🖥️ Windows PC";
    if (deviceInfo.includes("Mac")) return "🖥️ Mac";
    if (deviceInfo.includes("Linux")) return "🖥️ Linux";
    if (deviceInfo.includes("Chrome")) return "🌐 Chrome Browser";
    if (deviceInfo.includes("Firefox")) return "🌐 Firefox Browser";
    return "🖥️ Desktop Device";
  };

  return (
    <div>
      <TopBar title="Scan QR" subtitle="Scan to login on another device" />

      <div className="p-4 lg:p-6 max-w-md mx-auto">
        {/* Scanning */}
        {status === "scanning" && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 overflow-hidden">
              <div id="qr-reader" className="rounded-xl overflow-hidden" />
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-700 mb-2">
                How to use:
              </p>
              <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                <li>Open PocketDrive on desktop browser</li>
                <li>Click &quot;Login with QR Code&quot; on login page</li>
                <li>Point your camera at the QR code</li>
                <li>Confirm login on this phone</li>
                <li>Desktop logs in automatically</li>
              </ol>
            </div>
          </div>
        )}

        {/* Confirming */}
        {status === "confirming" && sessionInfo && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🖥️</div>
              <h2 className="text-xl font-bold text-gray-900">
                Login Request
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                A device wants to login to your account
              </p>
            </div>

            {/* Device info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Device Details
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">💻</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {getDeviceLabel(sessionInfo.device_info)}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {sessionInfo.device_info.substring(0, 50)}...
                  </p>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-6">
              <p className="text-xs text-yellow-700 font-medium mb-1">
                ⚠️ Security Notice
              </p>
              <p className="text-xs text-yellow-600">
                Only confirm if you are trying to login on this device.
                Never confirm if you did not scan this QR code.
              </p>
            </div>

            {/* Buttons */}
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

        {/* Confirmed */}
        {status === "confirmed" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Login Confirmed!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              The desktop device is now logged into your account
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
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Could not process QR code. Please try again.
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