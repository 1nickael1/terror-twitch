// Fase 2: luzes (fluorescente esverdeada da ala, branco cirúrgico no anfiteatro), props (com placas de
// sinalização inventadas) e decalques. Só dados.
import type { Area, DecalDef, LuzDef, PropDef } from '../../sim/fase';
import { celulasDe } from '../alcance';

const VERDE = 0xbfe8c8;        // fluorescente esverdeada da ala
const VERDE_FRACA = 0x8fbf9c;
const LAB = 0xd2f5e4;          // laboratório, mais fria e branca
const NECRO = 0x9ccfc0;        // necrotério, azul-esverdeada e baixa
const CIRURGICA = 0xeef8f2;    // focos do anfiteatro
const FOCO = 0xfff0d6;         // foco central, branco-quente
/** alturas (m, absolutas) das luzes do anfiteatro: acima da cabeça do chefe (2 m) e perto do que iluminam */
const ALTURA_FOCO = 3.6;
const ALTURA_PISO_CENTRAL = 3.4;
const ALTURA_GALERIA = 4.4;
const ELEVADOR = 0xffe7b0;
const ALARME = 0xff2a1a;

const NORTE = 0;               // frente = (0, -1)
const SUL = Math.PI;           // frente = (0, +1)
const ATRAVESSADA = Math.PI / 2;   // cortina ao longo de z (divide leitos vizinhos)

export const LUZES: LuzDef[] = [
  // triagem
  { em: [5, 3], cor: VERDE, intensidade: 1.0 },
  { em: [12, 3], cor: VERDE, intensidade: 0.9 },
  { em: [5, 8], cor: VERDE_FRACA, intensidade: 0.7, pisca: 0.4 },
  { em: [13, 8], cor: VERDE, intensidade: 0.8 },
  // posto de enfermagem e corredor
  { em: [21, 4], cor: VERDE, intensidade: 0.9 },
  { em: [20, 7], cor: VERDE_FRACA, intensidade: 0.6 },
  { em: [21, 11], cor: VERDE_FRACA, intensidade: 0.5, pisca: 0.5 },
  // enfermaria (corredor central claro, leitos na penumbra)
  { em: [5, 17], cor: VERDE, intensidade: 0.8 },
  { em: [11, 18], cor: VERDE, intensidade: 0.7, pisca: 0.6 },
  { em: [17, 17], cor: VERDE, intensidade: 0.8 },
  { em: [23, 18], cor: VERDE, intensidade: 0.7 },
  { em: [28, 17], cor: VERDE_FRACA, intensidade: 0.5, pisca: 0.3 },
  { em: [6, 15], cor: VERDE_FRACA, intensidade: 0.4 },
  { em: [14, 20], cor: VERDE_FRACA, intensidade: 0.4 },
  { em: [22, 15], cor: VERDE_FRACA, intensidade: 0.4, pisca: 0.7 },
  { em: [27, 11], cor: VERDE_FRACA, intensidade: 0.35 },
  { em: [4, 24], cor: VERDE, intensidade: 0.7 },
  // corredor de observação e depósito escondido
  { em: [33, 5], cor: VERDE_FRACA, intensidade: 0.5 },
  { em: [34, 14], cor: VERDE_FRACA, intensidade: 0.6, pisca: 0.5 },
  { em: [29, 3], cor: VERDE_FRACA, intensidade: 0.3 },
  // laboratório de patologia e sala limpa
  { em: [39, 4], cor: LAB, intensidade: 1.1 },
  { em: [44, 9], cor: LAB, intensidade: 1.1 },
  { em: [50, 9], cor: LAB, intensidade: 1.0 },
  { em: [38, 10], cor: LAB, intensidade: 0.9, pisca: 0.3 },
  { em: [49, 3], cor: 0xc8ffe8, intensidade: 0.9 },
  // antecâmara e necrotério
  { em: [48, 15], cor: VERDE, intensidade: 0.7 },
  { em: [44, 20], cor: NECRO, intensidade: 0.8 },
  { em: [52, 20], cor: NECRO, intensidade: 0.8 },
  { em: [48, 23], cor: NECRO, intensidade: 0.9, pisca: 0.4 },
  { em: [44, 24], cor: NECRO, intensidade: 0.6 },
  // elevador e corredor de serviço
  { em: [48, 27], cor: ELEVADOR, intensidade: 0.7 },
  { em: [43, 28], cor: VERDE_FRACA, intensidade: 0.5, pisca: 0.6 },
  { em: [37, 28], cor: VERDE_FRACA, intensidade: 0.6 },
  { em: [31, 28], cor: VERDE_FRACA, intensidade: 0.5 },
  // anfiteatro cirúrgico (teto de 7 m: as luzes descem até `ALTURA_*` para chegar ao chão — alcance de 9 m na
  // engine). Foco branco-quente forte sobre a mesa: a silhueta escura do visitante se lê da galeria.
  { em: [37, 37], cor: FOCO, intensidade: 4.5, altura: ALTURA_FOCO },
  { em: [31, 37], cor: CIRURGICA, intensidade: 1.4, altura: ALTURA_PISO_CENTRAL },
  { em: [42, 38], cor: CIRURGICA, intensidade: 1.4, altura: ALTURA_PISO_CENTRAL },
  { em: [37, 32], cor: VERDE, intensidade: 1.0, altura: ALTURA_GALERIA },
  { em: [36, 43], cor: VERDE, intensidade: 1.0, altura: ALTURA_GALERIA },
  { em: [29, 31], cor: VERDE_FRACA, intensidade: 0.8, altura: ALTURA_GALERIA },
  { em: [45, 44], cor: VERDE_FRACA, intensidade: 0.7, altura: ALTURA_GALERIA },
  { em: [48, 42], cor: VERDE_FRACA, intensidade: 0.6 },
  // alarme do anfiteatro (seguem `world.alarme`)
  { em: [33, 31], cor: ALARME, intensidade: 1.2, grupo: 'alarme' },
  { em: [41, 44], cor: ALARME, intensidade: 1.2, grupo: 'alarme' },
  { em: [28, 39], cor: ALARME, intensidade: 1.0, grupo: 'alarme' },
  { em: [45, 36], cor: ALARME, intensidade: 1.0, grupo: 'alarme' },
];

/** Sinalização inventada para a ala (nada de logos ou nomes de outras obras). */
const PLACAS: PropDef[] = [
  // triagem e posto
  { em: [8, 1], tipo: 'placa', parede: 'n', texto: 'ALA MÉDICA M-1 · TRIAGEM' },
  { em: [1, 8], tipo: 'placa', parede: 'o', texto: 'AGUARDE A CLASSIFICAÇÃO DE RISCO' },
  { em: [16, 4], tipo: 'placa', parede: 'l', texto: 'POSTO DE ENFERMAGEM →' },
  { em: [18, 2], tipo: 'placa', parede: 'n', texto: 'POSTO M-1 · SOMENTE EQUIPE' },
  { em: [22, 8], tipo: 'placa', parede: 's', texto: 'ENFERMARIA GERAL ↓' },
  // enfermaria
  { em: [20, 14], tipo: 'placa', parede: 'n', texto: 'ENFERMARIA GERAL · LEITOS 1–16' },
  { em: [3, 21], tipo: 'placa', parede: 's', texto: 'PRESCRIÇÃO' },
  { em: [29, 16], tipo: 'placa', parede: 'l', texto: 'PATOLOGIA · NÍVEL 1' },
  // corredor de observação e laboratório
  { em: [33, 9], tipo: 'placa', parede: 'o', texto: 'OBSERVAÇÃO · NÃO BATA NO VIDRO' },
  { em: [34, 13], tipo: 'placa', parede: 'l', texto: 'LABORATÓRIO DE PATOLOGIA' },
  { em: [40, 12], tipo: 'placa', parede: 's', texto: 'AMOSTRAS ATIVAS · NÃO ABRIR' },
  { em: [46, 7], tipo: 'placa', parede: 'n', texto: 'SALA LIMPA · TRAJE OBRIGATÓRIO' },
  { em: [47, 12], tipo: 'placa', parede: 's', texto: 'NECROTÉRIO · NÍVEL 2' },
  // antecâmara, necrotério, elevador e corredor de serviço
  { em: [46, 14], tipo: 'placa', parede: 'o', texto: 'NECROTÉRIO' },
  { em: [50, 16], tipo: 'placa', parede: 'l', texto: 'ELEVADOR DE MACAS → ANFITEATRO' },
  { em: [43, 18], tipo: 'placa', parede: 'n', texto: 'CÂMARA FRIA · GAVETAS 1–18' },
  { em: [47, 25], tipo: 'placa', parede: 's', texto: 'ELEVADOR DE MACAS' },
  { em: [40, 28], tipo: 'placa', parede: 's', texto: 'OBSERVAÇÃO · ACESSO NÍVEL 3' },
  // anfiteatro: cada terminal tem placa ao lado com o nome do perigo e onde ele age
  { em: [29, 31], tipo: 'placa', parede: 'n', texto: 'ANFITEATRO CIRÚRGICO 2' },
  { em: [27, 36], tipo: 'placa', parede: 'o', texto: 'UV OESTE · LUZ NO PISO À FRENTE' },
  { em: [46, 37], tipo: 'placa', parede: 'l', texto: 'UV LESTE · LUZ NO PISO À FRENTE' },
  { em: [35, 31], tipo: 'placa', parede: 'n', texto: 'VAPOR NORTE · DEGRAU ABAIXO' },
  { em: [38, 44], tipo: 'placa', parede: 's', texto: 'VAPOR SUL · DEGRAU ACIMA' },
  { em: [46, 43], tipo: 'placa', parede: 'l', texto: 'SAÍDA DE EMERGÊNCIA' },
];

/** Leitos da enfermaria: macas encostadas nas paredes norte e sul, cortinas entre elas e na beira do corredor. */
const LEITOS_COLUNAS = [3, 6, 9, 12, 15, 18, 24, 27];
const ENFERMARIA: PropDef[] = [
  ...LEITOS_COLUNAS.map((col): PropDef => ({ em: [col, 14], tipo: 'maca', parede: 'n' })),
  ...LEITOS_COLUNAS.map((col): PropDef => ({ em: [col, 21], tipo: 'maca', parede: 's' })),
  ...[4, 10, 16, 25].map((col): PropDef => ({ em: [col, 16], tipo: 'cortina', yaw: NORTE })),
  ...[7, 13, 19, 26].map((col): PropDef => ({ em: [col, 19], tipo: 'cortina', yaw: NORTE })),
  ...[8, 14, 20].map((col): PropDef => ({ em: [col, 15], tipo: 'cortina', yaw: ATRAVESSADA })),
  ...[11, 17, 23].map((col): PropDef => ({ em: [col, 20], tipo: 'cortina', yaw: ATRAVESSADA })),
  { em: [2, 17], tipo: 'carrinho', parede: 'o' },
  { em: [29, 18], tipo: 'carrinho', parede: 'l' },
  { em: [21, 21], tipo: 'lixeira', parede: 's' },
];

/** Móveis encostados nas paredes, fora das rotas (não têm colisão). */
const MOVEIS: PropDef[] = [
  // triagem
  { em: [13, 1], tipo: 'mesa', parede: 'n' },
  { em: [14, 1], tipo: 'mesa', parede: 'n' },
  { em: [15, 1], tipo: 'mesa', parede: 'n' },
  { em: [14, 2], tipo: 'cadeira', yaw: NORTE },
  { em: [1, 3], tipo: 'cadeira', parede: 'o' },
  { em: [1, 4], tipo: 'cadeira', parede: 'o' },
  { em: [1, 5], tipo: 'cadeira', parede: 'o' },
  { em: [7, 9], tipo: 'maca', parede: 's' },
  { em: [10, 9], tipo: 'carrinho', parede: 's' },
  { em: [16, 9], tipo: 'maca', parede: 's' },
  { em: [16, 1], tipo: 'lixeira', parede: 'l' },
  // posto de enfermagem
  { em: [24, 3], tipo: 'mesa', parede: 'l' },
  { em: [24, 4], tipo: 'mesa', parede: 'l' },
  { em: [23, 4], tipo: 'cadeira', yaw: -Math.PI / 2 },
  { em: [18, 5], tipo: 'armario', parede: 'o' },
  { em: [18, 6], tipo: 'armario', parede: 'o' },
  { em: [23, 8], tipo: 'carrinho', parede: 's' },
  // rouparia e prescrição
  { em: [26, 10], tipo: 'armario', parede: 'n' },
  { em: [29, 10], tipo: 'caixa', parede: 'n' },
  { em: [26, 12], tipo: 'caixa', parede: 'o' },
  { em: [2, 25], tipo: 'mesa', parede: 'o' },
  { em: [3, 25], tipo: 'cadeira', yaw: Math.PI / 2 },
  { em: [7, 23], tipo: 'armario', parede: 'l' },
  { em: [7, 24], tipo: 'armario', parede: 'l' },
  // corredor de observação e depósito escondido
  { em: [33, 15], tipo: 'carrinho', parede: 'o' },
  { em: [28, 2], tipo: 'caixa', parede: 'n' },
  { em: [28, 4], tipo: 'caixa', parede: 'o' },
  { em: [31, 4], tipo: 'caixa', parede: 's' },
  // laboratório
  { em: [37, 2], tipo: 'mesa', parede: 'n' },
  { em: [38, 2], tipo: 'mesa', parede: 'n' },
  { em: [41, 2], tipo: 'mesa', parede: 'n' },
  { em: [42, 2], tipo: 'mesa', parede: 'n' },
  { em: [40, 8], tipo: 'mesa', yaw: NORTE },
  { em: [41, 8], tipo: 'mesa', yaw: NORTE },
  { em: [43, 5], tipo: 'carrinho', yaw: NORTE },
  { em: [44, 11], tipo: 'carrinho', parede: 's' },
  { em: [52, 8], tipo: 'autoclave', parede: 'l' },
  { em: [52, 10], tipo: 'autoclave', parede: 'l' },
  { em: [44, 12], tipo: 'lampada_uv', parede: 's' },
  { em: [36, 11], tipo: 'armario', parede: 'o' },
  // sala limpa
  { em: [46, 2], tipo: 'autoclave', parede: 'n' },
  { em: [50, 2], tipo: 'mesa', parede: 'n' },
  { em: [51, 2], tipo: 'mesa', parede: 'n' },
  { em: [52, 4], tipo: 'lampada_uv', parede: 'l' },
  // antecâmara
  { em: [50, 14], tipo: 'mesa', parede: 'n' },
  { em: [46, 16], tipo: 'carrinho', parede: 'o' },
  // necrotério: paredes de gavetas, mesas de autópsia no meio
  { em: [42, 21], tipo: 'gavetas', parede: 'o' },
  { em: [42, 23], tipo: 'gavetas', parede: 'o' },
  { em: [42, 25], tipo: 'gavetas', parede: 'o' },
  { em: [54, 21], tipo: 'gavetas', parede: 'l' },
  { em: [54, 23], tipo: 'gavetas', parede: 'l' },
  { em: [54, 25], tipo: 'gavetas', parede: 'l' },
  { em: [45, 21], tipo: 'maca', yaw: NORTE },
  { em: [51, 21], tipo: 'maca', yaw: NORTE },
  { em: [46, 19], tipo: 'carrinho', yaw: NORTE },
  { em: [49, 18], tipo: 'lampada_uv', parede: 'n' },
  { em: [50, 25], tipo: 'lixeira', parede: 's' },
  // anfiteatro: mesa de cirurgia no centro, carrinhos e cadeiras da galeria
  { em: [37, 36], tipo: 'maca', yaw: NORTE },
  { em: [35, 36], tipo: 'carrinho', yaw: Math.PI / 2 },
  { em: [39, 38], tipo: 'carrinho', yaw: -Math.PI / 2 },
  ...[31, 33, 41, 43].map((col): PropDef => ({ em: [col, 31], tipo: 'cadeira', yaw: SUL })),
  ...[31, 33, 41, 43].map((col): PropDef => ({ em: [col, 44], tipo: 'cadeira', yaw: NORTE })),
];

export const PROPS: PropDef[] = [...PLACAS, ...ENFERMARIA, ...MOVEIS];

/**
 * Faixas de perigo no chão: a borda de cada área UV voltada para o terminal (a linha que o chefe cruza
 * antes de ficar sob a luz) e toda a linha de vapor. Áreas em `index.ts`.
 */
export function faixasDosPerigos(bordasUV: readonly Area[], linhasVapor: readonly Area[]): DecalDef[] {
  return [...bordasUV, ...linhasVapor].flatMap((a) => celulasDe(a).map((em): DecalDef => ({ em, tipo: 'faixa' })));
}

export const DECALS_SOLTOS: DecalDef[] = [
  // triagem e posto
  { em: [6, 5], tipo: 'sangue' },
  { em: [9, 7], tipo: 'sangue' },
  { em: [12, 1], tipo: 'marca', parede: 'n' },
  { em: [18, 5], tipo: 'sangue' },
  // enfermaria
  { em: [8, 15], tipo: 'sangue' },
  { em: [16, 20], tipo: 'sangue' },
  { em: [23, 15], tipo: 'sangue' },
  { em: [2, 19], tipo: 'marca', parede: 'o' },
  { em: [26, 21], tipo: 'marca', parede: 's' },
  // laboratório
  { em: [41, 6], tipo: 'queimado' },
  { em: [52, 7], tipo: 'marca', parede: 'l' },
  { em: [36, 5], tipo: 'sangue' },
  // necrotério e elevador
  { em: [45, 22], tipo: 'sangue' },
  { em: [51, 22], tipo: 'sangue' },
  { em: [44, 18], tipo: 'marca', parede: 'n' },
  { em: [48, 28], tipo: 'sangue' },
  // anfiteatro
  { em: [36, 38], tipo: 'sangue' },
  { em: [31, 36], tipo: 'sangue' },
  { em: [43, 39], tipo: 'sangue' },
  { em: [39, 33], tipo: 'sangue' },
];
