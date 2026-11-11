// Máquina de telas do jogo (pura): qual tela vem depois de cada comando. Os efeitos (carregar
// fase, pausar, trava do ponteiro) ficam no `Game`, que aplica esta função.

export type Tela = 'titulo' | 'jogando' | 'pausa' | 'documento' | 'morte' | 'fim_de_fase' | 'final';

export type Comando =
  | { c: 'estande' } | { c: 'reiniciar_estande' }
  | { c: 'novo_jogo' } | { c: 'continuar' } | { c: 'fase'; indice: number }
  | { c: 'pausar' } | { c: 'retomar' } | { c: 'sair' } | { c: 'proxima' }
  | { c: 'abrir_documento' } | { c: 'fechar_documento' }
  | { c: 'morreu' } | { c: 'renasceu' } | { c: 'concluiu' };

export interface EstadoTela { tela: Tela; fase: number }
export const FASE_ESTANDE = -1;

const jogando = (fase: number): EstadoTela => ({ tela: 'jogando', fase });

/** Próximo estado; um comando fora de contexto devolve o próprio `e` (mesma referência). */
export function transicao(e: EstadoTela, cmd: Comando, totalFases: number, desbloqueadas: number): EstadoTela {
  switch (e.tela) {
    case 'titulo':
      if (cmd.c === 'estande') return jogando(FASE_ESTANDE);
      if (cmd.c === 'novo_jogo') return jogando(0);
      if (cmd.c === 'continuar') return jogando(Math.max(0, Math.min(desbloqueadas, totalFases) - 1));
      if (cmd.c === 'fase' && Number.isInteger(cmd.indice) && cmd.indice >= 0
        && cmd.indice < desbloqueadas && cmd.indice < totalFases) return jogando(cmd.indice);
      return e;
    case 'jogando':
      if (cmd.c === 'pausar') return { tela: 'pausa', fase: e.fase };
      if (cmd.c === 'abrir_documento') return { tela: 'documento', fase: e.fase };
      if (cmd.c === 'morreu') return { tela: 'morte', fase: e.fase };
      if (cmd.c === 'concluiu' && e.fase !== FASE_ESTANDE) return { tela: 'fim_de_fase', fase: e.fase };
      return e;
    case 'pausa':
      if (cmd.c === 'reiniciar_estande' && e.fase === FASE_ESTANDE) return jogando(FASE_ESTANDE);
      if (cmd.c === 'retomar') return jogando(e.fase);
      if (cmd.c === 'sair') return { tela: 'titulo', fase: e.fase };
      return e;
    case 'documento':
      return cmd.c === 'fechar_documento' ? jogando(e.fase) : e;
    case 'morte':
      return cmd.c === 'renasceu' ? jogando(e.fase) : e;
    case 'fim_de_fase':
      if (cmd.c === 'proxima') return e.fase + 1 < totalFases ? jogando(e.fase + 1) : { tela: 'final', fase: e.fase };
      if (cmd.c === 'sair') return { tela: 'titulo', fase: e.fase };
      return e;
    case 'final':
      return cmd.c === 'sair' ? { tela: 'titulo', fase: e.fase } : e;
  }
}
