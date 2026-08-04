"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import api, { setAccessToken } from "@/lib/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { login, setLoading } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await api.post(
          "/auth/refresh",
          {},
          {
            signal: controller.signal,
            withCredentials: true,
          }
        );

        clearTimeout(timeout);

        const { access_token } = response.data.data;
        setAccessToken(access_token);

        const userResponse = await api.get("/auth/me", {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });
        const user = userResponse.data.data.user;

        login(access_token, user);
      } catch {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return <>{children}</>;
}