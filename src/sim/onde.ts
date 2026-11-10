// Resolve onde algo da fase fica: coordenada direta ou símbolo único da planta. Lógica pura.
import type { Onde } from './fase';
import type { Coord, Grid } from './grid';

/** Coordenada passa direto; símbolo precisa aparecer exatamente uma vez na planta. */
export function resolverOnde(g: Grid, em: Onde): Coord {
  if (typeof em !== 'string') return em;
  const lista = g.marcas.get(em) ?? [];
  if (lista.length !== 1) throw new Error(`Símbolo "${em}" não aparece exatamente uma vez na planta`);
  return lista[0];
}
