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

    const itemData = trashItem.item_data;

    if (trashItem.item_type === "file") {
      // Restore file
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

      // Restore storage usage
      await updateStorageUsed(userId, itemData.size);
    } else {
      // Restore folder
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

    // Remove from trash
    await supabase.from("trash").delete().eq("id", id).eq("user_id", userId);

    await logActivity({
      user_id: userId,
      action: "restored_from_trash",
      item_type: trashItem.item_type,
      item_id: String(trashItem.item_id),
      item_name: String(trashItem.item_name),
    });

    res.status(200).json({
      success: true,
      message: `${trashItem.item_type === "file" ? "File" : "Folder"} restored successfully`,
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

    // If file, delete from storage
    if (trashItem.item_type === "file") {
      const itemData = trashItem.item_data;
      if (itemData.storage_path) {
        await deleteFromStorage(itemData.storage_path);
      }
    }

    // Delete from trash
    await supabase.from("trash").delete().eq("id", id).eq("user_id", userId);

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

    // Get all trash items
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
      if (item.item_type === "file" && item.item_data?.storage_path) {
        try {
          await deleteFromStorage(item.item_data.storage_path);
        } catch {
          // Continue even if storage delete fails
        }
      }
    }

    // Delete all trash items
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

    // Delete files from storage
    for (const item of trashItems) {
      if (item.item_type === "file") {
        const itemData = item.item_data as any;
        if (itemData.storage_path) {
          try {
            await deleteFromStorage(itemData.storage_path);
          } catch {}
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