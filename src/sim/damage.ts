// Vida e colete: como um golpe se reparte e como a cura se limita. Lógica pura.
import { JOGADOR } from './balance';

export interface Alvo { vida: number; colete: number }

/** Remove o resíduo de ponto flutuante (30 × 2/3 dá 19,999…) sem mudar a regra. */
function limpar(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Reparte o dano entre colete e vida e devolve o novo estado. Não muta.
 * O colete segura `absorcaoColete` do golpe enquanto durar; o que ele não segura vai para a vida.
 */
export function absorver(alvo: Alvo, dano: number): Alvo {
  if (dano <= 0) return { vida: alvo.vida, colete: alvo.colete };
  const peloColete = Math.min(alvo.colete, limpar(dano * JOGADOR.absorcaoColete));
  return {
    vida: Math.max(0, limpar(alvo.vida - (dano - peloColete))),
    colete: limpar(alvo.colete - peloColete),
  };
}

/** Soma vida e colete, limitados ao máximo do jogador. Não muta. */
export function curar(alvo: Alvo, vida: number, colete: number): Alvo {
  return {
    vida: Math.min(JOGADOR.vidaMax, alvo.vida + vida),
    colete: Math.min(JOGADOR.coleteMax, alvo.colete + colete),
  };
}
