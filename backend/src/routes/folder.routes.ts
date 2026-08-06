import { Router } from "express";
import {
  createFolder,
  getFolders,
  getFolderById,
  renameFolder,
  deleteFolder,
  moveFolder,
  toggleFavoriteFolder,
  togglePinFolder,
  getFavoriteFolders,
  bulkDeleteFolders,
} from "../controllers/folder.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", createFolder);
router.get("/", getFolders);
router.get("/favorites", getFavoriteFolders);
router.post("/bulk-delete", bulkDeleteFolders);

router.get("/:id", getFolderById);
router.patch("/:id/rename", renameFolder);
router.delete("/:id", deleteFolder);
router.patch("/:id/move", moveFolder);
router.patch("/:id/favorite", toggleFavoriteFolder);
router.patch("/:id/pin", togglePinFolder);

export default router;