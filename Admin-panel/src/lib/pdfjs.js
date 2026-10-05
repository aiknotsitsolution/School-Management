// Single place to configure pdf.js so the reader and the uploader share one
// worker setup. Vite emits the worker as its own asset (?url) instead of
// inlining it, keeping it out of the entry chunk.
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export default pdfjsLib;

export const isPdfUrl = (url = "", fileName = "") =>
  /\.pdf(\?|#|$)/i.test(String(url || "")) || /\.pdf$/i.test(String(fileName || ""));

// Reads a File's page count client-side (for "12 / 24" in the reader UI).
// Fail-soft: returns null when the file is not a readable PDF.
export async function readPdfPageCount(file) {
  if (!file) return null;
  if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") return null;
  try {
    const data = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pages = doc.numPages;
    doc.destroy();
    return pages;
  } catch {
    return null;
  }
}
