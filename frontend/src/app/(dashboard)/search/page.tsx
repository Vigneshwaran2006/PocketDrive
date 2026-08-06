"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/TopBar";
import { formatFileSize, formatDate, getFileIcon } from "@/lib/utils";
import { File, Folder } from "@/types/file.types";
import { toast } from "@/components/ui/Toast";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    extension: "",
    is_favorited: false,
  });

  useEffect(() => {
    if (query) {
      handleSearch(query);
    }
  }, [query, filters]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ q });
      if (filters.type !== "all") params.append("type", filters.type);
      if (filters.extension) params.append("extension", filters.extension);
      if (filters.is_favorited) params.append("is_favorited", "true");

      const res = await api.get(`/search?${params.toString()}`);
      setFiles(res.data.data.files);
      setFolders(res.data.data.folders);
    } catch {
      toast.error("Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (id: string, name: string) => {
    try {
      const res = await api.get(`/files/${id}/download`);
      const { download_url } = res.data.data;

      const response = await fetch(download_url);
      if (!response.ok) throw new Error("Fetch failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      toast.error("Download failed");
    }
  };

  const total = files.length + folders.length;

  return (
    <div className="p-6">
      {/* Search Input */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).querySelector("input");
            if (input?.value) {
              router.push(`/search?q=${encodeURIComponent(input.value)}`);
            }
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            defaultValue={query}
            placeholder="Search files, folders, tags..."
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="flex gap-3 mt-3 flex-wrap">
          <select
            value={filters.type}
            onChange={(e) =>
              setFilters({ ...filters, type: e.target.value })
            }
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-gray-600"
          >
            <option value="all">All Types</option>
            <option value="file">Files Only</option>
            <option value="folder">Folders Only</option>
          </select>

          <select
            value={filters.extension}
            onChange={(e) =>
              setFilters({ ...filters, extension: e.target.value })
            }
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-gray-600"
          >
            <option value="">All Extensions</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="xlsx">XLSX</option>
            <option value="pptx">PPTX</option>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
            <option value="txt">TXT</option>
          </select>

          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.is_favorited}
              onChange={(e) =>
                setFilters({ ...filters, is_favorited: e.target.checked })
              }
              className="w-3.5 h-3.5 rounded"
            />
            Favorites only
          </label>
        </div>
      </div>

      {/* Results */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">🔍</span>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Search your files
          </h3>
          <p className="text-gray-400 text-sm">
            Search by filename, folder name, or tags
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 p-4 h-16 animate-pulse"
            />
          ))}
        </div>
      )}

      {hasSearched && !isLoading && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {total === 0 ? (
                "No results found"
              ) : (
                <>
                  <span className="font-medium text-gray-900">{total}</span>{" "}
                  result{total !== 1 ? "s" : ""} for{" "}
                  <span className="font-medium text-blue-600">
                    &quot;{query}&quot;
                  </span>
                </>
              )}
            </p>
          </div>

          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-5xl mb-4">😕</span>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No results found
              </h3>
              <p className="text-gray-400 text-sm">
                Try different keywords or remove filters
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Folder Results */}
              {folders.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Folders ({folders.length})
                  </h3>
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {folders.map((folder, index) => (
                      <div
                        key={folder.id}
                        className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${index !== 0 ? "border-t border-gray-50" : ""
                          }`}
                        onClick={() =>
                          router.push(`/folder/${folder.id}`)
                        }
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{
                            backgroundColor: `${folder.color}20`,
                          }}
                        >
                          📁
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {folder.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            Modified {formatDate(folder.updated_at)}
                          </p>
                        </div>
                        {folder.is_favorited && (
                          <span className="text-yellow-400">⭐</span>
                        )}
                        <span className="text-gray-300 text-sm">→</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File Results */}
              {files.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Files ({files.length})
                  </h3>
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${index !== 0 ? "border-t border-gray-50" : ""
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
                            {file.tags.length > 0 && (
                              <span className="ml-2">
                                {file.tags
                                  .slice(0, 2)
                                  .map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-block bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-xs mr-1"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </span>
                            )}
                          </p>
                        </div>
                        {file.is_favorited && (
                          <span className="text-yellow-400">⭐</span>
                        )}
                        <button
                          onClick={() =>
                            handleDownload(file.id, file.name)
                          }
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download"
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div>
      <TopBar title="Search" subtitle="Find your files and folders" />
      <Suspense
        fallback={
          <div className="p-6 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 h-16 animate-pulse"
              />
            ))}
          </div>
        }
      >
        <SearchContent />
      </Suspense>
    </div>
  );
}