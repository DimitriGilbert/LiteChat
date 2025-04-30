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
  ".mod", // Go modules
  ".sum", // Go modules checksum
  ".csproj", // C# project
  ".vbproj", // VB.NET project
  ".fsproj", // F# project
  ".sln", // Visual Studio solution
  ".props", // MSBuild props
  ".targets", // MSBuild targets
  ".gradle", // Gradle build script
  ".kts", // Kotlin script (often build scripts)
  ".pom", // Maven project
  ".rst", // reStructuredText
  ".tex", // LaTeX
  ".bib", // BibTeX
  ".r", // R language
  ".rmd", // R Markdown
  ".pl", // Perl
  ".pm", // Perl module
  ".lua", // Lua
  ".dart", // Dart
  ".diff", // Diff file
  ".patch", // Patch file
  ".applescript", // AppleScript
  ".properties", // Java properties
  ".http", // HTTP request file
  ".rest", // REST client file
  ".tf", // Terraform
  ".tfvars", // Terraform variables
  ".hcl", // HashiCorp Configuration Language
  ".rego", // Open Policy Agent Rego
  ".liquid", // Liquid template
  ".erb", // ERB template
  ".jinja", // Jinja template
  ".j2", // Jinja2 template alias
  ".mustache", // Mustache template
  ".hbs", // Handlebars template
  ".pug", // Pug template
  ".haml", // Haml template
  ".slim", // Slim template
  ".svelte", // Svelte component
  ".vue", // Vue component
  ".astro", // Astro component
  ".svg", // SVG is XML-based text
  ".webmanifest", // Web App Manifest
  ".vtt", // WebVTT subtitles
  ".srt", // SubRip subtitles
  ".sbv", // YouTube subtitles
  ".ass", // Advanced SubStation Alpha subtitles
  ".ssa", // SubStation Alpha subtitles
  ".config", // General config extension
  ".mdx", // MDX (Markdown + JSX)
  ".nfo", // Info file (often text)
  ".diz", // Description in Zip
]);
Object.freeze(COMMON_TEXT_EXTENSIONS);

// Helper function to check if a file is likely text-based
export const isLikelyTextFile = (
  name: string | undefined | null,
  mimeType?: string | undefined | null,
): boolean => {
  if (!name) return false; // Need a name to check extension

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
  const extension = "." + fileNameLower.split(".").pop();
  return COMMON_TEXT_EXTENSIONS.has(extension);
};
