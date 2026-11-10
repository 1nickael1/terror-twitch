// Progresso da campanha: quantas fases estão desbloqueadas e o melhor tempo (s) de cada uma.

import type { Armazenamento } from './opcoes';

export interface Progresso {
  desbloqueadas: number;
  melhorTempo: Record<string, number>;
}

export const CHAVE_PROGRESSO = 'scp-terror:progresso:v1';

function estadoInicial(): Progresso {
  return { desbloqueadas: 1, melhorTempo: {} };
}

function tempoValido(t: unknown): t is number {
  return typeof t === 'number' && Number.isFinite(t) && t > 0;
}

function limitarDesbloqueadas(n: number, totalFases: number): number {
  return Math.min(Math.max(1, totalFases), Math.max(1, Math.floor(n)));
}

function sanearProgresso(bruto: unknown, totalFases: number): Progresso {
  if (typeof bruto !== 'object' || bruto === null) return estadoInicial();
  const o = bruto as Record<string, unknown>;
  const desbloqueadas =
    typeof o.desbloqueadas === 'number' && Number.isFinite(o.desbloqueadas)
      ? limitarDesbloqueadas(o.desbloqueadas, totalFases)
      : 1;
  const melhorTempo: Record<string, number> = {};
  if (typeof o.melhorTempo === 'object' && o.melhorTempo !== null) {
    for (const [id, t] of Object.entries(o.melhorTempo)) {
      if (tempoValido(t)) melhorTempo[id] = t;
    }
  }
  return { desbloqueadas, melhorTempo };
}

export function carregarProgresso(a: Armazenamento, totalFases: number): Progresso {
  try {
    const texto = a.getItem(CHAVE_PROGRESSO);
    return texto === null ? estadoInicial() : sanearProgresso(JSON.parse(texto), totalFases);
  } catch {
    return estadoInicial();
  }
}

/** Concluir a fase de índice `indice` desbloqueia a seguinte e guarda o tempo se for o melhor. */
export function registrarConclusao(
  p: Progresso,
  indice: number,
  idFase: string,
  tempo: number,
  totalFases: number,
): Progresso {
  const desbloqueadas = limitarDesbloqueadas(Math.max(p.desbloqueadas, indice + 2), totalFases);
  const melhorTempo = { ...p.melhorTempo };
  const anterior = melhorTempo[idFase];
  if (tempoValido(tempo) && (anterior === undefined || tempo < anterior)) melhorTempo[idFase] = tempo;
  return { desbloqueadas, melhorTempo };
}

export function salvarProgresso(a: Armazenamento, p: Progresso): void {
  try {
    a.setItem(CHAVE_PROGRESSO, JSON.stringify(p));
  } catch {
    // Armazenamento bloqueado ou cheio: o progresso vale só nesta sessão.
  }
}
