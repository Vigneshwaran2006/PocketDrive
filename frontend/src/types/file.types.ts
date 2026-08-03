export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_favorited: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size: number;
  extension: string | null;
  is_favorited: boolean;
  is_pinned: boolean;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TrashItem {
  id: string;
  user_id: string;
  item_id: string;
  item_type: "file" | "folder";
  item_name: string;
  item_data: File | Folder;
  deleted_at: string;
  expires_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  item_type: "file" | "folder" | null;
  item_id: string | null;
  item_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PrintQueueItem {
  id: string;
  user_id: string;
  file_id: string;
  order_index: number;
  created_at: string;
  files: File;
}

export interface PrintProfile {
  id: string;
  user_id: string;
  name: string;
  file_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_files: number;
  total_folders: number;
  trash_count: number;
  storage_used: number;
  storage_total: number;
  storage_percentage: number;
}

export interface StorageBreakdown {
  label: string;
  size: number;
  count: number;
  percentage: number;
  color: string;
}