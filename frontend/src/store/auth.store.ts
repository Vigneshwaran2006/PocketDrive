import { create } from "zustand";
import { User } from "@/types/auth.types";
import { setAccessToken } from "@/lib/api";
import api from "@/lib/api";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user }),

  setAccessToken: (token) => {
    setAccessToken(token);
    set({ accessToken: token });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  login: (token, user) => {
    setAccessToken(token);
    set({
      accessToken: token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Continue logout even if API fails
    }
    setAccessToken(null);
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  },

  refreshUser: async () => {
    try {
      const response = await api.get("/auth/me");
      set({ user: response.data.data.user });
    } catch {
      // Ignore
    }
  },
}));