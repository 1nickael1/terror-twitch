// Fase 2, "Ala Médica e Pesquisa": planta e legenda. CELL = 2 m; colunas → x (leste), linhas → z (sul).
import type { CelulaDef } from '../../sim/grid';

/*
 * Legenda da planta:
 *   #  parede          .  piso (0 m, teto 3 m)         P  início (triagem)
 *   ,  piso da triagem (teto 4 m)    &  balcão alto da triagem (1 m; só pulando): segredo
 *   ^  duto e depósito escondido (1 m; só pulando): segredo
 *   :  laboratório de patologia (teto 5 m: os frascos dos enfermeiros sobem)
 *   =  janela de observação (corredor → laboratório; laboratório → sala limpa)
 *   ;  necrotério (teto 3,5 m)
 *   4 5 6  degraus do corredor de serviço (0,5 · 1 · 1,5 m); 6 também na escada de saída
 *   Anfiteatro cirúrgico (teto 7 m): 0 piso central · 1 2 3 degraus de observação (0,5 · 1 · 1,5 m)
 *   k m  terminais das lâmpadas UV (paredes oeste e leste)   n q  terminais do vapor (paredes norte e sul)
 *   Portas: A saída da triagem (grupo morto) · B posto · C prescrição · D enfermaria (nível 1)
 *           E laboratório · L sala limpa · F saída do laboratório (nível 2) · G necrotério
 *           H elevador de macas (tempo) · I fundo do elevador (tempo) · J anfiteatro · K saída (chefe morto)
 *
 * Salas (colunas x linhas):
 *   Triagem 1–16 x 1–9 (balcão alto 1–2 x 1) · posto de enfermagem 18–24 x 2–8 · corredor 21–22 x 10–13 ·
 *   enfermaria 2–29 x 14–21 (leitos ao norte e ao sul do corredor central, linhas 17–18) · rouparia (segredo)
 *   26–29 x 10–12 · prescrição 2–7 x 23–26 · corredor de observação 33–34 x 3–17 (janelas na coluna 35,
 *   linhas 4–10) · duto e depósito (segredo) 28–33 x 2–4 · laboratório 36–52 x 2–12 (sala limpa 46–52 x 2–5,
 *   atrás do vidro da linha 6) · antecâmara 46–50 x 14–16 · necrotério 42–54 x 18–25 · elevador 47–49 x 27–28 ·
 *   corredor de serviço 30–45 x 28 (degraus 31–33), porta J em [30, 29] e patamar [30, 30] · anfiteatro 27–46 x 31–44 (arquibancada norte 31–33,
 *   piso 34–41, arquibancada sul 42–44) · escada de saída 48 x 41–44.
 */
export const PLANTA = `
########################################################
#&&,,,,,,,,,,,,,,#######################################
#,,,,,,,,,,,,,,,,#.......###^^^^^^##:::::::::#:::::::###
#,,,,,,,,,,,,,,,,#.......###^^^^#..#:::::::::#:::::::###
#,,,,,,,,,,,,,,,,#.......###^^^^#..=:::::::::#:::::::###
#,,,,,,,,,,,,,,,,A.......########..=:::::::::#:::::::###
#,P,,,,,,,,,,,,,,#.......########..=::::::::::#===#L####
#,,,,,,,,,,,,,,,,#.......########..=:::::::::::::::::###
#,,,,,,,,,,,,,,,,#.......########..=:::::::::::::::::###
#,,,,,,,,,,,,,,,,####B###########..=:::::::::::::::::###
#####################..###....###..=:::::::::::::::::###
#####################..###....###..#:::::::::::::::::###
#####################..###....###..E:::::::::::::::::###
#####################..######.###..#############F#######
##............................###..###########.....#####
##............................###..###########.....#####
##............................###..###########.....#####
##............................D....#############G#######
##............................############;;;;;;;;;;;;;#
##............................############;;;;;;;;;;;;;#
##............................############;;;;;;;;;;;;;#
##............................############;;;;;;;;;;;;;#
####C#####################################;;;;;;;;;;;;;#
##......##################################;;;;;;;;;;;;;#
##......##################################;;;;;;;;;;;;;#
##......##################################;;;;;;;;;;;;;#
##......########################################H#######
###############################################...######
##############################6654............I...######
##############################J#########################
##############################6######n##################
###########################33333333333333333333#########
###########################22222222222222222222#########
###########################11111111111111111111#########
###########################00000000000000000000#########
###########################00000000000000000000#########
###########################00000000000000000000#########
##########################k00000000000000000000#########
###########################00000000000000000000m########
###########################00000000000000000000#########
###########################00000000000000000000#########
###########################00000000000000000000#6#######
###########################11111111111111111111#6#######
###########################22222222222222222222#6#######
###########################33333333333333333333K6#######
####################################q###################
`;

/** Pé-direito do anfiteatro: alto para os tubos UV, os canos de vapor e a vista das arquibancadas. */
const TETO_ANFITEATRO = 7;

export const LEGENDA: Record<string, CelulaDef> = {
  P: { teto: 4 },
  ',': { teto: 4 },
  '&': { piso: 1, teto: 4 },
  '^': { piso: 1 },
  ':': { teto: 5 },
  '=': { tipo: 'janela' },
  ';': { teto: 3.5 },
  '4': { piso: 0.5 },
  '5': { piso: 1 },
  '6': { piso: 1.5 },
  '0': { teto: TETO_ANFITEATRO },
  '1': { piso: 0.5, teto: TETO_ANFITEATRO },
  '2': { piso: 1, teto: TETO_ANFITEATRO },
  '3': { piso: 1.5, teto: TETO_ANFITEATRO },
  k: { tipo: 'parede' },
  m: { tipo: 'parede' },
  n: { tipo: 'parede' },
  q: { tipo: 'parede' },
  // portas em pisos elevados (entrada e saída do anfiteatro, na arquibancada alta)
  J: { piso: 1.5 },
  K: { piso: 1.5 },
};
