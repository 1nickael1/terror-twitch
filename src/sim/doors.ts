// Portas (abrir, fechar, trancar, cartões) e o botão de usar. Lógica pura.
import { PORTA } from './balance';
import type { SimEvent } from './eventos';
import { centro, coordDe, type Solido, type Vec2 } from './grid';
import { resolverOnde } from './onde';
import { celulaFechada } from './perigos';
import { frente } from './player';
import type { Porta, World } from './world';

/** Metade do cone de uso (60°): o alvo precisa estar até aqui da direção do olhar. */
const MEIO_CONE_USO = Math.PI / 3;

/** A porta ocupa a célula enquanto não abriu o bastante para passar; perigo ativo fecha as células da área. */
export function solidoDe(w: World): Solido {
  return (col, row) => w.portas.some((p) => p.coord[0] === col && p.coord[1] === row && p.abertura < PORTA.livreEm)
    || celulaFechada(w, col, row);
}

/** Jogador ou inimigo vivo na célula da porta. */
function alguemNoVao(w: World, p: Porta): boolean {
  const naCelula = (pos: Vec2) => {
    const [col, row] = coordDe(pos);
    return col === p.coord[0] && row === p.coord[1];
  };
  return naCelula(w.jogador.pos) || w.inimigos.some((i) => i.modo !== 'morto' && naCelula(i.pos));
}

function mudar(p: Porta, estado: Porta['estado']): SimEvent[] {
  p.estado = estado;
  return [{ tipo: 'porta', id: p.id, estado }];
}

function portaPorId(w: World, id: string): Porta {
  const p = w.portas.find((q) => q.id === id);
  if (!p) throw new Error(`Porta "${id}" não existe na fase`);
  return p;
}

/**
 * Comando de gatilho. `abrir` abre mesmo trancada; `fechar` não se perde com o vão ocupado
 * (a porta fica `fechando` e `avancarPortas` espera o vão livre);
 * `trancar` fecha e tranca ao terminar de fechar; `destrancar` só tira a tranca.
 */
export function comandarPorta(w: World, id: string, estado: 'abrir' | 'fechar' | 'trancar' | 'destrancar'): SimEvent[] {
  const p = portaPorId(w, id);
  switch (estado) {
    case 'abrir':
      p.trancarAoFechar = false;
      return p.estado === 'aberta' || p.estado === 'abrindo' ? [] : mudar(p, 'abrindo');
    case 'fechar':
      if (p.estado !== 'aberta' && p.estado !== 'abrindo') return [];
      return mudar(p, 'fechando');
    case 'trancar':
      if (p.estado === 'fechada') return mudar(p, 'trancada');
      if (p.estado === 'trancada') return [];
      p.trancarAoFechar = true;
      return p.estado === 'fechando' ? [] : mudar(p, 'fechando');
    case 'destrancar':
      p.trancarAoFechar = false;
      return p.estado === 'trancada' ? mudar(p, 'fechada') : [];
  }
}

/** Porta à frente do jogador apertando usar. */
function usarPorta(w: World, p: Porta): SimEvent[] {
  switch (p.estado) {
    case 'fechada':
      return mudar(p, 'abrindo');
    case 'aberta':
      return alguemNoVao(w, p) ? [] : mudar(p, 'fechando');
    case 'trancada':
      if (p.exige !== null && w.jogador.cartoes.some((c) => c >= p.exige!)) return mudar(p, 'abrindo');
      return [{ tipo: 'porta_negada', id: p.id, exige: p.exige }];
    case 'abrindo':
    case 'fechando':
      return [];
  }
}

/** O alvo está a até `alcanceUso` e dentro do cone de 60° do olhar. Em cima do alvo, vale. */
function aoAlcance(w: World, alvo: Vec2): boolean {
  const j = w.jogador;
  const dx = alvo.x - j.pos.x;
  const dz = alvo.z - j.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > PORTA.alcanceUso) return false;
  if (d < 1e-6) return true;
  const f = frente(j.yaw);
  return (f.x * dx + f.z * dz) / d >= Math.cos(MEIO_CONE_USO) - 1e-9;
}

/** O mais próximo dos candidatos ao alcance, ou nada. */
function maisProximo<T>(w: World, itens: readonly T[], pos: (t: T) => Vec2): T | null {
  let melhor: T | null = null;
  let melhorD = Infinity;
  for (const t of itens) {
    const p = pos(t);
    if (!aoAlcance(w, p)) continue;
    const d = Math.hypot(p.x - w.jogador.pos.x, p.z - w.jogador.pos.z);
    if (d < melhorD) {
      melhor = t;
      melhorD = d;
    }
  }
  return melhor;
}

/** Botão de usar: procura porta, depois terminal, depois documento. Sem alvo, nada. */
export function usar(w: World): SimEvent[] {
  const porta = maisProximo(w, w.portas, (p) => centro(p.coord));
  if (porta) return usarPorta(w, porta);
  const terminal = maisProximo(w, w.fase.terminais, (t) => centro(resolverOnde(w.grid, t.em)));
  if (terminal) return [{ tipo: 'terminal', id: terminal.id }];
  const documento = maisProximo(w, w.fase.documentos, (d) => centro(resolverOnde(w.grid, d.em)));
  if (documento) return [{ tipo: 'documento', id: documento.id }];
  return [];
}

/**
 * Move a abertura de 0 a 1 em `PORTA.tempo`. Emite `ruido` ao começar a abrir ou fechar e `porta`
 * ao terminar. Fechando com alguém no vão, a porta espera.
 */
export function avancarPortas(w: World, dt: number): SimEvent[] {
  const ev: SimEvent[] = [];
  const passo = dt / PORTA.tempo;
  for (const p of w.portas) {
    if (p.estado === 'abrindo') {
      if (p.abertura === 0) ev.push({ tipo: 'ruido', pos: centro(p.coord), raio: PORTA.ruido });
      p.abertura = Math.min(1, p.abertura + passo);
      if (p.abertura === 1) ev.push(...mudar(p, 'aberta'));
    } else if (p.estado === 'fechando') {
      if (alguemNoVao(w, p)) continue;
      if (p.abertura === 1) ev.push({ tipo: 'ruido', pos: centro(p.coord), raio: PORTA.ruido });
      p.abertura = Math.max(0, p.abertura - passo);
      if (p.abertura === 0) {
        ev.push(...mudar(p, p.trancarAoFechar ? 'trancada' : 'fechada'));
        p.trancarAoFechar = false;
      }
    }
  }
  return ev;
}
