"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import api, { setAccessToken } from "@/lib/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { login, setLoading } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Add timeout so mobile does not hang forever
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await api.post("/auth/refresh", {}, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const { access_token } = response.data.data;
        setAccessToken(access_token);

        const userResponse = await api.get("/auth/me");
        const user = userResponse.data.data.user;

        login(access_token, user);
      } catch {
        // Not authenticated or timeout
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return <>{children}</>;
}