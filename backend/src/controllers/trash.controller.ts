import { Response } from "express";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { deleteFromStorage, updateStorageUsed } from "../utils/storage.utils";
import { logActivity } from "../utils/activity.utils";

// ─── GET TRASH ────────────────────────────────────────────────────────────────

export const getTrash = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: trashItems, error } = await supabase
      .from("trash")
      .select("*")
      .eq("user_id", userId)
      .order("deleted_at", { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch trash",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { trash: trashItems },
    });
  } catch (error) {
    console.error("Get trash error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── RESTORE FROM TRASH ───────────────────────────────────────────────────────

export const restoreFromTrash = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: trashItem } = await supabase
      .from("trash")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!trashItem) {
      res.status(404).json({
        success: false,
        message: "Trash item not found",
      });
      return;
    }

    const itemData = trashItem.item_data as any;

    if (trashItem.item_type === "file") {
      // Restore single file
      await supabase.from("files").insert({
        id: itemData.id,
        user_id: itemData.user_id,
        folder_id: itemData.folder_id,
        name: itemData.name,
        original_name: itemData.original_name,
        storage_path: itemData.storage_path,
        mime_type: itemData.mime_type,
        size: itemData.size,
        extension: itemData.extension,
        is_favorited: itemData.is_favorited,
        is_pinned: itemData.is_pinned,
        tags: itemData.tags,
        version: itemData.version,
        created_at: itemData.created_at,
        updated_at: new Date().toISOString(),
      });

      await updateStorageUsed(userId, itemData.size);
    } else {
      // Restore folder with ALL contents (files + subfolders)

      // New format: has all_folders and all_files
      if (itemData.all_folders && itemData.all_files !== undefined) {
        // Check if parent folder still exists (may have been deleted)
        const rootFolder = itemData.folder;

        if (rootFolder.parent_id) {
          const { data: parentExists } = await supabase
            .from("folders")
            .select("id")
            .eq("id", rootFolder.parent_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (!parentExists) {
            // Parent no longer exists, restore to root
            rootFolder.parent_id = null;
            // Also update any folder that had this parent
            itemData.all_folders = itemData.all_folders.map((f: any) =>
              f.id === rootFolder.id ? { ...f, parent_id: null } : f
            );
          }
        }

        // Restore all folders (they reference each other by parent_id)
        if (itemData.all_folders.length > 0) {
          const foldersToRestore = itemData.all_folders.map((f: any) => ({
            id: f.id,
            user_id: f.user_id,
            parent_id: f.parent_id,
            name: f.name,
            color: f.color,
            is_favorited: f.is_favorited,
            is_pinned: f.is_pinned,
            created_at: f.created_at,
            updated_at: new Date().toISOString(),
          }));

          await supabase.from("folders").insert(foldersToRestore);
        }

        // Restore all files
        if (itemData.all_files.length > 0) {
          const filesToRestore = itemData.all_files.map((f: any) => ({
            id: f.id,
            user_id: f.user_id,
            folder_id: f.folder_id,
            name: f.name,
            original_name: f.original_name,
            storage_path: f.storage_path,
            mime_type: f.mime_type,
            size: f.size,
            extension: f.extension,
            is_favorited: f.is_favorited,
            is_pinned: f.is_pinned,
            tags: f.tags,
            version: f.version,
            created_at: f.created_at,
            updated_at: new Date().toISOString(),
          }));

          await supabase.from("files").insert(filesToRestore);

          const totalSize = itemData.all_files.reduce(
            (sum: number, f: any) => sum + f.size,
            0
          );
          await updateStorageUsed(userId, totalSize);
        }
      } else {
        // Old format: just single folder (backward compatible)
        await supabase.from("folders").insert({
          id: itemData.id,
          user_id: itemData.user_id,
          parent_id: itemData.parent_id,
          name: itemData.name,
          color: itemData.color,
          is_favorited: itemData.is_favorited,
          is_pinned: itemData.is_pinned,
          created_at: itemData.created_at,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Remove from trash
    await supabase
      .from("trash")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    await logActivity({
      user_id: userId,
      action: "restored_from_trash",
      item_type: trashItem.item_type,
      item_id: String(trashItem.item_id),
      item_name: String(trashItem.item_name),
    });

    res.status(200).json({
      success: true,
      message: `${
        trashItem.item_type === "file" ? "File" : "Folder"
      } restored successfully`,
    });
  } catch (error) {
    console.error("Restore from trash error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── PERMANENT DELETE ─────────────────────────────────────────────────────────

export const permanentDelete = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: trashItem } = await supabase
      .from("trash")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!trashItem) {
      res.status(404).json({
        success: false,
        message: "Trash item not found",
      });
      return;
    }

    const itemData = trashItem.item_data as any;

    if (trashItem.item_type === "file") {
      // Single file
      if (itemData.storage_path) {
        try {
          await deleteFromStorage(itemData.storage_path);
        } catch {}
      }
    } else {
      // Folder — delete all files in storage
      if (itemData.all_files && itemData.all_files.length > 0) {
        for (const file of itemData.all_files) {
          if (file.storage_path) {
            try {
              await deleteFromStorage(file.storage_path);
            } catch {}
          }
        }
      }
    }

    await supabase
      .from("trash")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    await logActivity({
      user_id: userId,
      action: "permanently_deleted",
      item_type: trashItem.item_type,
      item_id: String(trashItem.item_id),
      item_name: String(trashItem.item_name),
    });

    res.status(200).json({
      success: true,
      message: "Permanently deleted",
    });
  } catch (error) {
    console.error("Permanent delete error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── EMPTY TRASH ──────────────────────────────────────────────────────────────

export const emptyTrash = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: trashItems } = await supabase
      .from("trash")
      .select("*")
      .eq("user_id", userId);

    if (!trashItems || trashItems.length === 0) {
      res.status(200).json({
        success: true,
        message: "Trash is already empty",
      });
      return;
    }

    // Delete files from storage
    for (const item of trashItems) {
      const itemData = item.item_data as any;

      if (item.item_type === "file") {
        if (itemData?.storage_path) {
          try {
            await deleteFromStorage(itemData.storage_path);
          } catch {}
        }
      } else {
        // Folder — delete all files
        if (itemData?.all_files && itemData.all_files.length > 0) {
          for (const file of itemData.all_files) {
            if (file.storage_path) {
              try {
                await deleteFromStorage(file.storage_path);
              } catch {}
            }
          }
        }
      }
    }

    await supabase.from("trash").delete().eq("user_id", userId);

    await logActivity({
      user_id: userId,
      action: "emptied_trash",
      metadata: { items_deleted: trashItems.length },
    });

    res.status(200).json({
      success: true,
      message: `Trash emptied. ${trashItems.length} items permanently deleted.`,
    });
  } catch (error) {
    console.error("Empty trash error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── BULK RESTORE ─────────────────────────────────────────────────────────────

export const bulkRestoreTrash = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { trash_ids } = req.body;

    if (!Array.isArray(trash_ids) || trash_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "trash_ids array is required",
      });
      return;
    }

    const { data: trashItems } = await supabase
      .from("trash")
      .select("*")
      .in("id", trash_ids)
      .eq("user_id", userId);

    if (!trashItems || trashItems.length === 0) {
      res.status(404).json({
        success: false,
        message: "No items found",
      });
      return;
    }

    for (const item of trashItems) {
      const itemData = item.item_data as any;

      if (item.item_type === "file") {
        await supabase.from("files").insert({
          id: itemData.id,
          user_id: itemData.user_id,
          folder_id: itemData.folder_id,
          name: itemData.name,
          original_name: itemData.original_name,
          storage_path: itemData.storage_path,
          mime_type: itemData.mime_type,
          size: itemData.size,
          extension: itemData.extension,
          is_favorited: itemData.is_favorited,
          is_pinned: itemData.is_pinned,
          tags: itemData.tags,
          version: itemData.version,
          created_at: itemData.created_at,
          updated_at: new Date().toISOString(),
        });

        await updateStorageUsed(userId, itemData.size);
      } else {
        // Folder restore (with contents)
        if (itemData.all_folders && itemData.all_files !== undefined) {
          const rootFolder = itemData.folder;

          if (rootFolder.parent_id) {
            const { data: parentExists } = await supabase
              .from("folders")
              .select("id")
              .eq("id", rootFolder.parent_id)
              .eq("user_id", userId)
              .maybeSingle();

            if (!parentExists) {
              rootFolder.parent_id = null;
              itemData.all_folders = itemData.all_folders.map((f: any) =>
                f.id === rootFolder.id ? { ...f, parent_id: null } : f
              );
            }
          }

          if (itemData.all_folders.length > 0) {
            const foldersToRestore = itemData.all_folders.map((f: any) => ({
              id: f.id,
              user_id: f.user_id,
              parent_id: f.parent_id,
              name: f.name,
              color: f.color,
              is_favorited: f.is_favorited,
              is_pinned: f.is_pinned,
              created_at: f.created_at,
              updated_at: new Date().toISOString(),
            }));

            await supabase.from("folders").insert(foldersToRestore);
          }

          if (itemData.all_files.length > 0) {
            const filesToRestore = itemData.all_files.map((f: any) => ({
              id: f.id,
              user_id: f.user_id,
              folder_id: f.folder_id,
              name: f.name,
              original_name: f.original_name,
              storage_path: f.storage_path,
              mime_type: f.mime_type,
              size: f.size,
              extension: f.extension,
              is_favorited: f.is_favorited,
              is_pinned: f.is_pinned,
              tags: f.tags,
              version: f.version,
              created_at: f.created_at,
              updated_at: new Date().toISOString(),
            }));

            await supabase.from("files").insert(filesToRestore);

            const totalSize = itemData.all_files.reduce(
              (sum: number, f: any) => sum + f.size,
              0
            );
            await updateStorageUsed(userId, totalSize);
          }
        } else {
          // Old format
          await supabase.from("folders").insert({
            id: itemData.id,
            user_id: itemData.user_id,
            parent_id: itemData.parent_id,
            name: itemData.name,
            color: itemData.color,
            is_favorited: itemData.is_favorited,
            is_pinned: itemData.is_pinned,
            created_at: itemData.created_at,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    await supabase.from("trash").delete().in("id", trash_ids);

    await logActivity({
      user_id: userId,
      action: "bulk_restored_from_trash",
      metadata: { count: trashItems.length },
    });

    res.status(200).json({
      success: true,
      message: `${trashItems.length} item${
        trashItems.length !== 1 ? "s" : ""
      } restored`,
    });
  } catch (error) {
    console.error("Bulk restore error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── BULK PERMANENT DELETE ────────────────────────────────────────────────────

export const bulkPermanentDelete = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { trash_ids } = req.body;

    if (!Array.isArray(trash_ids) || trash_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "trash_ids array is required",
      });
      return;
    }

    const { data: trashItems } = await supabase
      .from("trash")
      .select("*")
      .in("id", trash_ids)
      .eq("user_id", userId);

    if (!trashItems || trashItems.length === 0) {
      res.status(404).json({
        success: false,
        message: "No items found",
      });
      return;
    }

    for (const item of trashItems) {
      const itemData = item.item_data as any;

      if (item.item_type === "file") {
        if (itemData.storage_path) {
          try {
            await deleteFromStorage(itemData.storage_path);
          } catch {}
        }
      } else {
        // Folder — delete all files
        if (itemData.all_files && itemData.all_files.length > 0) {
          for (const file of itemData.all_files) {
            if (file.storage_path) {
              try {
                await deleteFromStorage(file.storage_path);
              } catch {}
            }
          }
        }
      }
    }

    await supabase.from("trash").delete().in("id", trash_ids);

    await logActivity({
      user_id: userId,
      action: "bulk_permanent_delete",
      metadata: { count: trashItems.length },
    });

    res.status(200).json({
      success: true,
      message: `${trashItems.length} item${
        trashItems.length !== 1 ? "s" : ""
      } permanently deleted`,
    });
  } catch (error) {
    console.error("Bulk permanent delete error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};