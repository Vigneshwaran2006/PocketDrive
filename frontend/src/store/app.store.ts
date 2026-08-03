import { create } from "zustand";
import { File, Folder, PrintQueueItem } from "@/types/file.types";

interface AppStore {
  // Current folder
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;

  // Files and folders
  files: File[];
  folders: Folder[];
  setFiles: (files: File[]) => void;
  setFolders: (folders: Folder[]) => void;

  // Selected items
  selectedFiles: string[];
  selectedFolders: string[];
  toggleSelectFile: (id: string) => void;
  toggleSelectFolder: (id: string) => void;
  clearSelection: () => void;

  // Print queue
  printQueue: PrintQueueItem[];
  setPrintQueue: (queue: PrintQueueItem[]) => void;

  // View mode
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;

  // Upload progress
  isUploading: boolean;
  uploadProgress: number;
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentFolderId: null,
  setCurrentFolderId: (id) => set({ currentFolderId: id }),

  files: [],
  folders: [],
  setFiles: (files) => set({ files }),
  setFolders: (folders) => set({ folders }),

  selectedFiles: [],
  selectedFolders: [],

  toggleSelectFile: (id) => {
    const { selectedFiles } = get();
    if (selectedFiles.includes(id)) {
      set({ selectedFiles: selectedFiles.filter((f) => f !== id) });
    } else {
      set({ selectedFiles: [...selectedFiles, id] });
    }
  },

  toggleSelectFolder: (id) => {
    const { selectedFolders } = get();
    if (selectedFolders.includes(id)) {
      set({ selectedFolders: selectedFolders.filter((f) => f !== id) });
    } else {
      set({ selectedFolders: [...selectedFolders, id] });
    }
  },

  clearSelection: () => set({ selectedFiles: [], selectedFolders: [] }),

  printQueue: [],
  setPrintQueue: (queue) => set({ printQueue: queue }),

  viewMode: "grid",
  setViewMode: (mode) => set({ viewMode: mode }),

  isUploading: false,
  uploadProgress: 0,
  setUploading: (uploading) => set({ isUploading: uploading }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
}));