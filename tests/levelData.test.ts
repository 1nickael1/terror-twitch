import { describe, expect, it } from 'vitest';
import {
  cellAt, cellCenter, cellOf, findCells, hasLineOfSight, isBlocking, isOpaque, nextWaypoint, parseLevel,
} from '../src/engine/levelData';
import { MAPA } from '../src/engine/mapa';

const MINI = ['#####', '#P.M#', '#####'].join('\n');
const L_MAP = ['#####', '#P..#', '###.#', '###M#', '#####'].join('\n');

describe('parseLevel', () => {
  it('acha spawn do jogador e do monstro no centro das células', () => {
    const lv = parseLevel(MINI);
    expect(lv.cols).toBe(5);
    expect(lv.rowCount).toBe(3);
    expect(lv.playerSpawn).toEqual({ x: 3, z: 3 });
    expect(lv.monsterSpawn).toEqual({ x: 7, z: 3 });
  });

  it('completa linhas curtas com vazio e ignora linhas em branco/CRLF', () => {
    const lv = parseLevel('\r\n###\r\n#PM#\r\n##\r\n');
    expect(lv.cols).toBe(4);
    expect(cellAt(lv, 3, 2)).toBe(' ');
  });

  it('rejeita mapa sem P ou sem M', () => {
    expect(() => parseLevel('#.M#')).toThrow(/um P/);
    expect(() => parseLevel('#P.#')).toThrow(/um M/);
  });

  it('o mapa da cena é válido e tem luzes, alarme, mesa e porta arrombada', () => {
    const lv = parseLevel(MAPA);
    expect(findCells(lv, 'L').length).toBeGreaterThanOrEqual(3);
    expect(findCells(lv, 'A')).toHaveLength(1);
    expect(findCells(lv, 'T')).toHaveLength(1);
    expect(findCells(lv, 'D')).toHaveLength(1);
  });
});

describe('consultas da grade', () => {
  const lv = parseLevel(['#####', '#PTM#', '#####'].join('\n'));

  it('isBlocking: paredes, mesa e fora da grade bloqueiam; piso não', () => {
    expect(isBlocking(lv, 0, 0)).toBe(true);
    expect(isBlocking(lv, 2, 1)).toBe(true);
    expect(isBlocking(lv, 1, 1)).toBe(false);
    expect(isBlocking(lv, -1, 1)).toBe(true);
    expect(isBlocking(lv, 9, 9)).toBe(true);
  });

  it('isOpaque: mesa não bloqueia a visão; parede bloqueia', () => {
    expect(isOpaque(lv, 2, 1)).toBe(false);
    expect(isOpaque(lv, 0, 1)).toBe(true);
  });

  it('cellOf e cellCenter são inversos no centro', () => {
    expect(cellOf(cellCenter({ col: 3, row: 2 }))).toEqual({ col: 3, row: 2 });
  });
});

describe('hasLineOfSight', () => {
  it('vê através de piso e de mesa', () => {
    const lv = parseLevel(['#####', '#PTM#', '#####'].join('\n'));
    expect(hasLineOfSight(lv, { x: 3, z: 3 }, { x: 7, z: 3 })).toBe(true);
  });

  it('não vê através de parede', () => {
    const lv = parseLevel(L_MAP);
    expect(hasLineOfSight(lv, { x: 3, z: 3 }, { x: 7, z: 7 })).toBe(false);
  });
});

describe('nextWaypoint', () => {
  const lv = parseLevel(L_MAP);

  it('dá o centro da próxima célula no caminho em L', () => {
    expect(nextWaypoint(lv, { x: 3, z: 3 }, { x: 7, z: 7 })).toEqual({ x: 5, z: 3 });
  });

  it('na mesma célula devolve o próprio destino', () => {
    expect(nextWaypoint(lv, { x: 2.5, z: 3 }, { x: 3.5, z: 3.2 })).toEqual({ x: 3.5, z: 3.2 });
  });

  it('sem caminho devolve null', () => {
    const fechado = parseLevel(['#####', '#P#M#', '#####'].join('\n'));
    expect(nextWaypoint(fechado, { x: 3, z: 3 }, { x: 7, z: 3 })).toBeNull();
  });
});
