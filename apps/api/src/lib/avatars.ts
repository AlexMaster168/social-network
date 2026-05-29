import { db, photos, users } from "@sn/db";
import { eq, inArray } from "drizzle-orm";

/**
 * Возвращает Map userId -> avatarUrl (или null) для набора пользователей.
 * Резолвит users.avatarPhotoId через таблицу photos.
 */
export async function getAvatarUrls(userIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select({ userId: users.id, url: photos.url })
    .from(users)
    .leftJoin(photos, eq(photos.id, users.avatarPhotoId))
    .where(inArray(users.id, userIds));

  for (const row of rows) {
    map.set(row.userId, row.url ?? null);
  }
  return map;
}

export async function getAvatarUrl(userId: string): Promise<string | null> {
  const map = await getAvatarUrls([userId]);
  return map.get(userId) ?? null;
}

/** Возвращает url фотографии по её id (для обложки профиля). */
export async function getPhotoUrl(photoId: string | null): Promise<string | null> {
  if (!photoId) return null;
  const [row] = await db
    .select({ url: photos.url })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  return row?.url ?? null;
}
