export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function fileTypeLabel(name = "") {
  const ext = String(name).split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "FILE";
}