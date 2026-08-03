import { Router } from "express";
import {
  generateQRSession,
  pollQRStatus,
  confirmQRLogin,
  getQRSessionInfo,
} from "../controllers/qr.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public routes (no auth needed)
router.post("/generate", generateQRSession);
router.get("/poll/:session_id", pollQRStatus);

// Protected routes (mobile user must be logged in)
router.get("/session/:session_id", authenticate, getQRSessionInfo);
router.post("/confirm", authenticate, confirmQRLogin);

export default router;