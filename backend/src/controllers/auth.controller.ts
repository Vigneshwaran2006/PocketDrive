import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
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
    sendVerificationEmail,
    sendPasswordResetEmail,
} from "../utils/email.utils";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { getGoogleAuthUrl, getGoogleUser } from "../utils/google.utils";
import crypto from "crypto";

// ─── REGISTER ───────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { full_name, email, password } = req.body;

        // Validate input
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

        // Check if email already exists
        const { data: existingUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", email.toLowerCase())
            .single();

        if (existingUser) {
            res.status(409).json({
                success: false,
                message: "Email already registered",
            });
            return;
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
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

        // Generate verification token
        const rawToken = generateRandomToken();
        const hashedVerificationToken = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Save verification token
        await supabase.from("email_verifications").insert({
            user_id: newUser.id,
            token: hashedVerificationToken,
            expires_at: expiresAt.toISOString(),
        });

        // Send verification email
        await sendVerificationEmail(newUser.email, newUser.full_name, rawToken);

        res.status(201).json({
            success: true,
            message: "Account created successfully. Please verify your email.",
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
        const { token } = req.body;

        if (!token) {
            res.status(400).json({
                success: false,
                message: "Verification token is required",
            });
            return;
        }

        // Hash the token to compare with DB
        const hashedToken = hashToken(token);

        // Find verification record
        const { data: verification } = await supabase
            .from("email_verifications")
            .select("*")
            .eq("token", hashedToken)
            .single();

        if (!verification) {
            res.status(400).json({
                success: false,
                message: "Invalid verification token",
            });
            return;
        }

        // Check if token is expired
        if (new Date(verification.expires_at) < new Date()) {
            await supabase
                .from("email_verifications")
                .delete()
                .eq("id", verification.id);

            res.status(400).json({
                success: false,
                message: "Verification token expired. Please register again.",
            });
            return;
        }

        // Mark user as verified
        await supabase
            .from("users")
            .update({ is_verified: true, updated_at: new Date().toISOString() })
            .eq("id", verification.user_id);

        // Delete verification token
        await supabase
            .from("email_verifications")
            .delete()
            .eq("id", verification.id);

        res.status(200).json({
            success: true,
            message: "Email verified successfully. You can now log in.",
        });
    } catch (error) {
        console.error("Verify email error:", error);
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

        // Find user
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

        // Check if verified
        if (!user.is_verified) {
            res.status(401).json({
                success: false,
                message: "Please verify your email before logging in",
            });
            return;
        }

        // Verify password
        const isPasswordValid = await comparePassword(password, user.password);

        if (!isPasswordValid) {
            res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
            return;
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
        });

        const rawRefreshToken = generateRefreshToken({ userId: user.id });
        const hashedRefreshToken = hashToken(rawRefreshToken);

        // Refresh token expiry
        const refreshExpiresAt = remember_me
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Get device info
        const deviceInfo = req.headers["user-agent"] || "Unknown device";

        // Save refresh token in DB
        await supabase.from("refresh_tokens").insert({
            user_id: user.id,
            token: hashedRefreshToken,
            device_info: deviceInfo,
            expires_at: refreshExpiresAt.toISOString(),
        });

        // Set refresh token in httpOnly cookie
        res.cookie("refresh_token", rawRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            expires: refreshExpiresAt,
        });

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

        // Verify JWT signature
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

        // Check in DB
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

        // Check expiry
        if (new Date(tokenRecord.expires_at) < new Date()) {
            await supabase
                .from("refresh_tokens")
                .delete()
                .eq("id", tokenRecord.id);

            res.clearCookie("refresh_token");

            res.status(401).json({
                success: false,
                message: "Refresh token expired. Please login again.",
            });
            return;
        }

        // Get user
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

        // Generate new access token
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

            // Delete from DB
            await supabase
                .from("refresh_tokens")
                .delete()
                .eq("token", hashedToken);
        }

        // Clear cookie
        res.clearCookie("refresh_token");

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

        // Find user
        const { data: user } = await supabase
            .from("users")
            .select("id, email, full_name")
            .eq("email", email.toLowerCase())
            .single();

        // Always return success (security - don't reveal if email exists)
        if (!user) {
            res.status(200).json({
                success: true,
                message: "If that email exists, a reset link has been sent.",
            });
            return;
        }

        // Delete any existing reset tokens for this user
        await supabase
            .from("password_resets")
            .delete()
            .eq("user_id", user.id);

        // Generate reset token
        const rawToken = generateRandomToken();
        const hashedToken = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save reset token
        await supabase.from("password_resets").insert({
            user_id: user.id,
            token: hashedToken,
            expires_at: expiresAt.toISOString(),
        });

        // Send reset email
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

        // Hash token to compare
        const hashedToken = hashToken(token);

        // Find reset record
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

        // Check expiry
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

        // Hash new password
        const hashedPassword = await hashPassword(new_password);

        // Update password
        await supabase
            .from("users")
            .update({
                password: hashedPassword,
                updated_at: new Date().toISOString(),
            })
            .eq("id", resetRecord.user_id);

        // Delete reset token
        await supabase
            .from("password_resets")
            .delete()
            .eq("id", resetRecord.id);

        // Invalidate all refresh tokens for security
        await supabase
            .from("refresh_tokens")
            .delete()
            .eq("user_id", resetRecord.user_id);

        res.status(200).json({
            success: true,
            message: "Password reset successfully. Please login with your new password.",
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
  try {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      res.redirect(
        `${process.env.CLIENT_URL}/login?error=Google authentication failed`
      );
      return;
    }

    // Get Google user info
    const googleUser = await getGoogleUser(code);

    if (!googleUser.email) {
      res.redirect(
        `${process.env.CLIENT_URL}/login?error=Could not get email from Google`
      );
      return;
    }

    // Check if user exists
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", googleUser.email.toLowerCase())
      .single();

    if (!user) {
      // Create new user (auto-verified since Google verified the email)
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
        res.redirect(
          `${process.env.CLIENT_URL}/login?error=Failed to create account`
        );
        return;
      }

      user = newUser;
    } else {
      // Update avatar if not set
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

      // Ensure user is marked as verified
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

    // Generate tokens
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

    // Set refresh token cookie
    res.cookie("refresh_token", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: refreshExpiresAt,
    });

    // Redirect to frontend with access token
    res.redirect(
      `${process.env.CLIENT_URL}/auth/callback?token=${accessToken}`
    );
  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect(
      `${process.env.CLIENT_URL}/login?error=Authentication failed`
    );
  }
};