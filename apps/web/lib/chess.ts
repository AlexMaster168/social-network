// Шахматы: ходы фигур, шах/мат/пат, бот (negamax + alpha-beta).
// Упрощения: без рокировки и взятия на проходе; пешка превращается в ферзя.

export type Piece = string; // 'P''N''B''R''Q''K' (белые) / строчные (чёрные) / "" пусто
export type Board = Piece[][];
export type Color = "w" | "b";
export interface Move {
  from: [number, number];
  to: [number, number];
}

export function colorOf(p: Piece): Color | null {
  if (!p) return null;
  return p === p.toUpperCase() ? "w" : "b";
}
function inside(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function clone(b: Board): Board {
  return b.map((row) => [...row]);
}

export function initBoard(): Board {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const b: Board = Array.from({ length: 8 }, () => Array<Piece>(8).fill(""));
  for (let c = 0; c < 8; c++) {
    b[0][c] = back[c];
    b[1][c] = "p";
    b[6][c] = "P";
    b[7][c] = back[c].toUpperCase();
  }
  return b;
}

const KNIGHT: [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const DIAG: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const KING: [number, number][] = [...DIAG, ...ORTHO];

/** Атакована ли клетка (r,c) стороной byColor. */
export function isAttacked(board: Board, r: number, c: number, byColor: Color): boolean {
  // пешки
  const pawnRow = byColor === "w" ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    const pc = c + dc;
    if (inside(pawnRow, pc)) {
      const p = board[pawnRow][pc];
      if (p && colorOf(p) === byColor && p.toLowerCase() === "p") return true;
    }
  }
  // кони
  for (const [dr, dc] of KNIGHT) {
    const nr = r + dr, nc = c + dc;
    if (inside(nr, nc)) {
      const p = board[nr][nc];
      if (p && colorOf(p) === byColor && p.toLowerCase() === "n") return true;
    }
  }
  // король
  for (const [dr, dc] of KING) {
    const nr = r + dr, nc = c + dc;
    if (inside(nr, nc)) {
      const p = board[nr][nc];
      if (p && colorOf(p) === byColor && p.toLowerCase() === "k") return true;
    }
  }
  // слоны/ферзь по диагонали
  for (const [dr, dc] of DIAG) {
    let nr = r + dr, nc = c + dc;
    while (inside(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (colorOf(p) === byColor && (p.toLowerCase() === "b" || p.toLowerCase() === "q")) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  // ладьи/ферзь по ортогонали
  for (const [dr, dc] of ORTHO) {
    let nr = r + dr, nc = c + dc;
    while (inside(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (colorOf(p) === byColor && (p.toLowerCase() === "r" || p.toLowerCase() === "q")) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return false;
}

function findKing(board: Board, color: Color): [number, number] | null {
  const k = color === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) if (board[r][c] === k) return [r, c];
  return null;
}

export function inCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color);
  if (!k) return false;
  return isAttacked(board, k[0], k[1], color === "w" ? "b" : "w");
}

/** Псевдо-ходы одной фигуры (без проверки шаха). */
function pseudoMoves(board: Board, r: number, c: number): [number, number][] {
  const p = board[r][c];
  const color = colorOf(p);
  if (!color) return [];
  const out: [number, number][] = [];
  const type = p.toLowerCase();
  const enemy = color === "w" ? "b" : "w";

  const addSlide = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) {
        if (!board[nr][nc]) out.push([nr, nc]);
        else {
          if (colorOf(board[nr][nc]) === enemy) out.push([nr, nc]);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  };

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    const start = color === "w" ? 6 : 1;
    if (inside(r + dir, c) && !board[r + dir][c]) {
      out.push([r + dir, c]);
      if (r === start && !board[r + 2 * dir][c]) out.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inside(nr, nc) && board[nr][nc] && colorOf(board[nr][nc]) === enemy) out.push([nr, nc]);
    }
  } else if (type === "n") {
    for (const [dr, dc] of KNIGHT) {
      const nr = r + dr, nc = c + dc;
      if (inside(nr, nc) && colorOf(board[nr][nc]) !== color) out.push([nr, nc]);
    }
  } else if (type === "b") addSlide(DIAG);
  else if (type === "r") addSlide(ORTHO);
  else if (type === "q") addSlide([...DIAG, ...ORTHO]);
  else if (type === "k") {
    for (const [dr, dc] of KING) {
      const nr = r + dr, nc = c + dc;
      if (inside(nr, nc) && colorOf(board[nr][nc]) !== color) out.push([nr, nc]);
    }
  }
  return out;
}

/** Применяет ход (с превращением пешки в ферзя). */
export function makeMove(board: Board, m: Move): Board {
  const nb = clone(board);
  const [fr, fc] = m.from;
  const [tr, tc] = m.to;
  let piece = nb[fr][fc];
  nb[fr][fc] = "";
  // превращение пешки
  if (piece === "P" && tr === 0) piece = "Q";
  if (piece === "p" && tr === 7) piece = "q";
  nb[tr][tc] = piece;
  return nb;
}

/** Все легальные ходы стороны (не оставляющие короля под шахом). */
export function legalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (colorOf(board[r][c]) !== color) continue;
      for (const to of pseudoMoves(board, r, c)) {
        const m: Move = { from: [r, c], to };
        const nb = makeMove(board, m);
        if (!inCheck(nb, color)) moves.push(m);
      }
    }
  }
  return moves;
}

export function legalMovesFrom(board: Board, r: number, c: number): [number, number][] {
  const color = colorOf(board[r][c]);
  if (!color) return [];
  return pseudoMoves(board, r, c)
    .filter((to) => !inCheck(makeMove(board, { from: [r, c], to }), color))
    .map((to) => to);
}

export type GameResult = "checkmate" | "stalemate" | null;
export function gameResult(board: Board, color: Color): GameResult {
  if (legalMoves(board, color).length > 0) return null;
  return inCheck(board, color) ? "checkmate" : "stalemate";
}

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluate(board: Board): number {
  // с точки зрения чёрных (бот играет чёрными)
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = VALUE[p.toLowerCase()] ?? 0;
      score += colorOf(p) === "b" ? v : -v;
    }
  return score;
}

function negamax(board: Board, color: Color, depth: number, alpha: number, beta: number): number {
  const result = gameResult(board, color);
  if (result === "checkmate") return color === "b" ? -100000 + (5 - depth) : 100000 - (5 - depth);
  if (result === "stalemate") return 0;
  if (depth === 0) return color === "b" ? evaluate(board) : -evaluate(board);

  let best = -Infinity;
  for (const m of legalMoves(board, color)) {
    const score = -negamax(makeMove(board, m), color === "w" ? "b" : "w", depth - 1, -beta, -alpha);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

/** Лучший ход бота (чёрные). */
export function bestMove(board: Board, depth = 3): Move | null {
  const moves = legalMoves(board, "b");
  if (moves.length === 0) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const score = -negamax(makeMove(board, m), "w", depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export const GLYPH: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};
