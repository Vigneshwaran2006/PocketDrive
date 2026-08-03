"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, ToastContainer } from "@/components/ui/Toast";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email address");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setIsSubmitted(true);
      toast.success("Reset link sent! Check your email.");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Something went wrong. Try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
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
            <h1 className="text-2xl font-bold text-gray-900">
              Forgot password?
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              No worries, we will send you a reset link
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {isSubmitted ? (
              <div className="text-center">
                <div className="text-5xl mb-4">📬</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Check your email
                </h2>
                <p className="text-gray-500 text-sm mb-2">
                  We sent a password reset link to
                </p>
                <p className="font-medium text-gray-800 mb-6">{email}</p>
                <div className="p-4 bg-blue-50 rounded-lg text-left mb-6">
                  <ul className="text-xs text-blue-600 space-y-1">
                    <li>• Link expires in 1 hour</li>
                    <li>• Check your spam folder</li>
                    <li>• You can request a new link after 1 hour</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsSubmitted(false)}
                  className="w-full"
                >
                  Try another email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error}
                  disabled={isLoading}
                />

                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full"
                  size="lg"
                >
                  Send Reset Link
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-gray-500 mt-6">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-blue-600 font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}