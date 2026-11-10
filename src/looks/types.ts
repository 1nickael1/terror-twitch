import type { MaterialKind } from '../engine/materials';

/**
 * Névoa de referência: a densidade declarada por um estilo vale para uma fase com
 * `ambiente.nevoa` igual a este número. A engine escala proporcionalmente para as outras fases.
 */
export const NEVOA_REFERENCIA = 0.06;

/**
 * O que um filtro muda na cena. É só declaração: a engine combina com o `AmbienteDef` da fase,
 * as `LuzDef` e o estado da simulação (lanterna ligada, alarme, grupos de luz).
 */
export interface AjusteCena {
  /** névoa exponencial; `cor: null` usa a `corNevoa` da fase. O fundo segue a cor da névoa. */
  nevoa: { cor: number | null; densidade: number };
  material: MaterialKind;
  /** texturas sem filtragem (pixels duros) */
  texturasNearest: boolean;
  /** multiplica `fase.ambiente.ambiente` */
  ambiente: number;
  /** cor da luz ambiente (padrão: cinza azulado); Disquete (sépia) e Lanterna (azul frio) usam a sua */
  corAmbiente?: number;
  /** multiplica a intensidade de cada `LuzDef` e do alarme */
  luzes: number;
  /** multiplica a intensidade base da lanterna do jogador (o cone é fixo, da engine) */
  lanterna: number;
  /** multiplica o brilho dos materiais emissivos (telas, luminárias, indicadores) */
  emissivo: number;
  /** intensidade do iluminador infravermelho preso à câmera (0 = desligado) */
  infravermelho: number;
}

export interface VisualStyle {
  id: string;
  nome: string;
  frase: string;
  /** altura interna de render; largura segue o aspecto. null = resolução nativa */
  alturaInterna: number | null;
  /** como o render target é ampliado para a tela */
  ampliacao: 'nearest' | 'linear';
  cena: AjusteCena;
  /** corpo do fragment shader; COMMON é prefixado automaticamente */
  fragmentShader: string;
}
