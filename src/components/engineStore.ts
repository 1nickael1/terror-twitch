// Ponte entre a engine e o `Game` (imperativos) e o React (useSyncExternalStore). O snapshot só é
// trocado quando um campo exibido muda; nada por quadro passa pelo React além disso.
import { Engine, type EngineEvent } from '../engine/Engine';
import { Game } from '../engine/Game';
import type { VisualStyle } from '../looks/types';
import { carregarOpcoes, OPCOES_PADRAO, salvarOpcoes, sanear, type Armazenamento, type Opcoes } from '../save/opcoes';
import type { Progresso } from '../save/progresso';
import { ARMAS } from '../sim/balance';
import type { ArmaId, DocumentoDef, NivelCartao } from '../sim/fase';
import type { Comando, Tela } from '../sim/tela';
import type { Stats } from '../sim/world';
import { ladoDoDano, textoDoEvento, type LadoDano } from './formato';

/** a mensagem temporária do HUD some depois disto */
const MENSAGEM_MS = 4000;
/** a gravação das opções espera os sliders pararem por este tempo */
const GRAVAR_OPCOES_MS = 300;

export interface HudSnapshot {
  pronto: boolean; erro: string | null; tela: Tela; fase: number; nomeFase: string; travado: boolean;
  vida: number; colete: number; arma: ArmaId; municao: number; armas: ArmaId[]; cartoes: NivelCartao[];
  mensagem: string | null; documento: DocumentoDef | null;
  /** instante (performance.now) do último dano; 0 = nenhum */
  danoEm: number; danoLado: LadoDano | null;
  stats: Stats | null; totais: { inimigos: number; segredos: number; documentos: number } | null;
  opcoes: Opcoes; progresso: Progresso; filtro: string;
  /** o navegador recusou a trava pedida pelo "Continuar" (aviso na pausa) */
  travaRecusada: boolean;
}

const INICIAL: HudSnapshot = Object.freeze({
  pronto: false, erro: null, tela: 'titulo', fase: 0, nomeFase: '', travado: false,
  vida: 0, colete: 0, arma: 'pistola', municao: 0, armas: [], cartoes: [],
  mensagem: null, documento: null, danoEm: 0, danoLado: null,
  stats: null, totais: null,
  opcoes: OPCOES_PADRAO, progresso: { desbloqueadas: 1, melhorTempo: {} }, filtro: OPCOES_PADRAO.filtro,
  travaRecusada: false,
}) as HudSnapshot;

/** Armazenamento em memória: vale só nesta aba (localStorage bloqueado ou indisponível). */
class ArmazenamentoEmMemoria implements Armazenamento {
  private readonly m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void { this.m.set(k, v); }
}

/** localStorage, se o navegador deixar (modo privado ou bloqueio de cookies podem lançar). */
function armazenamentoDoNavegador(): Armazenamento {
  try {
    const ls = window.localStorage;
    const teste = 'scp-terror:teste';
    ls.setItem(teste, '1');
    ls.removeItem(teste);
    return ls;
  } catch {
    return new ArmazenamentoEmMemoria();
  }
}

function mesmaLista<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export class EngineStore {
  private engine: Engine | null = null;
  private game: Game | null = null;
  private off: (() => void) | null = null;
  private armazenamento: Armazenamento | null = null;
  private snap: HudSnapshot = INICIAL;
  private mensagemEm = 0;
  private timerOpcoes: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly styles: readonly VisualStyle[]) {}

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = (): HudSnapshot => this.snap;

  getServerSnapshot = (): HudSnapshot => INICIAL;

  attach(canvas: HTMLCanvasElement): void {
    this.detach();
    const a = armazenamentoDoNavegador();
    this.armazenamento = a;
    const opcoes = carregarOpcoes(a, this.styles.map((s) => s.id));
    // recarregar a página logo depois de mexer num slider não perde a opção
    window.addEventListener('pagehide', this.onPagehide);
    let engine: Engine | null = null;
    try {
      engine = new Engine(canvas, this.styles, opcoes);
      this.off = engine.on(this.onEvent);
      this.engine = engine;
      this.game = new Game(engine, a, () => this.lerGame());
      engine.start();
      this.set({ pronto: true, erro: null, opcoes, filtro: engine.filtro, mensagem: null });
      this.lerGame();
      this.lerWorld();
    } catch (err) {
      this.off?.();
      this.off = null;
      engine?.dispose();
      this.engine = null;
      this.game = null;
      this.set({ pronto: false, erro: err instanceof Error ? err.message : String(err) });
    }
  }

  detach(): void {
    this.gravarOpcoesPendentes();
    window.removeEventListener('pagehide', this.onPagehide);
    this.game?.dispose();
    this.game = null;
    this.off?.();
    this.off = null;
    this.engine?.dispose();
    this.engine = null;
    if (this.snap.pronto) this.set({ pronto: false, travado: false });
  }

  comando(cmd: Comando): void {
    this.game?.comando(cmd);
  }

  /** Esc no leitor de documento: fecha para a pausa, sem pedir a trava. */
  fecharDocumentoParaPausa(): void {
    this.game?.fecharDocumentoParaPausa();
  }

  /** Muda opções com efeito imediato; a gravação no armazenamento é agrupada (300 ms). */
  definirOpcoes(p: Partial<Opcoes>): void {
    const o = sanear({ ...this.snap.opcoes, ...p }, this.styles.map((s) => s.id));
    this.engine?.aplicarOpcoes(o);
    this.set({ opcoes: o });
    if (this.timerOpcoes !== null) clearTimeout(this.timerOpcoes);
    this.timerOpcoes = setTimeout(() => this.gravarOpcoesPendentes(), GRAVAR_OPCOES_MS);
  }

  private onPagehide = (): void => this.gravarOpcoesPendentes();

  private gravarOpcoesPendentes(): void {
    if (this.timerOpcoes === null) return;
    clearTimeout(this.timerOpcoes);
    this.timerOpcoes = null;
    if (this.armazenamento) salvarOpcoes(this.armazenamento, this.snap.opcoes);
  }

  private onEvent = (ev: EngineEvent): void => {
    if (ev.type === 'travado') this.set({ travado: ev.travado });
    else if (ev.type === 'filtro') this.set({ filtro: ev.id });
    else if (ev.type === 'fase') this.set({ mensagem: null, danoEm: 0, danoLado: null });
    else if (ev.type === 'eventos') this.lerEventos(ev.eventos);
    else if (ev.type === 'quadro') {
      if (this.snap.mensagem !== null && performance.now() - this.mensagemEm > MENSAGEM_MS) this.set({ mensagem: null });
      this.lerWorld();
    }
  };

  private lerEventos(eventos: Extract<EngineEvent, { type: 'eventos' }>['eventos']): void {
    const w = this.engine?.world;
    if (!w) return;
    for (const e of eventos) {
      const texto = textoDoEvento(e, w.fase.pickups);
      if (texto !== null) {
        this.mensagemEm = performance.now();
        this.set({ mensagem: texto });
      }
      if (e.tipo === 'dano_jogador') {
        this.set({ danoEm: performance.now(), danoLado: ladoDoDano(w.jogador.pos, w.jogador.yaw, e.de) });
      }
    }
  }

  private lerGame(): void {
    const g = this.game;
    if (!g) return;
    const r = g.resultado;
    this.set({
      tela: g.estado.tela, fase: g.estado.fase, documento: g.documento, progresso: g.progresso,
      stats: r?.stats ?? null, totais: r?.totais ?? null, travaRecusada: g.travaRecusada,
    });
  }

  private lerWorld(): void {
    const w = this.engine?.world;
    if (!w) return;
    const j = w.jogador;
    const s = this.snap;
    this.set({
      nomeFase: w.fase.nome,
      vida: Math.max(0, Math.ceil(j.vida)), colete: Math.max(0, Math.ceil(j.colete)), arma: j.arma,
      municao: j.municao[ARMAS[j.arma].municao],
      // mesma referência enquanto o conteúdo não muda (o `set` compara por ===)
      armas: mesmaLista(s.armas, j.armas) ? s.armas : [...j.armas],
      cartoes: mesmaLista(s.cartoes, j.cartoes) ? s.cartoes : [...j.cartoes],
    });
  }

  /** Só troca o snapshot (e avisa o React) quando algum campo mudou. */
  private set(p: Partial<HudSnapshot>): void {
    const k = Object.keys(p) as (keyof HudSnapshot)[];
    if (k.every((c) => this.snap[c] === p[c])) return;
    this.snap = { ...this.snap, ...p };
    for (const l of this.listeners) l();
  }
}
