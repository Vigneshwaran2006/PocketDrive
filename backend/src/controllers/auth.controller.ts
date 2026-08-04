import { Request, Response } from "express";
import crypto from "crypto";
import supabase from "../config/supabase";
import { hashPassword, hashToken } from "../utils/hash.utils";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.utils";
import { getGoogleAuthUrl, getGoogleUser } from "../utils/google.utils";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// ── Cookie Helpers ────────────────────────────────────────────────────────────

const setRefreshCookie = (res: Response, token: string, expiresAt: Date) => {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
};

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (!rawRefreshToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token missing",
      });
      return;
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
      return;
    }

    const hashedToken = hashToken(rawRefreshToken);

    const { data: tokenRecord } = await supabase
      .from("refresh_tokens")
      .select("*")
      .eq("token", hashedToken)
      .eq("user_id", decoded.userId)
      .single();

    if (!tokenRecord) {
      res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
      return;
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      await supabase.from("refresh_tokens").delete().eq("id", tokenRecord.id);
      clearRefreshCookie(res);

      res.status(401).json({
        success: false,
        message: "Refresh token expired. Please login again.",
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", decoded.userId)
      .single();

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    res.status(200).json({
      success: true,
      data: { access_token: newAccessToken },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token;

    if (rawRefreshToken) {
      const hashedToken = hashToken(rawRefreshToken);
      await supabase.from("refresh_tokens").delete().eq("token", hashedToken);
    }

    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET ME ──────────────────────────────────────────────────────────────────

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_url, storage_used, created_at")
      .eq("id", req.user!.userId)
      .single();

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GOOGLE AUTH - GET URL ───────────────────────────────────────────────────

export const googleAuth = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const url = getGoogleAuthUrl();

    if (!url) {
      res.status(500).json({
        success: false,
        message: "Failed to generate Google auth URL",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate Google authentication",
    });
  }
};

// ─── GOOGLE AUTH - CALLBACK ──────────────────────────────────────────────────

export const googleCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

  try {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      res.redirect(`${CLIENT_URL}/login?error=Google authentication failed`);
      return;
    }

    const googleUser = await getGoogleUser(code);

    if (!googleUser.email) {
      res.redirect(
        `${CLIENT_URL}/login?error=Could not get email from Google`
      );
      return;
    }

    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", googleUser.email.toLowerCase())
      .single();

    if (!user) {
      // Auto-create account
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await hashPassword(randomPassword);

      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email: googleUser.email.toLowerCase(),
          password: hashedPassword,
          full_name: googleUser.name || googleUser.email.split("@")[0],
          avatar_url: googleUser.picture || null,
          is_verified: true,
        })
        .select("*")
        .single();

      if (createError || !newUser) {
        res.redirect(`${CLIENT_URL}/login?error=Failed to create account`);
        return;
      }

      user = newUser;
    } else {
      // Update existing user's avatar if not set
      if (!user.avatar_url && googleUser.picture) {
        await supabase
          .from("users")
          .update({
            avatar_url: googleUser.picture,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const rawRefreshToken = generateRefreshToken({ userId: user.id });
    const hashedRefreshToken = hashToken(rawRefreshToken);

    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const deviceInfo = req.headers["user-agent"] || "Google OAuth";

    await supabase.from("refresh_tokens").insert({
      user_id: user.id,
      token: hashedRefreshToken,
      device_info: deviceInfo,
      expires_at: refreshExpiresAt.toISOString(),
    });

    setRefreshCookie(res, rawRefreshToken, refreshExpiresAt);

    res.redirect(`${CLIENT_URL}/auth/callback?token=${accessToken}`);
  } catch (error) {
    console.error("Google callback error:", error);
    const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${CLIENT_URL}/login?error=Authentication failed`);
  }
};