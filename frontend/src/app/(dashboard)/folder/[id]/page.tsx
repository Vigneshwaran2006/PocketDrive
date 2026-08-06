"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useAppStore } from "@/store/app.store";
import { FilePreview } from "@/components/ui/FilePreview";
import { printSingleFile } from "@/lib/print";
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

interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
  totalFiles: number;
  currentFileIndex: number;
  uploadedSize: number;
  totalSize: number;
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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    fileName: "",
    loaded: 0,
    total: 0,
    percent: 0,
    totalFiles: 0,
    currentFileIndex: 0,
    uploadedSize: 0,
    totalSize: 0,
  });

  // Selection
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

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

      if (!isRoot) {
        const folderRes = await api.get(`/folders/${folderId}`);
        setBreadcrumb(folderRes.data.data.breadcrumb);
      } else {
        setBreadcrumb([]);
      }
    } catch {
      toast.error("Failed to load contents");
    } finally {
      setIsLoading(false);
    }
  };

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

  // ── FILE UPLOAD ────────────────────────────────────────────────────────────

  const uploadOneFile = async (
    file: globalThis.File,
    fileIndex: number,
    totalFiles: number,
    totalSize: number,
    previouslyUploadedSize: number
  ): Promise<{ success: boolean; isDuplicate: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append("file", file);
      if (!isRoot) formData.append("folder_id", folderId);

      api
        .post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const currentFilePercent = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100
              );

              const totalUploaded =
                previouslyUploadedSize + progressEvent.loaded;
              const overallPercent = Math.round(
                (totalUploaded / totalSize) * 100
              );

              setUploadProgress({
                fileName: file.name,
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percent: currentFilePercent,
                totalFiles,
                currentFileIndex: fileIndex,
                uploadedSize: totalUploaded,
                totalSize,
              });
            }
          },
        })
        .then(() => {
          resolve({ success: true, isDuplicate: false });
        })
        .catch((error) => {
          if (error.response?.data?.code === "POSSIBLE_DUPLICATE") {
            resolve({ success: false, isDuplicate: true });
          } else {
            resolve({
              success: false,
              isDuplicate: false,
              error: error.response?.data?.message || "Upload failed",
            });
          }
        });
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // Validate file count
    if (fileArray.length > 50) {
      toast.error(
        `Maximum 50 files at once. You selected ${fileArray.length} files.`
      );
      e.target.value = "";
      return;
    }

    // Validate individual file sizes
    const oversizedFiles = fileArray.filter((f) => f.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(
        `${oversizedFiles.length} file(s) exceed 50MB limit. Please remove them.`
      );
      e.target.value = "";
      return;
    }

    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
    let uploadedSize = 0;
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    setIsUploading(true);
    setUploadProgress({
      fileName: fileArray[0].name,
      loaded: 0,
      total: fileArray[0].size,
      percent: 0,
      totalFiles: fileArray.length,
      currentFileIndex: 0,
      uploadedSize: 0,
      totalSize,
    });

    // Upload files one by one for accurate progress
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const result = await uploadOneFile(
        file,
        i + 1,
        fileArray.length,
        totalSize,
        uploadedSize
      );

      if (result.success) {
        successCount++;
      } else if (result.isDuplicate) {
        duplicateCount++;
      } else {
        failedCount++;
      }

      uploadedSize += file.size;
    }

    // Show results
    if (successCount > 0) {
      toast.success(
        `${successCount} file${successCount !== 1 ? "s" : ""} uploaded successfully`
      );
    }
    if (duplicateCount > 0) {
      toast.warning(
        `${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""} skipped`
      );
    }
    if (failedCount > 0) {
      toast.error(
        `${failedCount} file${failedCount !== 1 ? "s" : ""} failed to upload`
      );
    }

    setIsUploading(false);
    setUploadProgress({
      fileName: "",
      loaded: 0,
      total: 0,
      percent: 0,
      totalFiles: 0,
      currentFileIndex: 0,
      uploadedSize: 0,
      totalSize: 0,
    });
    e.target.value = "";
    fetchContents();
  };

  // ── SELECTION ──────────────────────────────────────────────────────────────

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleFolderSelection = (id: string) => {
    setSelectedFolders((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (
      selectedFiles.length === files.length &&
      selectedFolders.length === folders.length
    ) {
      setSelectedFiles([]);
      setSelectedFolders([]);
    } else {
      setSelectedFiles(files.map((f) => f.id));
      setSelectedFolders(folders.map((f) => f.id));
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setSelectedFolders([]);
    setSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    const total = selectedFiles.length + selectedFolders.length;
    if (total === 0) return;

    if (!confirm(`Move ${total} item${total !== 1 ? "s" : ""} to trash?`))
      return;

    try {
      const promises = [];
      if (selectedFiles.length > 0) {
        promises.push(
          api.post("/files/bulk-delete", { file_ids: selectedFiles })
        );
      }
      if (selectedFolders.length > 0) {
        promises.push(
          api.post("/folders/bulk-delete", { folder_ids: selectedFolders })
        );
      }

      await Promise.all(promises);
      toast.success(`${total} item${total !== 1 ? "s" : ""} moved to trash`);
      clearSelection();
      fetchContents();
    } catch {
      toast.error("Failed to delete items");
    }
  };

  // ── SINGLE OPERATIONS ──────────────────────────────────────────────────────

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

  const handlePrintFile = async (file: File) => {
    const printable = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!printable.includes(file.mime_type)) {
      toast.warning(
        "This file type cannot be printed directly. Only PDFs and images are supported."
      );
      return;
    }

    try {
      const res = await api.get(`/files/${file.id}/preview`);
      const previewUrl = res.data.data.preview_url;

      await printSingleFile(
        file.id,
        file.name,
        file.mime_type,
        previewUrl
      );

      toast.success("Print window opened");
    } catch (error: any) {
      toast.error(error.message || "Failed to print file");
    }
  };

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
  const totalSelected = selectedFiles.length + selectedFolders.length;

  // Calculate overall progress
  const overallPercent =
    uploadProgress.totalSize > 0
      ? Math.round(
        (uploadProgress.uploadedSize / uploadProgress.totalSize) * 100
      )
      : 0;

  return (
    <div>
      <TopBar
        title={
          isRoot
            ? "My Files"
            : breadcrumb[breadcrumb.length - 1]?.name || "Folder"
        }
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
                  <span className="text-gray-900 font-medium">
                    {item.name}
                  </span>
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

        {/* Upload Progress Card */}
        {isUploading && (
          <div className="bg-white border-2 border-blue-100 rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Uploading {uploadProgress.currentFileIndex} of{" "}
                    {uploadProgress.totalFiles} files
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-xs">
                    {uploadProgress.fileName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">
                  {overallPercent}%
                </p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(uploadProgress.uploadedSize)} /{" "}
                  {formatFileSize(uploadProgress.totalSize)}
                </p>
              </div>
            </div>

            {/* Overall progress */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">
                  Overall Progress
                </span>
                <span className="text-xs text-gray-400">
                  {uploadProgress.currentFileIndex} /{" "}
                  {uploadProgress.totalFiles}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>

            {/* Current file progress */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 truncate max-w-xs">
                  Current file: {uploadProgress.fileName}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {uploadProgress.percent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Selection Action Bar */}
        {totalSelected > 0 && (
          <div className="bg-blue-600 text-white rounded-xl p-3 mb-4 flex items-center justify-between shadow-lg sticky top-16 z-10 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={clearSelection}
                className="p-1 hover:bg-blue-700 rounded"
              >
                ✕
              </button>
              <span className="text-sm font-medium">
                {totalSelected} selected
              </span>
              <button
                onClick={selectAll}
                className="text-xs underline hover:text-blue-100"
              >
                {totalSelected === files.length + folders.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
            >
              🗑️ Delete Selected
            </button>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button onClick={() => setShowCreateFolder(true)} size="sm">
            📁 New Folder
          </Button>

          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
              multiple
            />
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                ${isUploading
                  ? "bg-blue-50 text-blue-700 cursor-not-allowed"
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
                <>⬆️ Upload Files</>
              )}
            </div>
          </label>

          {(files.length > 0 || folders.length > 0) && (
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
          )}

          <span className="text-sm text-gray-400 ml-auto">
            {folders.length} folder{folders.length !== 1 ? "s" : ""},{" "}
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-400 mb-4">
          💡 Max 50 files per upload, 50MB each
        </p>

        {/* Content */}
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              This folder is empty
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Create a folder or upload files to get started
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => setShowCreateFolder(true)} size="sm">
                📁 New Folder
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple
                />
                <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
                  ⬆️ Upload Files
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              💡 Select multiple files at once (max 50)
            </p>
          </div>
        ) : viewMode === "grid" ? (
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
                      selectionMode={selectionMode}
                      isSelected={selectedFolders.includes(folder.id)}
                      onToggleSelect={() =>
                        toggleFolderSelection(folder.id)
                      }
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
                      onFavorite={() =>
                        handleToggleFavoriteFolder(folder.id)
                      }
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
                      selectionMode={selectionMode}
                      isSelected={selectedFiles.includes(file.id)}
                      onToggleSelect={() => toggleFileSelection(file.id)}
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
                      onPrint={() => handlePrintFile(file)}
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
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {selectionMode && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selectedFiles.length === files.length &&
                          selectedFolders.length === folders.length &&
                          (files.length > 0 || folders.length > 0)
                        }
                        onChange={selectAll}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </th>
                  )}
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
                {folders.map((folder) => {
                  const isSelected = selectedFolders.includes(folder.id);
                  return (
                    <tr
                      key={folder.id}
                      className={`transition-colors group ${isSelected
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-gray-50"
                        }`}
                    >
                      {selectionMode && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleFolderSelection(folder.id)
                            }
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            !selectionMode &&
                            router.push(`/folder/${folder.id}`)
                          }
                          className="flex items-center gap-3"
                        >
                          <span className="text-lg">📁</span>
                          <span className="text-sm font-medium text-gray-800">
                            {folder.name}
                          </span>
                          {folder.is_favorited && (
                            <span className="text-yellow-400 text-xs">
                              ⭐
                            </span>
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
                        {!selectionMode && (
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
                              onClick={() =>
                                handleToggleFavoriteFolder(folder.id)
                              }
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
                        )}
                      </td>
                    </tr>
                  );
                })}

                {files.map((file) => {
                  const isSelected = selectedFiles.includes(file.id);
                  return (
                    <tr
                      key={file.id}
                      className={`transition-colors group ${isSelected
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-gray-50"
                        }`}
                    >
                      {selectionMode && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFileSelection(file.id)}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                      )}
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
                            <span className="text-yellow-400 text-xs">
                              ⭐
                            </span>
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
                        {!selectionMode && (
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
                              onClick={() =>
                                handleDownload(file.id, file.name)
                              }
                              title="Download"
                            />
                            <ActionButton
                              icon="🖨️"
                              onClick={() => handlePrintFile(file)}
                              title="Print this file"
                            />
                            <ActionButton
                              icon="➕"
                              onClick={() => handleAddToPrintQueue(file)}
                              title="Add to Print Queue"
                            />
                            <ActionButton
                              icon={file.is_favorited ? "⭐" : "☆"}
                              onClick={() =>
                                handleToggleFavoriteFile(file.id)
                              }
                              title="Favorite"
                            />
                            <ActionButton
                              icon="🗑️"
                              onClick={() =>
                                handleDeleteFile(file.id, file.name)
                              }
                              title="Delete"
                              danger
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
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
                  className={`w-7 h-7 rounded-full transition-transform ${newFolderColor === color
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

      {/* File Preview - Full Screen */}
      {previewFile && (
        <FilePreview
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewFile(null);
          }}
          url={previewFile.url}
          mimeType={previewFile.mime_type}
          fileName={previewFile.name}
          onDownload={async () => {
            const fileInList = files.find((f) => f.name === previewFile.name);
            if (fileInList) {
              await handleDownload(fileInList.id, fileInList.name);
            }
          }}
        />
      )}

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
  selectionMode,
  isSelected,
  onToggleSelect,
  onOpen,
  onRename,
  onDelete,
  onFavorite,
  onMove,
}: {
  folder: Folder;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onMove: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`relative group bg-white rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer ${isSelected
        ? "border-blue-500 bg-blue-50"
        : "border-gray-100 hover:border-gray-200"
        }`}
    >
      {selectionMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="absolute top-2 left-2 z-10"
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
              ? "bg-blue-600 border-blue-600 text-white"
              : "bg-white border-gray-300"
              }`}
          >
            {isSelected && <span className="text-xs">✓</span>}
          </div>
        </div>
      )}

      <button
        onClick={selectionMode ? onToggleSelect : onOpen}
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

      {folder.is_favorited && !selectionMode && (
        <span className="absolute top-2 left-2 text-xs">⭐</span>
      )}

      {!selectionMode && (
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
      )}

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
  selectionMode,
  isSelected,
  onToggleSelect,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onFavorite,
  onPrint,
  onAddToPrintQueue,
  onMove,
}: {
  file: File;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onPrint: () => void;
  onAddToPrintQueue: () => void;
  onMove: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`relative group bg-white rounded-xl border p-4 hover:shadow-md transition-all ${isSelected
        ? "border-blue-500 bg-blue-50"
        : "border-gray-100 hover:border-gray-200"
        }`}
    >
      {selectionMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="absolute top-2 left-2 z-10"
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
              ? "bg-blue-600 border-blue-600 text-white"
              : "bg-white border-gray-300"
              }`}
          >
            {isSelected && <span className="text-xs">✓</span>}
          </div>
        </div>
      )}

      <button
        onClick={
          selectionMode
            ? onToggleSelect
            : isPreviewable(file.mime_type)
              ? onPreview
              : onDownload
        }
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

      {file.is_favorited && !selectionMode && (
        <span className="absolute top-2 left-2 text-xs">⭐</span>
      )}
      {file.version > 1 && (
        <span className="absolute bottom-2 left-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
          v{file.version}
        </span>
      )}

      {!selectionMode && (
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
      )}

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-2 top-8 z-20 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-44">
            {isPreviewable(file.mime_type) && (
              <MenuItem icon="👁️" label="Preview" onClick={onPreview} />
            )}
            <MenuItem icon="⬇️" label="Download" onClick={onDownload} />
            <MenuItem icon="🖨️" label="Print" onClick={onPrint} />
            <MenuItem
              icon="➕"
              label="Add to Print Queue"
              onClick={onAddToPrintQueue}
            />
            <div className="border-t border-gray-100 my-1" />
            <MenuItem icon="✏️" label="Rename" onClick={onRename} />
            <MenuItem icon="📦" label="Move" onClick={onMove} />
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
        ${danger
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-50"
        }`}
    >
      <span className="text-xs">{icon}</span>
      {label}
    </button>
  );
}

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
        ${danger
          ? "hover:bg-red-50 text-red-500"
          : "hover:bg-gray-100 text-gray-500"
        }`}
    >
      {icon}
    </button>
  );
}