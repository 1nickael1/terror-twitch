// Terminais (console com tela emissiva) e documentos (prancheta clara), estáticos, no coletor.
import { BoxGeometry, Matrix4, PlaneGeometry, type BufferGeometry } from 'three';
import { celula, centro, CELL, type Coord, type Grid } from '../../sim/grid';
import { resolverOnde } from '../../sim/onde';
import type { LevelDef } from '../../sim/fase';
import { DIRECOES } from './faseMesh';
import type { Coletor } from './geometria';

/** Primeira vizinha andável (para onde o objeto olha) ou null. */
function frenteAndavel(g: Grid, c: Coord): { dc: number; dr: number } | null {
  return DIRECOES.find((d) => celula(g, c[0] + d.dc, c[1] + d.dr).tipo === 'piso') ?? null;
}

/**
 * Posiciona peças modeladas olhando para +z: na própria célula (andável) ou presas à face da
 * parede que dá para a vizinha andável. Devolve a matriz e a altura do piso de referência.
 */
export function colocacao(g: Grid, c: Coord): { m: Matrix4; piso: number; naParede: boolean } {
  const cel = celula(g, c[0], c[1]);
  const d = frenteAndavel(g, c) ?? { dc: 0, dr: 1 };
  const yaw = Math.atan2(d.dc, d.dr);
  const { x, z } = centro(c);
  if (cel.tipo === 'piso') {
    return { m: new Matrix4().makeRotationY(yaw).setPosition(x, cel.piso, z), piso: cel.piso, naParede: false };
  }
  const viz = celula(g, c[0] + d.dc, c[1] + d.dr);
  const bx = x + d.dc * (CELL / 2);
  const bz = z + d.dr * (CELL / 2);
  return { m: new Matrix4().makeRotationY(yaw).setPosition(bx, viz.piso, bz), piso: viz.piso, naParede: true };
}

function peca(g: BufferGeometry, x: number, y: number, z: number, m: Matrix4, rotX = 0): BufferGeometry {
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  return g.applyMatrix4(m);
}

export function construirObjetos(fase: LevelDef, g: Grid, co: Coletor): void {
  for (const t of fase.terminais) {
    const { m, naParede } = colocacao(g, resolverOnde(g, t.em));
    if (naParede) {
      // painel de parede: caixa saltada 12 cm, tela inclinada levemente para baixo
      co.add('metal', peca(new BoxGeometry(0.9, 0.75, 0.12), 0, 1.35, 0.06, m));
      co.add('tela', peca(new PlaneGeometry(0.7, 0.45), 0, 1.4, 0.125, m));
      co.add('metal', peca(new BoxGeometry(0.7, 0.05, 0.25), 0, 1.0, 0.12, m));
    } else {
      // console de pé no meio da célula
      co.add('metal', peca(new BoxGeometry(0.9, 1.0, 0.5), 0, 0.5, 0, m));
      co.add('metal', peca(new BoxGeometry(0.9, 0.55, 0.12), 0, 1.25, -0.15, m, -0.25));
      co.add('tela', peca(new PlaneGeometry(0.72, 0.42), 0, 1.25, -0.08, m, -0.25));
    }
  }
  for (const d of fase.documentos) {
    const { m, naParede } = colocacao(g, resolverOnde(g, d.em));
    if (naParede) {
      co.add('papel', peca(new BoxGeometry(0.32, 0.42, 0.015), 0, 1.4, 0.01, m));
    } else {
      // pedestal baixo com a prancheta em cima
      co.add('metal', peca(new BoxGeometry(0.45, 0.85, 0.45), 0, 0.425, 0, m));
      co.add('metal', peca(new BoxGeometry(0.34, 0.02, 0.44), 0, 0.86, 0, m));
      co.add('papel', peca(new BoxGeometry(0.28, 0.012, 0.38), 0, 0.875, 0, m));
    }
  }
}
