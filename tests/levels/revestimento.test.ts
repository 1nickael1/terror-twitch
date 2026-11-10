// Revestimento de parede por fase (C3.5, correção 1): validador, fases e escolha do slot na engine.
import type { Group, Mesh } from 'three';
import { BoxGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { Coletor, UV_POR_METRO } from '../../src/engine/view/geometria';
import type { Recursos } from '../../src/engine/view/recursos';
import { AZULEJO, slotsDoRevestimento } from '../../src/engine/view/revestimento';
import { fase1 } from '../../src/levels/fase1';
import { fase2 } from '../../src/levels/fase2';
import { validarFase } from '../../src/levels/validar';
import type { LevelDef, Revestimento } from '../../src/sim/fase';
import { faseMinima } from '../sim/ajuda';

const livre = { minSegredos: 0, minCartoes: 0 };
const comRevestimento = (r: unknown): LevelDef => {
  const f = faseMinima('#####\n#P.X#\n#####', { saida: [3, 1] });
  return { ...f, ambiente: { ...f.ambiente, revestimento: r as Revestimento } };
};

describe('revestimento de parede', () => {
  it('o validador aceita ausente, "escritorio" e "azulejo"', () => {
    expect(validarFase(faseMinima('#####\n#P.X#\n#####', { saida: [3, 1] }), livre)).toEqual([]);
    expect(validarFase(comRevestimento('escritorio'), livre)).toEqual([]);
    expect(validarFase(comRevestimento('azulejo'), livre)).toEqual([]);
  });

  it('o validador acusa revestimento desconhecido', () => {
    expect(validarFase(comRevestimento('marmore'), livre)).toContain('Revestimento "marmore" desconhecido');
  });

  it('fase 1 sem revestimento (a parede de sempre); fase 2 com azulejo', () => {
    expect(fase1.ambiente.revestimento).toBeUndefined();
    expect(fase2.ambiente.revestimento).toBe('azulejo');
  });

  it('a engine troca só o slot da parede, e só no azulejo', () => {
    expect(slotsDoRevestimento(undefined)).toEqual({});
    expect(slotsDoRevestimento('escritorio')).toEqual({});
    expect(slotsDoRevestimento('azulejo')).toEqual({ parede: 'parede-azulejo' });
  });

  it('azulejos de ~15 cm: a textura cobre uma repetição das UVs, com ladrilhos de pixels inteiros', () => {
    expect(AZULEJO.metros).toBe(1 / UV_POR_METRO);
    const lado = AZULEJO.metros / AZULEJO.ladrilhos;
    expect(lado).toBeGreaterThan(0.13);
    expect(lado).toBeLessThan(0.17);
    expect(Number.isInteger(AZULEJO.px / AZULEJO.ladrilhos)).toBe(true);
  });

  it('o coletor cria as malhas com o slot renomeado (sem renomear, como antes)', () => {
    const slots = (renomear?: Record<string, string>) => {
      const usados: string[] = [];
      const rec = { usar: <T extends Mesh>(m: T, slot: string) => { usados.push(slot); return m; } } as unknown as Recursos;
      const co = new Coletor();
      co.add('parede', new BoxGeometry());
      co.add('piso', new BoxGeometry());
      co.finalizar(rec, { add: () => undefined } as unknown as Group, new Set(), renomear);
      return usados;
    };
    expect(slots()).toEqual(['parede', 'piso']);
    expect(slots(slotsDoRevestimento('azulejo'))).toEqual(['parede-azulejo', 'piso']);
  });
});
