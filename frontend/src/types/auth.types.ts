export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  storage_used: number;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
}