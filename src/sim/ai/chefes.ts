// Registro das IAs de chefe por tipo: `avancarInimigos` despacha o inimigo do chefe para cá. Lógica pura.
import type { SimEvent } from '../eventos';
import type { Inimigo, World } from '../world';
import { avancarChefe096 } from './chefe096';

/** Um passo da IA do chefe (o `Inimigo` dele e o `w.chefe`). */
export type AvancarChefe = (w: World, i: Inimigo, dt: number) => SimEvent[];

/**
 * IA de chefe do tipo, ou `null` se o tipo não é de chefe. Resolvida na chamada (e não numa tabela
 * montada ao carregar o módulo) porque `chefe096` e `comum` se importam em ciclo.
 */
export function avancadorDeChefe(tipo: string): AvancarChefe | null {
  switch (tipo) {
    case 'entidade096':
      return avancarChefe096;
    default:
      return null;
  }
}
