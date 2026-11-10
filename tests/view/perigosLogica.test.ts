import { describe, expect, it } from 'vitest';
import {
  bicosDaArea, brilhoUV, brilhoValvula, DEGRAU_PISCA, emitirPorTaxa, estadoVisual, indicesDoTipo, MAX_BICOS_FASE,
  MAX_BICOS_LINHA, progressoAviso,
  pisoPerigo, TAXA_AVISO, TAXA_JATO, taxaVapor, tubosDaArea, UV_APAGADA,
} from '../../src/engine/view/perigosLogica';
import type { PerigoDef } from '../../src/sim/fase';

const comporta = (id: string): PerigoDef => ({ id, tipo: 'comporta', area: [1, 1, 1, 2], duracao: 3, recarga: 8, danoChefe: 0.3, danoComum: 40 });
const area = (id: string, tipo: 'ultravioleta' | 'vapor'): PerigoDef => ({
  id, tipo, area: [2, 2, 3, 2], aviso: 1, duracao: 4, recarga: 10, danoChefePorSeg: 0.07, danoPorSeg: 10,
});

/** Acendimentos (subidas de apagado para aceso) numa série de amostras. */
function acendimentos(amostras: number[]): number {
  let n = 0;
  for (let k = 1; k < amostras.length; k++) if (amostras[k] > 0.5 && amostras[k - 1] <= 0.5) n++;
  return n;
}

describe('indicesDoTipo (casar a view com world.perigos)', () => {
  it('devolve os índices de cada tipo na ordem da fase', () => {
    const defs = [area('uv1', 'ultravioleta'), comporta('c1'), area('v1', 'vapor'), comporta('c2'), area('uv2', 'ultravioleta')];
    expect(indicesDoTipo(defs, 'comporta')).toEqual([1, 3]);
    expect(indicesDoTipo(defs, 'ultravioleta')).toEqual([0, 4]);
    expect(indicesDoTipo(defs, 'vapor')).toEqual([2]);
    expect(indicesDoTipo([], 'comporta')).toEqual([]);
  });
});

describe('estadoVisual', () => {
  it('ativo vence aviso, aviso vence recarga; nada: pronto', () => {
    expect(estadoVisual({ ativo: 1, aviso: 0.3, recarga: 5 })).toBe('ativo');
    expect(estadoVisual({ ativo: 0, aviso: 0.3, recarga: 5 })).toBe('aviso');
    expect(estadoVisual({ ativo: 0, aviso: 0, recarga: 5 })).toBe('recarga');
    expect(estadoVisual({ ativo: 0, aviso: 0, recarga: 0 })).toBe('pronto');
  });

  it('progresso do aviso vai de 0 (acionado) a 1 (liga)', () => {
    expect(progressoAviso(1, 1)).toBe(0);
    expect(progressoAviso(0.25, 1)).toBeCloseTo(0.75);
    expect(progressoAviso(0, 1)).toBe(1);
    expect(progressoAviso(0.5, 0)).toBe(1);
  });
});

describe('brilhoUV', () => {
  it('aceso fixo no ativo (com ou sem reduzir flashes); apagado pronto ou recarregando', () => {
    expect(brilhoUV({ ativo: 2, aviso: 0 }, 1, 3.3, false)).toBe(1);
    expect(brilhoUV({ ativo: 2, aviso: 0 }, 1, 3.3, true)).toBe(1);
    expect(brilhoUV({ ativo: 0, aviso: 0 }, 1, 3.3, false)).toBe(UV_APAGADA);
  });

  it('no aviso pisca, mas no máximo 3 acendimentos por segundo', () => {
    const amostras: number[] = [];
    for (let k = 0; k < 400; k++) amostras.push(brilhoUV({ ativo: 0, aviso: 4 - k * 0.01 }, 4, k * 0.01, false));
    const n = acendimentos(amostras);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(12);    // 4 s
    expect(DEGRAU_PISCA).toBeGreaterThanOrEqual(1 / 6);
  });

  it('com reduzir flashes: sobe suave do apagado, sem degrau e sem apagar de novo', () => {
    let anterior = brilhoUV({ ativo: 0, aviso: 2 }, 2, 0, true);
    let maiorSalto = 0;
    for (let k = 1; k < 200; k++) {
      const b = brilhoUV({ ativo: 0, aviso: 2 - k * 0.01 }, 2, k * 0.01, true);
      maiorSalto = Math.max(maiorSalto, Math.abs(b - anterior));
      expect(b).toBeGreaterThanOrEqual(anterior);
      anterior = b;
    }
    expect(maiorSalto).toBeLessThan(0.05);
    expect(anterior).toBeGreaterThan(0.4);
  });
});

describe('brilhoValvula (lâmpada do vapor)', () => {
  it('apagada fora do aviso e do jato; acesa fixa no jato', () => {
    expect(brilhoValvula({ ativo: 0, aviso: 0 }, 1, false)).toBe(0);
    expect(brilhoValvula({ ativo: 1, aviso: 0 }, 1, false)).toBe(1);
  });

  it('pisca no aviso (≤ 2 Hz); com reduzir flashes pulsa suave e nunca apaga', () => {
    const normal = Array.from({ length: 300 }, (_, k) => brilhoValvula({ ativo: 0, aviso: 1 }, k * 0.01, false));
    expect(acendimentos(normal)).toBeGreaterThan(0);
    expect(acendimentos(normal)).toBeLessThanOrEqual(6);
    let menor = 1;
    let maiorSalto = 0;
    for (let k = 1; k < 300; k++) {
      const a = brilhoValvula({ ativo: 0, aviso: 1 }, (k - 1) * 0.01, true);
      const b = brilhoValvula({ ativo: 0, aviso: 1 }, k * 0.01, true);
      menor = Math.min(menor, b);
      maiorSalto = Math.max(maiorSalto, Math.abs(b - a));
    }
    expect(menor).toBeGreaterThan(0.2);
    expect(maiorSalto).toBeLessThan(0.05);
  });
});

describe('vapor: taxa e emissão', () => {
  it('jato forte no ativo, fiapos crescendo no aviso, nada fora disso', () => {
    expect(taxaVapor({ ativo: 1, aviso: 0 }, 1)).toBe(TAXA_JATO);
    expect(taxaVapor({ ativo: 0, aviso: 0 }, 1)).toBe(0);
    const comeco = taxaVapor({ ativo: 0, aviso: 1 }, 1);
    const fim = taxaVapor({ ativo: 0, aviso: 0.01 }, 1);
    expect(fim).toBeGreaterThan(comeco);
    expect(fim).toBeLessThanOrEqual(TAXA_AVISO);
    expect(fim).toBeLessThan(TAXA_JATO);
  });

  it('emitirPorTaxa solta o número certo ao longo do tempo (o resto passa para o quadro seguinte)', () => {
    const acumulado = [0, 0];
    let total = 0;
    for (let k = 0; k < 60; k++) total += emitirPorTaxa(acumulado, 1, 38, 1 / 60);
    expect(total).toBe(38);
    expect(acumulado[0]).toBe(0);
    // sem taxa: zera o resto; jogo parado (dt 0): guarda o resto
    acumulado[1] = 0.7;
    expect(emitirPorTaxa(acumulado, 1, 10, 0)).toBe(0);
    expect(acumulado[1]).toBe(0.7);
    expect(emitirPorTaxa(acumulado, 1, 0, 1 / 60)).toBe(0);
    expect(acumulado[1]).toBe(0);
  });

  it('bicos: no máximo MAX_BICOS_LINHA por linha, espaçados ao longo de toda a área; teto da fase cabe no pool', () => {
    const { bicos } = bicosDaArea([0, 0, 8, 1], 2);
    expect(bicos.length).toBe(MAX_BICOS_LINHA);
    // espaçados por igual: centros das faixas de 2 células
    expect(bicos.map((b) => b.x)).toEqual([2, 6, 10, 14]);
    expect(bicosDaArea([0, 0, 8, 1], 2, 2).bicos.map((b) => b.x)).toEqual([4, 12]);
    expect(bicosDaArea([0, 0, 8, 1], 2, 0).bicos).toEqual([]);
    // área curta: um por célula mesmo com teto maior
    expect(bicosDaArea([0, 0, 3, 1], 2, 10).bicos.length).toBe(3);
    // pior caso da fase: jato em todos os bicos ao mesmo tempo, com ~0,9 s de vida, cabe com folga no pool de 512
    expect(MAX_BICOS_FASE * TAXA_JATO * 0.9).toBeLessThan(512 * 0.6);
  });

  it('bicos: um por célula ao longo do eixo comprido, no meio do eixo curto', () => {
    const { eixoX, bicos } = bicosDaArea([2, 5, 4, 1], 2);
    expect(eixoX).toBe(true);
    expect(bicos).toEqual([{ x: 5, z: 11 }, { x: 7, z: 11 }, { x: 9, z: 11 }, { x: 11, z: 11 }]);
    const vertical = bicosDaArea([3, 1, 1, 3], 2);
    expect(vertical.eixoX).toBe(false);
    expect(vertical.bicos.map((b) => b.x)).toEqual([7, 7, 7]);
    expect(vertical.bicos.map((b) => b.z)).toEqual([3, 5, 7]);
  });

  it('tubos UV: uma fileira em área estreita, duas em área larga, no máximo 8', () => {
    expect(tubosDaArea([0, 0, 3, 1], 2).tubos.length).toBe(3);
    expect(tubosDaArea([0, 0, 3, 2], 2).tubos.length).toBe(6);
    expect(tubosDaArea([0, 0, 6, 4], 2).tubos.length).toBe(8);
    // dentro da área
    for (const t of tubosDaArea([1, 1, 3, 3], 2).tubos) {
      expect(t.x).toBeGreaterThan(2);
      expect(t.x).toBeLessThan(8);
      expect(t.z).toBeGreaterThan(2);
      expect(t.z).toBeLessThan(8);
    }
  });
});

describe('marca no piso da área (lote final do CP3)', () => {
  it('UV: apagada pronta e recarregando, pisca no aviso, firme no ativo', () => {
    expect(pisoPerigo('ultravioleta', { ativo: 0, aviso: 0 }, 1, 0, false)).toBe(0);
    expect(pisoPerigo('ultravioleta', { ativo: 2, aviso: 0 }, 1, 0.3, false)).toBe(1);
    // no aviso segue o pisca dos tubos: os dois níveis aparecem em degraus de 1/6 s
    const niveis = new Set<number>();
    for (let k = 0; k < 60; k++) niveis.add(pisoPerigo('ultravioleta', { ativo: 0, aviso: 0.5 }, 1, k * DEGRAU_PISCA, false));
    expect(niveis.size).toBe(2);
    for (const n of niveis) expect(n).toBeGreaterThan(0);
  });

  it('UV com "reduzir flashes": sobe suave no aviso, sem degrau', () => {
    const a = pisoPerigo('ultravioleta', { ativo: 0, aviso: 0.8 }, 1, 0, true);
    const b = pisoPerigo('ultravioleta', { ativo: 0, aviso: 0.2 }, 1, 0.05, true);
    expect(b).toBeGreaterThan(a);
    expect(pisoPerigo('ultravioleta', { ativo: 0, aviso: 0.2 }, 1, 9.9, true)).toBe(b);
  });

  it('vapor: névoa que cresce no aviso (sem piscar) e fica densa no jato', () => {
    expect(pisoPerigo('vapor', { ativo: 0, aviso: 0 }, 0.6, 0, false)).toBe(0);
    const inicio = pisoPerigo('vapor', { ativo: 0, aviso: 0.6 }, 0.6, 0, false);
    const fim = pisoPerigo('vapor', { ativo: 0, aviso: 0.05 }, 0.6, 0.123, false);
    expect(inicio).toBeGreaterThan(0.2);
    expect(fim).toBeGreaterThan(inicio);
    expect(pisoPerigo('vapor', { ativo: 1, aviso: 0 }, 0.6, 0, false)).toBe(1);
    expect(pisoPerigo('vapor', { ativo: 0, aviso: 0.3 }, 0.6, 1, true)).toBe(pisoPerigo('vapor', { ativo: 0, aviso: 0.3 }, 0.6, 7, false));
  });
});
