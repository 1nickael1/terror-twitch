import { describe, expect, it } from 'vitest';
import { JOGADOR } from '../../src/sim/balance';
import { centro, CELL, criarGrid, SALTO } from '../../src/sim/grid';
import { criarJogador, moverJogador, olhar } from '../../src/sim/player';
import { INPUT_VAZIO, type InputFrame } from '../../src/sim/world';

const LESTE = -Math.PI / 2;
const g = criarGrid(`
  ##########
  #P.....ab#
  ##########
`, { a: { piso: 0.5 }, b: { piso: 1.5 } });
const dt = 1 / 60;
const anda = (extra: Partial<InputFrame> = {}): InputFrame => ({ ...INPUT_VAZIO, frente: 1, ...extra });
const simular = (j: ReturnType<typeof criarJogador>, input: InputFrame, segundos: number) => {
  const tipos: string[] = [];
  for (let i = 0; i < Math.round(segundos / dt); i++) tipos.push(...moverJogador(g, j, input, dt).map((e) => e.tipo));
  return tipos;
};

describe('moverJogador', () => {
  it('acelera até a velocidade de corrida na direção do yaw', () => {
    const j = criarJogador(centro([1, 1]), LESTE);
    simular(j, anda(), 0.5);
    expect(Math.hypot(j.vel.x, j.vel.z)).toBeCloseTo(JOGADOR.velocidade, 1);
    expect(j.pos.x).toBeGreaterThan(centro([1, 1]).x + 3);
    expect(j.pos.z).toBeCloseTo(centro([1, 1]).z);
  });

  it('devagar anda mais lento e não faz ruído', () => {
    const j = criarJogador(centro([1, 1]), LESTE);
    const tipos = simular(j, anda({ devagar: true }), 1);
    expect(Math.hypot(j.vel.x, j.vel.z)).toBeCloseTo(JOGADOR.velocidadeDevagar, 1);
    expect(tipos).not.toContain('ruido');
  });

  it('correr faz passos e ruído', () => {
    const j = criarJogador(centro([1, 1]), LESTE);
    const tipos = simular(j, anda(), 1);
    expect(tipos).toContain('passo');
    expect(tipos).toContain('ruido');
  });

  it('sobe o degrau de 0,5 m andando e para no de 1 m', () => {
    const j = criarJogador(centro([5, 1]), LESTE);
    simular(j, anda(), 1.5);
    expect(j.y).toBeCloseTo(0.5);
    expect(j.pos.x).toBeLessThan(16 - JOGADOR.raio + 0.01);
  });

  it('pula 1 m e alcança a plataforma', () => {
    const j = criarJogador(centro([7, 1]), LESTE);
    j.y = 0.5;
    const tipos = simular(j, anda({ pular: true }), 1);
    expect(tipos).toContain('pulo');
    expect(tipos).toContain('pouso');
    expect(j.y).toBeCloseTo(1.5);
    expect(j.noChao).toBe(true);
  });

  it('o salto atinge cerca de 1,1 m', () => {
    const j = criarJogador(centro([2, 1]), LESTE);
    let topo = 0;
    moverJogador(g, j, { ...INPUT_VAZIO, pular: true }, dt);
    for (let i = 0; i < 60; i++) { moverJogador(g, j, INPUT_VAZIO, dt); topo = Math.max(topo, j.y); }
    expect(topo).toBeGreaterThan(1.0);
    expect(topo).toBeLessThan(1.25);
  });

  it('segurar pular pula uma vez só; soltar e apertar pula de novo', () => {
    const j = criarJogador(centro([2, 1]), LESTE);
    const segurando = simular(j, { ...INPUT_VAZIO, pular: true }, 2);
    expect(segurando.filter((t) => t === 'pulo')).toHaveLength(1);
    expect(j.noChao).toBe(true);
    moverJogador(g, j, INPUT_VAZIO, dt);
    expect(moverJogador(g, j, { ...INPUT_VAZIO, pular: true }, dt).map((e) => e.tipo)).toContain('pulo');
  });
});

describe('criarJogador', () => {
  it('aceita a altura inicial dos pés e começa sem pulo apertado nem passo acumulado', () => {
    const j = criarJogador(centro([7, 1]), LESTE, 0.5);
    expect(j.y).toBe(0.5);
    expect(j.puloApertado).toBe(false);
    expect(j.passoAcum).toBe(0);
    expect(j.reservaPistola).toBe(0);
    expect(j.tiroPendente).toBe(0);
    expect(criarJogador(centro([1, 1]), LESTE).y).toBe(0);
  });
});

describe('olhar', () => {
  it('soma yaw e limita pitch', () => {
    const j = criarJogador(centro([1, 1]), 0);
    olhar(j, 0.5, 10);
    expect(j.yaw).toBeCloseTo(0.5);
    expect(j.pitch).toBe(JOGADOR.pitchMax);
  });
});

describe('salto (correção 1)', () => {
  const gSalto = criarGrid(`
    ###########
    #P.......c#
    ###########
  `, { c: { piso: SALTO } });

  it('correndo e apertando pular, sobe numa plataforma de altura SALTO', () => {
    const j = criarJogador(centro([1, 1]), LESTE);
    const bordaPlataforma = 9 * CELL;
    const tipos: string[] = [];
    for (let i = 0; i < 180; i++) {
      // corre até a velocidade máxima e aperta pular a ~3 m da borda
      const pular = j.pos.x >= bordaPlataforma - 3.2;
      tipos.push(...moverJogador(gSalto, j, anda({ pular }), dt).map((e) => e.tipo));
    }
    expect(tipos).toContain('pulo');
    expect(j.pos.x).toBeGreaterThan(bordaPlataforma);
    expect(j.y).toBeCloseTo(SALTO);
    expect(j.noChao).toBe(true);
  });

  it.each([1 / 60, 1 / 30])('o topo do salto parado fica entre 1,10 e 1,13 m com dt = %s', (passo) => {
    const j = criarJogador(centro([2, 1]), LESTE);
    let topo = 0;
    moverJogador(g, j, { ...INPUT_VAZIO, pular: true }, passo);
    topo = j.y;
    for (let i = 0; i < Math.round(1 / passo); i++) { moverJogador(g, j, INPUT_VAZIO, passo); topo = Math.max(topo, j.y); }
    expect(topo).toBeGreaterThanOrEqual(1.1);
    expect(topo).toBeLessThan(1.13);
  });
});

describe('passos e colisão (correção 1)', () => {
  it('passoAcum zera ao andar devagar', () => {
    const j = criarJogador(centro([1, 1]), LESTE);
    while (j.passoAcum < 1.5) moverJogador(g, j, anda(), dt);
    moverJogador(g, j, anda({ devagar: true }), dt);
    expect(j.passoAcum).toBe(0);
  });

  it('parado, passoAcum zera e a corrida curta seguinte não faz passo', () => {
    const j = criarJogador(centro([1, 1]), LESTE);
    while (j.passoAcum < 2) moverJogador(g, j, anda(), dt);
    simular(j, INPUT_VAZIO, 0.5);
    expect(j.passoAcum).toBe(0);
    const tipos = simular(j, anda(), 0.1);
    expect(tipos).not.toContain('passo');
    expect(tipos).not.toContain('ruido');
  });

  it('correndo contra a parede, a velocidade daquele eixo vai a 0', () => {
    const j = criarJogador(centro([1, 1]), 0);   // yaw 0 olha para -z: parede ao norte
    simular(j, anda(), 0.5);
    expect(j.vel.z).toBe(0);
    expect(j.pos.z).toBeCloseTo(CELL + JOGADOR.raio, 1);
  });
});

describe('raspar na lateral no ar (correção 2)', () => {
  const gSalto = criarGrid(`
    ###########
    #P.......c#
    ###########
  `, { c: { piso: SALTO } });
  const bordaPlataforma = 9 * CELL;

  it.each([1, 2])('correndo e pulando a cerca de %s m da borda, sobe na plataforma de altura SALTO', (distancia) => {
    const j = criarJogador(centro([1, 1]), LESTE);
    let pulou = false;
    for (let i = 0; i < 180; i++) {
      const pular = !pulou && j.pos.x >= bordaPlataforma - distancia;
      if (pular) {
        expect(Math.hypot(j.vel.x, j.vel.z)).toBeCloseTo(JOGADOR.velocidade, 1);   // velocidade cheia
        pulou = true;
      }
      moverJogador(gSalto, j, anda({ pular }), dt);
    }
    expect(pulou).toBe(true);
    expect(j.pos.x).toBeGreaterThan(bordaPlataforma);
    expect(j.y).toBeCloseTo(SALTO);
    expect(j.noChao).toBe(true);
  });

  it('no chão, correndo para leste contra a parede, vel.x vai a 0', () => {
    const j = criarJogador(centro([8, 1]), LESTE, 1.5);   // em cima de b, parede a leste
    simular(j, anda(), 0.5);
    expect(j.noChao).toBe(true);
    expect(j.vel.x).toBe(0);
  });
});

describe('descer de borda alta (correção 2 da grade)', () => {
  const OESTE = Math.PI / 2;
  const borda = 6 * CELL;   // a plataforma P ocupa x de 12 a 14

  for (const altura of [0.6, 1, 1.5]) {
    const gBorda = criarGrid('########\n#.....P#\n########', { P: { piso: altura } });

    it(`correndo para fora de uma borda de ${altura} m, desce, pousa e segue`, () => {
      const j = criarJogador(centro([6, 1]), OESTE, altura);
      for (let i = 0; i < Math.round(1.5 / dt); i++) moverJogador(gBorda, j, anda(), dt);
      expect(j.y).toBeCloseTo(0);
      expect(j.noChao).toBe(true);
      expect(j.pos.x).toBeLessThan(borda - 2);
    });

    it(`depois de descer ${altura} m, é barrado pela parede da plataforma`, () => {
      const j = criarJogador(centro([6, 1]), OESTE, altura);
      for (let i = 0; i < Math.round(1.5 / dt); i++) moverJogador(gBorda, j, anda(), dt);
      j.yaw = LESTE;
      for (let i = 0; i < Math.round(1.5 / dt); i++) moverJogador(gBorda, j, anda(), dt);
      expect(j.y).toBeCloseTo(0);
      expect(j.pos.x).toBeLessThan(borda - JOGADOR.raio + 0.01);
      expect(j.pos.x).toBeGreaterThan(borda - JOGADOR.raio - 0.2);
    });
  }
});
