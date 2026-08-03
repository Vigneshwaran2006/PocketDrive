"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import api, { setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, ToastContainer } from "@/components/ui/Toast";

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [form, setForm] = useState({
        email: "",
        password: "",
        remember_me: false,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Show error from URL (Google OAuth failure)
    useEffect(() => {
        const error = searchParams.get("error");
        if (error) {
            toast.error(error);
        }
    }, [searchParams]);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!form.email.trim()) {
            newErrors.email = "Email is required";
        }

        if (!form.password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsLoading(true);
        try {
            const response = await api.post("/auth/login", {
                email: form.email,
                password: form.password,
                remember_me: form.remember_me,
            });

            const { access_token, user } = response.data.data;

            login(access_token, user);
            toast.success(`Welcome back, ${user.full_name}!`);
            router.push("/dashboard");
        } catch (error: any) {
            const message =
                error.response?.data?.message || "Login failed. Try again.";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true);
        try {
            const response = await api.get("/auth/google");
            const { url } = response.data.data;
            window.location.href = url;
        } catch {
            toast.error("Failed to initiate Google login");
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {/* Google Sign In */}
            <button
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGoogleLoading ? (
                    <>
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
                        Connecting...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </>
                )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">
                    OR
                </span>
                <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Email Login Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Input
                    label="Email Address"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    error={errors.email}
                    disabled={isLoading}
                />

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <Link
                            href="/forgot-password"
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <Input
                        type="password"
                        placeholder="Enter your password"
                        value={form.password}
                        onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                        }
                        error={errors.password}
                        disabled={isLoading}
                    />
                </div>

                {/* Remember me */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.remember_me}
                        onChange={(e) =>
                            setForm({ ...form, remember_me: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">
                        Remember me for 30 days
                    </span>
                </label>

                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full mt-1"
                    size="lg"
                >
                    Sign In
                </Button>
            </form>

            <div className="flex flex-col gap-3 mt-6">
                <p className="text-center text-sm text-gray-500">
                    Don&apos;t have an account?{" "}
                    <Link
                        href="/register"
                        className="text-blue-600 font-medium hover:underline"
                    >
                        Create one
                    </Link>
                </p>

                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-xs text-gray-300">or</span>
                    <div className="h-px flex-1 bg-gray-100" />
                </div>

                <Link
                    href="/qr-login"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <span>📷</span>
                    Login with QR Code
                </Link>
            </div>
        </div>
    );
}

export default function LoginPage() {
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
                            Welcome back
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            Sign in to your PocketDrive account
                        </p>
                    </div>

                    <Suspense
                        fallback={
                            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                                Loading...
                            </div>
                        }
                    >
                        <LoginContent />
                    </Suspense>
                </div>
            </div>
        </>
    );
}