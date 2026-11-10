// tests/sim/tension.test.ts
import { describe, expect, it } from 'vitest';
import { suavizarTensao, tensaoAlvo } from '../../src/sim/tension';
import { criarWorld } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const mundo = () => criarWorld(faseMinima('########\n#P.....#\n########'));

describe('tensaoAlvo', () => {
  it('é zero em paz e fica em [0, 1]', () => {
    const w = mundo();
    expect(tensaoAlvo(w)).toBe(0);
    for (let k = 2; k < 7; k++) porInimigo(w, 'funcionario', [k, 1]).modo = 'perseguicao';
    w.alarme = true;
    w.jogador.vida = 5;
    expect(tensaoAlvo(w)).toBeLessThanOrEqual(1);
  });
  it('cresce com inimigos em perseguição', () => {
    const w = mundo();
    porInimigo(w, 'funcionario', [3, 1]).modo = 'perseguicao';
    const um = tensaoAlvo(w);
    porInimigo(w, 'funcionario', [4, 1]).modo = 'perseguicao';
    expect(um).toBeGreaterThan(0);
    expect(tensaoAlvo(w)).toBeGreaterThan(um);
  });
  it('inimigo morto ou em patrulha não conta', () => {
    const w = mundo();
    porInimigo(w, 'funcionario', [3, 1]).modo = 'morto';
    porInimigo(w, 'funcionario', [4, 1]).modo = 'patrulha';
    expect(tensaoAlvo(w)).toBe(0);
  });
});

describe('suavizarTensao', () => {
  it('sobe mais rápido do que desce', () => {
    const sobe = suavizarTensao(0, 1, 0.5);
    const desce = 1 - suavizarTensao(1, 0, 0.5);
    expect(sobe).toBeGreaterThan(desce);
    expect(suavizarTensao(0.5, 0.5, 1)).toBeCloseTo(0.5);
  });
});

describe('tensaoAlvo: pesos', () => {
  it('suspeita vale menos do que perseguição', () => {
    const a = mundo();
    porInimigo(a, 'funcionario', [3, 1]).modo = 'suspeita';
    const b = mundo();
    porInimigo(b, 'funcionario', [3, 1]).modo = 'perseguicao';
    expect(tensaoAlvo(a)).toBeGreaterThan(0);
    expect(tensaoAlvo(a)).toBeLessThan(tensaoAlvo(b));
  });
  it('vida baixa só pesa com ameaça (inimigo contando ou alarme)', () => {
    const w = mundo();
    w.jogador.vida = 10;
    expect(tensaoAlvo(w)).toBe(0);
    w.alarme = true;
    const soAlarme = mundo();
    soAlarme.alarme = true;
    expect(tensaoAlvo(w)).toBeGreaterThan(tensaoAlvo(soAlarme));
  });
});
