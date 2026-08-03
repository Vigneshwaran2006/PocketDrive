import { Router } from "express";
import {
  getDashboard,
  getStorageAnalytics,
  getActivityLogs,
} from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getDashboard);
router.get("/storage", getStorageAnalytics);
router.get("/activity", getActivityLogs);

export default router;