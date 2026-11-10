/** Texturas originais geradas para os dois setores. Cor em sRGB; relevo/rugosidade em dados lineares. */
export const TEXTURAS = [
  'concreto', 'azulejo', 'piso', 'teto', 'porta', 'comporta',
  'metal-pintado', 'aco', 'madeira', 'tecido', 'borracha', 'papel', 'tela',
  'vida', 'colete', 'municao', 'cartao', 'capsula', 'vidro',
] as const;

export type TexturaId = typeof TEXTURAS[number];
export type CanalTextura = 'albedo' | 'relevo' | 'rugosidade';

export function urlTextura(id: TexturaId, canal: CanalTextura): string {
  return `/textures/${id}/${canal}.webp`;
}
