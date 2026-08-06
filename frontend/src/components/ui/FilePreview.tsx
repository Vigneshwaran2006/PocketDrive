"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  mimeType: string;
  fileName: string;
  onDownload?: () => void;
}

export function FilePreview({
  isOpen,
  onClose,
  url,
  mimeType,
  fileName,
  onDownload,
}: FilePreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setZoom(100);
      setRotation(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=")
        setZoom((z) => Math.min(z + 25, 300));
      if (e.key === "-") setZoom((z) => Math.max(z - 25, 25));
      if (e.key === "0") {
        setZoom(100);
        setRotation(0);
      }
      if (e.key === "r") setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!isOpen) return null;

  const isImage = mimeType.startsWith("image/");
  const isPDF = mimeType === "application/pdf";
  const isText = mimeType === "text/plain";

  // Detect office file type for helpful message
  const getOfficeInfo = (): { icon: string; label: string } | null => {
    if (mimeType.includes("word") || mimeType.includes("document")) {
      return { icon: "📝", label: "Word Document" };
    }
    if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType === "text/csv") {
      return { icon: "📊", label: "Spreadsheet" };
    }
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
      return { icon: "🎬", label: "Presentation" };
    }
    if (mimeType.includes("zip")) {
      return { icon: "🗜️", label: "Archive" };
    }
    return null;
  };

  const officeInfo = getOfficeInfo();

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-lg">
              {isImage
                ? "🖼️"
                : isPDF
                ? "📄"
                : isText
                ? "📃"
                : officeInfo?.icon || "📎"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {fileName}
            </p>
            <p className="text-xs text-gray-400 truncate">{mimeType}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isImage && (
            <>
              <div className="hidden sm:flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setZoom((z) => Math.max(z - 25, 25))}
                  className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  title="Zoom out"
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
                      d="M20 12H4"
                    />
                  </svg>
                </button>
                <span className="text-xs text-gray-300 px-2 min-w-14 text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(z + 25, 300))}
                  className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  title="Zoom in"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors hidden sm:block"
                title="Rotate"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>

              <div className="w-px h-6 bg-gray-700 hidden sm:block" />
            </>
          )}

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Open in new tab"
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>

          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
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
          )}

          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-hidden bg-gray-800 relative">
        {isImage ? (
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <img
              src={url}
              alt={fileName}
              className="transition-transform duration-200"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                maxWidth: zoom <= 100 ? "100%" : "none",
                maxHeight: zoom <= 100 ? "100%" : "none",
              }}
            />
          </div>
        ) : isPDF ? (
          <iframe
            src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full border-0"
            title={fileName}
          />
        ) : isText ? (
          <iframe
            src={url}
            className="w-full h-full bg-white border-0"
            title={fileName}
          />
        ) : officeInfo ? (
          // Office files - show helpful message
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
              <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl">{officeInfo.icon}</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {officeInfo.label}
              </h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Preview is not available for this file type in browser.
                Download to view in{" "}
                {mimeType.includes("word")
                  ? "Microsoft Word"
                  : mimeType.includes("sheet") || mimeType.includes("excel") || mimeType === "text/csv"
                  ? "Excel or Google Sheets"
                  : mimeType.includes("presentation")
                  ? "PowerPoint or Google Slides"
                  : "the appropriate application"}
                .
              </p>

              <div className="flex flex-col gap-2">
                {onDownload && (
                  <button
                    onClick={onDownload}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
                    Download File
                  </button>
                )}

                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Open in New Tab
                </a>
              </div>

              <p className="text-xs text-gray-500 mt-6">
                💡 Tip: Some browsers may show Office files in a new tab
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <span className="text-6xl mb-4">📄</span>
            <p className="text-lg">Preview not available</p>
            <p className="text-sm mt-2">Download the file to view it</p>
          </div>
        )}
      </div>

      {isImage && (
        <div className="hidden md:flex bg-gray-900 border-t border-gray-800 px-4 py-2 items-center gap-4 text-xs text-gray-500 flex-shrink-0">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
              +
            </kbd>{" "}
            Zoom in
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
              -
            </kbd>{" "}
            Zoom out
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
              R
            </kbd>{" "}
            Rotate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
              0
            </kbd>{" "}
            Reset
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
              Esc
            </kbd>{" "}
            Close
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}