import { describe, expect, it } from 'vitest';
import { absorver, curar } from '../../src/sim/damage';

describe('absorver', () => {
  it('sem colete, todo o dano vai para a vida', () => {
    expect(absorver({ vida: 100, colete: 0 }, 30)).toEqual({ vida: 70, colete: 0 });
  });
  it('com colete, ele segura 2/3 do golpe', () => {
    expect(absorver({ vida: 100, colete: 50 }, 30)).toEqual({ vida: 90, colete: 30 });
  });
  it('quando o colete acaba no meio do golpe, a sobra vai para a vida', () => {
    expect(absorver({ vida: 100, colete: 10 }, 30)).toEqual({ vida: 80, colete: 0 });
  });
  it('a vida não fica negativa', () => {
    expect(absorver({ vida: 5, colete: 0 }, 50).vida).toBe(0);
  });
  it('dano zero ou negativo devolve uma cópia sem mudar nada', () => {
    const alvo = { vida: 50, colete: 20 };
    for (const dano of [0, -10]) {
      const r = absorver(alvo, dano);
      expect(r).toEqual({ vida: 50, colete: 20 });
      expect(r).not.toBe(alvo);
    }
  });
});

describe('curar', () => {
  it('limita em 100', () => {
    expect(curar({ vida: 90, colete: 95 }, 25, 25)).toEqual({ vida: 100, colete: 100 });
  });
});
