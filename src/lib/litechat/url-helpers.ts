// src/lib/litechat/url-helpers.ts
export interface AppUrlParameters {
  query?: string;
  modelId?: string;
  vfsFiles?: string[];
  submit?: "0" | "1"; // New parameter: 0 = don't submit, 1 = submit (default)
}

export function parseAppUrlParameters(): AppUrlParameters {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") ?? undefined;
  const modelId = params.get("m") ?? undefined;
  const vfsFiles = params.getAll("vfs").filter(Boolean);
  const submit = (params.get("s") as "0" | "1") ?? "1"; // Default to submit

  return {
    query,
    modelId,
    vfsFiles: vfsFiles.length > 0 ? vfsFiles : undefined,
    submit,
  };
}
