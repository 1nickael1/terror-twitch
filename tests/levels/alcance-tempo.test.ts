// tests/levels/alcance-tempo.test.ts — condição `tempo` na busca de alcance do validador (C3.1, correção 1)
import { describe, expect, it } from 'vitest';
import { condicaoAlcancavel, type Alcance, type Contexto } from '../../src/levels/alcance';
import type { GatilhoDef } from '../../src/sim/fase';
import { criarGrid, type Coord } from '../../src/sim/grid';
import { faseMinima } from '../sim/ajuda';

const SALA = `
  ########
  #P.....#
  ########
`;

/** Só as células [1..3, 1] são alcançáveis. */
const ALCANCE: Alcance = { noAlcance: (c: Coord) => c[1] === 1 && c[0] >= 1 && c[0] <= 3 };

function contexto(gatilhos: GatilhoDef[]): Contexto {
  const f = faseMinima(SALA, { gatilhos, saida: [6, 1] });
  return { f, g: criarGrid(f.planta), inicio: [1, 1], onde: () => null, portas: [], grupos: new Set() };
}

describe('condicaoAlcancavel: tempo', () => {
  it('desde alcançável → alcançável; desde com área fora do alcance → não', () => {
    const ctx = contexto([
      { id: 'perto', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [] },
      { id: 'longe', quando: { tipo: 'area', area: [5, 1, 1, 1] }, faz: [] },
    ]);
    expect(condicaoAlcancavel(ctx, ALCANCE, { tipo: 'tempo', apos: 3, desde: 'perto' })).toBe(true);
    expect(condicaoAlcancavel(ctx, ALCANCE, { tipo: 'tempo', apos: 3, desde: 'longe' })).toBe(false);
  });

  it('encadeado: tempo desde um gatilho de tempo alcançável → alcançável', () => {
    const ctx = contexto([
      { id: 'a', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [] },
      { id: 'b', quando: { tipo: 'tempo', apos: 1, desde: 'a' }, faz: [] },
    ]);
    expect(condicaoAlcancavel(ctx, ALCANCE, { tipo: 'tempo', apos: 2, desde: 'b' })).toBe(true);
  });

  it('desde inexistente → não alcançável', () => {
    const ctx = contexto([]);
    expect(condicaoAlcancavel(ctx, ALCANCE, { tipo: 'tempo', apos: 1, desde: 'fantasma' })).toBe(false);
  });

  it('ciclo de tempo entre dois gatilhos → não alcançável, e termina', () => {
    const ctx = contexto([
      { id: 'a', quando: { tipo: 'tempo', apos: 1, desde: 'b' }, faz: [] },
      { id: 'b', quando: { tipo: 'tempo', apos: 1, desde: 'a' }, faz: [] },
    ]);
    expect(condicaoAlcancavel(ctx, ALCANCE, ctx.f.gatilhos[0].quando)).toBe(false);
    expect(condicaoAlcancavel(ctx, ALCANCE, { tipo: 'tempo', apos: 1, desde: 'a' })).toBe(false);
  });
});
