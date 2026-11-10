// Robô (C2.2, correção 3): sala de combate, chefe e comportas.
import { describe, expect, it } from 'vitest';
import { decidir, novoRobo, percorrer } from '../../src/levels/robo';
import type { PerigoDef } from '../../src/sim/fase';
import { centro } from '../../src/sim/grid';
import { criarWorld } from '../../src/sim/world';
import { faseComChefe, faseMinima } from '../sim/ajuda';

describe('percorrer: sala de combate', () => {
  it('vai à área que cria o grupo cuja morte destranca a porta da saída', () => {
    const planta = ['#########', '#P....D.#', '#.#######', '#.#', '#.#', '###'].join('\n');
    const f = faseMinima(planta, {
      saida: [7, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
      gatilhos: [
        { id: 'emboscada', quando: { tipo: 'area', area: [1, 4, 1, 1] }, faz: [{ acao: 'spawn', inimigos: [{ em: [1, 3], tipo: 'funcionario', grupo: 'g' }] }] },
        { id: 'limpo', quando: { tipo: 'grupo_morto', grupo: 'g' }, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] },
      ],
    });
    expect(percorrer(f, 60)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });
});

describe('percorrer: chefe', () => {
  it('sem inimigos, o chefe morre e a porta aberta por chefe_morto deixa chegar à saída', () => {
    const planta = ['#########', '#P....D.#', '#.#######', '#b#', '###'].join('\n');
    const f = faseComChefe(planta, { em: 'b' }, {
      saida: [7, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
      gatilhos: [{ id: 'fim', quando: { tipo: 'chefe_morto' }, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] }],
    });
    expect(percorrer(f, 60)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('a saída só conclui com o chefe morto', () => {
    // chefe isolado a mais de 8 m: nunca desperta nem é visto
    const f = faseComChefe('##############\n#P.X#.......b#\n##############', { em: 'b' }, { saida: [3, 1] });
    expect(percorrer(f, 60)).toMatchObject({ concluiu: true, motivo: 'saída' });
    expect(percorrer(f, 3, { semInimigos: false })).toEqual({ concluiu: false, passos: 180, motivo: 'tempo' });
  });
});

describe('robô e comportas', () => {
  const comporta: PerigoDef = { id: 'c1', tipo: 'comporta', area: [4, 1, 1, 1], duracao: 4, recarga: 10, danoChefe: 0.3, danoComum: 20 };
  const planta = ['##########', '#P......X#', '##########', '#b#', '###'].join('\n');
  const f = faseComChefe(planta, { em: 'b', perigos: [comporta] }, {
    saida: [8, 1],
    gatilhos: [{ id: 'alavanca', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'perigo', id: 'c1' }] }],
  });

  it('espera diante da comporta fechada na rota', () => {
    const w = criarWorld(f);
    w.perigos[0].ativo = 3;
    w.jogador.pos = centro([3, 1]);
    const input = decidir(w, novoRobo());
    expect(input.frente).toBe(0);
    expect(input.lado).toBe(0);
  });

  it('segue quando a comporta abre e chega à saída', () => {
    const r = percorrer(f, 60);
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    expect(r.passos).toBeGreaterThan(comporta.duracao * 60);
  });
});
