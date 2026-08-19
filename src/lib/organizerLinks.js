// Shared by OrganizerBox, OrganizerPage, and anywhere else an organizer's
// website/social handles need turning into real clickable URLs.
export function normalizeUrl(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function socialLink(handle, baseUrl) {
  if (!handle) return null;
  if (/^https?:\/\//i.test(handle)) return handle;
  const clean = handle.replace(/^@/, "");
  return `${baseUrl}${clean}`;
}
