import { describe, expect, it } from 'vitest';
import { circleHitsWall } from '../src/engine/collision';
import { parseLevel, type Vec2 } from '../src/engine/levelData';
import {
  createMonster, isAimingAt, MONSTER, updateMonster, yawTo, type MonsterContext, type MonsterState,
} from '../src/engine/monster';

// Sala aberta: interior x ∈ [2, 12], z ∈ [2, 10]; monstro em (11, 9).
const ROOM = parseLevel(['#######', '#.....#', '#..P..#', '#.....#', '#....M#', '#######'].join('\n'));
// Parede na col 4 (linhas 1–2) entre jogador (3,3) e monstro (15,3); linha 3 é aberta.
const WALLED = parseLevel(['#########', '#P..#..M#', '#...#...#', '#.......#', '#########'].join('\n'));

/** yaw do jogador (convenção da câmera) para mirar de `from` em `to` */
const aim = (from: Vec2, to: Vec2) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const ctx = (level = ROOM, playerPos: Vec2, playerYaw = 0): MonsterContext => ({ level, playerPos, playerYaw });

function run(m: MonsterState, c: MonsterContext, dt: number, steps: number) {
  let state = m;
  const events: string[] = [];
  for (let i = 0; i < steps; i++) {
    const r = updateMonster(state, c, dt);
    state = r.state;
    if (r.event) events.push(r.event);
  }
  return { state, events };
}

describe('parado → alerta', () => {
  const spawn = ROOM.monsterSpawn;

  it('fica parado se o jogador está longe e não mira', () => {
    const { state } = run(createMonster(spawn), ctx(ROOM, { x: 2.5, z: 2.5 }, 0), 0.25, 8);
    expect(state.mode).toBe('parado');
  });

  it('alerta quando o jogador chega a 8 m', () => {
    const r = updateMonster(createMonster(spawn), ctx(ROOM, { x: 11, z: 2.5 }), 0.1);
    expect(r.state.mode).toBe('alerta');
    expect(r.event).toBe('alertou');
  });

  it('alerta depois de 1,5 s acumulados de mira', () => {
    const p = { x: 2.5, z: 2.5 };
    const c = ctx(ROOM, p, aim(p, spawn));
    expect(run(createMonster(spawn), c, 0.25, 4).state.mode).toBe('parado');
    const { state, events } = run(createMonster(spawn), c, 0.25, 6);
    expect(state.mode).toBe('alerta');
    expect(events).toEqual(['alertou']);
  });

  it('mira através de parede não conta', () => {
    const p = WALLED.playerSpawn;
    const c = ctx(WALLED, p, aim(p, WALLED.monsterSpawn));
    expect(isAimingAt(WALLED, p, c.playerYaw, WALLED.monsterSpawn)).toBe(false);
    expect(run(createMonster(WALLED.monsterSpawn), c, 0.25, 12).state.mode).toBe('parado');
  });
});

describe('alerta → perseguição', () => {
  it('vira para o jogador em 2 s e então persegue', () => {
    const player = { x: 3, z: 3 };
    const alert: MonsterState = { ...createMonster(ROOM.monsterSpawn), mode: 'alerta' };
    const mid = run(alert, ctx(ROOM, player), 0.25, 4).state;
    expect(mid.mode).toBe('alerta');
    const end = run(alert, ctx(ROOM, player), 0.25, 8).state;
    expect(end.mode).toBe('perseguicao');
    expect(end.yaw).toBeCloseTo(yawTo(ROOM.monsterSpawn, player));
  });
});

describe('perseguição', () => {
  it('se aproxima do jogador', () => {
    const player = { x: 3, z: 3 };
    const m: MonsterState = { ...createMonster(ROOM.monsterSpawn), mode: 'perseguicao' };
    const d0 = Math.hypot(m.pos.x - player.x, m.pos.z - player.z);
    const { state } = run(m, ctx(ROOM, player), 0.1, 3);
    const d1 = Math.hypot(state.pos.x - player.x, state.pos.z - player.z);
    expect(d1).toBeLessThan(d0 - 2);
  });

  it('contorna a parede e alcança o jogador sem atravessar paredes', () => {
    const player = { x: 3, z: 7 };
    let m: MonsterState = { ...createMonster(WALLED.monsterSpawn), mode: 'perseguicao' };
    let pegou = false;
    for (let i = 0; i < 80 && !pegou; i++) {
      const r = updateMonster(m, ctx(WALLED, player), 0.05);
      m = r.state;
      expect(circleHitsWall(WALLED, m.pos.x, m.pos.z, MONSTER.radius)).toBe(false);
      pegou = r.event === 'pegou';
    }
    expect(pegou).toBe(true);
  });
});

describe('pegou → reiniciar', () => {
  it('pega quando encosta e pede reinício depois de 1 s', () => {
    const player = { x: 7, z: 5 };
    const m: MonsterState = { ...createMonster({ x: 7.5, z: 5 }), mode: 'perseguicao' };
    const r = updateMonster(m, ctx(ROOM, player), 0.016);
    expect(r.state.mode).toBe('pegou');
    expect(r.event).toBe('pegou');
    const { events } = run(r.state, ctx(ROOM, player), 0.25, 4);
    expect(events).toEqual(['reiniciar']);
  });
});
