// tests/sim/reanimados.test.ts — tipos da fase 2: reanimado, cirúrgico deitado, enfermeiro; corpos e contagem (C3.2)
import { describe, expect, it } from 'vitest';
import { criarInimigo } from '../../src/sim/ai/comum';
import { TIPOS } from '../../src/sim/ai/tipos';
import { IA } from '../../src/sim/balance';
import type { SimEvent } from '../../src/sim/eventos';
import { PASSO, step } from '../../src/sim/step';
import { ferirInimigo } from '../../src/sim/weapons';
import { INPUT_VAZIO, criarWorld, type World } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const OESTE = Math.PI / 2;   // frente = (-1, 0)
const CONE = (110 * Math.PI) / 180;

const CORREDOR = `
  ######################
  #P...................#
  #....................#
  #....................#
  ######################
`;

function rodar(w: World, segundos: number): SimEvent[] {
  const ev: SimEvent[] = [];
  const n = Math.round(segundos / PASSO);
  for (let k = 0; k < n; k++) ev.push(...step(w, INPUT_VAZIO, PASSO));
  return ev;
}
const tipos = (ev: readonly SimEvent[]) => ev.map((e) => e.tipo);

function mundo(extra: Parameters<typeof faseMinima>[1] = {}): World {
  const w = criarWorld(faseMinima(CORREDOR, { saida: [20, 3], ...extra }));
  w.jogador.colete = 0;
  return w;
}

describe('tipos novos', () => {
  it('reanimado, cirúrgico e enfermeiro com os números do adendo', () => {
    expect(TIPOS.reanimado).toMatchObject({
      arquetipo: 'avancador', vida: 70, velocidade: 3.6, raio: 0.38, altura: 1.8, visao: 14, visaoEscuro: 6,
      cone: CONE, audicao: 1.2, dano: 14, alcanceAtaque: 1.2, cadencia: 1.1, preparo: 0.45, dor: 0.12,
      projetil: null, reanimavel: true, deitado: false,
    });
    expect(TIPOS.reanimado_cirurgico).toMatchObject({
      arquetipo: 'emboscador', vida: 55, velocidade: 5.0, raio: 0.36, altura: 1.75, visao: 10, visaoEscuro: 5,
      cone: CONE, audicao: 0.8, dano: 18, alcanceAtaque: 1.3, cadencia: 1.0, preparo: 0.3, dor: 0.2,
      projetil: null, reanimavel: true, deitado: true,
    });
    expect(TIPOS.enfermeiro).toMatchObject({
      arquetipo: 'atirador', vida: 50, velocidade: 3.0, raio: 0.35, altura: 1.8, visao: 18, visaoEscuro: 8,
      cone: CONE, audicao: 1, dano: 16, alcanceAtaque: 14, cadencia: 2.2, preparo: 0.7, dor: 0.3,
      distanciaIdeal: 8, projetil: { velocidade: 9, raio: 0.18, arco: { gravidade: 12, respingo: 1.6 } },
      reanimavel: false, deitado: false,
    });
    expect(IA.levantar).toBe(0.8);
    for (const nome of ['funcionario', 'seguranca', 'entidade096']) expect([nome, TIPOS[nome].deitado]).toEqual([nome, false]);
  });
});

describe('corpos e contagem', () => {
  it('corpo: true nasce morto, sem vida e fora do total (fase e spawn)', () => {
    const w = mundo({
      inimigos: [{ em: [5, 2], tipo: 'reanimado', corpo: true }, { em: [6, 2], tipo: 'reanimado' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: [7, 2], tipo: 'reanimado', corpo: true }] }] }],
    });
    expect(w.inimigos[0]).toMatchObject({ modo: 'morto', vida: 0, contado: false, jaMorreu: false });
    expect(w.stats.totalInimigos).toBe(1);
    rodar(w, PASSO);
    expect(w.inimigos).toHaveLength(3);
    expect(w.inimigos[2].modo).toBe('morto');
    expect(w.stats.totalInimigos).toBe(1);
    rodar(w, 1);
    expect(w.inimigos[0].modo).toBe('morto');   // corpo não acorda sozinho
  });

  it('a morte conta uma vez por inimigo (jaMorreu)', () => {
    const w = mundo();
    const i = porInimigo(w, 'reanimado', [8, 2]);
    ferirInimigo(w, i, 1000);
    expect(w.stats.mortos).toBe(1);
    expect(i.jaMorreu).toBe(true);
    i.modo = 'perseguicao';   // como se levantasse
    i.vida = 10;
    ferirInimigo(w, i, 1000);
    expect(w.stats.mortos).toBe(1);
  });
});

describe('cirúrgico deitado', () => {
  it('sempre começa dormindo (deitado), mesmo sem dormindo na definição', () => {
    const w = mundo();
    expect(criarInimigo(w, { em: [5, 2], tipo: 'reanimado_cirurgico' }).modo).toBe('dormindo');
    expect(criarInimigo(w, { em: [5, 2], tipo: 'reanimado_cirurgico', corpo: true }).modo).toBe('morto');
  });

  it('ao perceber o jogador levanta (0,8 s parado, sem atacar) e só depois persegue e ataca', () => {
    const w = mundo();
    const c = porInimigo(w, 'reanimado_cirurgico', [3, 1], { yaw: OESTE });   // 4 m, de frente
    const ev = rodar(w, PASSO);
    expect(ev).toContainEqual({ tipo: 'inimigo_levanta', id: c.id });
    expect(c.modo).toBe('levantando');
    const pos = { ...c.pos };
    const durante = rodar(w, 0.75);
    expect(c.modo).toBe('levantando');
    expect(c.pos).toEqual(pos);
    expect(tipos(durante)).not.toContain('inimigo_ataque');
    expect(w.jogador.vida).toBe(100);
    rodar(w, 0.1);
    expect(c.modo).not.toBe('levantando');
    expect(c.modo).not.toBe('dormindo');
    rodar(w, 2);
    expect(w.jogador.vida).toBeLessThan(100);
  });

  it('não percebe o jogador longe (regra do emboscador) e segue deitado', () => {
    const w = mundo();
    const c = porInimigo(w, 'reanimado_cirurgico', [6, 1], { yaw: OESTE });   // 10 m
    rodar(w, 1);
    expect(c.modo).toBe('dormindo');
  });

  it('dano enquanto deitado o faz levantar (não entra em dor); dano levantando não interrompe', () => {
    const w = mundo();
    const c = porInimigo(w, 'reanimado_cirurgico', [10, 2]);
    const ev = ferirInimigo(w, c, 10);
    expect(c.modo).toBe('levantando');
    expect(c.timer).toBeCloseTo(IA.levantar, 9);
    expect(ev).toContainEqual({ tipo: 'inimigo_levanta', id: c.id });
    ferirInimigo(w, c, 10);
    expect(c.modo).toBe('levantando');
    expect(c.vida).toBe(35);
  });

  it('deitado: tiro na altura dos olhos passa por cima; tiro baixo acerta', () => {
    const w = mundo();
    const c = porInimigo(w, 'reanimado_cirurgico', [5, 1], { yaw: OESTE });   // 8 m a leste, deitado
    w.jogador.pitch = 0;
    step(w, { ...INPUT_VAZIO, atirar: true }, PASSO);   // reto, a 1,6 m do chão
    expect(c.vida).toBe(55);
    // o ruído do tiro o acorda: começa a levantar, ainda deitado
    expect(c.modo).toBe('levantando');
    w.jogador.pitch = Math.atan((0.2 - 1.6) / 8);   // mira a 0,2 m do chão nele
    for (let k = 0; k < 18; k++) step(w, INPUT_VAZIO, PASSO);   // fim da cadência da pistola
    step(w, { ...INPUT_VAZIO, atirar: true }, PASSO);
    expect(c.vida).toBeLessThan(55);
  });

  it('em pé (depois de levantar), o tiro na altura dos olhos acerta', () => {
    const w = mundo();
    const c = porInimigo(w, 'reanimado_cirurgico', [5, 1], { yaw: OESTE });
    c.modo = 'perseguicao';
    w.jogador.pitch = 0;
    step(w, { ...INPUT_VAZIO, atirar: true }, PASSO);
    expect(c.vida).toBeLessThan(55);
  });

  it('ruído perto o faz levantar', () => {
    const w = mundo();
    // a ~8 m, virado para o norte (não vê o jogador); o tiro (raio 24 × 0,5 × 0,8) chega a ele
    const c = porInimigo(w, 'reanimado_cirurgico', [5, 2], { yaw: 0 });
    rodar(w, 0.5);
    expect(c.modo).toBe('dormindo');
    const ev = step(w, { ...INPUT_VAZIO, atirar: true }, PASSO);
    expect(c.modo).toBe('levantando');
    expect(ev).toContainEqual({ tipo: 'inimigo_levanta', id: c.id });
  });
});
