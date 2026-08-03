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

export interface CreateFolderBody {
  name: string;
  parent_id?: string;
  color?: string;
}

export interface RenameFolderBody {
  name: string;
}

export interface MoveFolderBody {
  target_parent_id: string | null;
}