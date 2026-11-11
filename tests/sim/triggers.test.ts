import { describe, expect, it } from 'vitest';
import { avancarPortas, comandarPorta } from '../../src/sim/doors';
import { centro } from '../../src/sim/grid';
import { naArea } from '../../src/sim/grid';
import { avancarGatilhos } from '../../src/sim/triggers';
import { criarWorld, restaurarCheckpoint } from '../../src/sim/world';
import type { GatilhoDef } from '../../src/sim/fase';
import { faseMinima, porInimigo } from './ajuda';

const PLANTA = '#########\n#P..D...#\n#########';
const mundo = (gatilhos: GatilhoDef[]) =>
  criarWorld(faseMinima(PLANTA, { portas: [{ id: 'd1', em: 'D', trancada: true }], gatilhos }));

describe('naArea', () => {
  it('cobre as células do retângulo', () => {
    expect(naArea(centro([2, 1]), [2, 1, 2, 1])).toBe(true);
    expect(naArea(centro([3, 1]), [2, 1, 2, 1])).toBe(true);
    expect(naArea(centro([4, 1]), [2, 1, 2, 1])).toBe(false);
  });
});

describe('gatilhos', () => {
  it('área dispara uma vez e executa as ações em ordem', () => {
    const w = mundo([{ id: 'g1', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [
      { acao: 'mensagem', texto: 'Brecha de contenção.' },
      { acao: 'porta', id: 'd1', estado: 'abrir' },
      { acao: 'alarme', ligado: true },
    ] }]);
    expect(avancarGatilhos(w, [])).toEqual([]);
    w.jogador.pos = centro([2, 1]);
    const ev = avancarGatilhos(w, []);
    expect(ev[0]).toEqual({ tipo: 'gatilho', id: 'g1' });
    expect(ev.map((e) => e.tipo)).toEqual(['gatilho', 'mensagem', 'porta_desbloqueada', 'porta', 'alarme']);
    expect(w.alarme).toBe(true);
    expect(w.portas[0].estado).toBe('abrindo');
    expect(avancarGatilhos(w, [])).toEqual([]);
  });

  it('grupo morto dispara quando o último cai', () => {
    const w = mundo([{ id: 'g2', quando: { tipo: 'grupo_morto', grupo: 'sala' }, faz: [{ acao: 'porta', id: 'd1', estado: 'destrancar' }] }]);
    const a = porInimigo(w, 'funcionario', [2, 1]);
    const b = porInimigo(w, 'funcionario', [3, 1]);
    a.grupo = b.grupo = 'sala';
    a.modo = 'morto';
    expect(avancarGatilhos(w, [])).toEqual([]);
    b.modo = 'morto';
    expect(avancarGatilhos(w, []).map((e) => e.tipo)).toContain('gatilho');
    expect(w.portas[0].estado).toBe('fechada');
  });

  it('terminal e pickup disparam pelos eventos do passo', () => {
    const w = mundo([
      { id: 'g3', quando: { tipo: 'terminal', id: 't1' }, faz: [{ acao: 'som', id: 'bip' }] },
      { id: 'g4', quando: { tipo: 'pickup', indice: 0 }, faz: [{ acao: 'spawn', inimigos: [{ em: [6, 1], tipo: 'funcionario' }] }] },
    ]);
    const ev = avancarGatilhos(w, [{ tipo: 'terminal', id: 't1' }, { tipo: 'pickup', indice: 0 }]);
    expect(ev).toContainEqual({ tipo: 'som', id: 'bip' });
    expect(w.inimigos).toHaveLength(1);
    expect(w.stats.totalInimigos).toBe(1);
  });

  it('checkpoint guarda e restaura o estado do jogador', () => {
    const w = mundo([{ id: 'g5', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'checkpoint' }] }]);
    w.jogador.pos = centro([2, 1]);
    w.jogador.vida = 60;
    avancarGatilhos(w, []);
    w.jogador.vida = 0;
    w.jogador.pos = centro([6, 1]);
    w.estado = 'morto';
    restaurarCheckpoint(w);
    expect(w.jogador.vida).toBe(60);
    expect(w.jogador.pos).toEqual(centro([2, 1]));
    expect(w.estado).toBe('jogando');
  });

  it('teleporte move o jogador', () => {
    const w = mundo([{ id: 'g6', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'teleporte', para: [6, 1], yaw: 0 }] }]);
    w.jogador.pos = centro([2, 1]);
    avancarGatilhos(w, []);
    expect(w.jogador.pos).toEqual(centro([6, 1]));
    expect(w.jogador.yaw).toBe(0);
  });
});

describe('gatilhos (complemento)', () => {
  it('umaVez: false dispara a cada vez que a condição passa a valer', () => {
    const w = mundo([{ id: 'g7', umaVez: false, quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'luz', grupo: 'sala', ligada: false }] }]);
    w.jogador.pos = centro([2, 1]);
    expect(avancarGatilhos(w, []).map((e) => e.tipo)).toEqual(['gatilho', 'luz']);
    expect(w.luzesDesligadas.has('sala')).toBe(true);
    expect(avancarGatilhos(w, [])).toEqual([]);
    w.jogador.pos = centro([1, 1]);
    expect(avancarGatilhos(w, [])).toEqual([]);
    w.jogador.pos = centro([2, 1]);
    expect(avancarGatilhos(w, []).map((e) => e.tipo)).toEqual(['gatilho', 'luz']);
  });

  it('restaurar repõe gatilhos, luzes e inimigos do checkpoint como cópias', () => {
    const w = mundo([{ id: 'g8', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [
      { acao: 'luz', grupo: 'sala', ligada: false }, { acao: 'checkpoint' },
    ] }]);
    const i = porInimigo(w, 'funcionario', [6, 1]);
    w.jogador.pos = centro([2, 1]);
    avancarGatilhos(w, []);
    i.vida = 0;
    i.modo = 'morto';
    w.luzesDesligadas.clear();
    restaurarCheckpoint(w);
    expect(w.gatilhosFeitos).toEqual(new Set(['g8']));
    expect(w.luzesDesligadas).toEqual(new Set(['sala']));
    expect(w.inimigos[0].modo).toBe('patrulha');
    expect(w.inimigos[0]).not.toBe(i);
  });
});

describe('criarWorld', () => {
  it('cria portas, pickups e inimigos da fase e grava o primeiro checkpoint', () => {
    const w = criarWorld(faseMinima(PLANTA, {
      portas: [{ id: 'd1', em: 'D', exige: 1 }],
      pickups: [{ em: [2, 1], tipo: 'vida_p' }],
      inimigos: [{ em: [6, 1], tipo: 'funcionario', grupo: 'sala' }],
    }));
    expect(w.portas).toEqual([{ id: 'd1', coord: [4, 1], estado: 'fechada', abertura: 0, exige: 1, trancarAoFechar: false }]);
    expect(w.pickups[0]).toMatchObject({ pos: centro([2, 1]), pego: false });
    expect(w.inimigos[0]).toMatchObject({ grupo: 'sala', pos: centro([6, 1]) });
    expect(w.stats.totalInimigos).toBe(1);
    w.jogador.vida = 1;
    restaurarCheckpoint(w);
    expect(w.jogador.vida).toBe(100);
  });

  it('símbolo ausente ou repetido é erro claro', () => {
    expect(() => criarWorld(faseMinima(PLANTA, { portas: [{ id: 'x', em: 'Z' }] })))
      .toThrow('Símbolo "Z" não aparece exatamente uma vez na planta');
  });
});

describe('checkpoint: correção 1', () => {
  it('o checkpoint é gravado depois de todas as ações do gatilho', () => {
    const w = mundo([{ id: 'g9', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [
      { acao: 'checkpoint' },
      { acao: 'spawn', inimigos: [{ em: [6, 1], tipo: 'funcionario' }] },
      { acao: 'porta', id: 'd1', estado: 'trancar' },
    ] }]);
    comandarPorta(w, 'd1', 'abrir');
    for (let i = 0; i < 60; i++) avancarPortas(w, 1 / 60);
    w.jogador.pos = centro([2, 1]);
    expect(avancarGatilhos(w, []).map((e) => e.tipo)).toContain('checkpoint');
    w.inimigos[0].modo = 'morto';
    w.inimigos[0].vida = 0;
    w.jogador.pos = centro([6, 1]);
    w.estado = 'morto';
    restaurarCheckpoint(w);
    expect(w.inimigos).toHaveLength(1);
    expect(w.inimigos[0].modo).not.toBe('morto');
    expect(['fechando', 'trancada']).toContain(w.portas[0].estado);
    expect(w.portas[0].trancarAoFechar || w.portas[0].estado === 'trancada').toBe(true);
    expect(avancarGatilhos(w, [])).toEqual([]);
  });

  it('o snapshot inclui os efeitos de gatilhos posteriores no mesmo passo', () => {
    const w = mundo([
      { id: 'g10', quando: { tipo: 'area', area: [2, 1, 1, 1] }, faz: [{ acao: 'checkpoint' }] },
      { id: 'g11', quando: { tipo: 'pickup', indice: 0 }, faz: [{ acao: 'spawn', inimigos: [{ em: [6, 1], tipo: 'funcionario' }] }] },
    ]);
    w.jogador.pos = centro([2, 1]);
    avancarGatilhos(w, [{ tipo: 'pickup', indice: 0 }]);
    w.inimigos = [];
    restaurarCheckpoint(w);
    expect(w.inimigos).toHaveLength(1);
    expect(w.gatilhosFeitos).toEqual(new Set(['g10', 'g11']));
  });

  it('restaurar zera tensão e velocidade e mantém o tempo da fase', () => {
    const w = mundo([]);
    w.stats.tempo = 30;
    w.stats.mortos = 4;
    w.tensao = 0.8;
    w.jogador.vel = { x: 3, z: -2 };
    w.jogador.vy = 5;
    restaurarCheckpoint(w);
    expect(w.stats.tempo).toBe(30);
    expect(w.stats.mortos).toBe(0);
    expect(w.tensao).toBe(0);
    expect(w.jogador.vel).toEqual({ x: 0, z: 0 });
    expect(w.jogador.vy).toBe(0);
  });
});

describe('criarWorld: correção 1', () => {
  it('símbolo inválido de terminal ou documento falha ao criar o mundo', () => {
    expect(() => criarWorld(faseMinima(PLANTA, { terminais: [{ id: 't1', em: 'T', rotulo: 'T' }] })))
      .toThrow('Símbolo "T" não aparece exatamente uma vez na planta');
    expect(() => criarWorld(faseMinima(PLANTA, { documentos: [{ id: 'd', em: 'X', titulo: '', texto: '' }] })))
      .toThrow('Símbolo "X" não aparece exatamente uma vez na planta');
  });
});
