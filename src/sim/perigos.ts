// Perigos de cenário do chefe: comportas (fecham células e ferem uma vez) e perigos de área
// (ultravioleta, vapor: aviso, depois dano por segundo, sem bloquear). Lógica pura.
import { confirmarMorteChefe } from './ai/chefeComum';
import { desgastarJogador, ferirJogador } from './ai/comum';
import { tipoDe } from './ai/tipos';
import { PERIGO_AREA } from './balance';
import type { SimEvent } from './eventos';
import type { Area, LevelDef, PerigoArea, PerigoComporta, PerigoDef } from './fase';
import { celulaNaArea, centro, naArea, type Vec2 } from './grid';
import { desgastarInimigo, ferirInimigo } from './weapons';
import type { EstadoPerigo, World } from './world';

/** Folga para somas de `dt` (60 × 1/60 não dá 1 exato). */
const EPS = 1e-9;

/** Recusa em recarga, por tipo de perigo. */
const RECARREGANDO: Record<PerigoDef['tipo'], string> = {
  comporta: 'Comporta recarregando.',
  ultravioleta: 'Esterilização recarregando.',
  vapor: 'Válvula de vapor recarregando.',
};

/** Centro da área (origem do dano no jogador). */
function meio(area: Area): Vec2 {
  const [c0, r0, larg, alt] = area;
  return centro([c0 + (larg - 1) / 2, r0 + (alt - 1) / 2]);
}

function defDe(w: World, id: string): PerigoDef {
  const d = w.fase.chefe?.perigos.find((p) => p.id === id);
  if (!d) throw new Error(`Perigo "${id}" não existe na fase`);
  return d;
}

function estadoDe(w: World, id: string): EstadoPerigo {
  const e = w.perigos.find((p) => p.id === id);
  if (!e) throw new Error(`Perigo "${id}" não existe no mundo`);
  return e;
}

/**
 * Ação `perigo`: em recarga, só avisa (evento `recarregando` e mensagem do tipo). Comporta: fecha
 * (`ativo = duracao`, `recarga = recarga`) e, uma vez, fere quem está no vão: o chefe perde
 * `danoChefe × vidaMax`, inimigos comuns vivos e o jogador levam `danoComum`. Perigo de área:
 * `aviso = def.aviso`, `recarga = def.recarga`, evento `aviso` (o dano vem em `avancarPerigos`).
 */
export function acionarPerigo(w: World, id: string): SimEvent[] {
  const d = defDe(w, id);
  const e = estadoDe(w, id);
  if (e.recarga > 0) {
    return [{ tipo: 'perigo', id, estado: 'recarregando' }, { tipo: 'mensagem', texto: RECARREGANDO[d.tipo] }];
  }
  if (d.tipo !== 'comporta') {
    e.recarga = d.recarga;
    e.aviso = d.aviso;
    if (d.aviso > 0) return [{ tipo: 'perigo', id, estado: 'aviso' }];
    return [{ tipo: 'perigo', id, estado: 'aviso' }, ...ligar(e, d)];   // sem aviso: liga já
  }
  return fecharComporta(w, d, e);
}

function fecharComporta(w: World, d: PerigoComporta, e: EstadoPerigo): SimEvent[] {
  e.ativo = d.duracao;
  e.recarga = d.recarga;
  const eventos: SimEvent[] = [{ tipo: 'perigo', id: d.id, estado: 'fecha' }];
  for (const i of w.inimigos) {
    if (i.modo === 'morto' || !naArea(i.pos, d.area)) continue;
    const chefe = w.chefe?.inimigoId === i.id;
    eventos.push(...ferirInimigo(w, i, chefe ? d.danoChefe * tipoDe(i.tipo).vida : d.danoComum));
  }
  eventos.push(...confirmarMorteChefe(w));   // morto pela comporta: fase `morto` já neste passo
  if (naArea(w.jogador.pos, d.area)) eventos.push(...ferirJogador(w, d.danoComum, meio(d.area)));
  return eventos;
}

function ligar(e: EstadoPerigo, d: PerigoArea): SimEvent[] {
  e.aviso = 0;
  e.ativo = d.duracao;
  e.danoPulso = 0;
  e.jogadorNaArea = false;
  return [{ tipo: 'perigo', id: d.id, estado: 'liga' }];
}

/**
 * Um passo de perigo de área ligado, `t` segundos de dano: o chefe perde `danoChefePorSeg × vidaMax × t`,
 * inimigos vivos e o jogador `danoPorSeg × t` (jogador pelo colete, sem empurrão). Morte do chefe
 * confirma no mesmo passo. `dano_jogador` no 1º passo, no passo que fecha cada pulso de `PERIGO_AREA.pulsoDano` s
 * e no passo em que o jogador volta a ser ferido depois de não estar (entrou na área ligada; C3.2).
 */
function ferirNaArea(w: World, d: PerigoArea, e: EstadoPerigo, t: number): SimEvent[] {
  const eventos: SimEvent[] = [];
  for (const i of w.inimigos) {
    if (i.modo === 'morto' || !naArea(i.pos, d.area)) continue;
    const chefe = w.chefe?.inimigoId === i.id;
    eventos.push(...desgastarInimigo(w, i, (chefe ? d.danoChefePorSeg * tipoDe(i.tipo).vida : d.danoPorSeg) * t));
  }
  eventos.push(...confirmarMorteChefe(w));
  const dentro = naArea(w.jogador.pos, d.area);
  const entrou = dentro && !e.jogadorNaArea;
  e.jogadorNaArea = dentro;
  if (dentro) {
    const decorrido = d.duracao - e.ativo;   // antes deste passo
    const pulso = PERIGO_AREA.pulsoDano;
    // pulso no 1º passo, ao entrar e no passo que fecha cada `pulso` s; `quantia` = o acumulado desde o pulso anterior
    const fecha = Math.floor((decorrido + EPS) / pulso) !== Math.floor((decorrido + t + EPS) / pulso);
    const avisar = fecha || entrou || decorrido < EPS;
    const dano = d.danoPorSeg * t;
    e.danoPulso += dano;
    eventos.push(...desgastarJogador(w, dano, meio(d.area), avisar, e.danoPulso));
    if (avisar || w.estado !== 'jogando') e.danoPulso = 0;
  }
  return eventos;
}

/**
 * Conta `recarga`, `aviso` e `ativo`. Comporta: ao fim do `ativo`, abre (evento `abre`). Perigo de
 * área: ligado, fere neste passo e desconta; ao fim, `desliga`; o `aviso` chegando a 0 liga
 * (`ativo = duracao`, evento `liga`; o dano começa no passo seguinte).
 */
export function avancarPerigos(w: World, dt: number): SimEvent[] {
  const eventos: SimEvent[] = [];
  for (const e of w.perigos) {
    e.recarga = Math.max(0, e.recarga - dt);
    const d = defDe(w, e.id);
    if (d.tipo === 'comporta') {
      if (e.ativo <= 0) continue;
      e.ativo = Math.max(0, e.ativo - dt);
      if (e.ativo === 0) eventos.push({ tipo: 'perigo', id: e.id, estado: 'abre' });
      continue;
    }
    if (e.ativo > 0) {
      eventos.push(...ferirNaArea(w, d, e, Math.min(dt, e.ativo)));
      e.ativo = e.ativo - dt <= EPS ? 0 : e.ativo - dt;
      if (e.ativo === 0) {
        e.jogadorNaArea = false;
        eventos.push({ tipo: 'perigo', id: e.id, estado: 'desliga' });
      }
    } else if (e.aviso > 0) {
      e.aviso = e.aviso - dt <= EPS ? 0 : e.aviso - dt;
      if (e.aviso === 0) eventos.push(...ligar(e, d));
    }
  }
  return eventos;
}

/** Perigo acionado pelo terminal (gatilho `terminal` com ação `perigo`), ou null. */
export function perigoDoTerminal(fase: LevelDef, terminalId: string): string | null {
  for (const g of fase.gatilhos) {
    if (g.quando.tipo !== 'terminal' || g.quando.id !== terminalId) continue;
    for (const a of g.faz) if (a.acao === 'perigo') return a.id;
  }
  return null;
}

/** A célula está fechada por uma comporta ativa (perigos de área não bloqueiam). */
export function celulaFechada(w: World, col: number, row: number): boolean {
  for (const e of w.perigos) {
    if (e.ativo <= 0) continue;
    const d = defDe(w, e.id);
    if (d.tipo !== 'comporta') continue;
    if (celulaNaArea(col, row, d.area)) return true;
  }
  return false;
}
