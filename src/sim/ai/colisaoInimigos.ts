import { solidoDe } from '../doors';
import { alturaPiso, DEGRAU, moverComColisao, SALTO, type Vec2 } from '../grid';
import type { Inimigo, World } from '../world';
import { alturaCorpo, tipoDe } from './tipos';

const FOLGA = .005;
const PASSO = .15;
const vivo = (i: Inimigo) => i.modo !== 'morto' && i.vida > 0;
function mesmaAltura(a: Inimigo, ya: number, b: Inimigo): boolean {
  return ya < b.y + alturaCorpo(b) - .01 && b.y < ya + alturaCorpo(a) - .01;
}

/** Limita todo o segmento do eixo: nem um passo grande atravessa outro corpo. */
function limitar(w: World, i: Inimigo, pos: Vec2, destino: Vec2, eixo: 'x' | 'z'): Vec2 {
  const lateral = eixo === 'x' ? 'z' : 'x';
  let fim = destino[eixo];
  const inicio = pos[eixo], y = alturaPiso(w.grid, destino);
  for (const outro of w.inimigos) {
    if (outro === i || !vivo(outro) || !mesmaAltura(i, y, outro)) continue;
    const raio = tipoDe(i.tipo).raio + tipoDe(outro.tipo).raio + FOLGA;
    const d = pos[lateral] - outro.pos[lateral];
    if (Math.abs(d) >= raio) continue;
    const alcance = Math.sqrt(Math.max(0, raio * raio - d * d));
    const min = outro.pos[eixo] - alcance, max = outro.pos[eixo] + alcance;
    if (inicio <= min) { if (fim > min) fim = min; }
    else if (inicio >= max) { if (fim < max) fim = max; }
    else if ((fim - inicio) * (inicio - outro.pos[eixo]) < 0) fim = inicio;
  }
  return { ...pos, [eixo]: fim };
}

/** Movimento comum e investidas usam o mesmo espaço físico, com deslizamento eixo a eixo. */
export function moverEntreInimigos(w: World, i: Inimigo, dx: number, dz: number): Vec2 {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / PASSO));
  const raio = tipoDe(i.tipo).raio, solido = solidoDe(w);
  let pos = { ...i.pos }, y = i.y;
  for (let k = 0; k < n; k++) {
    const x = moverComColisao(w.grid, pos, y, dx / n, 0, raio, DEGRAU, solido);
    pos = limitar(w, i, pos, x, 'x'); y = alturaPiso(w.grid, pos);
    const z = moverComColisao(w.grid, pos, y, 0, dz / n, raio, DEGRAU, solido);
    pos = limitar(w, i, pos, z, 'z'); y = alturaPiso(w.grid, pos);
  }
  return pos;
}

/** Corrige nascimento, checkpoint ou reanimação sobrepostos, sem atravessar paredes/portas. */
export function separarInimigos(w: World): void {
  const solido = solidoDe(w);
  const empurrar = (i: Inimigo, dx: number, dz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / PASSO));
    for (let k = 0; k < n; k++) {
      const pos = moverComColisao(w.grid, i.pos, i.y, dx / n, dz / n, tipoDe(i.tipo).raio, DEGRAU, solido);
      const y = alturaPiso(w.grid, pos);
      if (i.y - y > SALTO) break;
      i.pos = pos; i.y = y;
    }
  };
  for (let rodada = 0; rodada < 48; rodada++) {
    let sobrepostos = false;
    for (let a = 0; a < w.inimigos.length; a++) {
      const i = w.inimigos[a]; if (!vivo(i)) continue;
      for (let b = a + 1; b < w.inimigos.length; b++) {
        const j = w.inimigos[b]; if (!vivo(j) || !mesmaAltura(i, i.y, j)) continue;
        const dx = i.pos.x - j.pos.x, dz = i.pos.z - j.pos.z, d = Math.hypot(dx, dz);
        const raio = tipoDe(i.tipo).raio + tipoDe(j.tipo).raio + FOLGA;
        if (d >= raio - .00001) continue;
        sobrepostos = true;
        // Empate determinístico, inclusive inimigos criados no mesmo ponto.
        const angulo = ((i.id * 31 + j.id * 17) % 8) * Math.PI / 4;
        const nx = d > .000001 ? dx / d : Math.cos(angulo), nz = d > .000001 ? dz / d : Math.sin(angulo);
        const falta = raio - d;
        empurrar(i, nx * falta / 2, nz * falta / 2);
        empurrar(j, -nx * falta / 2, -nz * falta / 2);
        let resta = raio - Math.hypot(i.pos.x - j.pos.x, i.pos.z - j.pos.z);
        if (resta > .00001) {
          empurrar(i, nx * resta, nz * resta);
          resta = raio - Math.hypot(i.pos.x - j.pos.x, i.pos.z - j.pos.z);
          if (resta > .00001) empurrar(j, -nx * resta, -nz * resta);
        }
      }
    }
    if (!sobrepostos) break;
  }
}
