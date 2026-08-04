import { Router } from "express";
import {
  refreshToken,
  logout,
  getMe,
  googleAuth,
  googleCallback,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;