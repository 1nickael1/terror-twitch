// Catálogo de nomes que as fases podem citar (sons, música, props). Só dados; o validador confere.
import type { Revestimento, TipoProp } from './fase';

/** Laços de fundo (`ambiente.somDeFundo`). */
export const SONS_DE_FUNDO: readonly string[] = ['zumbido', 'ventilacao', 'hospital'];
/** Músicas (`ambiente.musica`). */
export const MUSICAS: readonly string[] = ['tensao'];
/** Ids válidos para a ação `som` dos gatilhos. */
export const SONS_DE_EVENTO: readonly string[] = ['bip', 'sirene_curta', 'estalo', 'gaveta', 'elevador'];
/** Tipos de prop (`PropDef.tipo`). */
export const TIPOS_PROP: readonly TipoProp[] = [
  'mesa', 'cadeira', 'armario', 'caixa', 'maca', 'cama', 'placa', 'lixeira',
  'gavetas', 'cortina', 'autoclave', 'carrinho', 'lampada_uv',
];
/** Revestimentos de parede (`ambiente.revestimento`; C3.5, correção 1). */
export const REVESTIMENTOS: readonly Revestimento[] = ['escritorio', 'azulejo'];
