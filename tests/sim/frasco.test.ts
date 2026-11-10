// tests/sim/frasco.test.ts — projétil em arco do enfermeiro: parábola até o ponto mirado e respingo (C3.2)
import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/eventos';
import { centro } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { quebrarFrasco } from '../../src/sim/weapons';
import { INPUT_VAZIO, criarWorld, type Inimigo, type World } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const OESTE = Math.PI / 2;   // frente = (-1, 0)

const CORREDOR = `
  ######################
  #P...................#
  #....................#
  #....................#
  ######################
`;

function mundo(planta = CORREDOR, legenda = {}): World {
  const w = criarWorld(faseMinima(planta, { saida: [20, 3], legenda }));
  w.jogador.colete = 0;
  return w;
}

/** Roda até o primeiro evento do tipo (ou o limite), devolvendo os eventos do caminho. */
function ate(w: World, tipo: SimEvent['tipo'], limite = 10, aoPasso?: (ev: SimEvent[]) => void): SimEvent[] {
  const todos: SimEvent[] = [];
  for (let k = 0; k < limite / PASSO; k++) {
    const ev = step(w, INPUT_VAZIO, PASSO);
    todos.push(...ev);
    aoPasso?.(ev);
    if (ev.some((e) => e.tipo === tipo)) break;
  }
  return todos;
}

function quebra(ev: readonly SimEvent[]): Extract<SimEvent, { tipo: 'frasco_quebra' }> {
  const q = ev.find((e) => e.tipo === 'frasco_quebra');
  if (!q || q.tipo !== 'frasco_quebra') throw new Error('o frasco não quebrou');
  return q;
}

function enfermeiro(w: World, coord: [number, number]): Inimigo {
  return porInimigo(w, 'enfermeiro', coord, { yaw: OESTE });
}

describe('frasco em arco', () => {
  it('sobe e cai no ponto mirado; o jogador que saiu do respingo não é ferido', () => {
    const w = mundo();
    enfermeiro(w, [5, 1]);   // 8 m a leste do jogador
    const mira = { ...w.jogador.pos };
    ate(w, 'projetil');
    const p = w.projeteis[0];
    expect(p.vy).toBeGreaterThan(0);   // sobe (parábola), não reto ao peito
    w.jogador.pos = centro([1, 3]);    // 4 m ao sul do ponto mirado
    let alturaMax = 0;
    const ev = ate(w, 'frasco_quebra', 3, () => {
      if (w.projeteis[0]) alturaMax = Math.max(alturaMax, w.projeteis[0].y);
    });
    const q = quebra(ev);
    expect(Math.hypot(q.pos.x - mira.x, q.pos.z - mira.z)).toBeLessThan(0.4);
    expect(q.y).toBeLessThan(0.3);
    expect(alturaMax).toBeGreaterThan(1.5);
    expect(w.jogador.vida).toBe(100);
    expect(ev.filter((e) => e.tipo === 'dano_jogador')).toEqual([]);
  });

  it('o jogador a até `respingo` leva o dano uma vez, pelo colete', () => {
    const w = mundo();
    enfermeiro(w, [5, 1]);
    ate(w, 'projetil');
    w.jogador.colete = 30;
    const ev = ate(w, 'frasco_quebra', 3);
    quebra(ev);
    const danos = ev.filter((e) => e.tipo === 'dano_jogador');
    expect(danos).toHaveLength(1);
    // 16: o colete segura 2/3 (10,67) e a vida perde o resto
    expect(w.jogador.vida).toBeCloseTo(100 - 16 / 3, 4);
    expect(w.projeteis).toEqual([]);
  });

  it('respingo na borda: exatamente a 1,6 m fere, logo fora não', () => {
    for (const [d, fere] of [[1.6, true], [1.61, false]] as const) {
      const w = mundo();
      const e = enfermeiro(w, [8, 2]);
      const pos = { x: w.jogador.pos.x + d, z: w.jogador.pos.z };
      const p = { id: 99, de: 'inimigo' as const, tipo: e.tipo, pos, y: 0, vel: { x: 9, z: 0 }, vy: 0, dano: 16, vida: 1 };
      const ev = quebrarFrasco(w, p, { gravidade: 12, respingo: 1.6 });
      expect([d, ev.some((x) => x.tipo === 'dano_jogador')]).toEqual([d, fere]);
      expect(w.jogador.vida).toBe(fere ? 84 : 100);
    }
  });

  it('não fere inimigos no respingo', () => {
    const w = mundo();
    enfermeiro(w, [5, 1]);
    ate(w, 'projetil');
    const alvo = porInimigo(w, 'reforcado_teste', [1, 1]);
    w.jogador.pos = centro([1, 3]);
    const ev = ate(w, 'frasco_quebra', 3);
    quebra(ev);
    expect(alvo.vida).toBe(400);
  });

  it('alvo além do alcance do arco (14 m): cai no máximo do arco, na direção mirada', () => {
    // pé-direito alto para a parábola longa não tocar o teto
    const ALTO = `
      ######################
      #Poooooooooooooooooooo#
      ######################
    `;
    const w = mundo(ALTO, { o: { teto: 12 } });
    const e = enfermeiro(w, [7, 1]);   // 12 m
    let afastou = false;
    const ev = ate(w, 'projetil', 5, (passo) => {
      if (!afastou && passo.some((x) => x.tipo === 'inimigo_ataque')) {
        afastou = true;
        w.jogador.pos = { x: e.pos.x + 20, z: e.pos.z };   // passa para 20 m do outro lado durante o preparo
      }
    });
    expect(afastou).toBe(true);
    expect(ev.some((x) => x.tipo === 'projetil')).toBe(true);
    const origem = { ...e.pos };   // depois do disparo ele volta a andar
    const q = quebra(ate(w, 'frasco_quebra', 4));
    expect(q.pos.x - origem.x).toBeCloseTo(14, 0);
    expect(q.pos.z).toBeCloseTo(origem.z, 1);
  });
});
