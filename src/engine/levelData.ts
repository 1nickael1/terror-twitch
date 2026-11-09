export const CELL = 2;
export const WALL_HEIGHT = 3;

export interface Vec2 { x: number; z: number }
export interface Cell { col: number; row: number }

export interface LevelData {
  rows: string[];
  cols: number;
  rowCount: number;
  playerSpawn: Vec2;
  monsterSpawn: Vec2;
}

const FLOOR = new Set(['.', 'P', 'M', 'L', 'A', 'D']);
const OPAQUE = new Set(['#', 'C', ' ']);

function locate(rows: string[], ch: string): Cell[] {
  const out: Cell[] = [];
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) if (line[col] === ch) out.push({ col, row });
  });
  return out;
}

export function cellCenter(c: Cell): Vec2 {
  return { x: c.col * CELL + CELL / 2, z: c.row * CELL + CELL / 2 };
}

export function cellOf(p: Vec2): Cell {
  return { col: Math.floor(p.x / CELL), row: Math.floor(p.z / CELL) };
}

export function parseLevel(src: string): LevelData {
  const raw = src.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  const cols = Math.max(0, ...raw.map((l) => l.length));
  const rows = raw.map((l) => l.padEnd(cols, ' '));
  const ps = locate(rows, 'P');
  if (ps.length !== 1) throw new Error(`Mapa precisa de exatamente um P (achei ${ps.length})`);
  const ms = locate(rows, 'M');
  if (ms.length !== 1) throw new Error(`Mapa precisa de exatamente um M (achei ${ms.length})`);
  return { rows, cols, rowCount: rows.length, playerSpawn: cellCenter(ps[0]), monsterSpawn: cellCenter(ms[0]) };
}

export function findCells(level: LevelData, ch: string): Cell[] {
  return locate(level.rows, ch);
}

export function cellAt(level: LevelData, col: number, row: number): string {
  if (row < 0 || row >= level.rowCount || col < 0 || col >= level.cols) return ' ';
  return level.rows[row][col];
}

export function isBlocking(level: LevelData, col: number, row: number): boolean {
  return !FLOOR.has(cellAt(level, col, row));
}

export function isOpaque(level: LevelData, col: number, row: number): boolean {
  return OPAQUE.has(cellAt(level, col, row));
}

export function hasLineOfSight(level: LevelData, a: Vec2, b: Vec2, step = 0.25): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const c = cellOf({ x: a.x + dx * t, z: a.z + dz * t });
    if (isOpaque(level, c.col, c.row)) return false;
  }
  return true;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function nextWaypoint(level: LevelData, from: Vec2, to: Vec2): Vec2 | null {
  const start = cellOf(from);
  const goal = cellOf(to);
  if (start.col === goal.col && start.row === goal.row) return { ...to };
  const key = (c: Cell) => c.row * level.cols + c.col;
  const startKey = key(start);
  const prev = new Map<number, number>([[startKey, -1]]);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.col === goal.col && cur.row === goal.row) {
      let k = key(cur);
      let p = prev.get(k)!;
      while (p !== startKey) {
        k = p;
        p = prev.get(k)!;
      }
      return cellCenter({ col: k % level.cols, row: Math.floor(k / level.cols) });
    }
    for (const [dc, dr] of DIRS) {
      const n = { col: cur.col + dc, row: cur.row + dr };
      if (isBlocking(level, n.col, n.row)) continue;
      const nk = key(n);
      if (prev.has(nk)) continue;
      prev.set(nk, key(cur));
      queue.push(n);
    }
  }
  return null;
}
