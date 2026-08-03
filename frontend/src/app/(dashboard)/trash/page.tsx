"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, getFileIcon } from "@/lib/utils";
import { TrashItem } from "@/types/file.types";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmptying, setIsEmptying] = useState(false);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/trash");
      setItems(res.data.data.trash);
    } catch {
      toast.error("Failed to load trash");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string, name: string) => {
    try {
      await api.post(`/trash/${id}/restore`);
      toast.success(`"${name}" restored`);
      fetchTrash();
    } catch {
      toast.error("Restore failed");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`))
      return;

    try {
      await api.delete(`/trash/${id}`);
      toast.success("Permanently deleted");
      fetchTrash();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleEmptyTrash = async () => {
    if (
      !confirm(
        "Permanently delete all items in trash? This cannot be undone."
      )
    )
      return;

    setIsEmptying(true);
    try {
      await api.delete("/trash/empty");
      toast.success("Trash emptied");
      setItems([]);
    } catch {
      toast.error("Failed to empty trash");
    } finally {
      setIsEmptying(false);
    }
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff =
      new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div>
      <TopBar
        title="Trash"
        subtitle="Items are deleted after 30 days"
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {items.length} item{items.length !== 1 ? "s" : ""} in trash
          </p>
          {items.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleEmptyTrash}
              isLoading={isEmptying}
            >
              🗑️ Empty Trash
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 p-4 h-16 animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🗑️</span>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Trash is empty
            </h3>
            <p className="text-gray-400 text-sm">
              Deleted files and folders will appear here
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Info banner */}
            <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
              <p className="text-xs text-yellow-700">
                ⚠️ Items in trash are automatically deleted after 30 days.
                Restore them before they expire.
              </p>
            </div>

            {items.map((item, index) => {
              const daysLeft = getDaysLeft(item.expires_at);
              const isExpiringSoon = daysLeft <= 3;

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors group ${
                    index !== 0 ? "border-t border-gray-50" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {item.item_type === "folder"
                      ? "📁"
                      : getFileIcon(
                          (item.item_data as any).mime_type || ""
                        )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.item_name}
                      </p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          item.item_type === "folder"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {item.item_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Deleted {formatDate(item.deleted_at)} •{" "}
                      <span
                        className={
                          isExpiringSoon
                            ? "text-red-500 font-medium"
                            : ""
                        }
                      >
                        {daysLeft <= 0
                          ? "Expiring today"
                          : `${daysLeft} day${
                              daysLeft !== 1 ? "s" : ""
                            } left`}
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() =>
                        handleRestore(item.id, item.item_name)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      ♻️ Restore
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(item.id, item.item_name)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}