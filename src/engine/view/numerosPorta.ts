import { BoxGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Algarismos industriais em geometria fina: legíveis sem esticar a textura de um cartão. */
export function geometriaNumeroPorta(nivel: number): BufferGeometry {
  const segmentos: Record<number, number[]> = { 1: [1, 2], 2: [0, 1, 6, 4, 3], 3: [0, 1, 6, 2, 3] };
  const centros = [[0, .30], [.18, .15], [.18, -.15], [0, -.30], [-.18, -.15], [-.18, .15], [0, 0]];
  const partes = (segmentos[nivel] ?? []).map(i => {
    const horizontal = i === 0 || i === 3 || i === 6;
    const g = new BoxGeometry(horizontal ? .36 : .055, horizontal ? .055 : .30, .003);
    return g.translate(centros[i][0] - (nivel === 1 ? .18 : 0), centros[i][1], 0);
  });
  const geo = mergeGeometries(partes, false);
  for (const p of partes) p.dispose();
  if (!geo) throw new Error(`Nível de acesso inválido: ${nivel}`);
  return geo;
}
