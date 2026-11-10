// Números de jogo: toda constante de equilíbrio mora aqui.
import type { ArmaId, TipoMunicao } from './fase';

export const JOGADOR = {
  raio: 0.3, olhos: 1.6, velocidade: 9, velocidadeDevagar: 3.5, aceleracao: 70, controleNoAr: 0.35,
  gravidade: 22, impulsoSalto: 7.0, pitchMax: 1.4, vidaMax: 100, coleteMax: 100, absorcaoColete: 2 / 3,
  passoMetros: 2.2,
} as const;

/** Raio (m) em que cada ruído do jogador chega aos inimigos. */
export const RUIDO = { corrida: 7, pouso: 5 } as const;

export interface ArmaDef {
  nome: string; municao: TipoMunicao; porTiro: number; cadencia: number; automatica: boolean;
  fragmentos: number; dano: number; alcance: number; espalhamento: number; espalhamentoMax: number;
  ruido: number; projetil: boolean;
}

/** cadencia em segundos entre tiros; espalhamento em radianos; ruido = raio (m) do ruído do tiro */
export const ARMAS: Record<ArmaId, ArmaDef> = {
  pistola: {
    nome: 'Pistola de serviço', municao: 'balas', porTiro: 1, cadencia: 0.28, automatica: false,
    fragmentos: 1, dano: 20, alcance: 40, espalhamento: 0.008, espalhamentoMax: 0.008, ruido: 24, projetil: false,
  },
  escopeta: {
    nome: 'Escopeta de contenção', municao: 'cartuchos', porTiro: 1, cadencia: 0.9, automatica: false,
    fragmentos: 8, dano: 9, alcance: 18, espalhamento: 0.09, espalhamentoMax: 0.09, ruido: 30, projetil: false,
  },
  smg: {
    nome: 'Submetralhadora', municao: 'leves', porTiro: 1, cadencia: 0.08, automatica: true,
    fragmentos: 1, dano: 9, alcance: 30, espalhamento: 0.02, espalhamentoMax: 0.07, ruido: 26, projetil: false,
  },
  lancador: {
    nome: 'Lançador de agente', municao: 'capsulas', porTiro: 1, cadencia: 1.2, automatica: false,
    fragmentos: 1, dano: 40, alcance: 30, espalhamento: 0, espalhamentoMax: 0, ruido: 14, projetil: true,
  },
};
export const ORDEM_ARMAS: readonly ArmaId[] = ['pistola', 'escopeta', 'smg', 'lancador'];
export const MUNICAO_MAX: Record<TipoMunicao, number> = { balas: 120, cartuchos: 40, leves: 240, capsulas: 12 };
/** Abaixo de `minimo` balas, a pistola ganha 1 bala a cada `intervalo` segundos. */
export const PISTOLA_RESERVA = { minimo: 6, intervalo: 4 } as const;
/** Quanto o espalhamento cresce (rad) a cada tiro seguido, até `espalhamentoMax`. */
export const ESPALHAMENTO_POR_TIRO = 0.005;
/** Segundos de espera depois de trocar de arma. */
export const ESPERA_TROCA = 0.25;
/** `lentidao` multiplica a velocidade de quem está lento. */
export const NUVEM = { raio: 3, duracao: 4, danoPorSegundo: 15, lentidao: 0.5 } as const;
/** Segundos de lentidão renovados a cada passo dentro da nuvem. */
export const LENTO_NUVEM = 0.5;
export const LANCADOR = { velocidade: 16, subida: 4, gravidade: 12, vida: 5, abaixoDosOlhos: 0.2 } as const;
/** Acerto no décimo superior (`fracao`) do cilindro do inimigo multiplica o dano. */
export const CABECA = { multiplicador: 1.5, fracao: 0.1 } as const;
/** Segundos em que um clique durante a espera fica guardado para disparar quando ela acabar. */
export const TIRO_PENDENTE = 0.15;
/** tempo (s) para abrir ou fechar; alcanceUso (m); ruido = raio (m); a porta libera a passagem a partir de `livreEm` de abertura. */
export const PORTA = { tempo: 0.5, alcanceUso: 2.2, ruido: 8, livreEm: 0.6 } as const;
/** raio (m) de coleta e quanto cada pickup de vida/colete recupera. */
export const PICKUP = { raio: 0.7, vida_p: 15, vida_g: 50, colete_p: 25, colete_g: 100 } as const;
/** Munição de um pickup de munição sem `quantidade`. */
export const MUNICAO_PADRAO_PICKUP = 10;
/**
 * IA dos inimigos. Tempos em segundos, distâncias em metros, frações da velocidade do tipo.
 * `intervaloRota`: mínimo entre dois cálculos de rota; `semVerMax`: perseguindo sem ver o jogador
 * por esse tempo, desiste e vai à suspeita; `olharEmVolta`/`giroOlhando` (rad/s): o que faz ao
 * chegar ao ponto suspeito; `emboscadaPerto`/`emboscadaCostas`: até onde o emboscador percebe o
 * jogador (de costas para ele, mais longe); `acordar`: fração do raio do ruído que acorda quem dorme;
 * `chegada`: parado por bloqueio a menos disso do destino, conta como chegou.
 * Alturas (fração da altura do tipo): `olhos`, `disparo`. Do jogador (m acima dos pés):
 * `peitoJogador` é a mira do projétil, `alturaJogador` o topo do corpo que o projétil acerta.
 */
export const IA = {
  intervaloRota: 0.25, semVerMax: 6, olharEmVolta: 2, giroOlhando: Math.PI / 2,
  fracaoPatrulha: 0.4, fracaoSuspeita: 0.6,
  emboscadaPerto: 5, emboscadaCostas: 9, acordar: 0.5, chegada: 0.75,
  olhos: 0.9, disparo: 0.7, peitoJogador: 1.1, alturaJogador: 1.8, vidaProjetil: 4,
} as const;
/**
 * Tensão (guia da música), em [0, 1]. Cada inimigo vivo em perseguição, ataque ou dor vale
 * `perseguicao`; em suspeita, `suspeita`. O alarme ligado soma `alarme`. Vida abaixo de
 * `vidaBaixa` soma `pesoVidaBaixa`, só havendo ameaça (inimigo contando ou alarme).
 * `subida`/`descida`: taxas (1/s) da aproximação exponencial ao alvo.
 */
export const TENSAO = {
  perseguicao: 0.25, suspeita: 0.08, alarme: 0.15, vidaBaixa: 30, pesoVidaBaixa: 0.2,
  subida: 3.0, descida: 0.5,
  chefeAcordado: 0.5, chefeInvestida: 0.2,
} as const;
/**
 * Chefe da fase 1 (entidade 096). O tipo `entidade096` em `TIPOS` tem vida, velocidade, dano etc.;
 * aqui ficam as regras próprias. Tempos em segundos, distâncias em metros, ângulos em radianos.
 * `olharAngulo`/`olharTempo`: mira acumulada que o desperta; `distanciaDespertar`: jogador a até
 * isso o desperta; `despertar`: parado virando para o jogador; `arrombar`: tempo arrombando uma
 * porta; `investidaVel`/`investidaMax`/`investidaGolpe`: corrida em linha reta na arena e a
 * distância em que ela golpeia; `pausa`: parado entre investidas; `retomada`: `despertando` ao
 * restaurar um checkpoint com ele acordado. `velocidadePerseguicao` (m/s): corrida na perseguição, dentro e fora da
 * arena (lote final do CP2; o `TIPOS.entidade096.velocidade` não é usado pelo chefe); `preparoInvestida`: parado antes
 * de toda investida (o urro sai no início); `passoMetros`: metros andados entre dois eventos `chefe_passo`.
 */
export const CHEFE_096 = {
  olharAngulo: (6 * Math.PI) / 180, olharTempo: 1.5, distanciaDespertar: 8, despertar: 2.5,
  arrombar: 3, investidaVel: 15, investidaMax: 1.6, investidaGolpe: 1.3, pausa: 2.2, retomada: 3,
  velocidadePerseguicao: 12, preparoInvestida: 0.5, passoMetros: 2.5,
} as const;
