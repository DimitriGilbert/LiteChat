// src/lib/litechat/file-manager-utils.ts
// Add buildPath export

/**
 * Formats bytes into a human-readable string (KB, MB, GB, etc.).
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
 * Normalizes a path string.
 */
export const normalizePath = (path: string): string => {
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
 */
export const basename = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "";
  return normalized.substring(normalized.lastIndexOf("/") + 1);
};

/**
 * Builds a full path from a parent path and a name.
 */
export const buildPath = (parentPath: string, name: string): string => {
  return normalizePath(
    parentPath === "/" ? `/${name}` : `${parentPath}/${name}`,
  );
};
