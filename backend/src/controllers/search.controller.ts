import { Response } from "express";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const search = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const {
      q,
      type,
      folder_id,
      extension,
      tags,
      min_size,
      max_size,
      from_date,
      to_date,
      is_favorited,
    } = req.query;

    if (!q || String(q).trim() === "") {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const searchTerm = String(q).trim();

    // ── Search Files ────────────────────────────────────────────────────────

    let fileQuery = supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", `%${searchTerm}%`);

    if (folder_id) {
      fileQuery = fileQuery.eq("folder_id", String(folder_id));
    }

    if (extension) {
      fileQuery = fileQuery.eq(
        "extension",
        `.${String(extension).toLowerCase()}`
      );
    }

    if (tags) {
      const tagArray = String(tags)
        .split(",")
        .map((t) => t.trim());
      fileQuery = fileQuery.overlaps("tags", tagArray);
    }

    if (min_size) {
      fileQuery = fileQuery.gte("size", Number(min_size));
    }

    if (max_size) {
      fileQuery = fileQuery.lte("size", Number(max_size));
    }

    if (from_date) {
      fileQuery = fileQuery.gte("created_at", String(from_date));
    }

    if (to_date) {
      fileQuery = fileQuery.lte("created_at", String(to_date));
    }

    if (is_favorited === "true") {
      fileQuery = fileQuery.eq("is_favorited", true);
    }

    // ── Search Folders ──────────────────────────────────────────────────────

    let folderQuery = supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", `%${searchTerm}%`);

    if (is_favorited === "true") {
      folderQuery = folderQuery.eq("is_favorited", true);
    }

    // Run both queries
    const [filesResult, foldersResult] = await Promise.all([
      type === "folder" ? Promise.resolve({ data: [], error: null }) : fileQuery,
      type === "file" ? Promise.resolve({ data: [], error: null }) : folderQuery,
    ]);

    if (filesResult.error || foldersResult.error) {
      res.status(500).json({
        success: false,
        message: "Search failed",
      });
      return;
    }

    const files = filesResult.data || [];
    const folders = foldersResult.data || [];

    res.status(200).json({
      success: true,
      data: {
        files,
        folders,
        total: files.length + folders.length,
        query: searchTerm,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};