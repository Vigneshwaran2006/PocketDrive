"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatFileSize, formatDate, getFileIcon } from "@/lib/utils";
import { File, Folder } from "@/types/file.types";
import { toast } from "@/components/ui/Toast";

export default function FavoritesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "files" | "folders">(
    "all"
  );

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    setIsLoading(true);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        api.get("/files/favorites"),
        api.get("/folders/favorites"),
      ]);
      setFiles(filesRes.data.data.files);
      setFolders(foldersRes.data.data.folders);
    } catch {
      toast.error("Failed to load favorites");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfavoriteFile = async (id: string) => {
    try {
      await api.patch(`/files/${id}/favorite`);
      toast.success("Removed from favorites");
      fetchFavorites();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleUnfavoriteFolder = async (id: string) => {
    try {
      await api.patch(`/folders/${id}/favorite`);
      toast.success("Removed from favorites");
      fetchFavorites();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDownload = async (id: string, name: string) => {
    try {
      const res = await api.get(`/files/${id}/download`);
      const link = document.createElement("a");
      link.href = res.data.data.download_url;
      link.download = name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Download failed");
    }
  };

  const displayFolders =
    activeTab === "files" ? [] : folders;
  const displayFiles =
    activeTab === "folders" ? [] : files;
  const isEmpty = displayFiles.length === 0 && displayFolders.length === 0;

  return (
    <div>
      <TopBar
        title="Favorites"
        subtitle="Your starred files and folders"
      />

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
          {(["all", "files", "folders"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
              <span className="ml-1.5 text-xs text-gray-400">
                {tab === "all"
                  ? files.length + folders.length
                  : tab === "files"
                  ? files.length
                  : folders.length}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 p-4 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">⭐</span>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No favorites yet
            </h3>
            <p className="text-gray-400 text-sm">
              Star files and folders to find them quickly here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Favorite Folders */}
            {displayFolders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Folders ({displayFolders.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {displayFolders.map((folder) => (
                    <div
                      key={folder.id}
                      className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all group relative"
                    >
                      <button
                        onClick={() =>
                          router.push(`/folder/${folder.id}`)
                        }
                        className="w-full flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{
                            backgroundColor: `${folder.color}20`,
                          }}
                        >
                          📁
                        </div>
                        <div className="w-full text-center">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {folder.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(folder.updated_at)}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          handleUnfavoriteFolder(folder.id)
                        }
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-yellow-50 transition-all text-yellow-400"
                        title="Remove from favorites"
                      >
                        ⭐
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Favorite Files */}
            {displayFiles.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Files ({displayFiles.length})
                </h3>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {displayFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors group ${
                        index !== 0 ? "border-t border-gray-50" : ""
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                        {getFileIcon(file.mime_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)} •{" "}
                          {formatDate(file.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            handleDownload(file.id, file.name)
                          }
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          ⬇️
                        </button>
                        <button
                          onClick={() => handleUnfavoriteFile(file.id)}
                          className="p-2 text-yellow-400 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="Remove from favorites"
                        >
                          ⭐
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}