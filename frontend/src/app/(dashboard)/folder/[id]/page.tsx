"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useAppStore } from "@/store/app.store";
import {
  formatFileSize,
  formatDate,
  getFileIcon,
  isPreviewable,
} from "@/lib/utils";
import { File, Folder } from "@/types/file.types";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.id as string;
  const isRoot = folderId === "root";

  const { viewMode } = useAppStore();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");
  const [renamingItem, setRenamingItem] = useState<{
    id: string;
    name: string;
    type: "file" | "folder";
  } | null>(null);
  const [newName, setNewName] = useState("");
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    mime_type: string;
    name: string;
  } | null>(null);
  const [movingItem, setMovingItem] = useState<{
    id: string;
    type: "file" | "folder";
    name: string;
  } | null>(null);
  const [availableFolders, setAvailableFolders] = useState<Folder[]>([]);

  useEffect(() => {
    fetchContents();
  }, [folderId]);

  const fetchContents = async () => {
    setIsLoading(true);
    try {
      const queryParam = isRoot ? "root" : folderId;

      const [foldersRes, filesRes] = await Promise.all([
        api.get(`/folders?parent_id=${queryParam}`),
        api.get(`/files?folder_id=${queryParam}`),
      ]);

      setFolders(foldersRes.data.data.folders);
      setFiles(filesRes.data.data.files);

      // Get breadcrumb for non-root
      if (!isRoot) {
        const folderRes = await api.get(`/folders/${folderId}`);
        setBreadcrumb(folderRes.data.data.breadcrumb);
      } else {
        setBreadcrumb([]);
      }
    } catch (error) {
      toast.error("Failed to load contents");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Create Folder ─────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post("/folders", {
        name: newFolderName,
        parent_id: isRoot ? undefined : folderId,
        color: newFolderColor,
      });

      toast.success("Folder created");
      setShowCreateFolder(false);
      setNewFolderName("");
      fetchContents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create folder");
    }
  };

  // ── Upload File ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (!isRoot) formData.append("folder_id", folderId);

    setIsUploading(true);
    try {
      await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("File uploaded successfully");
      fetchContents();
    } catch (error: any) {
      if (error.response?.data?.code === "POSSIBLE_DUPLICATE") {
        toast.warning("A similar file already exists here");
      } else {
        toast.error(error.response?.data?.message || "Upload failed");
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Move "${name}" to trash?`)) return;

    try {
      await api.delete(`/folders/${id}`);
      toast.success("Folder moved to trash");
      fetchContents();
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  const handleDeleteFile = async (id: string, name: string) => {
    if (!confirm(`Move "${name}" to trash?`)) return;

    try {
      await api.delete(`/files/${id}`);
      toast.success("File moved to trash");
      fetchContents();
    } catch {
      toast.error("Failed to delete file");
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────

  const handleRename = async () => {
    if (!renamingItem || !newName.trim()) return;

    try {
      if (renamingItem.type === "folder") {
        await api.patch(`/folders/${renamingItem.id}/rename`, {
          name: newName,
        });
      } else {
        await api.patch(`/files/${renamingItem.id}/rename`, { name: newName });
      }

      toast.success("Renamed successfully");
      setShowRenameModal(false);
      setRenamingItem(null);
      fetchContents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Rename failed");
    }
  };

  // ── Toggle Favorite ───────────────────────────────────────────────────────

  const handleToggleFavoriteFile = async (id: string) => {
    try {
      const res = await api.patch(`/files/${id}/favorite`);
      toast.success(res.data.message);
      fetchContents();
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  const handleToggleFavoriteFolder = async (id: string) => {
    try {
      const res = await api.patch(`/folders/${id}/favorite`);
      toast.success(res.data.message);
      fetchContents();
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = async (id: string, name: string) => {
    try {
      const res = await api.get(`/files/${id}/download`);
      const { download_url } = res.data.data;

      const link = document.createElement("a");
      link.href = download_url;
      link.download = name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Download failed");
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────

  const handlePreview = async (file: File) => {
    try {
      const res = await api.get(`/files/${file.id}/preview`);
      setPreviewFile({
        url: res.data.data.preview_url,
        mime_type: file.mime_type,
        name: file.name,
      });
      setShowPreviewModal(true);
    } catch {
      toast.error("Preview not available");
    }
  };

  // ── Add to Print Queue ────────────────────────────────────────────────────

  const handleAddToPrintQueue = async (file: File) => {
    try {
      await api.post("/print-queue", { file_id: file.id });
      toast.success(`${file.name} added to print queue`);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to add to print queue"
      );
    }
  };

  // ── Move ──────────────────────────────────────────────────────────────────

  const handleOpenMove = async (item: {
    id: string;
    type: "file" | "folder";
    name: string;
  }) => {
    setMovingItem(item);
    try {
      const res = await api.get("/folders?parent_id=root");
      setAvailableFolders(res.data.data.folders);
    } catch {
      toast.error("Failed to load folders");
    }
    setShowMoveModal(true);
  };

  const handleMove = async (targetFolderId: string | null) => {
    if (!movingItem) return;

    try {
      if (movingItem.type === "file") {
        await api.patch(`/files/${movingItem.id}/move`, {
          target_folder_id: targetFolderId,
        });
      } else {
        await api.patch(`/folders/${movingItem.id}/move`, {
          target_parent_id: targetFolderId,
        });
      }

      toast.success("Moved successfully");
      setShowMoveModal(false);
      setMovingItem(null);
      fetchContents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Move failed");
    }
  };

  const folderColors = [
    "#6366f1",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div>
      <TopBar
        title={isRoot ? "My Files" : breadcrumb[breadcrumb.length - 1]?.name || "Folder"}
        subtitle={isRoot ? "All your files and folders" : undefined}
      />

      <div className="p-6">
        {/* Breadcrumb */}
        {!isRoot && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-4 flex-wrap">
            <button
              onClick={() => router.push("/folder/root")}
              className="hover:text-blue-600 transition-colors"
            >
              My Files
            </button>
            {breadcrumb.map((item, index) => (
              <span key={item.id} className="flex items-center gap-1">
                <span className="text-gray-300">/</span>
                {index === breadcrumb.length - 1 ? (
                  <span className="text-gray-900 font-medium">{item.name}</span>
                ) : (
                  <button
                    onClick={() => router.push(`/folder/${item.id}`)}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {item.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={() => setShowCreateFolder(true)} size="sm">
            📁 New Folder
          </Button>

          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                ${
                  isUploading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                }`}
            >
              {isUploading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Uploading...
                </>
              ) : (
                <>⬆️ Upload File</>
              )}
            </div>
          </label>

          <span className="text-sm text-gray-400 ml-auto">
            {folders.length} folder{folders.length !== 1 ? "s" : ""},{" "}
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 p-4 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : isEmpty ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              This folder is empty
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Create a folder or upload files to get started
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setShowCreateFolder(true)} size="sm">
                📁 New Folder
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
                  ⬆️ Upload File
                </div>
              </label>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          // Grid View
          <div className="flex flex-col gap-6">
            {folders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Folders
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onOpen={() => router.push(`/folder/${folder.id}`)}
                      onRename={() => {
                        setRenamingItem({
                          id: folder.id,
                          name: folder.name,
                          type: "folder",
                        });
                        setNewName(folder.name);
                        setShowRenameModal(true);
                      }}
                      onDelete={() =>
                        handleDeleteFolder(folder.id, folder.name)
                      }
                      onFavorite={() => handleToggleFavoriteFolder(folder.id)}
                      onMove={() =>
                        handleOpenMove({
                          id: folder.id,
                          type: "folder",
                          name: folder.name,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Files
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onPreview={() => handlePreview(file)}
                      onDownload={() => handleDownload(file.id, file.name)}
                      onRename={() => {
                        setRenamingItem({
                          id: file.id,
                          name: file.name,
                          type: "file",
                        });
                        setNewName(file.name);
                        setShowRenameModal(true);
                      }}
                      onDelete={() => handleDeleteFile(file.id, file.name)}
                      onFavorite={() => handleToggleFavoriteFile(file.id)}
                      onAddToPrintQueue={() => handleAddToPrintQueue(file)}
                      onMove={() =>
                        handleOpenMove({
                          id: file.id,
                          type: "file",
                          name: file.name,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Size
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Modified
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {folders.map((folder) => (
                  <tr
                    key={folder.id}
                    className="hover:bg-gray-50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/folder/${folder.id}`)}
                        className="flex items-center gap-3"
                      >
                        <span className="text-lg">📁</span>
                        <span className="text-sm font-medium text-gray-800">
                          {folder.name}
                        </span>
                        {folder.is_favorited && (
                          <span className="text-yellow-400 text-xs">⭐</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">
                      —
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                      {formatDate(folder.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <ActionButton
                          icon="✏️"
                          onClick={() => {
                            setRenamingItem({
                              id: folder.id,
                              name: folder.name,
                              type: "folder",
                            });
                            setNewName(folder.name);
                            setShowRenameModal(true);
                          }}
                          title="Rename"
                        />
                        <ActionButton
                          icon={folder.is_favorited ? "⭐" : "☆"}
                          onClick={() => handleToggleFavoriteFolder(folder.id)}
                          title="Favorite"
                        />
                        <ActionButton
                          icon="🗑️"
                          onClick={() =>
                            handleDeleteFolder(folder.id, folder.name)
                          }
                          title="Delete"
                          danger
                        />
                      </div>
                    </td>
                  </tr>
                ))}

                {files.map((file) => (
                  <tr
                    key={file.id}
                    className="hover:bg-gray-50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {getFileIcon(file.mime_type)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {file.name}
                          </p>
                          {file.version > 1 && (
                            <p className="text-xs text-gray-400">
                              v{file.version}
                            </p>
                          )}
                        </div>
                        {file.is_favorited && (
                          <span className="text-yellow-400 text-xs">⭐</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                      {formatDate(file.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPreviewable(file.mime_type) && (
                          <ActionButton
                            icon="👁️"
                            onClick={() => handlePreview(file)}
                            title="Preview"
                          />
                        )}
                        <ActionButton
                          icon="⬇️"
                          onClick={() => handleDownload(file.id, file.name)}
                          title="Download"
                        />
                        <ActionButton
                          icon="🖨️"
                          onClick={() => handleAddToPrintQueue(file)}
                          title="Add to Print Queue"
                        />
                        <ActionButton
                          icon={file.is_favorited ? "⭐" : "☆"}
                          onClick={() => handleToggleFavoriteFile(file.id)}
                          title="Favorite"
                        />
                        <ActionButton
                          icon="🗑️"
                          onClick={() => handleDeleteFile(file.id, file.name)}
                          title="Delete"
                          danger
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      <Modal
        isOpen={showCreateFolder}
        onClose={() => {
          setShowCreateFolder(false);
          setNewFolderName("");
        }}
        title="Create New Folder"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Folder Name"
            placeholder="e.g. Documents, College, Resume"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            autoFocus
          />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {folderColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewFolderColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    newFolderColor === color
                      ? "scale-125 ring-2 ring-offset-1 ring-gray-400"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateFolder(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              className="flex-1"
              disabled={!newFolderName.trim()}
            >
              Create Folder
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setRenamingItem(null);
        }}
        title={`Rename ${renamingItem?.type === "folder" ? "Folder" : "File"}`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="New Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRenameModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              className="flex-1"
              disabled={!newName.trim()}
            >
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewFile(null);
        }}
        title={previewFile?.name || "Preview"}
        size="lg"
      >
        <div className="flex items-center justify-center min-h-64">
          {previewFile?.mime_type.startsWith("image/") ? (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-96 object-contain rounded-lg"
            />
          ) : previewFile?.mime_type === "application/pdf" ? (
            <iframe
              src={previewFile.url}
              className="w-full h-96 rounded-lg"
              title={previewFile.name}
            />
          ) : previewFile?.mime_type === "text/plain" ? (
            <iframe
              src={previewFile.url}
              className="w-full h-64 rounded-lg bg-gray-50"
              title={previewFile.name}
            />
          ) : (
            <p className="text-gray-400">Preview not available</p>
          )}
        </div>
      </Modal>

      {/* Move Modal */}
      <Modal
        isOpen={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setMovingItem(null);
        }}
        title={`Move "${movingItem?.name}"`}
        size="sm"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500 mb-2">
            Select destination folder
          </p>

          <button
            onClick={() => handleMove(null)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 text-left transition-colors border border-gray-100"
          >
            <span>🏠</span>
            <span className="text-sm font-medium">Root (My Files)</span>
          </button>

          {availableFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => handleMove(folder.id)}
              disabled={folder.id === movingItem?.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 text-left transition-colors border border-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>📁</span>
              <span className="text-sm font-medium">{folder.name}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── Folder Card ──────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
  onFavorite,
  onMove,
}: {
  folder: Folder;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onMove: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer">
      <button
        onClick={onOpen}
        className="w-full flex flex-col items-center gap-2"
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${folder.color}20` }}
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

      {folder.is_favorited && (
        <span className="absolute top-2 left-2 text-xs">⭐</span>
      )}

      {/* Menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 transition-all"
      >
        <svg
          className="w-3.5 h-3.5 text-gray-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-2 top-8 z-20 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-36">
            <MenuItem icon="📂" label="Open" onClick={onOpen} />
            <MenuItem icon="✏️" label="Rename" onClick={onRename} />
            <MenuItem icon="📦" label="Move" onClick={onMove} />
            <MenuItem
              icon={folder.is_favorited ? "⭐" : "☆"}
              label={folder.is_favorited ? "Unfavorite" : "Favorite"}
              onClick={onFavorite}
            />
            <div className="border-t border-gray-100 my-1" />
            <MenuItem icon="🗑️" label="Delete" onClick={onDelete} danger />
          </div>
        </>
      )}
    </div>
  );
}

// ─── File Card ────────────────────────────────────────────────────────────────

function FileCard({
  file,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onFavorite,
  onAddToPrintQueue,
  onMove,
}: {
  file: File;
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onAddToPrintQueue: () => void;
  onMove: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative group bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all">
      <button
        onClick={isPreviewable(file.mime_type) ? onPreview : onDownload}
        className="w-full flex flex-col items-center gap-2"
      >
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl">
          {getFileIcon(file.mime_type)}
        </div>
        <div className="w-full text-center">
          <p className="text-xs font-medium text-gray-800 truncate">
            {file.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatFileSize(file.size)}
          </p>
        </div>
      </button>

      {file.is_favorited && (
        <span className="absolute top-2 left-2 text-xs">⭐</span>
      )}
      {file.version > 1 && (
        <span className="absolute bottom-2 left-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
          v{file.version}
        </span>
      )}

      {/* Menu */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 transition-all"
      >
        <svg
          className="w-3.5 h-3.5 text-gray-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-2 top-8 z-20 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-40">
            {isPreviewable(file.mime_type) && (
              <MenuItem icon="👁️" label="Preview" onClick={onPreview} />
            )}
            <MenuItem icon="⬇️" label="Download" onClick={onDownload} />
            <MenuItem icon="✏️" label="Rename" onClick={onRename} />
            <MenuItem icon="📦" label="Move" onClick={onMove} />
            <MenuItem icon="🖨️" label="Print Queue" onClick={onAddToPrintQueue} />
            <MenuItem
              icon={file.is_favorited ? "⭐" : "☆"}
              label={file.is_favorited ? "Unfavorite" : "Favorite"}
              onClick={onFavorite}
            />
            <div className="border-t border-gray-100 my-1" />
            <MenuItem icon="🗑️" label="Delete" onClick={onDelete} danger />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Menu Item ────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left
        ${danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <span className="text-xs">{icon}</span>
      {label}
    </button>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({
  icon,
  onClick,
  title,
  danger = false,
}: {
  icon: string;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md text-xs transition-colors
        ${danger ? "hover:bg-red-50 text-red-500" : "hover:bg-gray-100 text-gray-500"}`}
    >
      {icon}
    </button>
  );
}