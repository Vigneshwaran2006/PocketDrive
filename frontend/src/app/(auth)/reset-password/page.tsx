"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, ToastContainer } from "@/components/ui/Toast";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [form, setForm] = useState({
    new_password: "",
    confirm_password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) {
      toast.error("Invalid reset link. Please request a new one.");
    }
  }, [token]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.new_password) {
      newErrors.new_password = "Password is required";
    } else if (form.new_password.length < 8) {
      newErrors.new_password = "Password must be at least 8 characters";
    }

    if (!form.confirm_password) {
      newErrors.confirm_password = "Please confirm your password";
    } else if (form.new_password !== form.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: form.new_password,
      });

      setIsReset(true);
      toast.success("Password reset successfully!");
      setTimeout(() => router.push("/login"), 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Reset failed. Try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isReset) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Password Reset!
        </h2>
        <p className="text-gray-500 mb-6">
          Your password has been updated. Redirecting to login...
        </p>
        <Button onClick={() => router.push("/login")} className="w-full">
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🔐</div>
        <h2 className="text-xl font-bold text-gray-900">
          Create new password
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Must be at least 8 characters
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="New Password"
          type="password"
          placeholder="Min. 8 characters"
          value={form.new_password}
          onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          error={errors.new_password}
          disabled={isLoading}
        />

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="Re-enter new password"
          value={form.confirm_password}
          onChange={(e) =>
            setForm({ ...form, confirm_password: e.target.value })
          }
          error={errors.confirm_password}
          disabled={isLoading}
        />

        {/* Password strength indicator */}
        {form.new_password && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => {
                const strength = getPasswordStrength(form.new_password);
                return (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      level <= strength
                        ? strength <= 1
                          ? "bg-red-400"
                          : strength <= 2
                          ? "bg-yellow-400"
                          : strength <= 3
                          ? "bg-blue-400"
                          : "bg-green-400"
                        : "bg-gray-200"
                    }`}
                  />
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              {getStrengthLabel(getPasswordStrength(form.new_password))}
            </p>
          </div>
        )}

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full mt-1"
          size="lg"
          disabled={!token}
        >
          Reset Password
        </Button>
      </form>
    </>
  );
}

const getPasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  return strength;
};

const getStrengthLabel = (strength: number): string => {
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return labels[strength] || "";
};

export default function ResetPasswordPage() {
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
              <ResetPasswordContent />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}