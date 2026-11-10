// Orquestração das telas: guarda o `EstadoTela`, aplica `transicao` (pura) e executa os efeitos na
// engine (carregar fase, pausar, trava do ponteiro, renascer, gravar progresso). Sem React.
import { FASES } from '../levels/indice';
import type { Armazenamento } from '../save/opcoes';
import { carregarProgresso, registrarConclusao, salvarProgresso, type Progresso } from '../save/progresso';
import type { DocumentoDef } from '../sim/fase';
import { transicao, type Comando, type EstadoTela } from '../sim/tela';
import type { Stats } from '../sim/world';
import type { Engine, EngineEvent } from './Engine';

/** segundos de relógio real entre morrer e voltar ao checkpoint */
const ESPERA_MORTE_MS = 2000;
/** sem a trava do ponteiro depois deste tempo (negada), o jogo volta à pausa em vez de travar */
const ESPERA_TRAVA_MS = 1500;
/** telas em que a arma em primeira pessoa aparece */
const TELAS_COM_ARMA: ReadonlySet<EstadoTela['tela']> = new Set(['jogando', 'pausa', 'documento', 'morte']);

export interface ResultadoFase {
  stats: Stats;
  totais: { inimigos: number; segredos: number; documentos: number };
}

export class Game {
  private _estado: EstadoTela = { tela: 'titulo', fase: 0 };
  private _documento: DocumentoDef | null = null;
  private _resultado: ResultadoFase | null = null;
  private _progresso: Progresso;
  private timerMorte: ReturnType<typeof setTimeout> | null = null;
  /** instante (performance.now) em que, ainda sem trava, o jogo volta à pausa */
  private esperaTravaAte = Infinity;
  /** a trava pedida ao retomar da pausa ainda não chegou */
  private retomandoDaPausa = false;
  private _travaRecusada = false;
  private readonly off: () => void;

  constructor(
    private readonly engine: Engine,
    private readonly armazenamento: Armazenamento,
    /** chamado depois de cada mudança de tela (ou de documento, resultado, progresso) */
    private readonly aoMudar: () => void,
  ) {
    this._progresso = carregarProgresso(armazenamento, FASES.length);
    this.off = engine.on(this.onEngine);
    document.addEventListener('pointerlockerror', this.onErroTrava);
    this.mostrarFundoDoTitulo();
  }

  get estado(): EstadoTela { return this._estado; }
  get documento(): DocumentoDef | null { return this._documento; }
  get resultado(): ResultadoFase | null { return this._resultado; }
  get progresso(): Progresso { return this._progresso; }
  /** o navegador recusou a trava pedida pelo "Continuar" (a pausa mostra um aviso) */
  get travaRecusada(): boolean { return this._travaRecusada; }

  comando(cmd: Comando): void {
    const antes = this._estado;
    const depois = transicao(antes, cmd, FASES.length, this._progresso.desbloqueadas);
    if (depois === antes) return;
    this._estado = depois;
    this.efeitos(antes, depois);
    this.aoMudar();
  }

  /**
   * Esc no leitor de documento: fecha direto para a pausa, sem pedir a trava (o navegador recusa a
   * trava pedida pela tecla Esc). E e o botão continuam com `fechar_documento`.
   */
  fecharDocumentoParaPausa(): void {
    const antes = this._estado;
    const fechado = transicao(antes, { c: 'fechar_documento' }, FASES.length, this._progresso.desbloqueadas);
    if (fechado === antes) return;
    const depois = transicao(fechado, { c: 'pausar' }, FASES.length, this._progresso.desbloqueadas);
    this._estado = depois;
    this.efeitos(antes, depois);
    this.aoMudar();
  }

  dispose(): void {
    this.limparTimer();
    this.off();
    document.removeEventListener('pointerlockerror', this.onErroTrava);
  }

  private efeitos(antes: EstadoTela, depois: EstadoTela): void {
    this.efeitosDaTela(antes, depois);
    this.engine.mostrarArma(TELAS_COM_ARMA.has(depois.tela));
  }

  private efeitosDaTela(antes: EstadoTela, depois: EstadoTela): void {
    const e = this.engine;
    if (depois.tela !== 'pausa') this._travaRecusada = false;
    if (depois.tela !== 'jogando') this.retomandoDaPausa = false;
    if (depois.tela === 'pausa') this._documento = null;
    switch (depois.tela) {
      case 'jogando':
        if (antes.tela === 'morte') {
          // a trava normalmente continua; se caiu durante a morte, a pausa vem no próximo quadro
          e.pausar(false);
          this.esperaTravaAte = performance.now();
          return;
        }
        // áudio e trava antes de carregar a fase: os dois precisam do gesto, que expira
        e.pausar(false);
        e.gesto();
        e.pedirTrava();
        this._documento = null;
        this.retomandoDaPausa = antes.tela === 'pausa';
        if (antes.tela === 'titulo' || antes.tela === 'fim_de_fase') {
          this._resultado = null;
          e.carregarFase(FASES[depois.fase]);
        }
        this.esperaTravaAte = performance.now() + ESPERA_TRAVA_MS;
        return;
      case 'pausa':
        e.pausar(true);
        e.soltarTrava();
        return;
      case 'documento':
      case 'final':
        e.pausar(true, true);
        e.soltarTrava();
        return;
      case 'morte':
        e.pausar(true, true);
        this.limparTimer();
        this.timerMorte = setTimeout(() => {
          this.timerMorte = null;
          e.renascer();
          this.comando({ c: 'renasceu' });
        }, ESPERA_MORTE_MS);
        return;
      case 'fim_de_fase':
        e.pausar(true, true);
        e.soltarTrava();
        this.concluirFase(depois.fase);
        return;
      case 'titulo':
        this.limparTimer();
        this._documento = null;
        this._resultado = null;
        e.soltarTrava();
        this.mostrarFundoDoTitulo();
        return;
    }
  }

  /** Fundo do título: a fase 0 carregada e parada, câmera no spawn. */
  private mostrarFundoDoTitulo(): void {
    this.engine.descarregarFase();
    this.engine.carregarFase(FASES[0]);
    this.engine.mostrarArma(false);
    this.engine.pausar(true);
  }

  private concluirFase(indice: number): void {
    const w = this.engine.world;
    if (!w) return;
    const s = w.stats;
    this._resultado = {
      stats: { ...s, segredos: [...s.segredos], documentos: [...s.documentos] },
      totais: { inimigos: s.totalInimigos, segredos: w.fase.segredos.length, documentos: w.fase.documentos.length },
    };
    this._progresso = registrarConclusao(this._progresso, indice, w.fase.id, s.tempo, FASES.length);
    salvarProgresso(this.armazenamento, this._progresso);
  }

  private limparTimer(): void {
    if (this.timerMorte !== null) clearTimeout(this.timerMorte);
    this.timerMorte = null;
  }

  private onEngine = (ev: EngineEvent): void => {
    if (this._estado.tela !== 'jogando') return;
    if (ev.type === 'pausa') this.comando({ c: 'pausar' });
    else if (ev.type === 'travado') {
      if (ev.travado) {
        this.esperaTravaAte = Infinity;
        this.retomandoDaPausa = false;
      } else if (!this.engine.semTrava) this.comando({ c: 'pausar' });
    } else if (ev.type === 'eventos') {
      const w = this.engine.world;
      const ev0 = ev.eventos.find((x) => x.tipo === 'documento');
      const doc = ev0?.tipo === 'documento' ? w?.fase.documentos.find((d) => d.id === ev0.id) : undefined;
      if (doc) {
        this._documento = doc;
        this.comando({ c: 'abrir_documento' });
      }
    } else if (ev.type === 'quadro') {
      const w = this.engine.world;
      if (w?.estado === 'morto') this.comando({ c: 'morreu' });
      else if (w?.estado === 'concluida') this.comando({ c: 'concluiu' });
      else if (!this.engine.travado && !this.engine.semTrava && performance.now() >= this.esperaTravaAte) {
        this.travaNegada();
      }
    }
  };

  /** Trava negada (navegador automatizado, Esc recente): volta à pausa com "Continuar". */
  private onErroTrava = (): void => {
    if (this._estado.tela === 'jogando' && !this.engine.semTrava) this.travaNegada();
  };

  private travaNegada(): void {
    const avisar = this.retomandoDaPausa;
    this.comando({ c: 'pausar' });
    if (avisar && this._estado.tela === 'pausa') {
      this._travaRecusada = true;
      this.aoMudar();
    }
  }
}
