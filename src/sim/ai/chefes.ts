// Registro das IAs de chefe por tipo: criação do estado, passo, despertar e retomada. `world.ts`,
// `triggers.ts` e `avancarInimigos` passam por aqui, nunca pela IA de um chefe direto. Lógica pura.
import type { SimEvent } from '../eventos';
import type { EstadoChefe, Inimigo, World } from '../world';
import { IA_049 } from './chefe049';
import { IA_096 } from './chefe096';

/** O que cada IA de chefe oferece ao resto da simulação. */
export interface IaDeChefe {
  /** Um passo da IA do chefe (o `Inimigo` dele e o `w.chefe`). */
  avancar(w: World, i: Inimigo, dt: number): SimEvent[];
  /** Estado inicial, inerte, apontando para o `Inimigo` do chefe. */
  criarEstado(inimigoId: number): EstadoChefe;
  /** Restauro de checkpoint com o chefe acordado (nem inerte nem morto): volta na `retomada`. */
  retomar(w: World): void;
  /** Ação `chefe` (e dano enquanto inerte): acorda o chefe inerte; acordado ou sem chefe, []. */
  despertar(w: World): SimEvent[];
}

/**
 * IA de chefe do tipo, ou `null` se o tipo não é de chefe. Resolvida na chamada (e não numa tabela
 * montada ao carregar o módulo) porque `chefe096`/`chefe049` e `comum` se importam em ciclo.
 */
export function iaDeChefe(tipo: string): IaDeChefe | null {
  switch (tipo) {
    case 'entidade096':
      return IA_096;
    case 'entidade049':
      return IA_049;
    default:
      return null;
  }
}
