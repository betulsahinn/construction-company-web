/** Validate media URLs for rendering without mutating their stored value. */
export function normalizeMediaUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;

  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return url;
  if (url.startsWith("blob:")) return url;
  if (url.startsWith("data:image/")) return url;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
