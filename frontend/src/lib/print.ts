import { PDFDocument } from "pdf-lib";

interface PrintableFile {
  file_id: string;
  file_name: string;
  mime_type: string;
  download_url: string;
}

/**
 * Print multiple files by merging them into one PDF
 * Preserves queue order
 */
export const printFiles = async (files: PrintableFile[]): Promise<void> => {
  if (files.length === 0) return;

  const mergedPdfBytes = await mergeFilesToPDF(files);

  const blob = new Blob([new Uint8Array(mergedPdfBytes)], {
    type: "application/pdf",
  });
  const blobUrl = URL.createObjectURL(blob);

  await printPDFBlob(blobUrl);
};

/**
 * Merge PDFs and images into a single PDF
 */
const mergeFilesToPDF = async (files: PrintableFile[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    try {
      // Fetch file
      const response = await fetch(file.download_url);
      if (!response.ok) {
        console.error(`Failed to fetch ${file.file_name}`);
        continue;
      }

      const bytes = await response.arrayBuffer();

      if (file.mime_type === "application/pdf") {
        // Add PDF pages
        try {
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
        } catch (error) {
          console.error(`Failed to add PDF ${file.file_name}:`, error);
        }
      } else if (
        file.mime_type === "image/jpeg" ||
        file.mime_type === "image/jpg"
      ) {
        // Add JPEG as page
        try {
          const image = await mergedPdf.embedJpg(bytes);
          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();

          const scale = Math.min(
            width / image.width,
            height / image.height
          );

          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;

          page.drawImage(image, {
            x: (width - scaledWidth) / 2,
            y: (height - scaledHeight) / 2,
            width: scaledWidth,
            height: scaledHeight,
          });
        } catch (error) {
          console.error(`Failed to add JPEG ${file.file_name}:`, error);
        }
      } else if (file.mime_type === "image/png") {
        // Add PNG as page
        try {
          const image = await mergedPdf.embedPng(bytes);
          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();

          const scale = Math.min(
            width / image.width,
            height / image.height
          );

          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;

          page.drawImage(image, {
            x: (width - scaledWidth) / 2,
            y: (height - scaledHeight) / 2,
            width: scaledWidth,
            height: scaledHeight,
          });
        } catch (error) {
          console.error(`Failed to add PNG ${file.file_name}:`, error);
        }
      } else if (
        file.mime_type === "image/gif" ||
        file.mime_type === "image/webp"
      ) {
        // Convert GIF/WebP to PNG via canvas first
        try {
          const pngBytes = await convertImageToPng(bytes, file.mime_type);
          const image = await mergedPdf.embedPng(pngBytes);
          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();

          const scale = Math.min(
            width / image.width,
            height / image.height
          );

          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;

          page.drawImage(image, {
            x: (width - scaledWidth) / 2,
            y: (height - scaledHeight) / 2,
            width: scaledWidth,
            height: scaledHeight,
          });
        } catch (error) {
          console.error(
            `Failed to add ${file.mime_type} ${file.file_name}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(`Failed to process ${file.file_name}:`, error);
    }
  }

  return await mergedPdf.save();
};

/**
 * Convert GIF or WebP to PNG using canvas
 */
const convertImageToPng = (
  bytes: ArrayBuffer,
  mimeType: string
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (pngBlob) => {
          URL.revokeObjectURL(url);
          if (!pngBlob) {
            reject(new Error("Failed to convert to PNG"));
            return;
          }
          pngBlob
            .arrayBuffer()
            .then((buffer) => resolve(new Uint8Array(buffer)))
            .catch(reject);
        },
        "image/png"
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
};

/**
 * Print PDF blob using hidden iframe
 */
const printPDFBlob = (blobUrl: string): Promise<void> => {
  return new Promise((resolve) => {
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "-9999px";
    printFrame.style.bottom = "-9999px";
    printFrame.style.width = "1px";
    printFrame.style.height = "1px";
    printFrame.style.border = "0";
    printFrame.src = blobUrl;
    document.body.appendChild(printFrame);

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
        URL.revokeObjectURL(blobUrl);
        resolve();
      }, 500);
    };

    printFrame.onload = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();

          if (printFrame.contentWindow) {
            printFrame.contentWindow.addEventListener("afterprint", cleanup);
          }
        } catch (error) {
          console.error("Print error:", error);
          cleanup();
        }
      }, 500);
    };

    // Fallback cleanup
    setTimeout(cleanup, 60000);
  });
};

/**
 * Print a single file
 */
export const printSingleFile = async (
  fileId: string,
  fileName: string,
  mimeType: string,
  previewUrl: string
): Promise<void> => {
  await printFiles([
    {
      file_id: fileId,
      file_name: fileName,
      mime_type: mimeType,
      download_url: previewUrl,
    },
  ]);
};