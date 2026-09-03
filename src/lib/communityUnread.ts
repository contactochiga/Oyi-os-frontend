// Canonical "unread Community update" count, shared by the Community page
// and the Home operating strip so "N updates" always means the same thing
// in both places: real unread community/announcement/notice notifications,
// not a raw count of all available posts.
export function communityReadStorageKey(userId: string, estateId: string, homeId: string) {
  return `oyi:community:read:${userId || "user"}:${estateId || "estate"}:${homeId || "home"}`;
}

export function readLocalCommunityReadIds(userId: string, estateId: string, homeId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(communityReadStorageKey(userId, estateId, homeId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function countUnreadCommunityUpdates(notificationItems: any[], localReadIds: Set<string>) {
  return notificationItems.filter((item: any) => {
    const postId = String(item?.payload?.post_id || item?.entity_id || item?.post_id || "");
    return String(item?.status || "") !== "read" && !localReadIds.has(postId) && /community|announcement|notice/.test(`${item?.type || ""} ${item?.title || ""} ${item?.message || ""}`.toLowerCase());
  }).length;
}
