"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatFullDate, getActionLabel } from "@/lib/utils";
import { ActivityLog } from "@/types/file.types";
import { toast } from "@/components/ui/Toast";

const ACTION_ICONS: Record<string, string> = {
  uploaded_file: "⬆️",
  deleted_file: "🗑️",
  downloaded_file: "⬇️",
  renamed_file: "✏️",
  moved_file: "📦",
  favorited_file: "⭐",
  unfavorited_file: "☆",
  created_folder: "📁",
  deleted_folder: "🗑️",
  renamed_folder: "✏️",
  moved_folder: "📦",
  favorited_folder: "⭐",
  restored_from_trash: "♻️",
  permanently_deleted: "❌",
  uploaded_new_version: "🔄",
  added_to_print_queue: "🖨️",
  downloaded_print_queue: "⬇️",
  emptied_trash: "🗑️",
  loaded_print_profile: "💾",
};

const ACTION_COLORS: Record<string, string> = {
  uploaded_file: "bg-green-50 text-green-600",
  deleted_file: "bg-red-50 text-red-600",
  downloaded_file: "bg-blue-50 text-blue-600",
  renamed_file: "bg-purple-50 text-purple-600",
  moved_file: "bg-orange-50 text-orange-600",
  favorited_file: "bg-yellow-50 text-yellow-600",
  created_folder: "bg-indigo-50 text-indigo-600",
  deleted_folder: "bg-red-50 text-red-600",
  restored_from_trash: "bg-green-50 text-green-600",
  uploaded_new_version: "bg-blue-50 text-blue-600",
  added_to_print_queue: "bg-purple-50 text-purple-600",
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    fetchLogs(0);
  }, []);

  const fetchLogs = async (currentOffset: number) => {
    if (currentOffset === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const res = await api.get(
        `/dashboard/activity?limit=${LIMIT}&offset=${currentOffset}`
      );
      const { logs: newLogs, total: totalCount } = res.data.data;

      if (currentOffset === 0) {
        setLogs(newLogs);
      } else {
        setLogs((prev) => [...prev, ...newLogs]);
      }

      setTotal(totalCount);
      setOffset(currentOffset + LIMIT);
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const hasMore = logs.length < total;

  // Group logs by date
  const groupedLogs = logs.reduce(
    (groups: Record<string, ActivityLog[]>, log) => {
      const date = new Date(log.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
      return groups;
    },
    {}
  );

  return (
    <div>
      <TopBar
        title="Activity"
        subtitle="Your complete activity history"
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {total} total activit{total !== 1 ? "ies" : "y"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 p-4 h-16 animate-pulse"
              />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📋</span>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No activity yet
            </h3>
            <p className="text-gray-400 text-sm">
              Your actions will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs font-medium text-gray-400 px-2">
                    {date}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>

                {/* Logs for this date */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {dateLogs.map((log, index) => {
                    const icon =
                      ACTION_ICONS[log.action] || "📌";
                    const colorClass =
                      ACTION_COLORS[log.action] ||
                      "bg-gray-50 text-gray-600";

                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors ${
                          index !== 0 ? "border-t border-gray-50" : ""
                        }`}
                      >
                        {/* Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                        >
                          <span className="text-sm">{icon}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">
                            <span className="font-medium">
                              {getActionLabel(log.action)}
                            </span>
                            {log.item_name && (
                              <>
                                {" "}
                                <span className="text-gray-500 truncate">
                                  {log.item_name}
                                </span>
                              </>
                            )}
                          </p>

                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">
                              {formatFullDate(log.created_at)}
                            </p>
                            {log.item_type && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  log.item_type === "folder"
                                    ? "bg-indigo-50 text-indigo-500"
                                    : "bg-blue-50 text-blue-500"
                                }`}
                              >
                                {log.item_type}
                              </span>
                            )}
                          </div>

                          {/* Metadata */}
                          {log.metadata &&
                            Object.keys(log.metadata).length > 0 && (
                              <div className="mt-1 flex gap-2 flex-wrap">
                                {log.metadata.version && (
                                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                    v{log.metadata.version}
                                  </span>
                                )}
                                {log.metadata.old_name && (
                                  <span className="text-xs text-gray-400">
                                    from: {log.metadata.old_name}
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={() => fetchLogs(offset)}
                  disabled={isLoadingMore}
                  className="px-6 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}