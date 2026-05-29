import { db, comments, postAttachments, postReactions, posts, users } from "@sn/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getAvatarUrls } from "./avatars.js";

export interface Attachment {
  url: string;
  kind: "image" | "video" | "audio" | "voice" | "video_note" | "file";
  name: string | null;
  mime: string | null;
}

export interface FeedPost {
  id: string;
  content: string;
  imageUrl: string | null;
  attachments: Attachment[];
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role?: "owner" | "admin" | "member" | null;
  };
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  myReaction: "like" | "dislike" | null;
}

/** Собирает посты с агрегатами (лайки/дизлайки/комменты/моя реакция/аватар автора). */
export async function serializePosts(
  rows: { post: typeof posts.$inferSelect; author: typeof users.$inferSelect }[],
  viewerId: string,
): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.post.id);
  const authorIds = [...new Set(rows.map((r) => r.author.id))];

  // реакции, сгруппированные по посту и типу
  const reactionRows = await db
    .select({
      postId: postReactions.postId,
      type: postReactions.type,
      count: sql<number>`count(*)::int`,
    })
    .from(postReactions)
    .where(inArray(postReactions.postId, postIds))
    .groupBy(postReactions.postId, postReactions.type);

  // количество комментариев
  const commentRows = await db
    .select({ postId: comments.postId, count: sql<number>`count(*)::int` })
    .from(comments)
    .where(inArray(comments.postId, postIds))
    .groupBy(comments.postId);

  // мои реакции
  const myReactionRows = await db
    .select({ postId: postReactions.postId, type: postReactions.type })
    .from(postReactions)
    .where(
      and(inArray(postReactions.postId, postIds), eq(postReactions.userId, viewerId)),
    );

  const avatarMap = await getAvatarUrls(authorIds);

  // вложения постов
  const attachRows = await db
    .select()
    .from(postAttachments)
    .where(inArray(postAttachments.postId, postIds));
  const attachMap = new Map<string, Attachment[]>();
  for (const a of attachRows) {
    if (!attachMap.has(a.postId)) attachMap.set(a.postId, []);
    attachMap.get(a.postId)!.push({ url: a.url, kind: a.kind, name: a.name, mime: a.mime });
  }

  const likes = new Map<string, number>();
  const dislikes = new Map<string, number>();
  for (const r of reactionRows) {
    if (r.type === "like") likes.set(r.postId, r.count);
    else dislikes.set(r.postId, r.count);
  }
  const commentCounts = new Map(commentRows.map((r) => [r.postId, r.count]));
  const myReactions = new Map(myReactionRows.map((r) => [r.postId, r.type]));

  return rows.map(({ post, author }) => ({
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl,
    attachments: attachMap.get(post.id) ?? [],
    createdAt: post.createdAt,
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: avatarMap.get(author.id) ?? null,
    },
    likeCount: likes.get(post.id) ?? 0,
    dislikeCount: dislikes.get(post.id) ?? 0,
    commentCount: commentCounts.get(post.id) ?? 0,
    myReaction: (myReactions.get(post.id) as "like" | "dislike" | undefined) ?? null,
  }));
}
