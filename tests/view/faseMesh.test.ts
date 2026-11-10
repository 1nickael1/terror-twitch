// Faces das células de janela (faseMesh): desnível entre a janela e as vizinhas sem buraco.
import { describe, expect, it } from 'vitest';
import { facesJanela, MURETA, TOPO_VIDRO } from '../../src/engine/view/faseMesh';
import { criarGrid } from '../../src/sim/grid';

describe('facesJanela', () => {
  // cabine a 1,5 m (P), janela com o piso da cabine (|), arena a 0 m com teto 7 (~)
  const g = criarGrid('#####\n#P|~#\n#####', {
    P: { piso: 1.5, teto: 4.5 },
    '|': { tipo: 'janela', piso: 1.5, teto: 4.5 },
    '~': { teto: 7 },
  });
  const faces = facesJanela(g, 2, 1);
  const baixo = 1.5 + MURETA;
  const alto = 1.5 + TOPO_VIDRO;

  it('lado da arena (mais baixa): parede do chão da arena até o peitoril e do topo do vidro ao teto', () => {
    const leste = faces.filter((f) => f.dc === 1);
    expect(leste).toEqual([
      { dc: 1, dr: 0, tipo: 'mureta', paraFora: true, de: [0, 0], ate: [baixo, baixo] },
      { dc: 1, dr: 0, tipo: 'verga', paraFora: true, de: [alto, alto], ate: [7, 7] },
    ]);
  });

  it('lado da cabine (mesmo piso): mureta de 1 m e verga até o teto da cabine', () => {
    const oeste = faces.filter((f) => f.dc === -1);
    expect(oeste).toEqual([
      { dc: -1, dr: 0, tipo: 'mureta', paraFora: true, de: [1.5, 1.5], ate: [baixo, baixo] },
      { dc: -1, dr: 0, tipo: 'verga', paraFora: true, de: [alto, alto], ate: [4.5, 4.5] },
    ]);
  });

  it('paredes laterais: ombreira do vão, olhando para dentro', () => {
    const lados = faces.filter((f) => f.dc === 0);
    expect(lados).toHaveLength(2);
    for (const f of lados) expect(f).toMatchObject({ tipo: 'ombreira', paraFora: false, de: [baixo, baixo], ate: [alto, alto] });
  });

  it('janela larga: nenhuma face entre duas células de janela', () => {
    const g2 = criarGrid('######\n#P==.#\n######', { '=': { tipo: 'janela' } });
    expect(facesJanela(g2, 2, 1).some((f) => f.dc === 1)).toBe(false);
    expect(facesJanela(g2, 3, 1).some((f) => f.dc === -1)).toBe(false);
  });
});
