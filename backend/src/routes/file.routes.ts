import { Router } from "express";
import {
  uploadFile,
  getFiles,
  getFileById,
  deleteFile,
  renameFile,
  moveFile,
  downloadFile,
  previewFile,
  toggleFavoriteFile,
  togglePinFile,
  updateFileTags,
  getFavoriteFiles,
  getRecentFiles,
  getFileVersions,
} from "../controllers/file.controller";
import { authenticate } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate);

router.post("/upload", upload.single("file"), uploadFile);
router.get("/", getFiles);
router.get("/favorites", getFavoriteFiles);
router.get("/recent", getRecentFiles);
router.get("/:id", getFileById);
router.delete("/:id", deleteFile);
router.patch("/:id/rename", renameFile);
router.patch("/:id/move", moveFile);
router.get("/:id/download", downloadFile);
router.get("/:id/preview", previewFile);
router.patch("/:id/favorite", toggleFavoriteFile);
router.patch("/:id/pin", togglePinFile);
router.patch("/:id/tags", updateFileTags);
router.get("/:id/versions", getFileVersions);

export default router;