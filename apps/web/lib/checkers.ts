// Русские шашки: логика ходов, обязательный бой, дамки, бот на минимаксе.

export type Cell = null | "w" | "W" | "b" | "B";
export type Board = Cell[][];
export type Side = "w" | "b";

const DIRS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function inside(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
export function sideOf(cell: Cell): Side | null {
  if (cell === "w" || cell === "W") return "w";
  if (cell === "b" || cell === "B") return "b";
  return null;
}
export function isKing(cell: Cell) {
  return cell === "W" || cell === "B";
}
function clone(b: Board): Board {
  return b.map((row) => [...row]);
}

export function initBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array<Cell>(8).fill(null));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) b[r][c] = "b";
        else if (r > 4) b[r][c] = "w";
      }
    }
  }
  return b;
}

export interface Capture {
  to: [number, number];
  cap: [number, number];
}

/** Одиночные взятия из клетки (без учёта цепочек). */
export function capturesFrom(board: Board, r: number, c: number): Capture[] {
  const cell = board[r][c];
  const side = sideOf(cell);
  if (!side) return [];
  const res: Capture[] = [];

  if (!isKing(cell)) {
    for (const [dr, dc] of DIRS) {
      const er = r + dr, ec = c + dc;
      const tr = r + 2 * dr, tc = c + 2 * dc;
      if (inside(tr, tc) && board[tr][tc] === null) {
        const victim = inside(er, ec) ? board[er][ec] : null;
        if (victim && sideOf(victim) && sideOf(victim) !== side) {
          res.push({ to: [tr, tc], cap: [er, ec] });
        }
      }
    }
  } else {
    for (const [dr, dc] of DIRS) {
      let er = r + dr, ec = c + dc;
      while (inside(er, ec) && board[er][ec] === null) {
        er += dr;
        ec += dc;
      }
      if (inside(er, ec) && sideOf(board[er][ec]) && sideOf(board[er][ec]) !== side) {
        let tr = er + dr, tc = ec + dc;
        while (inside(tr, tc) && board[tr][tc] === null) {
          res.push({ to: [tr, tc], cap: [er, ec] });
          tr += dr;
          tc += dc;
        }
      }
    }
  }
  return res;
}

/** Тихие ходы (без боя). */
export function quietFrom(board: Board, r: number, c: number): [number, number][] {
  const cell = board[r][c];
  const side = sideOf(cell);
  if (!side) return [];
  const res: [number, number][] = [];

  if (!isKing(cell)) {
    const fdr = side === "w" ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = r + fdr, nc = c + dc;
      if (inside(nr, nc) && board[nr][nc] === null) res.push([nr, nc]);
    }
  } else {
    for (const [dr, dc] of DIRS) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc) && board[nr][nc] === null) {
        res.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
    }
  }
  return res;
}

export function sideHasCapture(board: Board, side: Side): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (sideOf(board[r][c]) === side && capturesFrom(board, r, c).length) return true;
  return false;
}

function promote(board: Board, r: number, c: number) {
  if (board[r][c] === "w" && r === 0) board[r][c] = "W";
  if (board[r][c] === "b" && r === 7) board[r][c] = "B";
}

/**
 * Применяет один шаг игрока из from в to. Возвращает новую доску, был ли бой,
 * и можно ли продолжить бой той же шашкой.
 */
export function applyStep(
  board: Board,
  from: [number, number],
  to: [number, number],
): { board: Board; captured: boolean; canContinue: boolean } {
  const nb = clone(board);
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = nb[fr][fc];

  const caps = capturesFrom(nb, fr, fc);
  const cap = caps.find((x) => x.to[0] === tr && x.to[1] === tc);

  nb[fr][fc] = null;
  nb[tr][tc] = piece;
  let captured = false;
  if (cap) {
    nb[cap.cap[0]][cap.cap[1]] = null;
    captured = true;
  }

  // продолжение боя возможно только если ещё есть взятия из новой позиции
  const canContinue = captured && capturesFrom(nb, tr, tc).length > 0;
  if (!canContinue) promote(nb, tr, tc);

  return { board: nb, captured, canContinue };
}

export interface FullMove {
  from: [number, number];
  steps: [number, number][];
  result: Board;
}

/** Полные ходы стороны (с цепочками боя) — для бота. */
export function fullMoves(board: Board, side: Side): FullMove[] {
  const moves: FullMove[] = [];
  const mustCapture = sideHasCapture(board, side);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (sideOf(board[r][c]) !== side) continue;
      if (mustCapture) {
        collectCaptures(board, r, c, [r, c], [], moves, [r, c]);
      } else {
        for (const [tr, tc] of quietFrom(board, r, c)) {
          const nb = clone(board);
          nb[tr][tc] = nb[r][c];
          nb[r][c] = null;
          promote(nb, tr, tc);
          moves.push({ from: [r, c], steps: [[tr, tc]], result: nb });
        }
      }
    }
  }
  return moves;
}

function collectCaptures(
  board: Board,
  r: number,
  c: number,
  origin: [number, number],
  steps: [number, number][],
  out: FullMove[],
  from: [number, number],
) {
  const caps = capturesFrom(board, r, c);
  if (caps.length === 0) {
    if (steps.length > 0) {
      const nb = clone(board);
      promote(nb, r, c);
      out.push({ from, steps, result: nb });
    }
    return;
  }
  for (const cap of caps) {
    const nb = clone(board);
    const piece = nb[r][c];
    nb[r][c] = null;
    nb[cap.cap[0]][cap.cap[1]] = null;
    nb[cap.to[0]][cap.to[1]] = piece;
    collectCaptures(nb, cap.to[0], cap.to[1], origin, [...steps, cap.to], out, from);
  }
}

/** Победитель: сторона, у соперника которой нет ходов/фигур. null — игра идёт. */
export function winner(board: Board): Side | null {
  const wHas = fullMoves(board, "w").length > 0;
  const bHas = fullMoves(board, "b").length > 0;
  if (!wHas) return "b";
  if (!bHas) return "w";
  return null;
}

function evaluate(board: Board): number {
  // с точки зрения чёрных (бот) — выше лучше для b
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell === "b") score += 3;
      else if (cell === "B") score += 8;
      else if (cell === "w") score -= 3;
      else if (cell === "W") score -= 8;
    }
  return score;
}

function minimax(board: Board, side: Side, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(board);
  const moves = fullMoves(board, side);
  if (moves.length === 0) return side === "b" ? -1000 : 1000;

  if (side === "b") {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, minimax(m.result, "w", depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      best = Math.min(best, minimax(m.result, "b", depth - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/** Лучший ход бота (чёрные). */
export function bestMove(board: Board, depth = 5): FullMove | null {
  const moves = fullMoves(board, "b");
  if (moves.length === 0) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const score = minimax(m.result, "w", depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
