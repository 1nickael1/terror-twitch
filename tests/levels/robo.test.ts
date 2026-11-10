import { describe, expect, it } from 'vitest';
import { decidir, novoRobo, percorrer } from '../../src/levels/robo';
import { centro } from '../../src/sim/grid';
import { frente } from '../../src/sim/player';
import { criarWorld } from '../../src/sim/world';
import { faseMinima, porInimigo } from '../sim/ajuda';

describe('percorrer', () => {
  it('atravessa um corredor reto', () => {
    const r = percorrer(faseMinima('########\n#P....X#\n########', { saida: [6, 1] }));
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    expect(r.passos).toBeGreaterThan(0);
    expect(r.passos).toBeLessThan(5 * 60);
  });

  it('faz curvas, sobe degrau, sobe e desce rampa', () => {
    const planta = [
      '#######',
      '#P._..#',
      '#####r#',
      '#X..sa#',
      '#######',
    ].join('\n');
    const f = faseMinima(planta, {
      saida: [1, 3], legenda: { _: { piso: 0.5 }, r: { rampa: 'z' }, s: { rampa: 'x' }, a: { piso: 1.5 } },
    });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('abre uma porta fechada no caminho', () => {
    const f = faseMinima('#######\n#P.D.X#\n#######', { saida: [5, 1], portas: [{ id: 'd', em: 'D' }] });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('busca o cartão num desvio antes da porta trancada', () => {
    const planta = ['#######', '#P..D.#', '#.#####', '#c#', '###'].join('\n');
    const f = faseMinima(planta, {
      saida: [5, 1], portas: [{ id: 'd', em: 'D', exige: 1, trancada: true }],
      pickups: [{ em: 'c', tipo: 'cartao', nivel: 1 }],
    });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('pula para uma plataforma', () => {
    const f = faseMinima('#######\n#P..kX#\n#######', { saida: [5, 1], legenda: { k: { piso: 1 }, X: { piso: 1 } } });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('usa um terminal na parede que abre a porta', () => {
    const planta = ['#######', '#P..F.#', '##t####'].join('\n');
    const f = faseMinima(planta, {
      saida: [5, 1], legenda: { t: { tipo: 'parede' } },
      portas: [{ id: 'f', em: 'F', trancada: true }],
      terminais: [{ id: 't1', em: 't', rotulo: 'Liberar' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'terminal', id: 't1' }, faz: [{ acao: 'porta', id: 'f', estado: 'abrir' }] }],
    });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('pega o pickup que abre a porta', () => {
    const planta = ['#######', '#P..F.#', '#.#####', '#k#', '###'].join('\n');
    const f = faseMinima(planta, {
      saida: [5, 1], portas: [{ id: 'f', em: 'F', trancada: true }],
      pickups: [{ em: 'k', tipo: 'colete_p' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'pickup', indice: 0 }, faz: [{ acao: 'porta', id: 'f', estado: 'abrir' }] }],
    });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('pisa na área que abre a porta', () => {
    const planta = ['#######', '#P..F.#', '#.#####', '#.#', '###'].join('\n');
    const f = faseMinima(planta, {
      saida: [5, 1], portas: [{ id: 'f', em: 'F', trancada: true }],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [1, 3, 1, 1] }, faz: [{ acao: 'porta', id: 'f', estado: 'abrir' }] }],
    });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('sem caminho até a saída desiste em 5 s de simulação', () => {
    const r = percorrer(faseMinima('#####\n#P#X#\n#####', { saida: [3, 1] }));
    expect(r).toMatchObject({ concluiu: false, motivo: 'sem caminho' });
    expect(r.passos).toBeLessThanOrEqual(5 * 60 + 1);
  });

  it('para por tempo', () => {
    const r = percorrer(faseMinima('############\n#P........X#\n############', { saida: [10, 1] }), 0.5);
    expect(r).toEqual({ concluiu: false, passos: 30, motivo: 'tempo' });
  });

  it('para na morte', () => {
    const f = faseMinima('############\n#P........X#\n############', {
      saida: [10, 1],
      gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'cronometro', segundos: 0.2 }] }],
    });
    expect(percorrer(f)).toMatchObject({ concluiu: false, motivo: 'morte' });
  });
});

describe('decidir', () => {
  it('mira e atira no inimigo visível', () => {
    const w = criarWorld(faseMinima('########\n#P.....#\n########'));
    w.jogador.yaw = 0;
    const alvo = porInimigo(w, 'funcionario', [5, 1]);
    alvo.modo = 'dormindo';
    const input = decidir(w, novoRobo());
    expect(input.atirar).toBe(true);
    expect(input.frente).toBe(0);
    const f = frente(w.jogador.yaw + input.dYaw);
    const p = centro([5, 1]);
    const d = Math.hypot(p.x - w.jogador.pos.x, p.z - w.jogador.pos.z);
    expect(f.x).toBeCloseTo((p.x - w.jogador.pos.x) / d, 5);
    expect(f.z).toBeCloseTo((p.z - w.jogador.pos.z) / d, 5);
  });
});

describe('percorrer: correção 1', () => {
  it('sem inimigos, grupo_morto dispara e destranca a porta do caminho', () => {
    const f = faseMinima('#######\n#Pa.D.#\n#######', {
      saida: [5, 1], portas: [{ id: 'd', em: 'D', trancada: true }],
      inimigos: [{ em: 'a', tipo: 'funcionario', grupo: 'sala' }],
      gatilhos: [{ id: 'g', quando: { tipo: 'grupo_morto', grupo: 'sala' }, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] }],
    });
    expect(percorrer(f)).toMatchObject({ concluiu: true, motivo: 'saída' });
  });

  it('desiste de pickup-objetivo que não pode ser coletado e termina sem caminho', () => {
    const planta = ['#######', '#P..F.#', '#.#####', '#k#', '###'].join('\n');
    const f = faseMinima(planta, {
      saida: [5, 1], portas: [{ id: 'f', em: 'F', trancada: true }],
      pickups: [{ em: 'k', tipo: 'vida_p' }],   // vida cheia: não é coletado
      gatilhos: [{ id: 'g', quando: { tipo: 'pickup', indice: 0 }, faz: [{ acao: 'porta', id: 'f', estado: 'abrir' }] }],
    });
    const r = percorrer(f);
    expect(r).toMatchObject({ concluiu: false, motivo: 'sem caminho' });
    expect(r.passos).toBeLessThan(30 * 60);
  });
});
