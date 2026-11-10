// Fase 1: luzes, props (com placas de sinalização inventadas) e decalques. Só dados.
import type { DecalDef, LuzDef, PropDef } from '../../sim/fase';

const FRIA = 0xa8d0ff;
const FRIA_AZUL = 0x9fc4ff;
const FRIA_FRACA = 0x7fa6d6;
const ALARME = 0xff2a1a;
const AMBAR = 0xffb04a;

export const LUZES: LuzDef[] = [
  // recepção (teto alto)
  { em: [5, 3], cor: 0xbcd6ff, intensidade: 1.1 },
  { em: [2, 7], cor: FRIA_AZUL, intensidade: 0.7 },
  // corredor escuro: só uma lâmpada falhando no fim
  { em: [14, 2], cor: FRIA_FRACA, intensidade: 0.35, pisca: 0.6 },
  // escritórios
  { em: [18, 2], cor: FRIA, intensidade: 0.9 },
  { em: [26, 8], cor: FRIA_AZUL, intensidade: 1.0, pisca: 0.3 },
  { em: [28, 2], cor: FRIA, intensidade: 0.9 },
  { em: [18, 8], cor: FRIA_AZUL, intensidade: 0.8 },
  { em: [19, 12], cor: FRIA_FRACA, intensidade: 0.4 },
  // posto de segurança
  { em: [35, 4], cor: FRIA, intensidade: 1.0 },
  { em: [41, 2], cor: FRIA_AZUL, intensidade: 0.8 },
  { em: [40, 6], cor: FRIA, intensidade: 0.8 },
  { em: [38, 10], cor: 0x86aee0, intensidade: 0.8, pisca: 0.4 },
  { em: [55, 14], cor: FRIA_AZUL, intensidade: 0.7 },
  { em: [50, 9], cor: 0x86aee0, intensidade: 0.7 },
  // bloco de celas
  { em: [28, 17], cor: FRIA_AZUL, intensidade: 0.9, pisca: 0.5 },
  { em: [40, 18], cor: 0x86aee0, intensidade: 0.9 },
  { em: [48, 17], cor: FRIA_FRACA, intensidade: 0.6, pisca: 0.8 },
  { em: [26, 13], cor: FRIA_FRACA, intensidade: 0.5, pisca: 0.7 },
  { em: [36, 14], cor: FRIA_FRACA, intensidade: 0.5 },
  { em: [41, 13], cor: FRIA_FRACA, intensidade: 0.4 },
  { em: [26, 21], cor: FRIA, intensidade: 0.8 },
  { em: [32, 21], cor: FRIA_FRACA, intensidade: 0.4, pisca: 0.4 },
  { em: [31, 24], cor: 0x6f93c4, intensidade: 0.5 },
  { em: [41, 21], cor: FRIA_AZUL, intensidade: 1.0 },
  // isolamento
  { em: [44, 25], cor: FRIA_FRACA, intensidade: 0.5 },
  { em: [44, 30], cor: 0xd8e6ff, intensidade: 0.8 },
  { em: [52, 30], cor: 0xcfd8e6, intensidade: 0.5, pisca: 0.2 },
  { em: [55, 34], cor: 0xcfd8e6, intensidade: 0.35 },
  // perseguição
  { em: [56, 38], cor: FRIA_AZUL, intensidade: 0.6 },
  { em: [60, 40], cor: FRIA_FRACA, intensidade: 0.5, pisca: 0.6 },
  { em: [45, 41], cor: 0x86aee0, intensidade: 0.6 },
  { em: [35, 37], cor: 0x86aee0, intensidade: 0.6, pisca: 0.5 },
  { em: [30, 39], cor: 0x86aee0, intensidade: 0.5 },
  { em: [25, 40], cor: 0x86aee0, intensidade: 0.6 },
  { em: [15, 42], cor: FRIA_FRACA, intensidade: 0.5, pisca: 0.5 },
  { em: [14, 40], cor: 0x86aee0, intensidade: 0.6 },
  { em: [6, 16], cor: FRIA_FRACA, intensidade: 0.45, pisca: 0.3 },
  // arquivo morto
  { em: [15, 14], cor: FRIA_FRACA, intensidade: 0.5, pisca: 0.6 },
  { em: [15, 18], cor: FRIA_FRACA, intensidade: 0.5 },
  // triagem (âmbar)
  { em: [6, 26], cor: AMBAR, intensidade: 1.2 },
  { em: [17, 27], cor: AMBAR, intensidade: 1.2 },
  { em: [17, 35], cor: AMBAR, intensidade: 1.2 },
  { em: [8, 36], cor: AMBAR, intensidade: 1.0 },
  { em: [3, 31], cor: 0xffd08a, intensidade: 0.8 },
  { em: [8, 22], cor: 0xd8e6ff, intensidade: 0.9 },
  // alarme (seguem `world.alarme`)
  { em: [24, 6], cor: ALARME, intensidade: 1.4, grupo: 'alarme' },
  { em: [40, 9], cor: ALARME, intensidade: 1.3, grupo: 'alarme' },
  { em: [35, 17], cor: ALARME, intensidade: 1.4, grupo: 'alarme' },
  { em: [47, 18], cor: ALARME, intensidade: 1.3, grupo: 'alarme' },
  { em: [41, 22], cor: ALARME, intensidade: 1.2, grupo: 'alarme' },
  { em: [44, 26], cor: ALARME, intensidade: 1.2, grupo: 'alarme' },
  { em: [54, 41], cor: ALARME, intensidade: 1.2, grupo: 'alarme' },
  { em: [40, 40], cor: ALARME, intensidade: 1.2, grupo: 'alarme' },
  { em: [20, 37], cor: ALARME, intensidade: 1.0, grupo: 'alarme' },
];

/** Sinalização inventada para a instalação (nada de logos ou nomes de outras obras). */
const PLACAS: PropDef[] = [
  { em: [5, 1], tipo: 'placa', parede: 'n', texto: 'SETOR L-2 · CONTENÇÃO LEVE' },
  { em: [2, 8], tipo: 'placa', parede: 's', texto: 'AGUARDE SER CHAMADO' },
  { em: [10, 6], tipo: 'placa', parede: 'l', texto: 'ADMINISTRAÇÃO' },
  { em: [18, 4], tipo: 'placa', parede: 's', texto: 'SALA DE REUNIÕES 2' },
  { em: [28, 1], tipo: 'placa', parede: 'n', texto: 'GERÊNCIA DO SETOR' },
  { em: [30, 1], tipo: 'placa', parede: 'l', texto: 'POSTO DE SEGURANÇA' },
  { em: [33, 1], tipo: 'placa', parede: 'n', texto: 'POSTO L-2 · ACESSO RESTRITO' },
  { em: [40, 1], tipo: 'placa', parede: 'n', texto: 'ARSENAL · SOMENTE PESSOAL AUTORIZADO' },
  { em: [56, 13], tipo: 'placa', parede: 'l', texto: 'BLOCO DE CELAS · NÍVEL 1' },
  { em: [22, 21], tipo: 'placa', parede: 'n', texto: 'ARQUIVO MORTO' },
  { em: [10, 19], tipo: 'placa', parede: 's', texto: 'ARQUIVO MORTO · ESTANTES A–F' },
  { em: [46, 17], tipo: 'placa', parede: 'n', texto: 'CELAS 01–05' },
  { em: [24, 17], tipo: 'placa', parede: 'n', texto: 'CELA 01' },
  { em: [29, 17], tipo: 'placa', parede: 'n', texto: 'CELA 02' },
  { em: [34, 17], tipo: 'placa', parede: 'n', texto: 'CELA 03' },
  { em: [39, 17], tipo: 'placa', parede: 'n', texto: 'CELA 04' },
  { em: [25, 18], tipo: 'placa', parede: 's', texto: 'REGISTROS' },
  { em: [31, 18], tipo: 'placa', parede: 's', texto: 'CELA 05' },
  { em: [40, 18], tipo: 'placa', parede: 's', texto: 'CONVIVÊNCIA' },
  { em: [44, 24], tipo: 'placa', parede: 'o', texto: 'ISOLAMENTO · NÍVEL 2' },
  { em: [45, 28], tipo: 'placa', parede: 'n', texto: 'NÃO OLHE PARA O OCUPANTE' },
  { em: [47, 30], tipo: 'placa', parede: 'l', texto: 'CELA L-2-07 · ISOLAMENTO' },
  { em: [52, 38], tipo: 'placa', parede: 'n', texto: 'TRIAGEM' },
  { em: [39, 37], tipo: 'placa', parede: 'n', texto: 'TRIAGEM' },
  { em: [22, 35], tipo: 'placa', parede: 'l', texto: 'TRIAGEM' },
  { em: [1, 30], tipo: 'placa', parede: 'o', texto: 'CABINE DE CONTROLE' },
  { em: [10, 25], tipo: 'placa', parede: 'l', texto: 'COMPORTA A' },
  { em: [10, 33], tipo: 'placa', parede: 'l', texto: 'COMPORTA B' },
  { em: [7, 24], tipo: 'placa', parede: 'n', texto: 'SAÍDA DE SERVIÇO' },
  { em: [7, 21], tipo: 'placa', parede: 'n', texto: 'ELEVADOR DE SERVIÇO' },
  { em: [14, 41], tipo: 'placa', parede: 'l', texto: 'TRIAGEM' },
];

/** Móveis encostados nas paredes, fora das rotas (não têm colisão). */
const MOVEIS: PropDef[] = [
  // recepção
  { em: [6, 1], tipo: 'mesa', parede: 'n' },
  { em: [7, 1], tipo: 'mesa', parede: 'n' },
  { em: [6, 2], tipo: 'cadeira', yaw: 0 },
  { em: [1, 6], tipo: 'cadeira', parede: 'o' },
  { em: [1, 7], tipo: 'cadeira', parede: 'o' },
  { em: [1, 8], tipo: 'cadeira', parede: 'o' },
  { em: [3, 8], tipo: 'cadeira', parede: 's' },
  { em: [10, 8], tipo: 'lixeira', parede: 's' },
  // escritórios
  { em: [17, 1], tipo: 'mesa', parede: 'n' },
  { em: [19, 1], tipo: 'mesa', parede: 'n' },
  { em: [20, 1], tipo: 'mesa', parede: 'n' },
  { em: [19, 2], tipo: 'cadeira', yaw: 0 },
  { em: [16, 3], tipo: 'armario', parede: 'o' },
  { em: [16, 10], tipo: 'lixeira', parede: 's' },
  { em: [17, 10], tipo: 'caixa', parede: 's' },
  { em: [25, 10], tipo: 'mesa', parede: 's' },
  { em: [25, 9], tipo: 'cadeira', yaw: Math.PI },
  { em: [28, 10], tipo: 'mesa', parede: 's' },
  { em: [23, 6], tipo: 'mesa', parede: 'n' },
  { em: [30, 6], tipo: 'armario', parede: 'l' },
  { em: [30, 7], tipo: 'armario', parede: 'l' },
  { em: [29, 1], tipo: 'mesa', parede: 'n' },
  { em: [30, 3], tipo: 'armario', parede: 'l' },
  { em: [21, 4], tipo: 'lixeira', parede: 's' },
  // posto de segurança
  { em: [32, 6], tipo: 'mesa', parede: 'o' },
  { em: [43, 2], tipo: 'mesa', parede: 'l' },
  { em: [33, 6], tipo: 'cadeira', yaw: -Math.PI / 2 },
  { em: [36, 7], tipo: 'mesa', parede: 's' },
  { em: [37, 7], tipo: 'mesa', parede: 's' },
  { em: [41, 1], tipo: 'armario', parede: 'n' },
  { em: [42, 1], tipo: 'armario', parede: 'n' },
  // arquivo morto
  { em: [10, 16], tipo: 'armario', parede: 'n' },
  { em: [21, 16], tipo: 'armario', parede: 'l' },
  { em: [21, 14], tipo: 'armario', parede: 'l' },
  { em: [2, 18], tipo: 'caixa', parede: 'o' },
  { em: [2, 14], tipo: 'mesa', parede: 'o' },
  { em: [19, 19], tipo: 'caixa', parede: 's' },
  { em: [43, 3], tipo: 'caixa', parede: 'l' },
  { em: [33, 9], tipo: 'caixa', parede: 'o' },
  // bloco de celas
  { em: [24, 12], tipo: 'cama', parede: 'n' },
  { em: [29, 12], tipo: 'cama', parede: 'n' },
  { em: [37, 12], tipo: 'cama', parede: 'n' },
  { em: [42, 12], tipo: 'cama', parede: 'n' },
  { em: [39, 15], tipo: 'maca', parede: 'o' },
  { em: [24, 20], tipo: 'armario', parede: 'o' },
  { em: [28, 20], tipo: 'armario', parede: 'l' },
  { em: [28, 22], tipo: 'mesa', parede: 'l' },
  { em: [30, 20], tipo: 'cama', parede: 'n' },
  { em: [34, 22], tipo: 'caixa', parede: 'l' },
  { em: [37, 21], tipo: 'mesa', parede: 'o' },
  { em: [45, 21], tipo: 'mesa', parede: 'l' },
  { em: [38, 22], tipo: 'cadeira', parede: 's' },
  { em: [42, 22], tipo: 'lixeira', parede: 's' },
  { em: [50, 18], tipo: 'caixa', parede: 'l' },
  // isolamento
  { em: [42, 29], tipo: 'maca', parede: 'o' },
  { em: [47, 32], tipo: 'armario', parede: 'l' },
  { em: [42, 33], tipo: 'mesa', parede: 'o' },
  { em: [57, 26], tipo: 'cama', parede: 'l' },
  // triagem
  { em: [21, 24], tipo: 'caixa', parede: 'n' },
  { em: [22, 24], tipo: 'caixa', parede: 'l' },
  { em: [22, 38], tipo: 'caixa', parede: 's' },
  { em: [14, 38], tipo: 'maca', parede: 's' },
  { em: [16, 38], tipo: 'maca', parede: 's' },
  { em: [1, 38], tipo: 'maca', parede: 's' },
  { em: [10, 38], tipo: 'caixa', parede: 's' },
  { em: [1, 31], tipo: 'mesa', parede: 'o' },
  { em: [4, 30], tipo: 'cadeira', yaw: -Math.PI / 2 },
];

export const PROPS: PropDef[] = [...PLACAS, ...MOVEIS];

export const DECALS: DecalDef[] = [
  { em: [29, 5], tipo: 'sangue' },
  { em: [25, 16], tipo: 'sangue' },
  { em: [26, 14], tipo: 'sangue' },
  { em: [27, 15], tipo: 'marca', parede: 'l' },
  { em: [26, 17], tipo: 'marca', parede: 'n' },
  { em: [31, 18], tipo: 'sangue' },
  { em: [36, 12], tipo: 'marca', parede: 'n' },
  { em: [49, 17], tipo: 'queimado', parede: 'n' },
  { em: [44, 25], tipo: 'sangue' },
  { em: [43, 31], tipo: 'sangue' },
  { em: [55, 38], tipo: 'marca', parede: 'n' },
  { em: [51, 37], tipo: 'sangue' },
];
