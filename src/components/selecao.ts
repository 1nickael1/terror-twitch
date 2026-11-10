// Seleção de fase (pura): quais fases o menu mostra e o melhor tempo de cada uma.
import type { Progresso } from '../save/progresso';

export interface ItemSelecao { indice: number; id: string; nome: string; melhor: number | null }

/** As fases desbloqueadas, em ordem (a primeira sempre), com o melhor tempo salvo (ou null). */
export function fasesDaSelecao(fases: readonly { id: string; nome: string }[], p: Progresso): ItemSelecao[] {
  const abertas = Math.min(fases.length, Math.max(1, p.desbloqueadas));
  return fases.slice(0, abertas).map((f, indice) => ({ indice, id: f.id, nome: f.nome, melhor: p.melhorTempo[f.id] ?? null }));
}
