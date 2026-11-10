// tests/sim/grid-espaco.test.ts
import { describe, expect, it } from 'vitest';
import { DEGRAU, SALTO, alcanceTiro, caminho, centro, criarGrid, moverComColisao, visivel } from '../../src/sim/grid';

// interior: x de 2 a 16, z de 2 a 8
const SALA = criarGrid(`
  #########
  #P..#...#
  #...g...#
  #...j.a.#
  #########
`, { g: { tipo: 'grade' }, j: { tipo: 'janela' }, a: { piso: 1 } });

describe('moverComColisao', () => {
  it('para na parede e desliza', () => {
    const p = moverComColisao(SALA, { x: 7.5, z: 3 }, 0, 1, 0.5, 0.3, DEGRAU);
    expect(p.x).toBeCloseTo(7.5);   // parede em col 4, linha 1
    expect(p.z).toBeCloseTo(3.5);
  });
  it('não sobe 1 m andando, sobe com alcance de salto', () => {
    const borda = { x: 11.6, z: 7 };
    expect(moverComColisao(SALA, borda, 0, 0.5, 0, 0.3, DEGRAU).x).toBeCloseTo(11.6);
    expect(moverComColisao(SALA, borda, 0, 0.5, 0, 0.3, SALTO).x).toBeCloseTo(12.1);
  });
  it('respeita sólido dinâmico', () => {
    const p = moverComColisao(SALA, { x: 3.5, z: 3 }, 0, 0.5, 0, 0.3, DEGRAU, (c, r) => c === 2 && r === 1);
    expect(p.x).toBeCloseTo(3.5);
  });
});

describe('visivel e alcanceTiro', () => {
  const oeste = centro([2, 1]);
  it('parede bloqueia visão e tiro', () => {
    expect(visivel(SALA, oeste, centro([6, 1]))).toBe(false);
    expect(alcanceTiro(SALA, oeste, { x: 1, z: 0 }, 50)).toBeCloseTo(3, 0);
  });
  it('grade deixa ver e atirar', () => {
    expect(visivel(SALA, centro([2, 2]), centro([6, 2]))).toBe(true);
    expect(alcanceTiro(SALA, centro([2, 2]), { x: 1, z: 0 }, 50)).toBeGreaterThan(9);
  });
  it('janela deixa ver mas não atirar', () => {
    expect(visivel(SALA, centro([2, 3]), centro([6, 3]))).toBe(true);
    expect(alcanceTiro(SALA, centro([2, 3]), { x: 1, z: 0 }, 50)).toBeLessThan(4);
  });
  it('alcanceTiro respeita o máximo', () => {
    expect(alcanceTiro(SALA, centro([2, 2]), { x: 1, z: 0 }, 2)).toBe(2);
  });
});

describe('caminho', () => {
  const g = criarGrid(`
    #######
    #P.#..#
    #..#..#
    #.....#
    #######
  `);
  it('contorna a parede', () => {
    const rota = caminho(g, centro([1, 1]), centro([5, 1]), DEGRAU)!;
    expect(rota.at(-1)).toEqual(centro([5, 1]));
    expect(rota.some((p) => p.z === centro([1, 3]).z)).toBe(true);
    expect(rota).toHaveLength(8);
  });
  it('mesma célula devolve vazio; sem rota devolve null', () => {
    expect(caminho(g, centro([1, 1]), { x: 3.2, z: 3.1 }, DEGRAU)).toEqual([]);
    const fechado = (c: number, r: number) => r === 3;
    expect(caminho(g, centro([1, 1]), centro([5, 1]), DEGRAU, fechado)).toBeNull();
  });
});

describe('correção 1: visão e tiro com altura', () => {
  // corredor longo; 'b' é um bloco de piso 3.2 em col 2; 'p' é plataforma de piso 1.5
  const g = criarGrid(`
    ############
    #PbA.......#
    #p.........#
    #..........#
    ############
  `, { b: { piso: 3.2, teto: 6 }, p: { piso: 1.5 } });
  const OLHO = 1.6;

  it('sem altura, resultados antigos (2D) se mantêm', () => {
    expect(visivel(g, centro([1, 1]), centro([3, 1]))).toBe(true);
    expect(alcanceTiro(g, centro([1, 1]), { x: 1, z: 0 }, 50)).toBeCloseTo(19, 0);
  });
  it('de baixo não se vê nem se acerta alvo atrás de bloco alto', () => {
    expect(visivel(g, centro([1, 1]), centro([3, 1]), undefined, OLHO, OLHO)).toBe(false);
    expect(alcanceTiro(g, centro([1, 1]), { x: 1, z: 0 }, 50, undefined, OLHO)).toBeLessThan(1.5);
  });
  it('de cima da plataforma vê quem está no chão adiante', () => {
    expect(visivel(g, centro([1, 2]), centro([3, 2]), undefined, 1.5 + OLHO, OLHO)).toBe(true);
  });
  it('tiro inclinado para baixo para no chão', () => {
    expect(alcanceTiro(g, centro([1, 3]), { x: 1, z: 0 }, 50, undefined, OLHO, -0.4)).toBeCloseTo(4, 0);
  });
  it('tiro inclinado para cima para no teto', () => {
    expect(alcanceTiro(g, centro([1, 3]), { x: 1, z: 0 }, 50, undefined, OLHO, 0.5)).toBeCloseTo(2.8, 0);
  });
});

describe('correção 1: quina diagonal, tubo, sólido e máximo', () => {
  const quina = criarGrid(`
    #####
    #P#.#
    ##..#
    #####
  `);
  it('não vaza pela quina entre duas paredes em diagonal', () => {
    expect(visivel(quina, centro([1, 1]), centro([2, 2]))).toBe(false);
    expect(alcanceTiro(quina, centro([1, 1]), { x: 1, z: 1 }, 50)).toBeLessThan(2);
  });

  const g = criarGrid(`
    #######
    #P.t..#
    #.....#
    #######
  `, { t: { tipo: 'tubo' } });
  it('tubo bloqueia visão e tiro', () => {
    expect(visivel(g, centro([1, 1]), centro([5, 1]))).toBe(false);
    expect(alcanceTiro(g, centro([1, 1]), { x: 1, z: 0 }, 50)).toBeCloseTo(3, 0);
  });
  it('sólido bloqueia visão e tiro', () => {
    const porta = (c: number, r: number) => c === 3 && r === 2;
    expect(visivel(g, centro([1, 2]), centro([5, 2]), porta)).toBe(false);
    expect(alcanceTiro(g, centro([1, 2]), { x: 1, z: 0 }, 50, porta)).toBeCloseTo(3, 0);
    expect(visivel(g, centro([1, 2]), centro([5, 2]))).toBe(true);
  });
  it('max <= 0 devolve 0', () => {
    expect(alcanceTiro(g, centro([1, 2]), { x: 1, z: 0 }, 0)).toBe(0);
    expect(alcanceTiro(g, centro([1, 2]), { x: 1, z: 0 }, -1)).toBe(0);
  });
});

describe('correção 2: sobreposição não prende', () => {
  // porta (sólido) na col 3, linha 1: x de 6 a 8
  const g = criarGrid(`
    #######
    #P....#
    #######
  `);
  const porta = (c: number, r: number) => c === 3 && r === 1;
  const sobreposto = { x: 5.8, z: 3 };   // raio 0.3: encosta 0,1 m na porta

  it('círculo já sobreposto a um sólido sai para o lado livre', () => {
    expect(moverComColisao(g, sobreposto, 0, -0.5, 0, 0.3, DEGRAU, porta).x).toBeCloseTo(5.3);
  });
  it('círculo já sobreposto pode deslizar ao longo do sólido sem afundar', () => {
    expect(moverComColisao(g, sobreposto, 0, 0, 0.2, 0.3, DEGRAU, porta).z).toBeCloseTo(3.2);
  });
  it('círculo já sobreposto não afunda mais', () => {
    expect(moverComColisao(g, sobreposto, 0, 0.1, 0, 0.3, DEGRAU, porta).x).toBeCloseTo(5.8);
  });
  it('círculo não sobreposto continua barrado', () => {
    expect(moverComColisao(g, { x: 5.5, z: 3 }, 0, 0.5, 0, 0.3, DEGRAU, porta).x).toBeCloseTo(5.5);
  });
  it('sobreposto a uma célula, não entra numa célula nova que bloqueia', () => {
    // encostado na porta e andando para o norte contra a parede (linha 0 termina em z = 2)
    expect(moverComColisao(g, { x: 5.8, z: 2.4 }, 0, 0, -0.2, 0.3, DEGRAU, porta).z).toBeCloseTo(2.4);
  });
});
