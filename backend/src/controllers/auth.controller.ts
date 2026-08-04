import { Request, Response } from "express";
import crypto from "crypto";
import supabase from "../config/supabase";
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
  hashToken,
} from "../utils/hash.utils";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.utils";
import {
  sendOTPEmail,
  sendPasswordResetEmail,
  generateOTP,
} from "../utils/email.utils";
import { getGoogleAuthUrl, getGoogleUser } from "../utils/google.utils";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// ── Cookie Helper ─────────────────────────────────────────────────────────────

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

// ─── REGISTER ───────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required",
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
      return;
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id, is_verified")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      if (existingUser.is_verified) {
        res.status(409).json({
          success: false,
          message: "Email already registered",
        });
        return;
      }

      // Unverified user exists — delete old data and re-register
      await supabase
        .from("email_verifications")
        .delete()
        .eq("user_id", existingUser.id);
      await supabase.from("users").delete().eq("id", existingUser.id);
    }

    const hashedPassword = await hashPassword(password);

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      })
      .select("id, email, full_name")
      .single();

    if (createError || !newUser) {
      res.status(500).json({
        success: false,
        message: "Failed to create account",
      });
      return;
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await supabase.from("email_verifications").insert({
      user_id: newUser.id,
      otp: otp,
      expires_at: expiresAt.toISOString(),
    });

    // Send OTP email
    await sendOTPEmail(newUser.email, newUser.full_name, otp);

    res.status(201).json({
      success: true,
      message: "Account created. Verification code sent to your email.",
      data: {
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── VERIFY EMAIL ────────────────────────────────────────────────────────────

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: "Email and verification code are required",
      });
      return;
    }

    // Find user
    const { data: user } = await supabase
      .from("users")
      .select("id, is_verified")
      .eq("email", email.toLowerCase())
      .single();

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Account not found",
      });
      return;
    }

    if (user.is_verified) {
      res.status(400).json({
        success: false,
        message: "Email already verified",
      });
      return;
    }

    // Find verification record
    const { data: verification } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!verification) {
      res.status(400).json({
        success: false,
        message: "No verification code found. Please register again.",
      });
      return;
    }

    // Check attempts (max 5)
    if (verification.attempts >= 5) {
      await supabase
        .from("email_verifications")
        .delete()
        .eq("id", verification.id);

      await supabase.from("users").delete().eq("id", user.id);

      res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please register again.",
      });
      return;
    }

    // Check expiry
    if (new Date(verification.expires_at) < new Date()) {
      await supabase
        .from("email_verifications")
        .delete()
        .eq("id", verification.id);

      await supabase.from("users").delete().eq("id", user.id);

      res.status(400).json({
        success: false,
        message: "Verification code expired. Please register again.",
      });
      return;
    }

    // Check OTP match
    if (verification.otp !== otp.toString().trim()) {
      // Increment attempts
      await supabase
        .from("email_verifications")
        .update({ attempts: verification.attempts + 1 })
        .eq("id", verification.id);

      const remaining = 5 - (verification.attempts + 1);

      res.status(400).json({
        success: false,
        message: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
      return;
    }

    // OTP matches — verify user
    await supabase
      .from("users")
      .update({ is_verified: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // Delete verification record
    await supabase
      .from("email_verifications")
      .delete()
      .eq("id", verification.id);

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now sign in.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── RESEND OTP ──────────────────────────────────────────────────────────────

export const resendOTP = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, is_verified")
      .eq("email", email.toLowerCase())
      .single();

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Account not found",
      });
      return;
    }

    if (user.is_verified) {
      res.status(400).json({
        success: false,
        message: "Email already verified",
      });
      return;
    }

    // Delete old OTP
    await supabase
      .from("email_verifications")
      .delete()
      .eq("user_id", user.id);

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await supabase.from("email_verifications").insert({
      user_id: user.id,
      otp: otp,
      expires_at: expiresAt.toISOString(),
    });

    await sendOTPEmail(email.toLowerCase(), user.full_name, otp);

    res.status(200).json({
      success: true,
      message: "New verification code sent to your email.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, remember_me } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.is_verified) {
      res.status(401).json({
        success: false,
        message: "Please verify your email before logging in",
      });
      return;
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const rawRefreshToken = generateRefreshToken({ userId: user.id });
    const hashedRefreshToken = hashToken(rawRefreshToken);

    const refreshExpiresAt = remember_me
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const deviceInfo = req.headers["user-agent"] || "Unknown device";

    await supabase.from("refresh_tokens").insert({
      user_id: user.id,
      token: hashedRefreshToken,
      device_info: deviceInfo,
      expires_at: refreshExpiresAt.toISOString(),
    });

    setRefreshCookie(res, rawRefreshToken, refreshExpiresAt);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          storage_used: user.storage_used,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
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
        message: "Refresh token not found or already used",
      });
      return;
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      await supabase
        .from("refresh_tokens")
        .delete()
        .eq("id", tokenRecord.id);

      clearRefreshCookie(res);

      res.status(401).json({
        success: false,
        message: "Refresh token expired. Please login again.",
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_url")
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
      data: {
        access_token: newAccessToken,
      },
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
      await supabase
        .from("refresh_tokens")
        .delete()
        .eq("token", hashedToken);
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

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("email", email.toLowerCase())
      .single();

    if (!user) {
      res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent.",
      });
      return;
    }

    await supabase.from("password_resets").delete().eq("user_id", user.id);

    const rawToken = generateRandomToken();
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await supabase.from("password_resets").insert({
      user_id: user.id,
      token: hashedToken,
      expires_at: expiresAt.toISOString(),
    });

    await sendPasswordResetEmail(user.email, user.full_name, rawToken);

    res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── RESET PASSWORD ──────────────────────────────────────────────────────────

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
      return;
    }

    const hashedToken = hashToken(token);

    const { data: resetRecord } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token", hashedToken)
      .single();

    if (!resetRecord) {
      res.status(400).json({
        success: false,
        message: "Invalid reset token",
      });
      return;
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      await supabase
        .from("password_resets")
        .delete()
        .eq("id", resetRecord.id);

      res.status(400).json({
        success: false,
        message: "Reset token expired. Please request a new one.",
      });
      return;
    }

    const hashedPassword = await hashPassword(new_password);

    await supabase
      .from("users")
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resetRecord.user_id);

    await supabase
      .from("password_resets")
      .delete()
      .eq("id", resetRecord.id);

    await supabase
      .from("refresh_tokens")
      .delete()
      .eq("user_id", resetRecord.user_id);

    res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
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
      if (!user.avatar_url && googleUser.picture) {
        await supabase
          .from("users")
          .update({
            avatar_url: googleUser.picture,
            is_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      if (!user.is_verified) {
        await supabase
          .from("users")
          .update({
            is_verified: true,
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

    const refreshExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

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