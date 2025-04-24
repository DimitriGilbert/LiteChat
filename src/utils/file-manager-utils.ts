
/**
 * Formats bytes into a human-readable string (KB, MB, GB, etc.).
 * @param bytes - The number of bytes.
 * @param decimals - The number of decimal places to include.
 * @returns A formatted string representing the size.
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Normalizes a path string: ensures leading slash, removes trailing slash (unless root), collapses multiple slashes.
 * @param path - The path string to normalize.
 * @returns The normalized path string.
 */
export const normalizePath = (path: string): string => {
  // Ensure leading slash, remove trailing slash (unless root), collapse multiple slashes
  let p = path.replace(/\/+/g, "/");
  if (!p.startsWith("/")) {
    p = "/" + p;
  }
  if (p !== "/" && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
};

/**
 * Joins path segments into a single normalized path string.
 * @param segments - An array of path segments.
 * @returns The joined and normalized path string.
 */
export const joinPath = (...segments: string[]): string => {
  return normalizePath(
    segments
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/"),
  );
};

/**
 * Gets the directory name from a path string.
 * @param path - The path string.
 * @returns The directory path (parent path). Returns "/" for root or files directly under root.
 */
export const dirname = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) return "/";
  if (lastSlash === 0) return "/";
  return normalized.substring(0, lastSlash);
};

/**
 * Gets the base name (file or folder name) from a path string.
 * @param path - The path string.
 * @returns The base name. Returns "" for the root directory.
 */
export const basename = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "";
  return normalized.substring(normalized.lastIndexOf("/") + 1);
};
