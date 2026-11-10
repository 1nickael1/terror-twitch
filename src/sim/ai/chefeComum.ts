// O que vale para qualquer chefe, sem depender da IA dele: achar o estado e o `Inimigo` e
// confirmar a morte. Não importa nenhuma IA de chefe (perigos e armas importam daqui). Lógica pura.
import type { SimEvent } from '../eventos';
import type { Vec2 } from '../grid';
import type { EstadoChefe, Inimigo, World } from '../world';

/** Estado do chefe da fase, ou null sem chefe. */
export function estadoChefe(w: World): EstadoChefe | null {
  return w.chefe;
}

/** O `Inimigo` do chefe em `w.inimigos`, ou undefined sem chefe. */
export function inimigoDoChefe(w: World): Inimigo | undefined {
  const c = w.chefe;
  return c ? w.inimigos.find((i) => i.id === c.inimigoId) : undefined;
}

/** Zera o que o chefe estava fazendo ao morrer (campos próprios de cada tipo). */
function limparAoMorrer(c: EstadoChefe): void {
  switch (c.tipo) {
    case 'entidade096':
      c.portaAlvo = null;
      c.investida = null;
      return;
    case 'entidade049':
      c.corpoAlvo = null;
      return;
  }
}

/**
 * Se o `Inimigo` do chefe está morto e a fase ainda não, passa a `morto` com `chefe_morto` (uma vez).
 * Chamada no passo do chefe e logo depois de dano fora dele (perigos), para valer no mesmo passo.
 */
export function confirmarMorteChefe(w: World): SimEvent[] {
  const c = w.chefe;
  if (!c || c.fase === 'morto') return [];
  const i = inimigoDoChefe(w);
  if (!i || i.modo !== 'morto') return [];
  c.fase = 'morto';
  limparAoMorrer(c);
  return [{ tipo: 'chefe_morto' }];
}

/** Soma o que o chefe andou; a cada `metros`, um `chefe_passo` na posição dele (o áudio toca o passo pesado). */
export function contarPassos(c: { passo: number }, antes: Vec2, agora: Vec2, metros: number): SimEvent[] {
  c.passo += Math.hypot(agora.x - antes.x, agora.z - antes.z);
  if (c.passo < metros) return [];
  c.passo %= metros;
  return [{ tipo: 'chefe_passo', pos: { x: agora.x, z: agora.z } }];
}
