import { describe, expect, it } from 'vitest';
import { impactoEmPortaOuJanela } from '../../src/engine/view/marcasTiro';
import { criarWorld } from '../../src/sim/world';
import { faseMinima } from '../sim/ajuda';

// colunas: 0 '#', 1 'P', 2 '.', 3 'D' (porta), 4 '.', 5 'J' (janela), 6 '.', 7 '#'
const PLANTA = '########\n#P.D.J.#\n########';
const mundo = () => criarWorld(faseMinima(PLANTA, {
  legenda: { J: { tipo: 'janela' } },
  portas: [{ id: 'd1', em: 'D' }],
}));

describe('impactoEmPortaOuJanela', () => {
  it('impacto na borda da célula da porta, atirando para ela: sem marca', () => {
    const w = mundo();
    expect(impactoEmPortaOuJanela(w, { x: 3, z: 3 }, 6, 3)).toBe(true);
  });
  it('vale com a porta em qualquer estado (aberta também)', () => {
    const w = mundo();
    w.portas[0].estado = 'aberta';
    expect(impactoEmPortaOuJanela(w, { x: 3, z: 3 }, 6, 3)).toBe(true);
  });
  it('janela também', () => {
    const w = mundo();
    expect(impactoEmPortaOuJanela(w, { x: 9, z: 3 }, 10, 3)).toBe(true);
  });
  it('parede comum: marca normal', () => {
    const w = mundo();
    expect(impactoEmPortaOuJanela(w, { x: 13, z: 3 }, 14, 3)).toBe(false);
    expect(impactoEmPortaOuJanela(w, { x: 3, z: 3 }, 3, 2)).toBe(false);
  });
  it('o lado conta: de costas para a porta, a parede atrás recebe a marca', () => {
    const w = mundo();
    expect(impactoEmPortaOuJanela(w, { x: 7, z: 3 }, 2, 3)).toBe(false);
  });
});
