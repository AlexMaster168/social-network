import type { User } from "@sn/db";

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  status: string | null;
  city: string | null;
  birthday: string | null;
  relationship: User["relationship"];
  avatarPhotoId: string | null;
  avatarUrl: string | null;
  coverPhotoId: string | null;
  coverUrl: string | null;
  createdAt: Date;
}

/**
 * Безопасное представление пользователя для отдачи наружу
 * (без passwordHash). avatarUrl/coverUrl подставляются там,
 * где есть join с таблицей photos.
 */
export function publicUser(
  user: User,
  avatarUrl: string | null = null,
  coverUrl: string | null = null,
): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    status: user.status,
    city: user.city,
    birthday: user.birthday,
    relationship: user.relationship,
    avatarPhotoId: user.avatarPhotoId,
    avatarUrl,
    coverPhotoId: user.coverPhotoId,
    coverUrl,
    createdAt: user.createdAt,
  };
}
