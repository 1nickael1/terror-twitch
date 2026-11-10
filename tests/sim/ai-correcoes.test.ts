// tests/sim/ai-correcoes.test.ts — correções 1 e 2 do adendo do CP2
import { describe, expect, it } from 'vitest';
import { avancarInimigos } from '../../src/sim/ai/comum';
import { caminho, centro, coordDe, criarGrid, DEGRAU, SALTO } from '../../src/sim/grid';
import { criarWorld, type World } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const dt = 1 / 60;
const LESTE = -Math.PI / 2;
const rodar = (w: World, s: number) => {
  const tipos: string[] = [];
  for (let k = 0; k < Math.round(s / dt); k++) tipos.push(...avancarInimigos(w, [], dt).map((e) => e.tipo));
  return tipos;
};

describe('correção 1: inimigos não descem mais que SALTO', () => {
  const BORDA = `
    #########
    #AAAA...#
    #AAAA...#
    #AAAA..P#
    #########
  `;

  it('caminho com queda máxima recusa a descida alta; sem ela, aceita', () => {
    const g = criarGrid(BORDA, { A: { piso: 2 } });
    expect(caminho(g, centro([2, 2]), centro([7, 3]), DEGRAU)).not.toBeNull();
    expect(caminho(g, centro([2, 2]), centro([7, 3]), DEGRAU, undefined, SALTO)).toBeNull();
    const baixa = criarGrid(BORDA, { A: { piso: 1 } });
    expect(caminho(baixa, centro([2, 2]), centro([7, 3]), DEGRAU, undefined, SALTO)).not.toBeNull();
  });

  it('avançador numa plataforma de 2 m não pula para o jogador lá embaixo', () => {
    const w = criarWorld(faseMinima(BORDA, { legenda: { A: { piso: 2 } } }));
    const i = porInimigo(w, 'funcionario', [2, 2]);
    i.yaw = LESTE;
    const tipos = rodar(w, 5);
    expect(tipos).toContain('inimigo_alerta');
    expect(i.y).toBe(2);
    expect(coordDe(i.pos)[0]).toBeLessThanOrEqual(4);
    expect(w.jogador.vida).toBe(100);
  });

  it('desce degrau de até SALTO e ataca', () => {
    const w = criarWorld(faseMinima(BORDA, { legenda: { A: { piso: 1 } } }));
    const i = porInimigo(w, 'funcionario', [2, 2]);
    i.yaw = LESTE;
    rodar(w, 5);
    expect(i.y).toBe(0);
    expect(w.jogador.vida).toBeLessThan(100);
  });
});

describe('correção 2: avançador sem rota até o jogador visto', () => {
  const ILHA = `
    ###########
    #.........#
    #.....BBB.#
    #.....BPB.#
    #.....BBB.#
    #.........#
    ###########
  `;
  const mundo = () => criarWorld(faseMinima(ILHA, { legenda: { B: { piso: 1.5 }, P: { piso: 1.5 } } }));

  it('vai à célula alcançável mais próxima do jogador e espera ali, de frente para ele', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [1, 3]);
    i.yaw = LESTE;
    rodar(w, 4);
    expect(i.modo).toBe('perseguicao');
    expect(coordDe(i.pos)).toEqual([5, 3]);
    const pos = { ...i.pos };
    rodar(w, 1);
    expect(Math.hypot(i.pos.x - pos.x, i.pos.z - pos.z)).toBeLessThan(0.05);
    // de frente para o jogador: frente = (-sin yaw, -cos yaw) aponta para o leste
    expect(-Math.sin(i.yaw)).toBeGreaterThan(0.99);
    expect(w.jogador.vida).toBe(100);
  });

  it('volta à rota normal quando o jogador fica alcançável', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [1, 3]);
    i.yaw = LESTE;
    rodar(w, 3);
    w.jogador.pos = centro([9, 5]);
    w.jogador.y = 0;
    rodar(w, 4);
    expect(i.refugio).toBeNull();
    expect(w.jogador.vida).toBeLessThan(100);
  });
});
