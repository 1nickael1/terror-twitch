// Portas (abrir, fechar, trancar, cartões) e o botão de usar. Lógica pura.
import { PORTA } from './balance';
import type { SimEvent } from './eventos';
import type { DocumentoDef, NivelCartao, TerminalDef } from './fase';
import { centro, coordDe, type Solido, type Vec2 } from './grid';
import { resolverOnde } from './onde';
import { celulaFechada, perigoDoTerminal } from './perigos';
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

/** A porta exige cartão e o jogador tem um do nível ou acima. */
function temCartao(w: World, p: Porta): boolean {
  return p.exige !== null && w.jogador.cartoes.some((c) => c >= p.exige!);
}

/** Porta à frente do jogador apertando usar. */
function usarPorta(w: World, p: Porta): SimEvent[] {
  switch (p.estado) {
    case 'fechada':
      return mudar(p, 'abrindo');
    case 'aberta':
      return alguemNoVao(w, p) ? [] : mudar(p, 'fechando');
    case 'trancada':
      if (temCartao(w, p)) return mudar(p, 'abrindo');
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

type Escolha =
  | { tipo: 'porta'; porta: Porta }
  | { tipo: 'terminal'; terminal: TerminalDef }
  | { tipo: 'documento'; documento: DocumentoDef };

/** O alvo do botão de usar: porta, depois terminal, depois documento (o mais próximo de cada, ao alcance). */
function escolherAlvo(w: World): Escolha | null {
  const porta = maisProximo(w, w.portas, (p) => centro(p.coord));
  if (porta) return { tipo: 'porta', porta };
  const terminal = maisProximo(w, w.fase.terminais, (t) => centro(resolverOnde(w.grid, t.em)));
  if (terminal) return { tipo: 'terminal', terminal };
  const documento = maisProximo(w, w.fase.documentos, (d) => centro(resolverOnde(w.grid, d.em)));
  if (documento) return { tipo: 'documento', documento };
  return null;
}

/** Botão de usar: procura porta, depois terminal, depois documento. Sem alvo, nada. */
export function usar(w: World): SimEvent[] {
  const alvo = escolherAlvo(w);
  if (!alvo) return [];
  switch (alvo.tipo) {
    case 'porta': return usarPorta(w, alvo.porta);
    case 'terminal': return [{ tipo: 'terminal', id: alvo.terminal.id }];
    case 'documento': return [{ tipo: 'documento', id: alvo.documento.id }];
  }
}

/** O que o botão de usar acionaria agora (para a dica do HUD). Não muda nada no mundo. */
export type AlvoDeUso =
  /** `vaoOcupado`: alguém na célula da porta (aberta, o botão não fecha) */
  | { tipo: 'porta'; id: string; estado: Porta['estado']; exige: NivelCartao | null; temCartao: boolean; vaoOcupado: boolean }
  | { tipo: 'terminal'; id: string; rotulo: string; perigo: { id: string; pronto: boolean; recarga: number } | null }
  | { tipo: 'documento'; id: string; titulo: string };

export function alvoDeUso(w: World): AlvoDeUso | null {
  const alvo = escolherAlvo(w);
  if (!alvo) return null;
  switch (alvo.tipo) {
    case 'porta': {
      const p = alvo.porta;
      return {
        tipo: 'porta', id: p.id, estado: p.estado, exige: p.exige, temCartao: temCartao(w, p), vaoOcupado: alguemNoVao(w, p),
      };
    }
    case 'terminal': {
      const t = alvo.terminal;
      const idPerigo = perigoDoTerminal(w.fase, t.id);
      const e = idPerigo === null ? undefined : w.perigos.find((x) => x.id === idPerigo);
      return {
        tipo: 'terminal', id: t.id, rotulo: t.rotulo,
        perigo: e ? { id: e.id, pronto: e.recarga <= 0, recarga: e.recarga } : null,
      };
    }
    case 'documento':
      return { tipo: 'documento', id: alvo.documento.id, titulo: alvo.documento.titulo };
  }
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
