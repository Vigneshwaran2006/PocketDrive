import { Response } from "express";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { getSignedUrl } from "../utils/storage.utils";
import { logActivity } from "../utils/activity.utils";

// ─── GET PRINT QUEUE ──────────────────────────────────────────────────────────

export const getPrintQueue = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: queue, error } = await supabase
      .from("print_queue")
      .select(`
        *,
        files (
          id,
          name,
          mime_type,
          size,
          extension,
          storage_path
        )
      `)
      .eq("user_id", userId)
      .order("order_index", { ascending: true });

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch print queue",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { queue },
    });
  } catch (error) {
    console.error("Get print queue error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── ADD TO PRINT QUEUE ───────────────────────────────────────────────────────

export const addToPrintQueue = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { file_id } = req.body;

    if (!file_id) {
      res.status(400).json({
        success: false,
        message: "file_id is required",
      });
      return;
    }

    // Verify file belongs to user
    const { data: file } = await supabase
      .from("files")
      .select("id, name, mime_type")
      .eq("id", file_id)
      .eq("user_id", userId)
      .single();

    if (!file) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    // Check if already in queue
    const { data: existing } = await supabase
      .from("print_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("file_id", file_id)
      .single();

    if (existing) {
      res.status(409).json({
        success: false,
        message: "File already in print queue",
      });
      return;
    }

    // Get current max order
    const { data: maxOrder } = await supabase
      .from("print_queue")
      .select("order_index")
      .eq("user_id", userId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = maxOrder ? maxOrder.order_index + 1 : 0;

    const { data: queueItem, error } = await supabase
      .from("print_queue")
      .insert({
        user_id: userId,
        file_id,
        order_index: nextOrder,
      })
      .select(`
        *,
        files (
          id,
          name,
          mime_type,
          size,
          extension
        )
      `)
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to add to print queue",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "added_to_print_queue",
      item_type: "file",
      item_id: String(file_id),
      item_name: String(file.name),
    });

    res.status(201).json({
      success: true,
      message: "Added to print queue",
      data: { item: queueItem },
    });
  } catch (error) {
    console.error("Add to print queue error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── REMOVE FROM PRINT QUEUE ──────────────────────────────────────────────────

export const removeFromPrintQueue = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: item } = await supabase
      .from("print_queue")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!item) {
      res.status(404).json({
        success: false,
        message: "Queue item not found",
      });
      return;
    }

    await supabase
      .from("print_queue")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    res.status(200).json({
      success: true,
      message: "Removed from print queue",
    });
  } catch (error) {
    console.error("Remove from print queue error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── REORDER PRINT QUEUE ──────────────────────────────────────────────────────

export const reorderPrintQueue = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { ordered_ids } = req.body;

    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "ordered_ids array is required",
      });
      return;
    }

    // Update order for each item
    const updates = ordered_ids.map((id: string, index: number) =>
      supabase
        .from("print_queue")
        .update({ order_index: index })
        .eq("id", id)
        .eq("user_id", userId)
    );

    await Promise.all(updates);

    res.status(200).json({
      success: true,
      message: "Print queue reordered",
    });
  } catch (error) {
    console.error("Reorder print queue error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── CLEAR PRINT QUEUE ────────────────────────────────────────────────────────

export const clearPrintQueue = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    await supabase.from("print_queue").delete().eq("user_id", userId);

    res.status(200).json({
      success: true,
      message: "Print queue cleared",
    });
  } catch (error) {
    console.error("Clear print queue error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET DOWNLOAD URLS FOR QUEUE ──────────────────────────────────────────────

export const getQueueDownloadUrls = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: queue, error } = await supabase
      .from("print_queue")
      .select(`
        order_index,
        files (
          id,
          name,
          mime_type,
          storage_path,
          size
        )
      `)
      .eq("user_id", userId)
      .order("order_index", { ascending: true });

    if (error || !queue) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch queue",
      });
      return;
    }

    // Generate signed URLs for each file
    const filesWithUrls = await Promise.all(
      queue.map(async (item: any) => {
        const file = item.files;
        if (!file) return null;

        const signedUrl = await getSignedUrl(file.storage_path, 3600);

        return {
          order_index: item.order_index,
          file_id: file.id,
          file_name: file.name,
          mime_type: file.mime_type,
          size: file.size,
          download_url: signedUrl,
        };
      })
    );

    await logActivity({
      user_id: userId,
      action: "downloaded_print_queue",
      metadata: { file_count: queue.length },
    });

    res.status(200).json({
      success: true,
      data: {
        files: filesWithUrls.filter(Boolean),
        total: filesWithUrls.length,
      },
    });
  } catch (error) {
    console.error("Get queue download urls error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── PRINT PROFILES ───────────────────────────────────────────────────────────

export const getPrintProfiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: profiles, error } = await supabase
      .from("print_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch print profiles",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { profiles },
    });
  } catch (error) {
    console.error("Get print profiles error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createPrintProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, file_ids } = req.body;

    if (!name || name.trim() === "") {
      res.status(400).json({
        success: false,
        message: "Profile name is required",
      });
      return;
    }

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one file is required",
      });
      return;
    }

    const { data: profile, error } = await supabase
      .from("print_profiles")
      .insert({
        user_id: userId,
        name: name.trim(),
        file_ids,
      })
      .select("*")
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to create print profile",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Print profile created",
      data: { profile },
    });
  } catch (error) {
    console.error("Create print profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deletePrintProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: profile } = await supabase
      .from("print_profiles")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!profile) {
      res.status(404).json({
        success: false,
        message: "Profile not found",
      });
      return;
    }

    await supabase
      .from("print_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    res.status(200).json({
      success: true,
      message: "Print profile deleted",
    });
  } catch (error) {
    console.error("Delete print profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const loadPrintProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: profile } = await supabase
      .from("print_profiles")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!profile) {
      res.status(404).json({
        success: false,
        message: "Profile not found",
      });
      return;
    }

    // Clear current queue
    await supabase.from("print_queue").delete().eq("user_id", userId);

    // Add profile files to queue
    const queueItems = profile.file_ids.map(
      (fileId: string, index: number) => ({
        user_id: userId,
        file_id: fileId,
        order_index: index,
      })
    );

    await supabase.from("print_queue").insert(queueItems);

    await logActivity({
      user_id: userId,
      action: "loaded_print_profile",
      metadata: { profile_name: profile.name },
    });

    res.status(200).json({
      success: true,
      message: `Profile "${profile.name}" loaded into print queue`,
    });
  } catch (error) {
    console.error("Load print profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};