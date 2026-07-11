import { BASE_URL } from "./config";
import { getAuthToken } from "./auth";

/**
 * Resolves an upload path returned by the API (e.g. `/uploads/live.png`) into a
 * fully-qualified URL. Absolute URLs are returned untouched.
 *
 * @param path     The stored path or absolute URL.
 * @param baseUrl  The host serving the files. Defaults to `BASE_URL`.
 */
export function getUploadUrl(path: string, baseUrl: string = BASE_URL): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${baseUrl}${path}`;
}

/**
 * Uploads a file to the API's `/uploads` endpoint, authenticating with the
 * stored token. Returns the stored path (feed it back through `getUploadUrl`
 * to display).
 */
export async function uploadFile(
  file: File,
  baseUrl: string = BASE_URL,
): Promise<{ url: string; filename: string }> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${baseUrl}/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || "Erro ao fazer upload");
  }

  return res.json();
}
