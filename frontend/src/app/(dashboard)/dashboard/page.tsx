"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatFileSize, formatDate, getFileIcon } from "@/lib/utils";
import { File, Folder, DashboardStats, StorageBreakdown, ActivityLog } from "@/types/file.types";

interface DashboardData {
  user: any;
  stats: DashboardStats;
  recent_files: File[];
  recent_folders: Folder[];
  favorite_files: File[];
  favorite_folders: Folder[];
  pinned_files: File[];
  recent_activity: ActivityLog[];
  storage_breakdown: StorageBreakdown[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get("/dashboard");
      setData(response.data.data);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title="Dashboard" />
        <div className="p-6">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <TopBar title="Dashboard" subtitle={`Welcome back, ${data.user?.full_name}`} />

      <div className="p-6 flex flex-col gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon="📄"
            label="Total Files"
            value={data.stats.total_files.toString()}
            color="blue"
          />
          <StatCard
            icon="📁"
            label="Total Folders"
            value={data.stats.total_folders.toString()}
            color="indigo"
          />
          <StatCard
            icon="💾"
            label="Storage Used"
            value={formatFileSize(data.stats.storage_used)}
            sub={`${data.stats.storage_percentage}% of 5 GB`}
            color="green"
          />
          <StatCard
            icon="🗑️"
            label="In Trash"
            value={data.stats.trash_count.toString()}
            color="red"
          />
        </div>

        {/* Storage Bar */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Storage Breakdown
            </h3>
            <Link
              href="/activity"
              className="text-xs text-blue-600 hover:underline"
            >
              View analytics →
            </Link>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${data.stats.storage_percentage}%` }}
            />
          </div>

          {/* Breakdown */}
          <div className="flex flex-wrap gap-3">
            {data.storage_breakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-gray-600">
                  {item.label}{" "}
                  <span className="text-gray-400">
                    ({item.percentage}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Files */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Recent Files
              </h3>
              <Link
                href="/folder/root"
                className="text-xs text-blue-600 hover:underline"
              >
                View all →
              </Link>
            </div>

            {data.recent_files.length === 0 ? (
              <EmptyState
                icon="📄"
                message="No files yet. Upload your first file!"
              />
            ) : (
              <div className="flex flex-col gap-1">
                {data.recent_files.slice(0, 8).map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-xl flex-shrink-0">
                      {getFileIcon(file.mime_type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(file.size)} •{" "}
                        {formatDate(file.updated_at)}
                      </p>
                    </div>
                    {file.is_favorited && (
                      <span className="text-yellow-400 text-xs">⭐</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Recent Activity
              </h3>
              <Link
                href="/activity"
                className="text-xs text-blue-600 hover:underline"
              >
                View all →
              </Link>
            </div>

            {data.recent_activity.length === 0 ? (
              <EmptyState icon="📋" message="No activity yet" />
            ) : (
              <div className="flex flex-col gap-3">
                {data.recent_activity.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs">
                        {getActivityIcon(log.action)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        <span className="font-medium">
                          {getActivityLabel(log.action)}
                        </span>{" "}
                        {log.item_name && (
                          <span className="text-gray-500 truncate">
                            {log.item_name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Favorites */}
        {(data.favorite_files.length > 0 ||
          data.favorite_folders.length > 0) && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                ⭐ Favorites
              </h3>
              <Link
                href="/favorites"
                className="text-xs text-blue-600 hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...data.favorite_folders, ...data.favorite_files]
                .slice(0, 6)
                .map((item: any) => (
                  <div
                    key={item.id}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors text-center"
                  >
                    <span className="text-2xl">
                      {item.mime_type
                        ? getFileIcon(item.mime_type)
                        : "📁"}
                    </span>
                    <p className="text-xs text-gray-700 font-medium truncate w-full">
                      {item.name}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recent Folders */}
        {data.recent_folders.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Recent Folders
              </h3>
              <Link
                href="/folder/root"
                className="text-xs text-blue-600 hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.recent_folders.slice(0, 6).map((folder) => (
                <Link
                  key={folder.id}
                  href={`/folder/${folder.id}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors text-center"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${folder.color}20` }}
                  >
                    📁
                  </div>
                  <p className="text-xs text-gray-700 font-medium truncate w-full">
                    {folder.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(folder.updated_at)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub Components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "indigo" | "green" | "red";
}) {
  const colors = {
    blue: "bg-blue-50",
    indigo: "bg-indigo-50",
    green: "bg-green-50",
    red: "bg-red-50",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div
        className={`w-9 h-9 ${colors[color]} rounded-lg flex items-center justify-center mb-3`}
      >
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-28" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5 h-32" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 h-64" />
        <div className="bg-white rounded-xl border border-gray-100 p-5 h-64" />
      </div>
    </div>
  );
}

function getActivityIcon(action: string): string {
  const icons: Record<string, string> = {
    uploaded_file: "⬆️",
    deleted_file: "🗑️",
    downloaded_file: "⬇️",
    renamed_file: "✏️",
    moved_file: "📦",
    favorited_file: "⭐",
    created_folder: "📁",
    deleted_folder: "🗑️",
    restored_from_trash: "♻️",
    added_to_print_queue: "🖨️",
    uploaded_new_version: "🔄",
  };
  return icons[action] || "📌";
}

function getActivityLabel(action: string): string {
  const labels: Record<string, string> = {
    uploaded_file: "Uploaded",
    deleted_file: "Deleted",
    downloaded_file: "Downloaded",
    renamed_file: "Renamed",
    moved_file: "Moved",
    favorited_file: "Starred",
    unfavorited_file: "Unstarred",
    created_folder: "Created folder",
    deleted_folder: "Deleted folder",
    restored_from_trash: "Restored",
    added_to_print_queue: "Added to print queue",
    uploaded_new_version: "New version uploaded",
    emptied_trash: "Emptied trash",
  };
  return labels[action] || action;
}