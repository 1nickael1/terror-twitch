import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { MaterialBank } from '../../src/engine/materials';
import { PerigosAreaView } from '../../src/engine/view/perigosArea';
import { MAX_BICOS_FASE, TAXA_JATO } from '../../src/engine/view/perigosLogica';
import { Recursos } from '../../src/engine/view/recursos';
import type { PerigoDef } from '../../src/sim/fase';
import { criarWorld, type World } from '../../src/sim/world';
import { faseComChefe } from '../sim/ajuda';

const PLANTA = [
  '##############',
  '#P...........#',
  '#............#',
  '##############',
].join('\n');

const area = (id: string, tipo: 'ultravioleta' | 'vapor', col: number, larg = 1): PerigoDef => ({
  id, tipo, area: [col, 1, larg, 2], aviso: 1, duracao: 4, recarga: 10, danoChefePorSeg: 0.07, danoPorSeg: 10,
});

function montar(perigos: PerigoDef[]) {
  const w = criarWorld(faseComChefe(PLANTA, { em: [12, 2], perigos }));
  const bank = new MaterialBank();
  bank.define('metal', { color: 0x333333 });
  bank.define('tubo', { color: 0x555555 });
  const grupo = new Group();
  const jatos: { x: number; forte: boolean; n: number }[] = [];
  const particulas = { emitirVapor: (_w: World, x: number, _y: number, _z: number, n: number, forte: boolean) => { jatos.push({ x, n, forte }); } };
  const view = new PerigosAreaView(w.fase, w.grid, new Recursos(bank), grupo, particulas);
  return { w, grupo, view, jatos };
}

const nomes = (g: Group) => g.children.map((c) => c.name);

describe('PerigosAreaView com lista mista (casa por índice com world.perigos)', () => {
  const MISTA: PerigoDef[] = [
    area('uv1', 'ultravioleta', 2),
    { id: 'c1', tipo: 'comporta', area: [5, 1, 1, 2], duracao: 3, recarga: 8, danoChefe: 0.3, danoComum: 40 },
    area('v1', 'vapor', 7, 2),
  ];

  it('desenha só os perigos de área; a comporta fica com a ComportasView', () => {
    const { grupo } = montar(MISTA);
    const n = nomes(grupo);
    expect(n).toContain('uv-tubos:uv1');
    expect(n).toContain('uv-luz:uv1');
    expect(n).toContain('vapor-cano:v1');
    expect(n.some((x) => x.includes('c1'))).toBe(false);
  });

  it('comporta fechada não solta vapor nem acende a UV; o vapor ativo solta jato pelos próprios bicos', () => {
    const { w, view, jatos } = montar(MISTA);
    w.perigos[1].ativo = 3;   // comporta
    view.sincronizar(w);
    w.t += 1 / 60;
    view.sincronizar(w);
    expect(jatos).toEqual([]);
    w.perigos[2].ativo = 3;   // vapor
    for (let k = 0; k < 30; k++) {
      w.t += 1 / 60;
      view.sincronizar(w);
    }
    expect(jatos.length).toBeGreaterThan(0);
    expect(jatos.every((j) => j.forte)).toBe(true);
    // os bicos do vapor estão na área dele (colunas 7 e 8: x de 14 a 18)
    expect(jatos.every((j) => j.x > 14 && j.x < 18)).toBe(true);
  });

  it('a luz da UV acende no ativo e apaga fora dele', () => {
    const { w, view, grupo } = montar(MISTA);
    const luz = grupo.children.find((c) => c.name === 'uv-luz:uv1') as unknown as { intensity: number };
    view.sincronizar(w);
    expect(luz.intensity).toBe(0);
    w.perigos[0].ativo = 2;
    w.t += 1 / 60;
    view.sincronizar(w);
    expect(luz.intensity).toBeGreaterThan(0);
  });

  it('o total de bicos de vapor da fase respeita MAX_BICOS_FASE', () => {
    const linhas = [area('v1', 'vapor', 1, 6), area('v2', 'vapor', 7, 6), area('v3', 'vapor', 1, 2)];
    const { w, view, jatos } = montar(linhas);
    for (const p of w.perigos) p.ativo = 3;
    view.sincronizar(w);
    for (let k = 0; k < 60; k++) {
      w.t += 1 / 60;
      view.sincronizar(w);
    }
    // 1 s de jato em tudo: no máximo MAX_BICOS_FASE bicos × TAXA_JATO partículas (a terceira linha fica sem bico)
    const porSegundo = jatos.reduce((s, j) => s + j.n, 0);
    expect(porSegundo).toBe(MAX_BICOS_FASE * TAXA_JATO);
  });
});
