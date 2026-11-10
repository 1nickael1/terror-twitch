import { describe, expect, it } from 'vitest';
import { ATLAS_MAX, layoutAtlas, linhasDaPlaca, normalParede, origemNoAtlas, uvNoAtlas } from '../../src/engine/view/placasLogica';

describe('linhasDaPlaca', () => {
  it('caixa alta, quebra por palavra até o limite de caracteres', () => {
    expect(linhasDaPlaca('Setor de contenção leve', 14)).toEqual(['SETOR DE', 'CONTENÇÃO LEVE']);
  });

  it('palavra maior que o limite fica inteira numa linha', () => {
    expect(linhasDaPlaca('Descontaminação obrigatória', 8)).toEqual(['DESCONTAMINAÇÃO', 'OBRIGATÓRIA']);
  });

  it('no máximo 3 linhas; o excesso termina em reticências', () => {
    const l = linhasDaPlaca('um dois tres quatro cinco seis sete oito', 9);
    expect(l.length).toBe(3);
    expect(l[2].endsWith('…')).toBe(true);
  });

  it('respeita quebras explícitas e ignora espaços extras', () => {
    expect(linhasDaPlaca('  Ala B \n  saída  ', 20)).toEqual(['ALA B', 'SAÍDA']);
  });

  it('texto vazio: nenhuma linha', () => {
    expect(linhasDaPlaca('   ', 10)).toEqual([]);
  });
});

describe('normalParede', () => {
  it('parede n/s/l/o: a placa olha para dentro da célula', () => {
    expect(normalParede('n', 0)).toEqual({ x: 0, z: 1 });
    expect(normalParede('s', 0)).toEqual({ x: 0, z: -1 });
    expect(normalParede('l', 0)).toEqual({ x: -1, z: 0 });
    expect(normalParede('o', 0)).toEqual({ x: 1, z: 0 });
  });

  it('sem parede: a placa olha para a frente do yaw', () => {
    const n = normalParede(undefined, Math.PI / 2);
    expect(n.x).toBeCloseTo(-1);
    expect(n.z).toBeCloseTo(0);
  });
});

describe('atlas das placas', () => {
  it('31 placas cabem em 4 colunas de 512 × 256 num canvas de até 2048', () => {
    const l = layoutAtlas(31);
    expect(l).toMatchObject({ colunas: 4, linhas: 8, larg: 512, alt: 256, largTotal: 2048, altTotal: 2048 });
  });

  it('muitas placas: os ladrilhos caem pela metade até caber', () => {
    const l = layoutAtlas(100);
    expect(l.largTotal).toBeLessThanOrEqual(ATLAS_MAX);
    expect(l.altTotal).toBeLessThanOrEqual(ATLAS_MAX);
    expect(l.colunas * l.linhas).toBeGreaterThanOrEqual(100);
  });

  it('uma placa: um ladrilho só', () => {
    expect(layoutAtlas(1)).toMatchObject({ colunas: 1, linhas: 1, largTotal: 512, altTotal: 256 });
  });

  it('UVs do ladrilho: a primeira placa no topo à esquerda (v = 1 no topo), sem invadir a vizinha', () => {
    const l = layoutAtlas(31);
    const [u0, v0, u1, v1] = uvNoAtlas(0, l);
    expect(u0).toBeCloseTo(0, 3);
    expect(u1).toBeCloseTo(0.25, 3);
    expect(v1).toBeCloseTo(1, 3);
    expect(v0).toBeCloseTo(1 - 1 / 8, 3);
    expect(u1).toBeLessThan(uvNoAtlas(1, l)[0]);
    expect(origemNoAtlas(5, l)).toEqual({ x: 512, y: 256 });
  });
});
