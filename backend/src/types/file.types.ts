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

export interface RenameFileBody {
  name: string;
}

export interface MoveFileBody {
  target_folder_id: string | null;
}

export interface UpdateTagsBody {
  tags: string[];
}