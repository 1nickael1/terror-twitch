// tests/sim/doors.test.ts
import { describe, expect, it } from 'vitest';
import { PORTA } from '../../src/sim/balance';
import { avancarPortas, comandarPorta, solidoDe, usar } from '../../src/sim/doors';
import { centro } from '../../src/sim/grid';
import { criarWorld } from '../../src/sim/world';
import { faseMinima } from './ajuda';

const PLANTA = '########\n#P.D...#\n########';
const dt = 1 / 60;
const mundo = (porta = {}) => {
  const w = criarWorld(faseMinima(PLANTA, { portas: [{ id: 'd1', em: 'D', ...porta }] }));
  w.jogador.pos = centro([2, 1]);
  return w;
};
const esperar = (w: ReturnType<typeof mundo>, s: number) => {
  const tipos: string[] = [];
  for (let i = 0; i < Math.ceil(s / dt); i++) tipos.push(...avancarPortas(w, dt).map((e) => e.tipo));
  return tipos;
};

describe('portas', () => {
  it('fechada bloqueia; usar abre; aberta libera', () => {
    const w = mundo();
    expect(solidoDe(w)(3, 1)).toBe(true);
    expect(usar(w)).toContainEqual({ tipo: 'porta', id: 'd1', estado: 'abrindo' });
    const tipos = esperar(w, PORTA.tempo + 0.1);
    expect(tipos).toContain('ruido');
    expect(w.portas[0].estado).toBe('aberta');
    expect(solidoDe(w)(3, 1)).toBe(false);
  });

  it('o jogador fecha a porta atrás de si', () => {
    const w = mundo();
    usar(w); esperar(w, 1);
    usar(w); esperar(w, 1);
    expect(w.portas[0].estado).toBe('fechada');
  });

  it('não fecha com alguém no vão', () => {
    const w = mundo();
    usar(w); esperar(w, 1);
    w.jogador.pos = centro([3, 1]);
    usar(w);
    expect(w.portas[0].estado).toBe('aberta');
  });

  it('trancada exige cartão do nível', () => {
    const w = mundo({ exige: 2, trancada: true });
    expect(usar(w)).toEqual([{ tipo: 'porta_negada', id: 'd1', exige: 2 }]);
    w.jogador.cartoes = [1];
    expect(usar(w)).toEqual([{ tipo: 'porta_negada', id: 'd1', exige: 2 }]);
    w.jogador.cartoes = [1, 3];
    expect(usar(w)).toContainEqual({ tipo: 'porta', id: 'd1', estado: 'abrindo' });
  });

  it('trancada sem cartão só abre por comando', () => {
    const w = mundo({ trancada: true });
    expect(usar(w)).toEqual([{ tipo: 'porta_negada', id: 'd1', exige: null }]);
    comandarPorta(w, 'd1', 'abrir');
    esperar(w, 1);
    expect(w.portas[0].estado).toBe('aberta');
  });

  it('longe demais ou de costas não usa', () => {
    const w = mundo();
    w.jogador.pos = centro([1, 1]);
    w.jogador.yaw = Math.PI / 2;
    expect(usar(w)).toEqual([]);
  });
});

describe('portas: comandos e usar (complemento)', () => {
  it('trancar fecha a porta aberta e tranca ao terminar de fechar', () => {
    const w = mundo();
    usar(w); esperar(w, 1);
    expect(comandarPorta(w, 'd1', 'trancar')).toEqual([{ tipo: 'porta', id: 'd1', estado: 'fechando' }]);
    esperar(w, 1);
    expect(w.portas[0].estado).toBe('trancada');
    expect(comandarPorta(w, 'd1', 'destrancar')).toEqual([{ tipo: 'porta', id: 'd1', estado: 'fechada' }]);
  });

  it('fechando espera o vão ficar livre', () => {
    const w = mundo();
    usar(w); esperar(w, 1);
    comandarPorta(w, 'd1', 'trancar');
    w.jogador.pos = centro([3, 1]);
    esperar(w, 1);
    expect(w.portas[0].abertura).toBe(1);
    w.jogador.pos = centro([2, 1]);
    esperar(w, 1);
    expect(w.portas[0].estado).toBe('trancada');
  });

  it('usar aciona terminal e documento à frente', () => {
    const fase = faseMinima('########\n#P.T...#\n########', {
      terminais: [{ id: 't1', em: 'T', rotulo: 'Terminal' }],
      documentos: [{ id: 'doc1', em: [1, 1], titulo: 'Nota', texto: '...' }],
    });
    const w = criarWorld(fase);
    w.jogador.pos = centro([2, 1]);
    expect(usar(w)).toEqual([{ tipo: 'terminal', id: 't1' }]);
    w.jogador.yaw = Math.PI / 2;
    expect(usar(w)).toEqual([{ tipo: 'documento', id: 'doc1' }]);
  });
});

describe('portas: correção 1', () => {
  it('comando fechar com alguém no vão não se perde: espera e fecha quando o vão fica livre', () => {
    const w = mundo();
    usar(w); esperar(w, 1);
    w.jogador.pos = centro([3, 1]);
    expect(comandarPorta(w, 'd1', 'fechar')).toEqual([{ tipo: 'porta', id: 'd1', estado: 'fechando' }]);
    esperar(w, 1);
    expect(w.portas[0].estado).toBe('fechando');
    expect(w.portas[0].abertura).toBe(1);
    w.jogador.pos = centro([2, 1]);
    esperar(w, 1);
    expect(w.portas[0].estado).toBe('fechada');
  });
});
