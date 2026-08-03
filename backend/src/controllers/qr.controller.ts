import { Request, Response } from "express";
import crypto from "crypto";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt.utils";
import { hashToken } from "../utils/hash.utils";
import { logActivity } from "../utils/activity.utils";

// ─── GENERATE QR SESSION ──────────────────────────────────────────────────────

export const generateQRSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Generate unique session ID
    const sessionId = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const deviceInfo = req.headers["user-agent"] || "Unknown device";

    // Save session in DB
    const { data: session, error } = await supabase
      .from("qr_sessions")
      .insert({
        session_id: sessionId,
        status: "pending",
        device_info: deviceInfo,
        expires_at: expiresAt.toISOString(),
      })
      .select("*")
      .single();

    if (error || !session) {
      res.status(500).json({
        success: false,
        message: "Failed to create QR session",
      });
      return;
    }

    // QR data is the session ID
    const qrData = `${process.env.CLIENT_URL}/qr-confirm?session=${sessionId}`;

    res.status(201).json({
      success: true,
      data: {
        session_id: sessionId,
        qr_data: qrData,
        expires_at: expiresAt.toISOString(),
        expires_in: 300, // 5 minutes in seconds
      },
    });
  } catch (error) {
    console.error("Generate QR session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── POLL QR STATUS (Desktop polls this) ─────────────────────────────────────

export const pollQRStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { session_id } = req.params;

    if (!session_id) {
      res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
      return;
    }

    const { data: session } = await supabase
      .from("qr_sessions")
      .select("*")
      .eq("session_id", session_id)
      .single();

    if (!session) {
      res.status(404).json({
        success: false,
        message: "Session not found",
      });
      return;
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from("qr_sessions")
        .update({ status: "expired" })
        .eq("session_id", session_id);

      res.status(200).json({
        success: true,
        data: {
          status: "expired",
          message: "QR code has expired",
        },
      });
      return;
    }

    // If confirmed, return access token and mark as used
    if (session.status === "confirmed" && session.access_token) {
      // Mark as used so it can't be reused
      await supabase
        .from("qr_sessions")
        .update({ status: "used" })
        .eq("session_id", session_id);

      res.status(200).json({
        success: true,
        data: {
          status: "confirmed",
          access_token: session.access_token,
          message: "Login confirmed",
        },
      });
      return;
    }

    // Still pending
    res.status(200).json({
      success: true,
      data: {
        status: session.status,
        message:
          session.status === "pending"
            ? "Waiting for confirmation"
            : session.status,
      },
    });
  } catch (error) {
    console.error("Poll QR status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── CONFIRM QR LOGIN (Mobile confirms) ──────────────────────────────────────

export const confirmQRLogin = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { session_id } = req.body;

    if (!session_id) {
      res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
      return;
    }

    // Get session
    const { data: session } = await supabase
      .from("qr_sessions")
      .select("*")
      .eq("session_id", session_id)
      .single();

    if (!session) {
      res.status(404).json({
        success: false,
        message: "QR session not found or already used",
      });
      return;
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      res.status(400).json({
        success: false,
        message: "QR code has expired. Please generate a new one.",
      });
      return;
    }

    // Check if already used
    if (session.status !== "pending") {
      res.status(400).json({
        success: false,
        message: `QR session is ${session.status}`,
      });
      return;
    }

    // Get user info
    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Generate access token for desktop
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    // Generate refresh token for desktop
    const rawRefreshToken = generateRefreshToken({ userId: user.id });
    const hashedRefreshToken = hashToken(rawRefreshToken);

    const refreshExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // Save refresh token
    await supabase.from("refresh_tokens").insert({
      user_id: user.id,
      token: hashedRefreshToken,
      device_info: session.device_info || "QR Login",
      expires_at: refreshExpiresAt.toISOString(),
    });

    // Update QR session with confirmed status and token
    await supabase
      .from("qr_sessions")
      .update({
        status: "confirmed",
        user_id: userId,
        access_token: accessToken,
      })
      .eq("session_id", session_id);

    await logActivity({
      user_id: userId,
      action: "qr_login_confirmed",
      metadata: {
        device_info: session.device_info,
      },
    });

    res.status(200).json({
      success: true,
      message: "Login confirmed successfully. Desktop will log in shortly.",
      data: {
        user: {
          full_name: user.full_name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error("Confirm QR login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET QR SESSION INFO (Mobile views before confirming) ─────────────────────

export const getQRSessionInfo = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { session_id } = req.params;

    const { data: session } = await supabase
      .from("qr_sessions")
      .select("session_id, status, device_info, expires_at, created_at")
      .eq("session_id", session_id)
      .single();

    if (!session) {
      res.status(404).json({
        success: false,
        message: "QR session not found",
      });
      return;
    }

    if (new Date(session.expires_at) < new Date()) {
      res.status(400).json({
        success: false,
        message: "QR session has expired",
      });
      return;
    }

    if (session.status !== "pending") {
      res.status(400).json({
        success: false,
        message: `Session already ${session.status}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        session_id: session.session_id,
        status: session.status,
        device_info: session.device_info,
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    console.error("Get QR session info error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};