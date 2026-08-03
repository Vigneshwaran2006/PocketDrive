"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { toast, ToastContainer } from "@/components/ui/Toast";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const tokenFromUrl = searchParams.get("token") || "";

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [manualToken, setManualToken] = useState("");

  // Auto verify if token in URL
  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleVerify = async (token: string) => {
    if (!token.trim()) {
      toast.error("Please enter the verification token");
      return;
    }

    setIsVerifying(true);
    try {
      await api.post("/auth/verify-email", { token });
      setIsVerified(true);
      toast.success("Email verified successfully!");
      setTimeout(() => router.push("/login"), 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Verification failed. Try again.";
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  if (isVerified) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Email Verified!
        </h2>
        <p className="text-gray-500 mb-6">
          Your account is now active. Redirecting to login...
        </p>
        <Button onClick={() => router.push("/login")} className="w-full">
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-6xl mb-4">📧</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Verify your email
      </h2>
      {email && (
        <p className="text-gray-500 mb-2 text-sm">
          We sent a verification link to{" "}
          <span className="font-medium text-gray-700">{email}</span>
        </p>
      )}
      <p className="text-gray-400 text-sm mb-8">
        Click the link in the email or paste the token below
      </p>

      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Paste verification token here"
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
        <Button
          onClick={() => handleVerify(manualToken)}
          isLoading={isVerifying}
          className="w-full"
          size="lg"
        >
          Verify Email
        </Button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left">
        <p className="text-xs text-blue-700 font-medium mb-1">
          Did not receive the email?
        </p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>• Check your spam folder</li>
          <li>• Make sure you entered the correct email</li>
          <li>• The link expires in 24 hours</li>
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
            <Suspense fallback={<div className="text-center">Loading...</div>}>
              <VerifyEmailContent />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}