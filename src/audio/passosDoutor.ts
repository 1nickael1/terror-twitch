import type { World } from '../sim/world';
import type { PedidoSom } from './regras';

/** Cadência por distância real: sem passos em pausa, parado, morto ou num teleporte. */
export class PassosDoutor {
  private readonly anteriores = new Map<number, { x: number; z: number; percurso: number }>();
  private tempo = -1;
  atualizar(w: World): PedidoSom[] {
    if (w.t < this.tempo || w.estado !== 'jogando') this.anteriores.clear();
    this.tempo = w.t;
    if (w.estado !== 'jogando') return [];
    const sons: PedidoSom[] = [];
    const vivos = new Set<number>();
    for (const i of w.inimigos) {
      if (i.tipo !== 'funcionario' || i.modo === 'morto') continue;
      vivos.add(i.id);
      const a = this.anteriores.get(i.id);
      if (!a) { this.anteriores.set(i.id, { ...i.pos, percurso: 0 }); continue; }
      const d = Math.hypot(i.pos.x - a.x, i.pos.z - a.z);
      a.x = i.pos.x; a.z = i.pos.z;
      if (d > 2 || ['ataque', 'dor', 'dormindo'].includes(i.modo)) { a.percurso = 0; continue; }
      a.percurso += d;
      const passo = i.modo === 'perseguicao' ? 1.3 : .75;
      if (a.percurso < passo) continue;
      a.percurso %= passo;
      sons.push({ som: 'doutorPasso', pos: { ...i.pos }, y: i.y + .08 });
    }
    for (const id of this.anteriores.keys()) if (!vivos.has(id)) this.anteriores.delete(id);
    return sons;
  }
}
