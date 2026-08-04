"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { toast, ToastContainer } from "@/components/ui/Toast";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";

  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [email] = useState(emailFromUrl);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);

      // Focus last filled input or next empty
      const nextIndex = Math.min(index + digits.length, 5);
      const nextInput = document.getElementById(`otp-${nextIndex}`);
      nextInput?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsVerifying(true);
    try {
      await api.post("/auth/verify-email", {
        email,
        otp: otpString,
      });

      setIsVerified(true);
      toast.success("Email verified successfully!");
      setTimeout(() => router.push("/login"), 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Verification failed";
      toast.error(message);
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0")?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await api.post("/auth/resend-otp", { email });
      toast.success("New code sent to your email!");
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0")?.focus();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to resend code"
      );
    } finally {
      setIsResending(false);
    }
  };

  if (isVerified) {
    return (
      <div className="text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Email Verified!
        </h2>
        <p className="text-gray-500 mb-6">
          Redirecting to sign in...
        </p>
        <Button onClick={() => router.push("/login")} className="w-full">
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-4xl">📧</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Enter verification code
      </h2>
      {email && (
        <p className="text-sm text-gray-500 mb-1">
          We sent a 6-digit code to
        </p>
      )}
      {email && (
        <p className="text-sm font-medium text-gray-700 mb-6">{email}</p>
      )}

      {/* OTP Input */}
      <div className="flex justify-center gap-2 mb-6">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            className={`
              w-12 h-14 text-center text-xl font-bold rounded-xl border-2
              focus:outline-none transition-all
              ${
                digit
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-900"
              }
              focus:border-blue-500 focus:ring-2 focus:ring-blue-200
            `}
            autoFocus={index === 0}
          />
        ))}
      </div>

      <Button
        onClick={handleVerify}
        isLoading={isVerifying}
        className="w-full"
        size="lg"
        disabled={otp.join("").length !== 6}
      >
        Verify Email
      </Button>

      {/* Resend */}
      <div className="mt-6">
        <p className="text-sm text-gray-400 mb-2">
          Didn&apos;t receive the code?
        </p>
        <button
          onClick={handleResend}
          disabled={isResending}
          className="text-sm text-blue-600 font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isResending ? "Sending..." : "Resend Code"}
        </button>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl text-left">
        <ul className="text-xs text-gray-500 space-y-1.5">
          <li>• Code expires in 10 minutes</li>
          <li>• Check your spam folder</li>
          <li>• You have 5 attempts</li>
        </ul>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <ToastContainer />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-2xl">📁</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">PocketDrive</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <Suspense
              fallback={<div className="text-center">Loading...</div>}
            >
              <VerifyEmailContent />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}