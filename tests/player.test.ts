import { describe, expect, it } from 'vitest';
import { circleHitsWall } from '../src/engine/collision';
import { parseLevel } from '../src/engine/levelData';
import {
  applyLook, PITCH_LIMIT, PLAYER_RADIUS, RUN_MULTIPLIER, stepPlayer, WALK_SPEED, type PlayerState,
} from '../src/engine/player';

// Sala aberta: interior x ∈ [2, 12], z ∈ [2, 10].
const ROOM = parseLevel(['#######', '#.....#', '#..P..#', '#.....#', '#....M#', '#######'].join('\n'));
const EAST = -Math.PI / 2;
const at = (x: number, z: number, yaw = EAST): PlayerState => ({ pos: { x, z }, yaw, pitch: 0 });

describe('stepPlayer', () => {
  it('anda para frente na direção do yaw', () => {
    const s = stepPlayer(ROOM, at(7, 5), { forward: 1, strafe: 0, run: false }, 0.1);
    expect(s.pos.x).toBeCloseTo(7 + WALK_SPEED * 0.1);
    expect(s.pos.z).toBeCloseTo(5);
  });

  it('Shift multiplica a velocidade', () => {
    const s = stepPlayer(ROOM, at(7, 5), { forward: 1, strafe: 0, run: true }, 0.1);
    expect(s.pos.x).toBeCloseTo(7 + WALK_SPEED * RUN_MULTIPLIER * 0.1);
  });

  it('sem entrada não se move', () => {
    const s0 = at(7, 5);
    expect(stepPlayer(ROOM, s0, { forward: 0, strafe: 0, run: false }, 0.1)).toBe(s0);
  });

  it('não atravessa parede', () => {
    const s = stepPlayer(ROOM, at(11.5, 5), { forward: 1, strafe: 0, run: false }, 0.1);
    expect(s.pos.x).toBeLessThanOrEqual(12 - PLAYER_RADIUS);
    expect(circleHitsWall(ROOM, s.pos.x, s.pos.z, PLAYER_RADIUS)).toBe(false);
  });

  it('desliza ao longo da parede quando anda na diagonal contra ela', () => {
    // olhando +x, direita é +z
    const s = stepPlayer(ROOM, at(11.5, 5), { forward: 1, strafe: 1, run: false }, 0.1);
    expect(s.pos.x).toBeCloseTo(11.5);
    expect(s.pos.z).toBeGreaterThan(5.2);
  });

  it('diagonal não é mais rápida que reta', () => {
    const s = stepPlayer(ROOM, at(7, 5), { forward: 1, strafe: 1, run: false }, 0.1);
    expect(Math.hypot(s.pos.x - 7, s.pos.z - 5)).toBeCloseTo(WALK_SPEED * 0.1);
  });
});

describe('applyLook', () => {
  it('soma yaw e limita o pitch', () => {
    const s = applyLook(at(7, 5, 0), 0.5, 10);
    expect(s.yaw).toBeCloseTo(0.5);
    expect(s.pitch).toBe(PITCH_LIMIT);
    expect(applyLook(s, 0, -100).pitch).toBe(-PITCH_LIMIT);
  });
});
