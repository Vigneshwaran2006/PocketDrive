import { Router } from "express";
import {
  getTrash,
  restoreFromTrash,
  permanentDelete,
  emptyTrash,
  bulkRestoreTrash,
  bulkPermanentDelete,
} from "../controllers/trash.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getTrash);
router.delete("/empty", emptyTrash);
router.post("/bulk-restore", bulkRestoreTrash);
router.post("/bulk-delete", bulkPermanentDelete);
router.post("/:id/restore", restoreFromTrash);
router.delete("/:id", permanentDelete);

export default router;