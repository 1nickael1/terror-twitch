// Recorte por oclusão da grade (inimigos atrás de parede não são desenhados).
import { describe, expect, it } from 'vitest';
import { aVista, PERTO_SEMPRE } from '../../src/engine/view/oclusao';
import { centro, criarGrid, visivel } from '../../src/sim/grid';

describe('aVista', () => {
  const g = criarGrid([
    '##########',
    '#P.......#',
    '#####.####',
    '#........#',
    '##########',
  ].join('\n'));
  const olho = centro([1, 1]);

  it('linha de visão livre: desenha', () => {
    expect(aVista(g, olho, centro([8, 1]), 0.35)).toBe(true);
  });

  it('atrás da parede e longe: não desenha', () => {
    expect(aVista(g, olho, centro([8, 3]), 0.35)).toBe(false);
  });

  it(`a até ${PERTO_SEMPRE} m: desenha mesmo sem linha de visão`, () => {
    expect(aVista(g, olho, { x: olho.x + 1, z: olho.z + 3 }, 0.35)).toBe(true);
  });

  it('só o ombro aparecendo na quina já conta', () => {
    // o centro fica escondido pela quina do vão (5,2); a lateral passa por ele
    const olho2 = centro([5, 1]);
    const alvo = { x: 9, z: 7 };
    expect(visivel(g, olho2, alvo)).toBe(false);
    expect(aVista(g, olho2, alvo, 0.35)).toBe(true);
  });

  it('porta fechada (sólido) bloqueia como parede', () => {
    const solido = (col: number, row: number) => col === 5 && row === 2;
    expect(aVista(g, centro([5, 1]), centro([5, 3]), 0.35, solido)).toBe(true);   // perto
    expect(aVista(g, centro([1, 1]), centro([7, 3]), 0.35, solido)).toBe(false);
  });
});
