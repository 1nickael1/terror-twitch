// tests/sim/tempo.test.ts — condição `tempo` com `relogio` e `gatilhosQuando` (C3.1)
import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/eventos';
import type { GatilhoDef } from '../../src/sim/fase';
import { PASSO, step } from '../../src/sim/step';
import { INPUT_VAZIO, criarWorld, gravarCheckpoint, restaurarCheckpoint, type World } from '../../src/sim/world';
import { faseMinima } from './ajuda';

const SALA = `
  ########
  #P.....#
  #......#
  ########
`;

function passos(w: World, n: number): SimEvent[] {
  const ev: SimEvent[] = [];
  for (let k = 0; k < n; k++) ev.push(...step(w, INPUT_VAZIO, PASSO));
  return ev;
}
const disparou = (ev: readonly SimEvent[], id: string) => ev.some((e) => e.tipo === 'gatilho' && e.id === id);

/** `inicio` dispara no 1º passo (o P está na área); `depois` vale 2 s depois dele. */
function fase(extraInicio: GatilhoDef['faz'] = []) {
  return faseMinima(SALA, {
    saida: [6, 2],
    gatilhos: [
      { id: 'inicio', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'mensagem', texto: 'começou' }, ...extraInicio] },
      { id: 'depois', quando: { tipo: 'tempo', apos: 2, desde: 'inicio' }, faz: [{ acao: 'mensagem', texto: 'passou' }] },
    ],
  });
}

describe('relógio', () => {
  it('começa em 0, soma dt a cada passo e registra quando cada gatilho disparou', () => {
    const w = criarWorld(fase());
    expect(w.relogio).toBe(0);
    expect(w.gatilhosQuando).toEqual({});
    passos(w, 30);
    expect(w.relogio).toBeCloseTo(0.5, 9);
    expect(w.gatilhosQuando).toEqual({ inicio: 0 });
  });

  it('relogio e gatilhosQuando entram no snapshot', () => {
    const w = criarWorld(fase());
    passos(w, 10);
    gravarCheckpoint(w);
    const s = JSON.parse(w.checkpoint) as { relogio: number; gatilhosQuando: Record<string, number> };
    expect(s.relogio).toBeCloseTo(10 * PASSO, 9);
    expect(s.gatilhosQuando).toEqual({ inicio: 0 });
  });
});

describe('condição tempo', () => {
  it('não dispara antes de `apos` segundos e dispara no tempo certo, uma vez', () => {
    const w = criarWorld(fase());
    const antes = passos(w, 119);   // relógio do último passo: 118/60 s
    expect(disparou(antes, 'depois')).toBe(false);
    const agora = passos(w, 2);
    expect(disparou(agora, 'depois')).toBe(true);
    expect(w.gatilhosQuando.depois).toBeCloseTo(2, 6);
    expect(disparou(passos(w, 120), 'depois')).toBe(false);
  });

  it('sem o gatilho `desde` disparado, nunca vale', () => {
    const w = criarWorld(faseMinima(SALA, {
      saida: [6, 2],
      gatilhos: [
        { id: 'longe', quando: { tipo: 'area', area: [5, 2, 1, 1] }, faz: [] },
        { id: 'depois', quando: { tipo: 'tempo', apos: 0.1, desde: 'longe' }, faz: [] },
      ],
    }));
    expect(disparou(passos(w, 300), 'depois')).toBe(false);
  });

  it('o restauro volta o relógio (stats.tempo não volta) e a contagem recomeça do checkpoint', () => {
    const w = criarWorld(fase([{ acao: 'checkpoint' }]));   // grava com relógio 0 e `inicio` registrado
    passos(w, 90);   // 1,5 s
    expect(w.relogio).toBeCloseTo(1.5, 9);
    restaurarCheckpoint(w);
    expect(w.relogio).toBe(0);
    expect(w.gatilhosQuando).toEqual({ inicio: 0 });
    expect(w.stats.tempo).toBeCloseTo(1.5, 9);
    // sem a volta do relógio, 1,5 + 1,9 já passaria de 2 s
    expect(disparou(passos(w, 114), 'depois')).toBe(false);
    expect(disparou(passos(w, 10), 'depois')).toBe(true);
  });

  it('o restauro devolve cópias: mexer no mundo não altera o snapshot', () => {
    const w = criarWorld(fase([{ acao: 'checkpoint' }]));
    passos(w, 1);
    restaurarCheckpoint(w);
    w.gatilhosQuando.outro = 5;
    restaurarCheckpoint(w);
    expect(w.gatilhosQuando).toEqual({ inicio: 0 });
  });
});
