export interface User {
  id: string;
  email: string;
  password: string;
  full_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  storage_used: number;
  created_at: string;
  updated_at: string;
}

export interface RegisterBody {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface ForgotPasswordBody {
  email: string;
}

export interface ResetPasswordBody {
  token: string;
  new_password: string;
}

export interface VerifyEmailBody {
  token: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

export interface AuthRequest extends Express.Request {
  user?: {
    userId: string;
    email: string;
  };
}