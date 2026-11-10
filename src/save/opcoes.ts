// Opções do jogador, persistidas num armazenamento injetado (localStorage no navegador).
// Tudo que vem do armazenamento é saneado campo a campo: nada salvo pode quebrar o jogo.

export interface Armazenamento {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export type Qualidade = 'baixa' | 'media' | 'alta';

export interface Opcoes {
  sensibilidade: number; // 0.2 a 3
  inverterY: boolean;
  fov: number; // 60 a 110
  volumeGeral: number; // 0 a 1
  volumeEfeitos: number; // 0 a 1
  volumeMusica: number; // 0 a 1
  filtro: string; // id de um VisualStyle
  reduzirFlashes: boolean;
  qualidade: Qualidade;
}

export const OPCOES_PADRAO: Opcoes = {
  sensibilidade: 1,
  inverterY: false,
  fov: 80,
  volumeGeral: 0.8,
  volumeEfeitos: 1,
  volumeMusica: 0.7,
  filtro: 'lanterna',
  reduzirFlashes: false,
  qualidade: 'media',
};

export const CHAVE_OPCOES = 'scp-terror:opcoes:v1';

const QUALIDADES: readonly Qualidade[] = ['baixa', 'media', 'alta'];

/** Número dentro da faixa; fora dela é limitado; tipo errado ou NaN vira o padrão. */
function numeroNaFaixa(valor: unknown, min: number, max: number, padrao: number): number {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return padrao;
  return Math.min(max, Math.max(min, valor));
}

function booleano(valor: unknown, padrao: boolean): boolean {
  return typeof valor === 'boolean' ? valor : padrao;
}

export function sanear(bruto: unknown, filtrosValidos: readonly string[]): Opcoes {
  const o: Record<string, unknown> = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : {};
  const p = OPCOES_PADRAO;
  return {
    sensibilidade: numeroNaFaixa(o.sensibilidade, 0.2, 3, p.sensibilidade),
    inverterY: booleano(o.inverterY, p.inverterY),
    fov: numeroNaFaixa(o.fov, 60, 110, p.fov),
    volumeGeral: numeroNaFaixa(o.volumeGeral, 0, 1, p.volumeGeral),
    volumeEfeitos: numeroNaFaixa(o.volumeEfeitos, 0, 1, p.volumeEfeitos),
    volumeMusica: numeroNaFaixa(o.volumeMusica, 0, 1, p.volumeMusica),
    filtro: typeof o.filtro === 'string' && filtrosValidos.includes(o.filtro) ? o.filtro : p.filtro,
    reduzirFlashes: booleano(o.reduzirFlashes, p.reduzirFlashes),
    qualidade: QUALIDADES.find((q) => q === o.qualidade) ?? p.qualidade,
  };
}

export function carregarOpcoes(a: Armazenamento, filtrosValidos: readonly string[]): Opcoes {
  try {
    const texto = a.getItem(CHAVE_OPCOES);
    return sanear(texto === null ? null : JSON.parse(texto), filtrosValidos);
  } catch {
    return { ...OPCOES_PADRAO };
  }
}

export function salvarOpcoes(a: Armazenamento, o: Opcoes): void {
  try {
    a.setItem(CHAVE_OPCOES, JSON.stringify(o));
  } catch {
    // Armazenamento bloqueado ou cheio: as opções valem só nesta sessão.
  }
}
