// Eventos que a simulação emite a cada passo (só tipos, sem lógica).
import type { ArmaId, NivelCartao } from './fase';
import type { Vec2 } from './grid';
import type { Porta } from './world';

export type SimEvent =
  | { tipo: 'tiro'; arma: ArmaId; pos: Vec2 }
  | { tipo: 'impacto'; pos: Vec2; y: number; em: 'parede' | 'inimigo' }
  | { tipo: 'ruido'; pos: Vec2; raio: number }
  | { tipo: 'passo'; pos: Vec2 }
  | { tipo: 'pulo' } | { tipo: 'pouso' }
  | { tipo: 'dano_jogador'; quantia: number; de: Vec2 }
  | { tipo: 'inimigo_alerta'; id: number }
  | { tipo: 'inimigo_ataque'; id: number }
  | { tipo: 'inimigo_dor'; id: number }
  | { tipo: 'inimigo_morto'; id: number }
  | { tipo: 'projetil'; id: number }
  | { tipo: 'explosao'; pos: Vec2 }
  | { tipo: 'porta'; id: string; estado: Porta['estado'] }
  | { tipo: 'porta_negada'; id: string; exige: NivelCartao | null }
  | { tipo: 'pickup'; indice: number }
  | { tipo: 'arma_trocada'; arma: ArmaId }
  | { tipo: 'sem_municao' }
  | { tipo: 'segredo'; id: string }
  | { tipo: 'documento'; id: string }
  | { tipo: 'terminal'; id: string }
  | { tipo: 'checkpoint' }
  | { tipo: 'gatilho'; id: string }
  | { tipo: 'mensagem'; texto: string }
  | { tipo: 'som'; id: string }
  | { tipo: 'alarme'; ligado: boolean }
  | { tipo: 'luz'; grupo: string; ligada: boolean }
  | { tipo: 'jogador_morto' }
  | { tipo: 'fase_concluida' };
