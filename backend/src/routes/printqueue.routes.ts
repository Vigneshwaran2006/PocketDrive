import { Router } from "express";
import {
  getPrintQueue,
  addToPrintQueue,
  removeFromPrintQueue,
  reorderPrintQueue,
  clearPrintQueue,
  getQueueDownloadUrls,
  getPrintProfiles,
  createPrintProfile,
  deletePrintProfile,
  loadPrintProfile,
} from "../controllers/printqueue.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getPrintQueue);
router.post("/", addToPrintQueue);
router.delete("/clear", clearPrintQueue);
router.patch("/reorder", reorderPrintQueue);
router.get("/download", getQueueDownloadUrls);
router.delete("/:id", removeFromPrintQueue);

router.get("/profiles", getPrintProfiles);
router.post("/profiles", createPrintProfile);
router.delete("/profiles/:id", deletePrintProfile);
router.post("/profiles/:id/load", loadPrintProfile);

export default router;