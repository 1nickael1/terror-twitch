import { CELL, isBlocking, type LevelData, type Vec2 } from './levelData';

export function circleHitsWall(level: LevelData, x: number, z: number, r: number): boolean {
  const c0 = Math.floor((x - r) / CELL);
  const c1 = Math.floor((x + r) / CELL);
  const r0 = Math.floor((z - r) / CELL);
  const r1 = Math.floor((z + r) / CELL);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!isBlocking(level, col, row)) continue;
      const nx = Math.max(col * CELL, Math.min(x, (col + 1) * CELL));
      const nz = Math.max(row * CELL, Math.min(z, (row + 1) * CELL));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < r * r) return true;
    }
  }
  return false;
}

export function moveWithCollision(level: LevelData, pos: Vec2, dx: number, dz: number, r: number): Vec2 {
  let x = pos.x + dx;
  if (circleHitsWall(level, x, pos.z, r)) x = pos.x;
  let z = pos.z + dz;
  if (circleHitsWall(level, x, z, r)) z = pos.z;
  return { x, z };
}
