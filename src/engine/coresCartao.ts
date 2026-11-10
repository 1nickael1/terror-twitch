// Cores dos cartões de acesso por nível: a única fonte, usada pelos materiais (faixa das portas,
// pickups de cartão) e pelo HUD. Sem three nem DOM: importável pela engine e pelo React.
import type { NivelCartao } from '../sim/fase';

export interface CorCartao { hex: number; css: string; nome: string }

export const CORES_CARTAO: Record<NivelCartao, CorCartao> = {
  1: { hex: 0x3fae6a, css: '#3fae6a', nome: 'verde' },
  2: { hex: 0xe08a2a, css: '#e08a2a', nome: 'laranja' },
  3: { hex: 0x8f6fe0, css: '#8f6fe0', nome: 'violeta' },
};
