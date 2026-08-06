// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// Format date
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatFullDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getFileIcon = (mimeType: string): string => {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("word")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "🎬";
  if (mimeType === "text/plain") return "📃";
  if (mimeType === "text/csv") return "📊";
  if (mimeType === "text/html") return "🌐";
  if (mimeType === "application/json") return "⚙️";
  if (mimeType === "text/xml" || mimeType === "application/xml") return "📋";
  if (mimeType === "text/markdown") return "📖";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("gzip"))
    return "🗜️";
  return "📎";
};

export const getFileColor = (mimeType: string): string => {
  if (mimeType === "application/pdf") return "text-red-500";
  if (mimeType.startsWith("image/")) return "text-blue-500";
  if (mimeType.includes("word")) return "text-blue-700";
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return "text-green-600";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "text-orange-500";
  if (mimeType === "text/plain") return "text-gray-500";
  return "text-gray-600";
};

export const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    uploaded_file: "Uploaded",
    deleted_file: "Deleted",
    renamed_file: "Renamed",
    moved_file: "Moved",
    downloaded_file: "Downloaded",
    favorited_file: "Starred",
    unfavorited_file: "Unstarred",
    created_folder: "Created folder",
    deleted_folder: "Deleted folder",
    renamed_folder: "Renamed folder",
    moved_folder: "Moved folder",
    restored_from_trash: "Restored",
    permanently_deleted: "Permanently deleted",
    uploaded_new_version: "Uploaded new version",
    added_to_print_queue: "Added to print queue",
    downloaded_print_queue: "Downloaded print queue",
    emptied_trash: "Emptied trash",
    loaded_print_profile: "Loaded print profile",
    bulk_deleted_files: "Bulk deleted files",
    bulk_deleted_folders: "Bulk deleted folders",
    bulk_restored_from_trash: "Bulk restored",
    bulk_permanent_delete: "Bulk permanent delete",
    qr_login_confirmed: "QR login confirmed",
  };
  return labels[action] || action;
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

// PDFs, images, text - native preview
export const isPreviewable = (mimeType: string): boolean => {
  const previewable = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "text/plain",
    "text/html",
    "text/xml",
    "application/xml",
    "application/json",
    "text/markdown",
    "text/csv",
  ];
  return previewable.includes(mimeType);
};

// Office docs — previewable via Google Docs Viewer
export const isOfficePreviewable = (mimeType: string): boolean => {
  const office = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/csv",
  ];
  return office.includes(mimeType);
};

// Any type of preview possible
export const canPreview = (mimeType: string): boolean => {
  return isPreviewable(mimeType) || isOfficePreviewable(mimeType);
};

export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 55%)`;
};