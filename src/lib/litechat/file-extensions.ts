// src/lib/litechat/file-extensions.ts
// Single source of truth for common text file extensions
export const COMMON_TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".less",
  ".py",
  ".pyw",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".kts",
  ".rs",
  ".toml",
  ".yaml",
  ".yml",
  ".xml",
  ".sh",
  ".bash",
  ".zsh",
  ".bat",
  ".cmd",
  ".ps1",
  ".gitignore",
  ".gitattributes",
  ".env",
  ".log",
  ".csv",
  ".tsv",
  ".ini",
  ".cfg",
  ".conf",
  ".sql",
  ".dockerfile",
  "dockerfile",
  ".mod",
  ".sum",
  ".csproj",
  ".vbproj",
  ".fsproj",
  ".sln",
  ".props",
  ".targets",
  ".gradle",
  ".kts",
  ".pom",
  ".rst",
  ".tex",
  ".bib",
  ".r",
  ".rmd",
  ".pl",
  ".pm",
  ".lua",
  ".dart",
  ".diff",
  ".patch",
  ".applescript",
  ".properties",
  ".http",
  ".rest",
  ".tf",
  ".tfvars",
  ".hcl",
  ".rego",
  ".liquid",
  ".erb",
  ".jinja",
  ".j2",
  ".mustache",
  ".hbs",
  ".pug",
  ".haml",
  ".slim",
  ".svelte",
  ".vue",
  ".astro",
  ".svg",
  ".webmanifest",
  ".vtt",
  ".srt",
  ".sbv",
  ".ass",
  ".ssa",
  ".config",
  ".mdx",
  ".nfo",
  ".diz",
]);
Object.freeze(COMMON_TEXT_EXTENSIONS);

// Helper function to check if a file is likely text-based
export const isLikelyTextFile = (
  name: string | undefined | null,
  mimeType?: string | undefined | null
): boolean => {
  if (!name) return false;

  const fileNameLower = name.toLowerCase();

  // Prioritize specific text MIME types
  if (
    mimeType?.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/yaml" ||
    mimeType === "application/toml" ||
    mimeType === "application/sql" ||
    mimeType === "application/x-sh" || // Shell script
    mimeType === "application/x-httpd-php" || // PHP
    mimeType === "application/x-python" || // Python
    mimeType === "application/x-ruby" || // Ruby
    mimeType === "image/svg+xml" // SVG is text
  ) {
    return true;
  }

  // Fallback: Check extension against the common list
  const fsplitname = fileNameLower.split(".");
  // no ext === text !
  if (fsplitname.length < 2) return true;
  const extension = "." + fileNameLower.split(".").pop();
  return COMMON_TEXT_EXTENSIONS.has(extension);
};
