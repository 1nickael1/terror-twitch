import { moveWithCollision } from './collision';
import type { LevelData, Vec2 } from './levelData';

export interface PlayerState { pos: Vec2; yaw: number; pitch: number }
export interface MoveInput { forward: number; strafe: number; run: boolean }

export const PLAYER_RADIUS = 0.35;
export const WALK_SPEED = 4;
export const RUN_MULTIPLIER = 1.7;
export const PITCH_LIMIT = 1.4;

export function forwardVec(yaw: number): Vec2 {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function rightVec(yaw: number): Vec2 {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

export function stepPlayer(level: LevelData, s: PlayerState, input: MoveInput, dt: number): PlayerState {
  const f = forwardVec(s.yaw);
  const r = rightVec(s.yaw);
  let dx = f.x * input.forward + r.x * input.strafe;
  let dz = f.z * input.forward + r.z * input.strafe;
  const len = Math.hypot(dx, dz);
  if (len === 0) return s;
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  const step = WALK_SPEED * (input.run ? RUN_MULTIPLIER : 1) * dt;
  return { ...s, pos: moveWithCollision(level, s.pos, dx * step, dz * step, PLAYER_RADIUS) };
}

export function applyLook(s: PlayerState, dYaw: number, dPitch: number): PlayerState {
  return {
    ...s,
    yaw: s.yaw + dYaw,
    pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.pitch + dPitch)),
  };
}
