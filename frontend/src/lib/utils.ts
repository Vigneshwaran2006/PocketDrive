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

// Format full date
export const formatFullDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Get file icon based on mime type
export const getFileIcon = (mimeType: string): string => {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("word")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "📊";
  if (mimeType === "text/plain") return "📃";
  if (mimeType === "text/csv") return "📊";
  if (mimeType.includes("zip")) return "🗜️";
  return "📎";
};

// Get file color based on mime type
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

// Get action label for activity log
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
  };
  return labels[action] || action;
};

// Truncate text
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

// Check if file is previewable
export const isPreviewable = (mimeType: string): boolean => {
  const previewable = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "text/plain",
  ];
  return previewable.includes(mimeType);
};

// Generate color from string (for folder colors)
export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 55%)`;
};