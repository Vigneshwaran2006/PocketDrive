import { Router } from "express";
import {
  getTrash,
  restoreFromTrash,
  permanentDelete,
  emptyTrash,
} from "../controllers/trash.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getTrash);
router.post("/:id/restore", restoreFromTrash);
router.delete("/empty", emptyTrash);
router.delete("/:id", permanentDelete);

export default router;