import { db, friendships } from "@sn/db";
import { and, eq, or } from "drizzle-orm";

export type FriendState = "none" | "friends" | "outgoing" | "incoming";

/**
 * Статус отношений между viewer и other с точки зрения viewer:
 *  - friends:  заявка принята (взаимная дружба)
 *  - outgoing: viewer отправил заявку, ждёт ответа
 *  - incoming: other отправил заявку viewer'у
 *  - none:     никаких связей
 */
export async function getFriendState(viewerId: string, otherId: string): Promise<FriendState> {
  if (viewerId === otherId) return "none";

  const [row] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, otherId)),
        and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, viewerId)),
      ),
    )
    .limit(1);

  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  // pending
  return row.requesterId === viewerId ? "outgoing" : "incoming";
}
