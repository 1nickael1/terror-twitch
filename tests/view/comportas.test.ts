import { describe, expect, it } from 'vitest';
import { avancarFechamento, brilhoAviso, COR_INDICADOR, DESCIDA, estadoIndicador, SUBIDA } from '../../src/engine/view/comportasLogica';

describe('avancarFechamento', () => {
  it('desce em 0,15 s quando a comporta está ativa', () => {
    expect(DESCIDA).toBeCloseTo(0.15);
    let f = 0;
    f = avancarFechamento(f, true, 0.075);
    expect(f).toBeCloseTo(0.5);
    f = avancarFechamento(f, true, 0.1);
    expect(f).toBe(1);
  });

  it('sobe de volta em 0,6 s', () => {
    expect(SUBIDA).toBeCloseTo(0.6);
    let f = avancarFechamento(1, false, 0.3);
    expect(f).toBeCloseTo(0.5);
    f = avancarFechamento(f, false, 0.4);
    expect(f).toBe(0);
  });

  it('dt zero (jogo parado) não mexe', () => {
    expect(avancarFechamento(0.4, true, 0)).toBe(0.4);
  });
});

describe('brilhoAviso', () => {
  it('apagada sem recarga', () => {
    expect(brilhoAviso(1.3, 0, false)).toBe(0);
    expect(brilhoAviso(1.3, 0, true)).toBe(0);
  });

  it('pisca devagar (abaixo de 1 Hz) enquanto recarrega', () => {
    const amostras = Array.from({ length: 400 }, (_, k) => brilhoAviso(k * 0.01, 5, false));
    let trocas = 0;
    for (let k = 1; k < amostras.length; k++) if ((amostras[k] > 0.5) !== (amostras[k - 1] > 0.5)) trocas++;
    // 4 s: no máximo 8 trocas (≤ 1 Hz), e pelo menos uma (pisca)
    expect(trocas).toBeGreaterThan(0);
    expect(trocas).toBeLessThanOrEqual(8);
  });

  it('com reduzir flashes, sem degrau: varia suave e nunca apaga', () => {
    let maiorSalto = 0;
    let menor = 1;
    for (let k = 1; k < 400; k++) {
      const a = brilhoAviso((k - 1) * 0.01, 5, true);
      const b = brilhoAviso(k * 0.01, 5, true);
      maiorSalto = Math.max(maiorSalto, Math.abs(b - a));
      menor = Math.min(menor, b);
    }
    expect(maiorSalto).toBeLessThan(0.05);
    expect(menor).toBeGreaterThan(0.2);
  });
});

describe('estadoIndicador (luz do terminal da comporta)', () => {
  it('branco-azulado com a comporta pronta, âmbar fixo enquanto recarrega (sem piscar)', () => {
    expect(estadoIndicador(0)).toBe('pronta');
    expect(estadoIndicador(-0.01)).toBe('pronta');
    expect(estadoIndicador(6.9)).toBe('recarregando');
    expect(estadoIndicador(0.001)).toBe('recarregando');
    expect(COR_INDICADOR.pronta).not.toBe(COR_INDICADOR.recarregando);
    // pronta: branco-azulado (a tela do terminal é verde); recarga: âmbar
    expect(COR_INDICADOR.pronta).toBe(0xd6ecff);
    expect(COR_INDICADOR.recarregando).toBe(0xffa224);
  });
});
