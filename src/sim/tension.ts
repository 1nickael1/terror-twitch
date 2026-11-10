// Tensão do momento, que guia a música: alvo a partir do estado e suavização. Lógica pura.
import { TENSAO } from './balance';
import type { World } from './world';

/** alvo de tensão em [0, 1] a partir do estado atual */
export function tensaoAlvo(w: World): number {
  let ameaca = 0;
  for (const i of w.inimigos) {
    if (i.modo === 'perseguicao' || i.modo === 'ataque' || i.modo === 'dor') ameaca += TENSAO.perseguicao;
    else if (i.modo === 'suspeita') ameaca += TENSAO.suspeita;
  }
  let alvo = ameaca + (w.alarme ? TENSAO.alarme : 0);
  if (alvo > 0 && w.jogador.vida < TENSAO.vidaBaixa) alvo += TENSAO.pesoVidaBaixa;
  return Math.min(1, Math.max(0, alvo));
}

/** aproxima a tensão do alvo: sobe rápido, desce devagar */
export function suavizarTensao(atual: number, alvo: number, dt: number): number {
  const taxa = alvo > atual ? TENSAO.subida : TENSAO.descida;
  return atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));
}
