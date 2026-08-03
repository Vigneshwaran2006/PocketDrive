"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatFileSize, getFileIcon } from "@/lib/utils";
import { PrintQueueItem, PrintProfile } from "@/types/file.types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";

export default function PrintQueuePage() {
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [profiles, setProfiles] = useState<PrintProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [activeTab, setActiveTab] = useState<"queue" | "profiles">("queue");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [queueRes, profilesRes] = await Promise.all([
        api.get("/print-queue"),
        api.get("/print-queue/profiles"),
      ]);
      setQueue(queueRes.data.data.queue);
      setProfiles(profilesRes.data.data.profiles);
    } catch {
      toast.error("Failed to load print queue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.delete(`/print-queue/${id}`);
      setQueue(queue.filter((item) => item.id !== id));
      toast.success("Removed from queue");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all items from print queue?")) return;

    try {
      await api.delete("/print-queue/clear");
      setQueue([]);
      toast.success("Print queue cleared");
    } catch {
      toast.error("Failed to clear queue");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newQueue = [...queue];
    [newQueue[index - 1], newQueue[index]] = [
      newQueue[index],
      newQueue[index - 1],
    ];
    setQueue(newQueue);
    await saveOrder(newQueue);
  };

  const handleMoveDown = async (index: number) => {
    if (index === queue.length - 1) return;
    const newQueue = [...queue];
    [newQueue[index], newQueue[index + 1]] = [
      newQueue[index + 1],
      newQueue[index],
    ];
    setQueue(newQueue);
    await saveOrder(newQueue);
  };

  const saveOrder = async (newQueue: PrintQueueItem[]) => {
    try {
      await api.patch("/print-queue/reorder", {
        ordered_ids: newQueue.map((item) => item.id),
      });
    } catch {
      toast.error("Failed to save order");
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get("/print-queue/download");
      const files = res.data.data.files;

      if (files.length === 0) {
        toast.error("No files in queue");
        return;
      }

      // Download each file
      for (const file of files) {
        const link = document.createElement("a");
        link.href = file.download_url;
        link.download = file.file_name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      toast.success(`${files.length} files downloaded`);
    } catch {
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return;

    try {
      await api.post("/print-queue/profiles", {
        name: profileName,
        file_ids: queue.map((item) => item.file_id),
      });
      toast.success("Profile saved");
      setShowSaveProfile(false);
      setProfileName("");
      fetchData();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to save profile"
      );
    }
  };

  const handleLoadProfile = async (id: string, name: string) => {
    if (
      !confirm(
        `Load profile "${name}"? This will replace your current queue.`
      )
    )
      return;

    try {
      await api.post(`/print-queue/profiles/${id}/load`);
      toast.success(`Profile "${name}" loaded`);
      fetchData();
      setActiveTab("queue");
    } catch {
      toast.error("Failed to load profile");
    }
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;

    try {
      await api.delete(`/print-queue/profiles/${id}`);
      toast.success("Profile deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete profile");
    }
  };

  const totalSize = queue.reduce(
    (sum, item) => sum + (item.files?.size || 0),
    0
  );

  return (
    <div>
      <TopBar
        title="Print Queue"
        subtitle="Arrange and download your documents"
      />

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
          {(["queue", "profiles"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "queue" ? "🖨️ Queue" : "💾 Profiles"}
              <span className="ml-1.5 text-xs text-gray-400">
                {tab === "queue" ? queue.length : profiles.length}
              </span>
            </button>
          ))}
        </div>

        {/* Queue Tab */}
        {activeTab === "queue" && (
          <>
            {/* Actions */}
            {queue.length > 0 && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Button
                  onClick={handleDownloadAll}
                  isLoading={isDownloading}
                  size="sm"
                >
                  ⬇️ Download All ({queue.length})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveProfile(true)}
                >
                  💾 Save as Profile
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClear}
                >
                  🗑️ Clear Queue
                </Button>

                <span className="text-sm text-gray-400 ml-auto">
                  Total: {formatFileSize(totalSize)}
                </span>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-100 p-4 h-20 animate-pulse"
                  />
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">🖨️</span>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Print queue is empty
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Add files from your folders to the print queue
                </p>
                <div className="bg-blue-50 rounded-xl p-4 text-left max-w-sm">
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    How to use:
                  </p>
                  <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                    <li>Go to My Files</li>
                    <li>Right-click a file</li>
                    <li>Click &quot;Print Queue&quot;</li>
                    <li>Arrange order here</li>
                    <li>Download all at once</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs text-blue-700">
                    💡 Use the arrows to arrange the order before downloading
                  </p>
                </div>

                {queue.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${
                      index !== 0 ? "border-t border-gray-50" : ""
                    }`}
                  >
                    {/* Order number */}
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {index + 1}
                    </div>

                    {/* File icon */}
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {getFileIcon(item.files?.mime_type || "")}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.files?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(item.files?.size || 0)} •{" "}
                        {item.files?.mime_type}
                      </p>
                    </div>

                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        title="Move up"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === queue.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        title="Move down"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Profiles Tab */}
        {activeTab === "profiles" && (
          <>
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">💾</span>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No saved profiles
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Save your current queue as a profile for quick access
                </p>
                <div className="bg-blue-50 rounded-xl p-4 text-left max-w-sm">
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    Example profiles:
                  </p>
                  <ul className="text-xs text-blue-600 space-y-1">
                    <li>🎓 College Admission — Resume, Marksheet, Certificate</li>
                    <li>💼 Job Application — Resume, ID Proof, Certificates</li>
                    <li>🏥 Medical — Insurance, Reports, ID</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {profile.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {profile.file_ids.length} file
                          {profile.file_ids.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleDeleteProfile(profile.id, profile.name)
                        }
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        🗑️
                      </button>
                    </div>

                    <Button
                      onClick={() =>
                        handleLoadProfile(profile.id, profile.name)
                      }
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      📂 Load Profile
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Save Profile Modal */}
      <Modal
        isOpen={showSaveProfile}
        onClose={() => {
          setShowSaveProfile(false);
          setProfileName("");
        }}
        title="Save as Profile"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Profile Name"
            placeholder="e.g. College Admission, Job Application"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
            autoFocus
            hint={`${queue.length} file${queue.length !== 1 ? "s" : ""} will be saved`}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveProfile(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              className="flex-1"
              disabled={!profileName.trim()}
            >
              Save Profile
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}