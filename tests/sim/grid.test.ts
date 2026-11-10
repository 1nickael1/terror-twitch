// tests/sim/grid.test.ts
import { describe, expect, it } from 'vitest';
import {
  CELL, DEGRAU, SALTO, alturaPiso, celula, celulaNaArea, centro, coordDe, criarGrid, naArea, passavel,
} from '../../src/sim/grid';

const PLANTA = `
  ########
  #P.abc.#
  #..g.j.#
  ########
`;
const LEG = {
  a: { piso: 0.5 },                       // degrau
  b: { piso: 1.5 },                       // só pulando a partir de 'a' (1 m)
  c: { piso: 3.2, teto: 6 },              // alto demais a partir de 'b' (1,7 m)
  g: { tipo: 'grade' as const },
  j: { tipo: 'janela' as const },
};

describe('criarGrid', () => {
  const g = criarGrid(PLANTA, LEG);

  it('mede a planta sem a indentação', () => {
    expect(g.cols).toBe(8);
    expect(g.rows).toBe(4);
  });

  it('lê piso, parede e legenda', () => {
    expect(celula(g, 0, 0).tipo).toBe('parede');
    expect(celula(g, 2, 1)).toMatchObject({ tipo: 'piso', piso: 0, teto: 3 });
    expect(celula(g, 3, 1).piso).toBe(0.5);
    expect(celula(g, 5, 1)).toMatchObject({ piso: 3.2, teto: 6 });
    expect(celula(g, 3, 2).tipo).toBe('grade');
  });

  it('fora da grade é parede', () => {
    expect(celula(g, -1, 0).tipo).toBe('parede');
    expect(celula(g, 99, 99).tipo).toBe('parede');
  });

  it('registra as marcas', () => {
    expect(g.marcas.get('P')).toEqual([[1, 1]]);
    expect(g.marcas.get('a')).toEqual([[3, 1]]);
  });

  it('exige exatamente um P', () => {
    expect(() => criarGrid('###\n#.#\n###')).toThrow(/exatamente um P/);
    expect(() => criarGrid('####\n#PP#\n####')).toThrow(/exatamente um P/);
  });

  it('rejeita símbolo desconhecido', () => {
    expect(() => criarGrid('####\n#P7#\n####')).toThrow(/Símbolo desconhecido/);
  });
});

describe('coordenadas', () => {
  it('centro e coordDe são inversos', () => {
    expect(centro([3, 1])).toEqual({ x: 3 * CELL + 1, z: 1 * CELL + 1 });
    expect(coordDe({ x: 7.9, z: 2.1 })).toEqual([3, 1]);
  });
});

describe('passavel', () => {
  const g = criarGrid(PLANTA, LEG);
  it('anda no plano e sobe degrau', () => {
    expect(passavel(g, [1, 1], [2, 1], DEGRAU)).toBe(true);
    expect(passavel(g, [2, 1], [3, 1], DEGRAU)).toBe(true);
  });
  it('1 m de subida só pulando', () => {
    expect(passavel(g, [3, 1], [4, 1], DEGRAU)).toBe(false);
    expect(passavel(g, [3, 1], [4, 1], SALTO)).toBe(true);
  });
  it('1,7 m não sobe nem pulando, mas desce', () => {
    expect(passavel(g, [4, 1], [5, 1], SALTO)).toBe(false);
    expect(passavel(g, [5, 1], [4, 1], DEGRAU)).toBe(true);
  });
  it('parede, grade e janela não passam', () => {
    expect(passavel(g, [1, 1], [1, 0], SALTO)).toBe(false);
    expect(passavel(g, [2, 2], [3, 2], SALTO)).toBe(false);
    expect(passavel(g, [4, 2], [5, 2], SALTO)).toBe(false);
  });
  it('sólido dinâmico (porta fechada) bloqueia', () => {
    expect(passavel(g, [1, 1], [2, 1], DEGRAU, (c, r) => c === 2 && r === 1)).toBe(false);
  });
});

describe('rampa', () => {
  const g = criarGrid('#####\n#PrA#\n#####', { r: { rampa: 'x' }, A: { piso: 1 } });
  it('interpola a altura ao longo do eixo', () => {
    expect(alturaPiso(g, { x: 2 * CELL + 0.001, z: 3 })).toBeCloseTo(0, 2);
    expect(alturaPiso(g, { x: 2 * CELL + 1, z: 3 })).toBeCloseTo(0.5);
    expect(alturaPiso(g, { x: 3 * CELL - 0.001, z: 3 })).toBeCloseTo(1, 2);
  });
  it('é passável dos dois lados andando', () => {
    expect(passavel(g, [1, 1], [2, 1], DEGRAU)).toBe(true);
    expect(passavel(g, [2, 1], [3, 1], DEGRAU)).toBe(true);
  });
});

describe('correção 1: rampa coerente', () => {
  const g = criarGrid('######\n#PBrC#\n######', { B: { piso: 2 }, C: { piso: 3 }, r: { rampa: 'x' } });
  it('rampa elevada herda piso e teto das vizinhas do eixo', () => {
    expect(celula(g, 3, 1)).toMatchObject({ piso: 2, teto: 6, rampa: 'x' });
  });
  it('é passável dos dois lados', () => {
    expect(passavel(g, [2, 1], [3, 1], DEGRAU)).toBe(true);
    expect(passavel(g, [3, 1], [4, 1], DEGRAU)).toBe(true);
    expect(passavel(g, [4, 1], [3, 1], DEGRAU)).toBe(true);
    expect(passavel(g, [3, 1], [2, 1], DEGRAU)).toBe(true);
  });
  it('alturaPiso interpola de 2 a 3', () => {
    expect(alturaPiso(g, { x: 3 * CELL + 0.001, z: 3 })).toBeCloseTo(2, 2);
    expect(alturaPiso(g, { x: 3 * CELL + 1, z: 3 })).toBeCloseTo(2.5);
    expect(alturaPiso(g, { x: 4 * CELL - 0.001, z: 3 })).toBeCloseTo(3, 2);
  });
  it('teto explícito da legenda é mantido', () => {
    const h = criarGrid('######\n#PBrC#\n######', { B: { piso: 2 }, C: { piso: 3 }, r: { rampa: 'x', teto: 5 } });
    expect(celula(h, 3, 1)).toMatchObject({ piso: 2, teto: 5 });
  });
});

describe('correção 1: rampa z', () => {
  const g = criarGrid('###\n#P#\n#r#\n#A#\n###', { r: { rampa: 'z' }, A: { piso: 1 } });
  it('interpola de norte para sul e é passável', () => {
    expect(alturaPiso(g, { x: 3, z: 2 * CELL + 0.001 })).toBeCloseTo(0, 2);
    expect(alturaPiso(g, { x: 3, z: 2 * CELL + 1 })).toBeCloseTo(0.5);
    expect(alturaPiso(g, { x: 3, z: 3 * CELL - 0.001 })).toBeCloseTo(1, 2);
    expect(passavel(g, [1, 1], [1, 2], DEGRAU)).toBe(true);
    expect(passavel(g, [1, 2], [1, 3], DEGRAU)).toBe(true);
  });
});

describe('naArea e celulaNaArea (C3.1, correção 1: uma só regra de área)', () => {
  it('a célula está no retângulo [col, row, larg, alt] (meio aberto)', () => {
    expect(celulaNaArea(2, 1, [2, 1, 2, 1])).toBe(true);
    expect(celulaNaArea(3, 1, [2, 1, 2, 1])).toBe(true);
    expect(celulaNaArea(4, 1, [2, 1, 2, 1])).toBe(false);
    expect(celulaNaArea(2, 2, [2, 1, 2, 1])).toBe(false);
    expect(naArea(centro([3, 1]), [2, 1, 2, 1])).toBe(true);
    expect(naArea({ x: 3.99, z: 2.5 }, [1, 1, 1, 1])).toBe(true);   // célula [1, 1]
    expect(naArea({ x: 4.01, z: 2.5 }, [1, 1, 1, 1])).toBe(false);
  });
});
