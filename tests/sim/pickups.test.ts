// tests/sim/pickups.test.ts
import { describe, expect, it } from 'vitest';
import { MUNICAO_MAX, PICKUP } from '../../src/sim/balance';
import { centro } from '../../src/sim/grid';
import { coletar } from '../../src/sim/pickups';
import { criarWorld } from '../../src/sim/world';
import type { PickupDef } from '../../src/sim/fase';
import { faseMinima } from './ajuda';

const mundo = (p: Omit<PickupDef, 'em'>) => {
  const w = criarWorld(faseMinima('######\n#P...#\n######', { pickups: [{ em: [3, 1], ...p }] }));
  w.jogador.pos = centro([3, 1]);
  return w;
};

describe('coletar', () => {
  it('vida cura e some', () => {
    const w = mundo({ tipo: 'vida_p' });
    w.jogador.vida = 50;
    expect(coletar(w)).toEqual([{ tipo: 'pickup', indice: 0 }]);
    expect(w.jogador.vida).toBe(50 + PICKUP.vida_p);
    expect(coletar(w)).toEqual([]);
  });
  it('vida cheia não coleta', () => {
    const w = mundo({ tipo: 'vida_g' });
    expect(coletar(w)).toEqual([]);
    expect(w.pickups[0].pego).toBe(false);
  });
  it('munição respeita o máximo', () => {
    const w = mundo({ tipo: 'municao', municao: 'cartuchos', quantidade: 999 });
    coletar(w);
    expect(w.jogador.municao.cartuchos).toBe(MUNICAO_MAX.cartuchos);
  });
  it('arma nova entra no arsenal e é selecionada', () => {
    const w = mundo({ tipo: 'arma', arma: 'escopeta', quantidade: 8 });
    w.jogador.armas = ['pistola'];
    w.jogador.municao.cartuchos = 0;
    coletar(w);
    expect(w.jogador.armas).toContain('escopeta');
    expect(w.jogador.arma).toBe('escopeta');
    expect(w.jogador.municao.cartuchos).toBe(8);
  });
  it('arma nova não encurta a espera nem guarda tiro pendente', () => {
    const w = mundo({ tipo: 'arma', arma: 'escopeta' });
    w.jogador.armas = ['pistola'];
    w.jogador.espera = 0.9;
    w.jogador.tiroPendente = 0.1;
    expect(coletar(w)).toEqual([{ tipo: 'pickup', indice: 0 }, { tipo: 'arma_trocada', arma: 'escopeta' }]);
    expect(w.jogador.espera).toBe(0.9);
    expect(w.jogador.tiroPendente).toBe(0);
  });
  it('cartão entra na lista', () => {
    const w = mundo({ tipo: 'cartao', nivel: 2 });
    coletar(w);
    expect(w.jogador.cartoes).toEqual([2]);
  });
  it('longe não coleta', () => {
    const w = mundo({ tipo: 'cartao', nivel: 1 });
    w.jogador.pos = centro([1, 1]);
    expect(coletar(w)).toEqual([]);
  });
});
