import { BoxGeometry } from 'three';
import { celula, CELL, type Grid } from '../../sim/grid';
import type { Coletor } from './geometria';

/** Rodapés e canaletas acompanhando paredes sólidas; união por material no coletor da fase. */
export function construirAcabamento(g: Grid, co: Coletor): void {
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      const c = celula(g, col, row);
      if (c.tipo !== 'piso' || c.rampa) continue;
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        if (celula(g, col + dx, row + dz).tipo !== 'parede') continue;
        const x = (col + .5) * CELL + dx * (CELL / 2 - .025);
        const z = (row + .5) * CELL + dz * (CELL / 2 - .025);
        const w = dx ? .05 : CELL, d = dz ? .05 : CELL;
        co.add('grade', new BoxGeometry(w, .14, d).translate(x, c.piso + .07, z));
        co.add('grade', new BoxGeometry(w, .055, d).translate(x, c.teto - .24, z));
      }
    }
  }
}
