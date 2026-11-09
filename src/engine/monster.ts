import { moveWithCollision } from './collision';
import { hasLineOfSight, nextWaypoint, type LevelData, type Vec2 } from './levelData';
import { forwardVec } from './player';

export const MONSTER = {
  triggerDistance: 8,
  gazeSeconds: 1.5,
  gazeAngle: (6 * Math.PI) / 180,
  turnSeconds: 2,
  speed: 9,
  catchDistance: 0.8,
  caughtSeconds: 1,
  radius: 0.4,
} as const;

export type MonsterMode = 'parado' | 'alerta' | 'perseguicao' | 'pegou';
export type MonsterEvent = 'alertou' | 'pegou' | 'reiniciar';

export interface MonsterState {
  mode: MonsterMode;
  pos: Vec2;
  /** frente = (sin yaw, cos yaw) */
  yaw: number;
  fromYaw: number;
  gazeTime: number;
  timer: number;
}

export interface MonsterContext {
  level: LevelData;
  playerPos: Vec2;
  playerYaw: number;
}

export interface MonsterUpdate {
  state: MonsterState;
  event?: MonsterEvent;
}

export function createMonster(spawn: Vec2, yaw = 0): MonsterState {
  return { mode: 'parado', pos: { ...spawn }, yaw, fromYaw: yaw, gazeTime: 0, timer: 0 };
}

export function yawTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function isAimingAt(level: LevelData, eye: Vec2, yaw: number, target: Vec2): boolean {
  const dx = target.x - eye.x;
  const dz = target.z - eye.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return true;
  const f = forwardVec(yaw);
  if ((f.x * dx + f.z * dz) / len < Math.cos(MONSTER.gazeAngle)) return false;
  return hasLineOfSight(level, eye, target);
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a + Math.PI) % (2 * Math.PI);
  if (d < 0) d += 2 * Math.PI;
  return a + (d - Math.PI) * t;
}

const smooth = (k: number) => k * k * (3 - 2 * k);

export function updateMonster(m: MonsterState, ctx: MonsterContext, dt: number): MonsterUpdate {
  const { level, playerPos, playerYaw } = ctx;
  const dist = Math.hypot(playerPos.x - m.pos.x, playerPos.z - m.pos.z);

  switch (m.mode) {
    case 'parado': {
      const gazeTime = isAimingAt(level, playerPos, playerYaw, m.pos) ? m.gazeTime + dt : m.gazeTime;
      if (dist <= MONSTER.triggerDistance || gazeTime >= MONSTER.gazeSeconds) {
        return { state: { ...m, mode: 'alerta', gazeTime, timer: 0, fromYaw: m.yaw }, event: 'alertou' };
      }
      return { state: { ...m, gazeTime } };
    }
    case 'alerta': {
      const timer = m.timer + dt;
      const target = yawTo(m.pos, playerPos);
      if (timer >= MONSTER.turnSeconds) return { state: { ...m, mode: 'perseguicao', yaw: target, timer: 0 } };
      return { state: { ...m, timer, yaw: lerpAngle(m.fromYaw, target, smooth(timer / MONSTER.turnSeconds)) } };
    }
    case 'perseguicao': {
      if (dist <= MONSTER.catchDistance) return { state: { ...m, mode: 'pegou', timer: 0 }, event: 'pegou' };
      const goal = hasLineOfSight(level, m.pos, playerPos)
        ? playerPos
        : (nextWaypoint(level, m.pos, playerPos) ?? playerPos);
      const dx = goal.x - m.pos.x;
      const dz = goal.z - m.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = Math.min(MONSTER.speed * dt, len);
      const pos = moveWithCollision(level, m.pos, (dx / len) * step, (dz / len) * step, MONSTER.radius);
      return { state: { ...m, pos, yaw: Math.atan2(dx, dz) } };
    }
    case 'pegou': {
      const timer = m.timer + dt;
      return timer >= MONSTER.caughtSeconds
        ? { state: { ...m, timer }, event: 'reiniciar' }
        : { state: { ...m, timer } };
    }
  }
}
