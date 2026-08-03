import { Response } from "express";
import supabase from "../config/supabase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const TOTAL_STORAGE = 5 * 1024 * 1024 * 1024; // 5GB

export const getDashboard = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Run all queries in parallel
    const [
      userResult,
      recentFilesResult,
      recentFoldersResult,
      favoriteFoldersResult,
      favoriteFilesResult,
      pinnedFilesResult,
      pinnedFoldersResult,
      trashCountResult,
      activityResult,
      storageBreakdownResult,
    ] = await Promise.all([
      // User info
      supabase
        .from("users")
        .select("id, email, full_name, avatar_url, storage_used, created_at")
        .eq("id", userId)
        .single(),

      // Recent files
      supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(10),

      // Recent folders
      supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(6),

      // Favorite folders
      supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .eq("is_favorited", true)
        .order("updated_at", { ascending: false })
        .limit(6),

      // Favorite files
      supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .eq("is_favorited", true)
        .order("updated_at", { ascending: false })
        .limit(6),

      // Pinned files
      supabase
        .from("files")
        .select("*")
        .eq("user_id", userId)
        .eq("is_pinned", true)
        .order("updated_at", { ascending: false }),

      // Pinned folders
      supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .eq("is_pinned", true)
        .order("updated_at", { ascending: false }),

      // Trash count
      supabase
        .from("trash")
        .select("id", { count: "exact" })
        .eq("user_id", userId),

      // Recent activity
      supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),

      // Storage breakdown by mime type
      supabase
        .from("files")
        .select("mime_type, size")
        .eq("user_id", userId),
    ]);

    // Calculate storage breakdown
    const storageBreakdown = calculateStorageBreakdown(
      storageBreakdownResult.data || []
    );

    // Get total file and folder counts
    const [fileCountResult, folderCountResult] = await Promise.all([
      supabase
        .from("files")
        .select("id", { count: "exact" })
        .eq("user_id", userId),
      supabase
        .from("folders")
        .select("id", { count: "exact" })
        .eq("user_id", userId),
    ]);

    const user = userResult.data;
    const storageUsed = user?.storage_used || 0;
    const storagePercentage = Math.min(
      (storageUsed / TOTAL_STORAGE) * 100,
      100
    );

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          total_files: fileCountResult.count || 0,
          total_folders: folderCountResult.count || 0,
          trash_count: trashCountResult.count || 0,
          storage_used: storageUsed,
          storage_total: TOTAL_STORAGE,
          storage_percentage: Math.round(storagePercentage * 100) / 100,
        },
        recent_files: recentFilesResult.data || [],
        recent_folders: recentFoldersResult.data || [],
        favorite_folders: favoriteFoldersResult.data || [],
        favorite_files: favoriteFilesResult.data || [],
        pinned_files: pinnedFilesResult.data || [],
        pinned_folders: pinnedFoldersResult.data || [],
        recent_activity: activityResult.data || [],
        storage_breakdown: storageBreakdown,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── STORAGE ANALYTICS ────────────────────────────────────────────────────────

export const getStorageAnalytics = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const { data: files, error } = await supabase
      .from("files")
      .select("mime_type, size, created_at, extension")
      .eq("user_id", userId);

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch storage analytics",
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("storage_used")
      .eq("id", userId)
      .single();

    const breakdown = calculateStorageBreakdown(files || []);
    const storageUsed = user?.storage_used || 0;

    // Group by extension
    const byExtension: Record<string, { count: number; size: number }> = {};
    for (const file of files || []) {
      const ext = file.extension || "unknown";
      if (!byExtension[ext]) {
        byExtension[ext] = { count: 0, size: 0 };
      }
      byExtension[ext].count += 1;
      byExtension[ext].size += file.size;
    }

    // Upload trend (last 7 days)
    const trend = calculateUploadTrend(files || []);

    res.status(200).json({
      success: true,
      data: {
        storage_used: storageUsed,
        storage_total: TOTAL_STORAGE,
        storage_percentage:
          Math.round((storageUsed / TOTAL_STORAGE) * 10000) / 100,
        breakdown,
        by_extension: byExtension,
        upload_trend: trend,
        total_files: files?.length || 0,
      },
    });
  } catch (error) {
    console.error("Storage analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────

export const getActivityLogs = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const { data: logs, error, count } = await supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch activity logs",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        logs,
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Activity logs error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

interface FileRecord {
  mime_type: string;
  size: number;
  created_at?: string;
  extension?: string;
}

interface StorageCategory {
  label: string;
  size: number;
  count: number;
  percentage: number;
  color: string;
}

const calculateStorageBreakdown = (
  files: FileRecord[]
): StorageCategory[] => {
  const categories: Record<
    string,
    { label: string; size: number; count: number; color: string }
  > = {
    pdf: { label: "PDFs", size: 0, count: 0, color: "#ef4444" },
    image: { label: "Images", size: 0, count: 0, color: "#3b82f6" },
    document: { label: "Documents", size: 0, count: 0, color: "#8b5cf6" },
    spreadsheet: { label: "Spreadsheets", size: 0, count: 0, color: "#10b981" },
    presentation: {
      label: "Presentations",
      size: 0,
      count: 0,
      color: "#f59e0b",
    },
    other: { label: "Others", size: 0, count: 0, color: "#6b7280" },
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  for (const file of files) {
    const mime = file.mime_type;

    if (mime === "application/pdf") {
      categories.pdf.size += file.size;
      categories.pdf.count += 1;
    } else if (mime.startsWith("image/")) {
      categories.image.size += file.size;
      categories.image.count += 1;
    } else if (
      mime.includes("word") ||
      mime === "text/plain" ||
      mime === "text/csv"
    ) {
      categories.document.size += file.size;
      categories.document.count += 1;
    } else if (mime.includes("sheet") || mime.includes("excel")) {
      categories.spreadsheet.size += file.size;
      categories.spreadsheet.count += 1;
    } else if (mime.includes("presentation") || mime.includes("powerpoint")) {
      categories.presentation.size += file.size;
      categories.presentation.count += 1;
    } else {
      categories.other.size += file.size;
      categories.other.count += 1;
    }
  }

  return Object.values(categories)
    .map((cat) => ({
      ...cat,
      percentage:
        totalSize > 0
          ? Math.round((cat.size / totalSize) * 10000) / 100
          : 0,
    }))
    .filter((cat) => cat.count > 0);
};

const calculateUploadTrend = (
  files: FileRecord[]
): Array<{ date: string; count: number; size: number }> => {
  const trend: Record<string, { count: number; size: number }> = {};

  // Last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    trend[dateStr] = { count: 0, size: 0 };
  }

  for (const file of files) {
    if (!file.created_at) continue;
    const dateStr = file.created_at.split("T")[0];
    if (trend[dateStr]) {
      trend[dateStr].count += 1;
      trend[dateStr].size += file.size;
    }
  }

  return Object.entries(trend).map(([date, data]) => ({
    date,
    count: data.count,
    size: data.size,
  }));
};