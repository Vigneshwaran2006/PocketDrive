import { Response } from "express";
import path from "path";
import crypto from "crypto";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { logActivity } from "../utils/activity.utils";
import {
  uploadToStorage,
  deleteFromStorage,
  getSignedUrl,
  updateStorageUsed,
} from "../utils/storage.utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ─── UPLOAD FILE ──────────────────────────────────────────────────────────────

export const uploadFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { folder_id } = req.body;

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file provided",
      });
      return;
    }

    const file = req.file;

    if (file.size > MAX_FILE_SIZE) {
      res.status(400).json({
        success: false,
        message: "File size exceeds 50MB limit",
      });
      return;
    }

    if (folder_id) {
      const { data: folder } = await supabase
        .from("folders")
        .select("id")
        .eq("id", folder_id)
        .eq("user_id", userId)
        .single();

      if (!folder) {
        res.status(404).json({
          success: false,
          message: "Folder not found",
        });
        return;
      }
    }

    // Duplicate detection - handle root (null) vs nested folders
    let duplicateQuery = supabase
      .from("files")
      .select("id, name, size, original_name")
      .eq("user_id", userId)
      .eq("size", file.size)
      .eq("original_name", file.originalname);

    if (folder_id) {
      duplicateQuery = duplicateQuery.eq("folder_id", folder_id);
    } else {
      duplicateQuery = duplicateQuery.is("folder_id", null);
    }

    const { data: duplicate } = await duplicateQuery.maybeSingle();

    if (duplicate) {
      res.status(409).json({
        success: false,
        message:
          "A file with the same name and size already exists. Possible duplicate.",
        data: { duplicate },
        code: "POSSIBLE_DUPLICATE",
      });
      return;
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueFileName = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}${extension}`;

    await uploadToStorage(uniqueFileName, file.buffer, file.mimetype);

    // Check for versioning - handle root (null) vs nested folders
    let existingFileQuery = supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .eq("original_name", file.originalname);

    if (folder_id) {
      existingFileQuery = existingFileQuery.eq("folder_id", folder_id);
    } else {
      existingFileQuery = existingFileQuery.is("folder_id", null);
    }

    const { data: existingFile } = await existingFileQuery.maybeSingle();

    if (existingFile) {
      await supabase.from("file_versions").insert({
        file_id: existingFile.id,
        user_id: userId,
        version: existingFile.version,
        storage_path: existingFile.storage_path,
        size: existingFile.size,
      });

      const { data: updatedFile, error } = await supabase
        .from("files")
        .update({
          storage_path: uniqueFileName,
          size: file.size,
          version: existingFile.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingFile.id)
        .select("*")
        .single();

      if (error) {
        res.status(500).json({
          success: false,
          message: "Failed to update file version",
        });
        return;
      }

      await updateStorageUsed(userId, file.size - existingFile.size);

      await logActivity({
        user_id: userId,
        action: "uploaded_new_version",
        item_type: "file",
        item_id: String(updatedFile!.id),
        item_name: String(updatedFile!.name),
        metadata: { version: updatedFile!.version },
      });

      res.status(200).json({
        success: true,
        message: `New version (v${updatedFile!.version}) uploaded`,
        data: { file: updatedFile },
      });
      return;
    }

    const { data: newFile, error: insertError } = await supabase
      .from("files")
      .insert({
        user_id: userId,
        folder_id: folder_id || null,
        name: file.originalname,
        original_name: file.originalname,
        storage_path: uniqueFileName,
        mime_type: file.mimetype,
        size: file.size,
        extension: extension || null,
      })
      .select("*")
      .single();

    if (insertError || !newFile) {
      await deleteFromStorage(uniqueFileName);
      res.status(500).json({
        success: false,
        message: "Failed to save file record",
      });
      return;
    }

    await updateStorageUsed(userId, file.size);

    await logActivity({
      user_id: userId,
      action: "uploaded_file",
      item_type: "file",
      item_id: String(newFile.id),
      item_name: String(newFile.name),
      metadata: {
        size: file.size,
        mime_type: file.mimetype,
      },
    });

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: { file: newFile },
    });
  } catch (error) {
    console.error("Upload file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── UPLOAD MULTIPLE FILES ────────────────────────────────────────────────────

export const uploadMultipleFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { folder_id } = req.body;

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: "No files provided",
      });
      return;
    }

    if (folder_id) {
      const { data: folder } = await supabase
        .from("folders")
        .select("id")
        .eq("id", folder_id)
        .eq("user_id", userId)
        .single();

      if (!folder) {
        res.status(404).json({
          success: false,
          message: "Folder not found",
        });
        return;
      }
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      duplicates: [] as any[],
    };

    for (const file of files) {
      try {
        if (file.size > MAX_FILE_SIZE) {
          results.failed.push({
            name: file.originalname,
            reason: "File size exceeds 50MB limit",
          });
          continue;
        }

        // Check for duplicate - handle root (null) vs nested folders
        let duplicateQuery = supabase
          .from("files")
          .select("id, name, size")
          .eq("user_id", userId)
          .eq("size", file.size)
          .eq("original_name", file.originalname);

        if (folder_id) {
          duplicateQuery = duplicateQuery.eq("folder_id", folder_id);
        } else {
          duplicateQuery = duplicateQuery.is("folder_id", null);
        }

        const { data: duplicate } = await duplicateQuery.maybeSingle();

        if (duplicate) {
          results.duplicates.push({
            name: file.originalname,
            existing_id: duplicate.id,
          });
          continue;
        }

        const extension = path.extname(file.originalname).toLowerCase();
        const uniqueFileName = `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}${extension}`;

        await uploadToStorage(uniqueFileName, file.buffer, file.mimetype);

        // Check for versioning
        let existingFileQuery = supabase
          .from("files")
          .select("*")
          .eq("user_id", userId)
          .eq("original_name", file.originalname);

        if (folder_id) {
          existingFileQuery = existingFileQuery.eq("folder_id", folder_id);
        } else {
          existingFileQuery = existingFileQuery.is("folder_id", null);
        }

        const { data: existingFile } = await existingFileQuery.maybeSingle();

        if (existingFile) {
          await supabase.from("file_versions").insert({
            file_id: existingFile.id,
            user_id: userId,
            version: existingFile.version,
            storage_path: existingFile.storage_path,
            size: existingFile.size,
          });

          const { data: updatedFile } = await supabase
            .from("files")
            .update({
              storage_path: uniqueFileName,
              size: file.size,
              version: existingFile.version + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingFile.id)
            .select("*")
            .single();

          await updateStorageUsed(userId, file.size - existingFile.size);

          await logActivity({
            user_id: userId,
            action: "uploaded_new_version",
            item_type: "file",
            item_id: String(updatedFile!.id),
            item_name: String(updatedFile!.name),
            metadata: { version: updatedFile!.version },
          });

          results.successful.push({
            name: file.originalname,
            file: updatedFile,
            is_new_version: true,
          });
          continue;
        }

        const { data: newFile, error: insertError } = await supabase
          .from("files")
          .insert({
            user_id: userId,
            folder_id: folder_id || null,
            name: file.originalname,
            original_name: file.originalname,
            storage_path: uniqueFileName,
            mime_type: file.mimetype,
            size: file.size,
            extension: extension || null,
          })
          .select("*")
          .single();

        if (insertError || !newFile) {
          await deleteFromStorage(uniqueFileName);
          results.failed.push({
            name: file.originalname,
            reason: "Failed to save file record",
          });
          continue;
        }

        await updateStorageUsed(userId, file.size);

        await logActivity({
          user_id: userId,
          action: "uploaded_file",
          item_type: "file",
          item_id: String(newFile.id),
          item_name: String(newFile.name),
          metadata: {
            size: file.size,
            mime_type: file.mimetype,
          },
        });

        results.successful.push({
          name: file.originalname,
          file: newFile,
        });
      } catch (error: any) {
        console.error(`Failed to upload ${file.originalname}:`, error);
        results.failed.push({
          name: file.originalname,
          reason: error.message || "Upload failed",
        });
      }
    }

    const totalUploaded = results.successful.length;
    const totalFailed = results.failed.length;
    const totalDuplicates = results.duplicates.length;

    res.status(200).json({
      success: true,
      message: `${totalUploaded} file${
        totalUploaded !== 1 ? "s" : ""
      } uploaded${
        totalDuplicates > 0
          ? `, ${totalDuplicates} duplicate${
              totalDuplicates !== 1 ? "s" : ""
            }`
          : ""
      }${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`,
      data: results,
    });
  } catch (error) {
    console.error("Upload multiple files error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FILES ────────────────────────────────────────────────────────────────

export const getFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { folder_id } = req.query;

    let query = supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (folder_id === "root" || !folder_id) {
      query = query.is("folder_id", null);
    } else {
      query = query.eq("folder_id", folder_id as string);
    }

    const { data: files, error } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch files",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { files },
    });
  } catch (error) {
    console.error("Get files error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FILE BY ID ───────────────────────────────────────────────────────────

export const getFileById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { file },
    });
  } catch (error) {
    console.error("Get file by id error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── DELETE FILE ──────────────────────────────────────────────────────────────

export const deleteFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    await supabase.from("trash").insert({
      user_id: userId,
      item_id: file.id,
      item_type: "file",
      item_name: file.name,
      item_data: file,
    });

    await supabase
      .from("files")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    await updateStorageUsed(userId, -file.size);

    await logActivity({
      user_id: userId,
      action: "deleted_file",
      item_type: "file",
      item_id: id,
      item_name: String(file.name),
    });

    res.status(200).json({
      success: true,
      message: "File moved to trash",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── BULK DELETE FILES ────────────────────────────────────────────────────────

export const bulkDeleteFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { file_ids } = req.body;

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "file_ids array is required",
      });
      return;
    }

    const { data: files } = await supabase
      .from("files")
      .select("*")
      .in("id", file_ids)
      .eq("user_id", userId);

    if (!files || files.length === 0) {
      res.status(404).json({
        success: false,
        message: "No files found",
      });
      return;
    }

    const trashItems = files.map((file) => ({
      user_id: userId,
      item_id: file.id,
      item_type: "file" as const,
      item_name: file.name,
      item_data: file,
    }));

    await supabase.from("trash").insert(trashItems);

    await supabase
      .from("files")
      .delete()
      .in("id", file_ids)
      .eq("user_id", userId);

    const totalSize = files.reduce(
      (sum: number, f: any) => sum + f.size,
      0
    );
    await updateStorageUsed(userId, -totalSize);

    await logActivity({
      user_id: userId,
      action: "bulk_deleted_files",
      metadata: {
        count: files.length,
        total_size: totalSize,
      },
    });

    res.status(200).json({
      success: true,
      message: `${files.length} file${
        files.length !== 1 ? "s" : ""
      } moved to trash`,
    });
  } catch (error) {
    console.error("Bulk delete files error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── RENAME FILE ──────────────────────────────────────────────────────────────

export const renameFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const { name } = req.body;

    if (!name || name.trim() === "") {
      res.status(400).json({
        success: false,
        message: "File name is required",
      });
      return;
    }

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const { data: updated, error } = await supabase
      .from("files")
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to rename file",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "renamed_file",
      item_type: "file",
      item_id: id,
      item_name: name.trim(),
      metadata: { old_name: String(file.name) },
    });

    res.status(200).json({
      success: true,
      message: "File renamed successfully",
      data: { file: updated },
    });
  } catch (error) {
    console.error("Rename file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── MOVE FILE ────────────────────────────────────────────────────────────────

export const moveFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const { target_folder_id } = req.body;

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    if (target_folder_id) {
      const { data: targetFolder } = await supabase
        .from("folders")
        .select("id")
        .eq("id", target_folder_id)
        .eq("user_id", userId)
        .single();

      if (!targetFolder) {
        res.status(404).json({
          success: false,
          message: "Target folder not found",
        });
        return;
      }
    }

    const { data: updated, error } = await supabase
      .from("files")
      .update({
        folder_id: target_folder_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to move file",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "moved_file",
      item_type: "file",
      item_id: id,
      item_name: String(file.name),
    });

    res.status(200).json({
      success: true,
      message: "File moved successfully",
      data: { file: updated },
    });
  } catch (error) {
    console.error("Move file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── DOWNLOAD FILE ────────────────────────────────────────────────────────────

export const downloadFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("pocketdrive-files")
      .createSignedUrl(file.storage_path, 3600, {
        download: file.name,
      });

    if (signedError || !signedData) {
      res.status(500).json({
        success: false,
        message: "Failed to generate download URL",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "downloaded_file",
      item_type: "file",
      item_id: id,
      item_name: String(file.name),
    });

    res.status(200).json({
      success: true,
      data: {
        download_url: signedData.signedUrl,
        file_name: file.name,
        mime_type: file.mime_type,
        expires_in: 3600,
      },
    });
  } catch (error) {
    console.error("Download file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── PREVIEW FILE ─────────────────────────────────────────────────────────────

export const previewFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const signedUrl = await getSignedUrl(file.storage_path, 900);

    res.status(200).json({
      success: true,
      data: {
        preview_url: signedUrl,
        mime_type: file.mime_type,
        file_name: file.name,
        expires_in: 900,
      },
    });
  } catch (error) {
    console.error("Preview file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── TOGGLE FAVORITE ─────────────────────────────────────────────────────────

export const toggleFavoriteFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const { data: updated } = await supabase
      .from("files")
      .update({
        is_favorited: !file.is_favorited,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    await logActivity({
      user_id: userId,
      action: file.is_favorited ? "unfavorited_file" : "favorited_file",
      item_type: "file",
      item_id: id,
      item_name: String(file.name),
    });

    res.status(200).json({
      success: true,
      message: file.is_favorited
        ? "Removed from favorites"
        : "Added to favorites",
      data: { file: updated },
    });
  } catch (error) {
    console.error("Toggle favorite file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── TOGGLE PIN ───────────────────────────────────────────────────────────────

export const togglePinFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const { data: updated } = await supabase
      .from("files")
      .update({
        is_pinned: !file.is_pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    res.status(200).json({
      success: true,
      message: file.is_pinned ? "Unpinned" : "Pinned",
      data: { file: updated },
    });
  } catch (error) {
    console.error("Toggle pin file error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── UPDATE TAGS ──────────────────────────────────────────────────────────────

export const updateFileTags = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      res.status(400).json({
        success: false,
        message: "Tags must be an array",
      });
      return;
    }

    const { data: file } = await supabase
      .from("files")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const { data: updated, error } = await supabase
      .from("files")
      .update({
        tags: tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update tags",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Tags updated successfully",
      data: { file: updated },
    });
  } catch (error) {
    console.error("Update tags error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FAVORITES ────────────────────────────────────────────────────────────

export const getFavoriteFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: files, error } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .eq("is_favorited", true)
      .order("updated_at", { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch favorite files",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { files },
    });
  } catch (error) {
    console.error("Get favorite files error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET RECENT FILES ─────────────────────────────────────────────────────────

export const getRecentFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: files, error } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch recent files",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { files },
    });
  } catch (error) {
    console.error("Get recent files error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FILE VERSIONS ────────────────────────────────────────────────────────

export const getFileVersions = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: file } = await supabase
      .from("files")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    const { data: versions, error } = await supabase
      .from("file_versions")
      .select("*")
      .eq("file_id", id)
      .order("version", { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch versions",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { versions },
    });
  } catch (error) {
    console.error("Get file versions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};