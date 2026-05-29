import { commentReactions, db, messageReactions } from "@sn/db";
import { inArray } from "drizzle-orm";

export const ALLOWED_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

export interface ReactionSummary {
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
}

function build(
  rows: { targetId: string; emoji: string; userId: string }[],
  viewerId: string,
): Map<string, ReactionSummary> {
  const counts = new Map<string, Map<string, number>>();
  const mine = new Map<string, string>();
  for (const r of rows) {
    if (!counts.has(r.targetId)) counts.set(r.targetId, new Map());
    const m = counts.get(r.targetId)!;
    m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1);
    if (r.userId === viewerId) mine.set(r.targetId, r.emoji);
  }
  const result = new Map<string, ReactionSummary>();
  for (const [targetId, m] of counts) {
    result.set(targetId, {
      reactions: [...m.entries()].map(([emoji, count]) => ({ emoji, count })),
      myReaction: mine.get(targetId) ?? null,
    });
  }
  return result;
}

export async function getCommentReactions(commentIds: string[], viewerId: string) {
  if (commentIds.length === 0) return new Map<string, ReactionSummary>();
  const rows = await db
    .select({
      targetId: commentReactions.commentId,
      emoji: commentReactions.emoji,
      userId: commentReactions.userId,
    })
    .from(commentReactions)
    .where(inArray(commentReactions.commentId, commentIds));
  return build(rows, viewerId);
}

export async function getMessageReactions(messageIds: string[], viewerId: string) {
  if (messageIds.length === 0) return new Map<string, ReactionSummary>();
  const rows = await db
    .select({
      targetId: messageReactions.messageId,
      emoji: messageReactions.emoji,
      userId: messageReactions.userId,
    })
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds));
  return build(rows, viewerId);
}

const EMPTY: ReactionSummary = { reactions: [], myReaction: null };
export { EMPTY as EMPTY_REACTIONS };
