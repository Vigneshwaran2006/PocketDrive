"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, getFileIcon } from "@/lib/utils";
import { TrashItem } from "@/types/file.types";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { confirm } from "@/components/ui/ConfirmDialog";
import { withLoading } from "@/components/ui/LoadingOverlay";

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmptying, setIsEmptying] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

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

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === items.length) {
      setSelected([]);
    } else {
      setSelected(items.map((i) => i.id));
    }
  };

  const clearSelection = () => {
    setSelected([]);
    setSelectionMode(false);
  };

  const handleRestore = async (id: string, name: string) => {
    try {
      await withLoading(
        () => api.post(`/trash/${id}/restore`),
        `Restoring "${name}"...`
      );
      toast.success(`"${name}" restored`);
      fetchTrash();
    } catch {
      toast.error("Restore failed");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Permanently Delete?",
      message: `"${name}" will be permanently deleted. This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete Permanently",
    });

    if (!ok) return;

    try {
      await withLoading(
        () => api.delete(`/trash/${id}`),
        `Permanently deleting "${name}"...`
      );
      toast.success("Permanently deleted");
      fetchTrash();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleBulkRestore = async () => {
    if (selected.length === 0) return;

    try {
      await withLoading(
        () => api.post("/trash/bulk-restore", { trash_ids: selected }),
        `Restoring ${selected.length} item(s)...`
      );
      toast.success(`${selected.length} item(s) restored`);
      clearSelection();
      fetchTrash();
    } catch {
      toast.error("Failed to restore items");
    }
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;

    const ok = await confirm({
      title: "Permanently Delete?",
      message: `${selected.length} item${selected.length !== 1 ? "s" : ""
        } will be permanently deleted. This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete Permanently",
    });

    if (!ok) return;

    try {
      await withLoading(
        () => api.post("/trash/bulk-delete", { trash_ids: selected }),
        `Deleting ${selected.length} item(s)...`
      );
      toast.success(`${selected.length} item(s) permanently deleted`);
      clearSelection();
      fetchTrash();
    } catch {
      toast.error("Failed to delete items");
    }
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm({
      title: "Empty Trash?",
      message: `All ${items.length} item${items.length !== 1 ? "s" : ""
        } will be permanently deleted. This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Empty Trash",
    });

    if (!ok) return;

    setIsEmptying(true);
    try {
      await withLoading(
        () => api.delete("/trash/empty"),
        "Emptying trash..."
      );
      toast.success("Trash emptied");
      setItems([]);
    } catch {
      toast.error("Failed to empty trash");
    } finally {
      setIsEmptying(false);
    }
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      <TopBar title="Trash" subtitle="Items are deleted after 30 days" />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            {items.length} item{items.length !== 1 ? "s" : ""} in trash
          </p>
          {items.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectionMode ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) clearSelection();
                }}
              >
                {selectionMode ? "✓ Selecting" : "☐ Select"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleEmptyTrash}
                isLoading={isEmptying}
              >
                🗑️ Empty Trash
              </Button>
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div className="bg-blue-600 text-white rounded-xl p-3 mb-4 flex items-center justify-between shadow-lg sticky top-16 z-10 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={clearSelection}
                className="p-1 hover:bg-blue-700 rounded"
              >
                ✕
              </button>
              <span className="text-sm font-medium">
                {selected.length} of {items.length} selected
              </span>
              <button
                onClick={selectAll}
                className="text-xs underline hover:text-blue-100"
              >
                {selected.length === items.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
              >
                ♻️ Restore
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        )}

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
            <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
              <p className="text-xs text-yellow-700">
                ⚠️ Items in trash are automatically deleted after 30 days.
                Restore them before they expire.
              </p>
            </div>

            {items.map((item, index) => {
              const daysLeft = getDaysLeft(item.expires_at);
              const isExpiringSoon = daysLeft <= 3;
              const isSelected = selected.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-4 transition-colors group cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    } ${index !== 0 ? "border-t border-gray-50" : ""}`}
                  onClick={() => selectionMode && toggleSelect(item.id)}
                >
                  {selectionMode && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-300"
                        }`}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  )}

                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {item.item_type === "folder"
                      ? "📁"
                      : getFileIcon(
                        (item.item_data as any).mime_type || ""
                      )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.item_name}
                      </p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.item_type === "folder"
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
                          isExpiringSoon ? "text-red-500 font-medium" : ""
                        }
                      >
                        {daysLeft <= 0
                          ? "Expiring today"
                          : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                      </span>
                    </p>
                  </div>

                  {!selectionMode && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(item.id, item.item_name);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        ♻️ Restore
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id, item.item_name);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}