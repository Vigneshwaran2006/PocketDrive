import { Response } from "express";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { logActivity } from "../utils/activity.utils";

// ─── CREATE FOLDER ────────────────────────────────────────────────────────────

export const createFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, parent_id, color } = req.body;

    if (!name || name.trim() === "") {
      res.status(400).json({
        success: false,
        message: "Folder name is required",
      });
      return;
    }

    const trimmedName = name.trim();

    if (parent_id) {
      const { data: parentFolder } = await supabase
        .from("folders")
        .select("id")
        .eq("id", parent_id)
        .eq("user_id", userId)
        .single();

      if (!parentFolder) {
        res.status(404).json({
          success: false,
          message: "Parent folder not found",
        });
        return;
      }
    }

    // Check duplicate - use plain select (not single/maybeSingle)
    let existingQuery = supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .eq("name", trimmedName);

    if (parent_id) {
      existingQuery = existingQuery.eq("parent_id", parent_id);
    } else {
      existingQuery = existingQuery.is("parent_id", null);
    }

    const { data: existingFolders, error: existingError } = await existingQuery;

    if (existingError) {
      console.error("Duplicate check error:", existingError);
      res.status(500).json({
        success: false,
        message: "Failed to check duplicates",
      });
      return;
    }

    if (existingFolders && existingFolders.length > 0) {
      res.status(409).json({
        success: false,
        message: "A folder with this name already exists here",
      });
      return;
    }

    const { data: folder, error } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        parent_id: parent_id || null,
        name: trimmedName,
        color: color || "#6366f1",
      })
      .select("*")
      .single();

    if (error || !folder) {
      res.status(500).json({
        success: false,
        message: "Failed to create folder",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "created_folder",
      item_type: "folder",
      item_id: String(folder.id),
      item_name: String(folder.name),
    });

    res.status(201).json({
      success: true,
      message: "Folder created successfully",
      data: { folder },
    });
  } catch (error) {
    console.error("Create folder error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FOLDERS ──────────────────────────────────────────────────────────────

export const getFolders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { parent_id } = req.query;

    let query = supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("name", { ascending: true });

    if (parent_id === "root" || !parent_id) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", parent_id as string);
    }

    const { data: folders, error } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch folders",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { folders },
    });
  } catch (error) {
    console.error("Get folders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FOLDER BY ID ─────────────────────────────────────────────────────────

export const getFolderById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: folder, error } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !folder) {
      res.status(404).json({
        success: false,
        message: "Folder not found",
      });
      return;
    }

    const breadcrumb = await buildBreadcrumb(folder.id, userId);

    res.status(200).json({
      success: true,
      data: { folder, breadcrumb },
    });
  } catch (error) {
    console.error("Get folder by id error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── RENAME FOLDER ────────────────────────────────────────────────────────────

export const renameFolder = async (
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
        message: "Folder name is required",
      });
      return;
    }

    const trimmedName = name.trim();

    const { data: folder } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!folder) {
      res.status(404).json({
        success: false,
        message: "Folder not found",
      });
      return;
    }

    // Check duplicate
    let existingQuery = supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .eq("name", trimmedName)
      .neq("id", id);

    if (folder.parent_id) {
      existingQuery = existingQuery.eq("parent_id", folder.parent_id);
    } else {
      existingQuery = existingQuery.is("parent_id", null);
    }

    const { data: existingFolders } = await existingQuery;

    if (existingFolders && existingFolders.length > 0) {
      res.status(409).json({
        success: false,
        message: "A folder with this name already exists here",
      });
      return;
    }

    const { data: updated, error } = await supabase
      .from("folders")
      .update({
        name: trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to rename folder",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "renamed_folder",
      item_type: "folder",
      item_id: id,
      item_name: trimmedName,
      metadata: { old_name: String(folder.name) },
    });

    res.status(200).json({
      success: true,
      message: "Folder renamed successfully",
      data: { folder: updated },
    });
  } catch (error) {
    console.error("Rename folder error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── DELETE FOLDER (Recursive) ────────────────────────────────────────────────

export const deleteFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: folder } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!folder) {
      res.status(404).json({
        success: false,
        message: "Folder not found",
      });
      return;
    }

    // Get ALL descendant folders (recursively)
    const allFolderIds = await getAllDescendantFolderIds(id, userId);
    allFolderIds.push(id); // include the folder itself

    // Get ALL files inside these folders
    const { data: allFiles } = await supabase
      .from("files")
      .select("*")
      .in("folder_id", allFolderIds)
      .eq("user_id", userId);

    // Get ALL folders (including descendants)
    const { data: allFolders } = await supabase
      .from("folders")
      .select("*")
      .in("id", allFolderIds)
      .eq("user_id", userId);

    // Bundle everything as one trash item with all contents
    const trashData = {
      folder: folder,
      all_folders: allFolders || [],
      all_files: allFiles || [],
    };

    // Insert single trash entry containing everything
    await supabase.from("trash").insert({
      user_id: userId,
      item_id: folder.id,
      item_type: "folder",
      item_name: folder.name,
      item_data: trashData,
    });

    // Delete all files from files table
    if (allFiles && allFiles.length > 0) {
      const fileIds = allFiles.map((f) => f.id);
      await supabase
        .from("files")
        .delete()
        .in("id", fileIds)
        .eq("user_id", userId);

      // Update storage used
      const totalSize = allFiles.reduce(
        (sum: number, f: any) => sum + f.size,
        0
      );
      await import("../utils/storage.utils").then(({ updateStorageUsed }) =>
        updateStorageUsed(userId, -totalSize)
      );
    }

    // Delete all folders from folders table
    await supabase
      .from("folders")
      .delete()
      .in("id", allFolderIds)
      .eq("user_id", userId);

    await logActivity({
      user_id: userId,
      action: "deleted_folder",
      item_type: "folder",
      item_id: id,
      item_name: String(folder.name),
      metadata: {
        subfolder_count: (allFolders?.length || 1) - 1,
        file_count: allFiles?.length || 0,
      },
    });

    res.status(200).json({
      success: true,
      message: `Folder moved to trash with ${
        allFolders?.length || 1
      } folder(s) and ${allFiles?.length || 0} file(s)`,
    });
  } catch (error) {
    console.error("Delete folder error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Helper: Get all descendant folder IDs recursively
const getAllDescendantFolderIds = async (
  folderId: string,
  userId: string
): Promise<string[]> => {
  const ids: string[] = [];

  const { data: children } = await supabase
    .from("folders")
    .select("id")
    .eq("parent_id", folderId)
    .eq("user_id", userId);

  if (!children || children.length === 0) return ids;

  for (const child of children) {
    ids.push(child.id);
    const descendants = await getAllDescendantFolderIds(child.id, userId);
    ids.push(...descendants);
  }

  return ids;
};

// ─── MOVE FOLDER ──────────────────────────────────────────────────────────────

export const moveFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const { target_parent_id } = req.body;

    if (target_parent_id === id) {
      res.status(400).json({
        success: false,
        message: "Cannot move folder into itself",
      });
      return;
    }

    const { data: folder } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!folder) {
      res.status(404).json({
        success: false,
        message: "Folder not found",
      });
      return;
    }

    if (target_parent_id) {
      const { data: targetFolder } = await supabase
        .from("folders")
        .select("id")
        .eq("id", target_parent_id)
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
      .from("folders")
      .update({
        parent_id: target_parent_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to move folder",
      });
      return;
    }

    await logActivity({
      user_id: userId,
      action: "moved_folder",
      item_type: "folder",
      item_id: id,
      item_name: String(folder.name),
    });

    res.status(200).json({
      success: true,
      message: "Folder moved successfully",
      data: { folder: updated },
    });
  } catch (error) {
    console.error("Move folder error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── TOGGLE FAVORITE ─────────────────────────────────────────────────────────

export const toggleFavoriteFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: folder } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!folder) {
      res.status(404).json({
        success: false,
        message: "Folder not found",
      });
      return;
    }

    const { data: updated } = await supabase
      .from("folders")
      .update({
        is_favorited: !folder.is_favorited,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    await logActivity({
      user_id: userId,
      action: folder.is_favorited ? "unfavorited_folder" : "favorited_folder",
      item_type: "folder",
      item_id: id,
      item_name: String(folder.name),
    });

    res.status(200).json({
      success: true,
      message: folder.is_favorited
        ? "Removed from favorites"
        : "Added to favorites",
      data: { folder: updated },
    });
  } catch (error) {
    console.error("Toggle favorite folder error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── TOGGLE PIN ───────────────────────────────────────────────────────────────

export const togglePinFolder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);

    const { data: folder } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!folder) {
      res.status(404).json({
        success: false,
        message: "Folder not found",
      });
      return;
    }

    const { data: updated } = await supabase
      .from("folders")
      .update({
        is_pinned: !folder.is_pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    res.status(200).json({
      success: true,
      message: folder.is_pinned ? "Unpinned" : "Pinned",
      data: { folder: updated },
    });
  } catch (error) {
    console.error("Toggle pin folder error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── GET FAVORITES ────────────────────────────────────────────────────────────

export const getFavoriteFolders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: folders, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_favorited", true)
      .order("updated_at", { ascending: false });

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch favorite folders",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { folders },
    });
  } catch (error) {
    console.error("Get favorite folders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── BULK DELETE FOLDERS (Recursive) ──────────────────────────────────────────

export const bulkDeleteFolders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { folder_ids } = req.body;

    if (!Array.isArray(folder_ids) || folder_ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "folder_ids array is required",
      });
      return;
    }

    let totalDeletedFolders = 0;
    let totalDeletedFiles = 0;

    for (const folderId of folder_ids) {
      const { data: folder } = await supabase
        .from("folders")
        .select("*")
        .eq("id", folderId)
        .eq("user_id", userId)
        .single();

      if (!folder) continue;

      // Get all descendant folders
      const allFolderIds = await getAllDescendantFolderIds(folderId, userId);
      allFolderIds.push(folderId);

      // Get all files
      const { data: allFiles } = await supabase
        .from("files")
        .select("*")
        .in("folder_id", allFolderIds)
        .eq("user_id", userId);

      // Get all folders
      const { data: allFolders } = await supabase
        .from("folders")
        .select("*")
        .in("id", allFolderIds)
        .eq("user_id", userId);

      const trashData = {
        folder: folder,
        all_folders: allFolders || [],
        all_files: allFiles || [],
      };

      await supabase.from("trash").insert({
        user_id: userId,
        item_id: folder.id,
        item_type: "folder",
        item_name: folder.name,
        item_data: trashData,
      });

      // Delete files
      if (allFiles && allFiles.length > 0) {
        const fileIds = allFiles.map((f) => f.id);
        await supabase
          .from("files")
          .delete()
          .in("id", fileIds)
          .eq("user_id", userId);

        const totalSize = allFiles.reduce(
          (sum: number, f: any) => sum + f.size,
          0
        );
        await import("../utils/storage.utils").then(({ updateStorageUsed }) =>
          updateStorageUsed(userId, -totalSize)
        );

        totalDeletedFiles += allFiles.length;
      }

      // Delete folders
      await supabase
        .from("folders")
        .delete()
        .in("id", allFolderIds)
        .eq("user_id", userId);

      totalDeletedFolders += allFolders?.length || 1;
    }

    await logActivity({
      user_id: userId,
      action: "bulk_deleted_folders",
      metadata: {
        folder_count: totalDeletedFolders,
        file_count: totalDeletedFiles,
      },
    });

    res.status(200).json({
      success: true,
      message: `${totalDeletedFolders} folder(s) and ${totalDeletedFiles} file(s) moved to trash`,
    });
  } catch (error) {
    console.error("Bulk delete folders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── HELPER: BUILD BREADCRUMB ─────────────────────────────────────────────────

interface BreadcrumbFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

const buildBreadcrumb = async (
  folderId: string,
  userId: string
): Promise<Array<{ id: string; name: string }>> => {
  const breadcrumb: Array<{ id: string; name: string }> = [];

  let currentId: string | null = folderId;

  while (currentId) {
    const { data } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .eq("user_id", userId)
      .single();

    if (!data) break;

    const folder = data as BreadcrumbFolder;

    breadcrumb.unshift({
      id: String(folder.id),
      name: String(folder.name),
    });

    currentId = folder.parent_id ? String(folder.parent_id) : null;
  }

  return breadcrumb;
};