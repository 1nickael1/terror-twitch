// Catálogo de nomes que as fases podem citar (sons, música, props). Só dados; o validador confere.
import type { TipoProp } from './fase';

/** Laços de fundo (`ambiente.somDeFundo`). */
export const SONS_DE_FUNDO: readonly string[] = ['zumbido', 'ventilacao'];
/** Músicas (`ambiente.musica`). */
export const MUSICAS: readonly string[] = ['tensao'];
/** Ids válidos para a ação `som` dos gatilhos. */
export const SONS_DE_EVENTO: readonly string[] = ['bip', 'sirene_curta', 'estalo'];
/** Tipos de prop (`PropDef.tipo`). */
export const TIPOS_PROP: readonly TipoProp[] = ['mesa', 'cadeira', 'armario', 'caixa', 'maca', 'cama', 'placa', 'lixeira'];
