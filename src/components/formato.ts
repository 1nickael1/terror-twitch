// Textos e contas puras da interface: tempo mm:ss, nome de pickup, mensagem do HUD a partir de um
// evento da simulação, o lado de onde veio o dano e a barra de vida do chefe.
import { tipoDe } from '../sim/ai/tipos';
import { ARMAS } from '../sim/balance';
import type { SimEvent } from '../sim/eventos';
import type { PickupDef, TipoMunicao } from '../sim/fase';
import type { Vec2 } from '../sim/grid';
import type { World } from '../sim/world';

export type LadoDano = 'frente' | 'tras' | 'esquerda' | 'direita';

const dois = (n: number) => String(n).padStart(2, '0');

/** Segundos em `mm:ss` (minutos sem limite, segundos truncados). */
export function formatarTempo(segundos: number): string {
  const s = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  return `${dois(Math.floor(s / 60))}:${dois(s % 60)}`;
}

const NOME_MUNICAO: Record<TipoMunicao, string> = {
  balas: 'Balas', cartuchos: 'Cartuchos', leves: 'Munição leve', capsulas: 'Cápsulas de agente',
};

export function nomeDoPickup(d: PickupDef): string {
  switch (d.tipo) {
    case 'vida_p': return 'Kit médico pequeno';
    case 'vida_g': return 'Kit médico';
    case 'colete_p': return 'Placa de colete';
    case 'colete_g': return 'Colete balístico';
    case 'arma': return d.arma ? ARMAS[d.arma].nome : 'Arma';
    case 'cartao': return `Cartão de acesso nível ${d.nivel ?? 1}`;
    case 'municao': {
      const nome = d.municao ? NOME_MUNICAO[d.municao] : 'Munição';
      return d.quantidade ? `${nome} (${d.quantidade})` : nome;
    }
  }
}

/** Mensagem temporária do HUD para o evento, ou `null` se ele não mostra nada. */
export function textoDoEvento(e: SimEvent, pickups: readonly PickupDef[]): string | null {
  switch (e.tipo) {
    case 'mensagem': return e.texto;
    case 'porta_negada': return e.exige === null ? 'Trancada' : `Acesso negado: cartão nível ${e.exige}`;
    case 'pickup': {
      const d = pickups[e.indice];
      return d ? nomeDoPickup(d) : null;
    }
    case 'segredo': return 'Segredo encontrado';
    case 'checkpoint': return 'Checkpoint';
    default: return null;
  }
}

/** De que lado (relativo ao olhar) veio o golpe; `null` se a origem coincide com o jogador. */
export function ladoDoDano(pos: Vec2, yaw: number, de: Vec2): LadoDano | null {
  const dx = de.x - pos.x;
  const dz = de.z - pos.z;
  if (Math.hypot(dx, dz) < 1e-6) return null;
  // convenções da simulação: frente = (-sin yaw, -cos yaw), direita = (cos yaw, -sin yaw)
  const f = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
  const r = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  if (Math.abs(f) >= Math.abs(r)) return f >= 0 ? 'frente' : 'tras';
  return r >= 0 ? 'direita' : 'esquerda';
}

export interface BarraChefe { nome: string; vida: number }

/**
 * Barra de vida do chefe: só com o chefe acordado (nem inerte nem morto, nem o `Inimigo` dele morto). `vida` em 0..1,
 * arredondada a 1% (o snapshot do HUD só muda quando o valor exibido muda).
 */
export function barraDoChefe(w: World): BarraChefe | null {
  const c = w.chefe;
  const def = w.fase.chefe;
  if (!c || !def || c.fase === 'inerte' || c.fase === 'morto') return null;
  const i = w.inimigos.find((x) => x.id === c.inimigoId);
  // o `Inimigo` morre um passo antes de a fase do chefe virar `morto`: sem barra a 0%
  if (!i || i.modo === 'morto') return null;
  const fracao = Math.max(0, Math.min(1, i.vida / tipoDe(i.tipo).vida));
  return { nome: def.nome, vida: Math.round(fracao * 100) / 100 };
}
