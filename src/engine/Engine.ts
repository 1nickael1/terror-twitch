// Casca da engine: palco (renderer, cena, filtro), loop de passo fixo, áudio e a fase carregada
// (LevelRuntime). A simulação (`sim/`) é a fonte da verdade; a engine só lê o World e reage aos
// eventos de `step`. Que fase carregar, quando pausar e quando renascer quem decide é o `Game`.
import { Mixer } from '../audio/Mixer';
import { audioDeveTocar } from '../audio/regras';
import { SomDaFase } from '../audio/SomDaFase';
import type { VisualStyle } from '../looks/types';
import type { Opcoes } from '../save/opcoes';
import { JOGADOR } from '../sim/balance';
import type { SimEvent } from '../sim/eventos';
import type { LevelDef } from '../sim/fase';
import { criarWorld, restaurarCheckpoint, type World } from '../sim/world';
import { exporDepuracao, MedidorDeQuadro } from './depuracao';
import type { EngineEvent } from './eventosEngine';
import { Input } from './input';
import { LevelRuntime } from './LevelRuntime';
import { Palco } from './palco';
import { PassoFixo } from './passoFixo';
import { CameraJogador } from './view/cameraJogador';

export type { EngineEvent } from './eventosEngine';
export { WebGL2IndisponivelError } from './eventosEngine';

const DT_MAX = 0.1;
/** depois do clique que pede a trava, o áudio espera isto antes de suspender por "sem trava" */
const JANELA_TRAVA_MS = 500;

export class Engine {
  private readonly palco: Palco;
  private readonly input: Input;
  private readonly listeners = new Set<(e: EngineEvent) => void>();
  private readonly olhos: CameraJogador;
  private readonly passo = new PassoFixo();
  private readonly medidor = new MedidorDeQuadro();
  /** áudio: o contexto só nasce no primeiro clique no canvas */
  private readonly mixer = new Mixer();
  private somDaFase: SomDaFase | null = null;
  /** último estado da simulação visto pelo áudio (começa `true` para suspender no 1º quadro parado) */
  private audioAtivo = true;
  /** instante do último clique no canvas (o contexto nasce/retoma dentro dele) */
  private gestoAudioEm = -Infinity;
  private opcoes: Opcoes;
  private runtime: LevelRuntime | null = null;
  private _world: World | null = null;
  private pausado = false;
  /** pausado pela interface mas com o áudio rodando (morte, fim de fase, final, documento) */
  private audioNaPausa = false;
  private raf = 0;
  private rodando = false;
  private ultimo = 0;
  private tempo = 0;
  /** depuração em desenvolvimento (`__scp.jogarSemTrava`): simula sem o ponteiro travado */
  semTrava = false;
  private fase: LevelDef | null = null;
  /** arma em primeira pessoa visível (o `Game` esconde fora de jogo); vale para cada fase carregada */
  private armaVisivel = true;
  private descartado = false;
  private removerDepuracao: (() => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    styles: readonly VisualStyle[],
    opcoes: Opcoes,
  ) {
    this.palco = new Palco(canvas, styles, opcoes.filtro);
    this.olhos = new CameraJogador(this.palco.camera);
    this.input = new Input(canvas, (travado) => {
      if (travado) this.input.limparBordas();
      this.emit({ type: 'travado', travado });
      this.seguirPausaDoAudio(false);
    }, () => this.gesto());
    document.addEventListener('visibilitychange', this.onVisibilidade);
    this.opcoes = { ...opcoes };
    this.palco.aplicarCena(undefined);
    this.aplicarOpcoes(opcoes);
    // a fase é decidida pelo `Game` (máquina de telas)
    if (process.env.NODE_ENV !== 'production') this.removerDepuracao = exporDepuracao(this, {
      world: () => this.world, mixer: () => this.mixer, lerSemTrava: () => this.semTrava, definirSemTrava: (v) => { this.semTrava = v; },
    });
  }

  get world(): World | null { return this._world; }
  get travado(): boolean { return this.input.estaTravado; }

  on(l: (e: EngineEvent) => void): () => void {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  /**
   * Gesto do usuário (clique no canvas ou num botão da interface). O Safari só retoma o contexto
   * de áudio no próprio gesto: retoma aqui e o quadro concilia depois; com o jogo pausado pela
   * interface, o contexto nasce (ou fica) suspenso.
   */
  gesto(): void {
    const tocar = this.audioAtivoAgora(true);
    this.mixer.iniciar(tocar);
    if (!tocar) return;
    this.audioAtivo = true;
    this.gestoAudioEm = performance.now();
  }

  /** Pede a trava do ponteiro (precisa vir de um gesto do usuário). */
  pedirTrava(): void { this.input.pedirTrava(); }

  soltarTrava(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  mostrarArma(v: boolean): void {
    this.armaVisivel = v;
    this.runtime?.mostrarArmas(v);
  }

  /** Volta o mundo atual ao último checkpoint e reconstrói o que a cena mostra dele. */
  renascer(): void {
    const w = this._world;
    if (!w) return;
    restaurarCheckpoint(w);
    this.runtime?.reconstruirDinamicos(w);
    this.teleportarCamera(w);
  }

  start(): void {
    if (this.rodando || this.descartado) return;
    this.rodando = true;
    this.ultimo = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /**
   * `true` congela a simulação (a cena continua sendo desenhada). `manterAudio`: o áudio segue
   * tocando com a simulação parada (o som da morte ou da conclusão termina na própria tela).
   */
  pausar(sim: boolean, manterAudio = false): void {
    this.audioNaPausa = sim && manterAudio;
    if (this.pausado && !sim) {
      // nada apertado na pausa (nem um Esc pendente) vaza para o jogo
      this.input.limparBordas();
      this.input.consumirPausa();
    }
    this.pausado = sim;
    if (sim) this.passo.zerar();
  }

  aplicarOpcoes(o: Opcoes): void {
    this.opcoes = { ...o };
    if (this.palco.definirFiltro(o.filtro)) {
      this.palco.aplicarCena(this.fase?.ambiente);
      this.emit({ type: 'filtro', id: this.palco.estilo.id });
    }
    this.palco.aplicarQualidade(o.qualidade, o.fov);
    this.input.sensibilidade = o.sensibilidade;
    this.input.inverterY = o.inverterY;
    this.mixer.volumes(o.volumeGeral, o.volumeEfeitos, o.volumeMusica);
    this.configurarRuntime();
  }

  get filtro(): string {
    return this.palco.estilo.id;
  }

  carregarFase(f: LevelDef): void {
    this.descarregarFase();
    const world = criarWorld(f);
    // só vira a fase atual depois que o runtime existe (ele se limpa sozinho se falhar)
    const { scene, camera, bank, texturas } = this.palco;
    this.runtime = new LevelRuntime({ scene, camera, bank, texturas, fase: f, world });
    this.fase = f;
    this._world = world;
    this.somDaFase = new SomDaFase(this.mixer, f);
    this.palco.aplicarCena(f.ambiente);
    this.configurarRuntime();
    this.runtime.mostrarArmas(this.armaVisivel);
    this.teleportarCamera(world);
    this.emit({ type: 'fase', id: f.id });
  }

  descarregarFase(): void {
    if (!this.runtime) return;
    this.runtime.dispose();
    this.runtime = null;
    this.somDaFase?.dispose();
    this.somDaFase = null;
    this.mixer.cortarTodas();
    this._world = null;
    this.fase = null;
    this.passo.zerar();
    this.palco.aplicarCena(undefined);
    this.emit({ type: 'fase', id: null });
  }

  estatisticasDeRender(): { drawCalls: number; geometrias: number; texturas: number; msFrame: number } {
    const mem = this.palco.renderer.info.memory;
    return { drawCalls: this.medidor.drawCalls, geometrias: mem.geometries, texturas: mem.textures, msFrame: this.medidor.msFrame };
  }

  dispose(): void {
    if (this.descartado) return;
    this.descartado = true;
    cancelAnimationFrame(this.raf);
    this.rodando = false;
    document.removeEventListener('visibilitychange', this.onVisibilidade);
    this.input.dispose();
    this.descarregarFase();
    this.mixer.dispose();
    this.listeners.clear();
    this.palco.dispose();
    this.removerDepuracao?.();
  }

  private configurarRuntime(): void {
    const c = this.palco.estilo.cena;
    this.runtime?.configurarLuzes(c.luzes, c.emissivo, this.opcoes.reduzirFlashes);
  }

  private emit(e: EngineEvent): void {
    for (const l of this.listeners) l(e);
  }

  /** O áudio deve tocar agora (`audioDeveTocar`)? `noGesto`: ignora a trava, que chega depois do clique. */
  private audioAtivoAgora(noGesto = false): boolean {
    return audioDeveTocar({
      oculta: document.hidden, pausado: this.pausado, audioNaPausa: this.audioNaPausa,
      travado: noGesto || this.input.estaTravado, semTrava: this.semTrava,
    });
  }

  private simAtiva(): boolean {
    return !this.pausado && (this.input.estaTravado || this.semTrava);
  }

  private onVisibilidade = () => {
    this.medidor.descartar();
    // aba oculta: o rAF para, então o quadro não suspenderia o áudio (laços tocando em segundo plano)
    if (document.hidden) {
      this.mixer.suspender();
      this.audioAtivo = false;
    }
  };

  private frame = (agora: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dtReal = (agora - this.ultimo) / 1000;
    this.ultimo = agora;
    if (dtReal <= 0) return;
    const dt = Math.min(dtReal, DT_MAX);
    this.medidor.registrar(dtReal);
    this.tempo += dt;

    if (this.input.consumirPausa()) this.emit({ type: 'pausa' });
    const eventos = this.avancar(dt);
    this.seguirPausaDoAudio();
    const world = this._world;
    if (world) {
      const alfa = this.passo.alfa;
      const ativa = this.simAtiva();
      this.olhos.atualizar(world.jogador, alfa, dt, ativa, ativa ? this.input.espiarOlhar() : undefined);
      this.runtime?.sincronizar(world, eventos, alfa, dt);
      this.palco.lights.atualizar(world, dt);
      const j = world.jogador;
      this.somDaFase?.sincronizar(world, eventos, { pos: j.pos, y: j.y + JOGADOR.olhos, yaw: j.yaw });
    }

    this.medidor.drawCalls = this.palco.render(this.tempo);

    if (eventos.length > 0) this.emit({ type: 'eventos', eventos });
    this.emit({ type: 'quadro' });
  };

  /** Passos fixos de simulação deste quadro (morte e fim de fase ficam com o `Game`). */
  private avancar(dt: number): SimEvent[] {
    const w = this._world;
    if (!w) return [];
    if (this.simAtiva()) return this.passo.avancar(w, this.input, this.olhos, dt);
    this.passo.zerar();
    this.olhos.marcarAnterior(w.jogador);
    return [];
  }

  /**
   * Contexto de áudio seguindo `audioDeveTocar` (pausa, título, sem trava e aba oculta suspendem). Com
   * `esperarTrava`, não suspende logo depois do clique que pediu a trava (ela chega a seguir).
   */
  private seguirPausaDoAudio(esperarTrava = true): void {
    const ativa = this.audioAtivoAgora();
    if (ativa === this.audioAtivo) return;
    if (!ativa && esperarTrava && performance.now() - this.gestoAudioEm < JANELA_TRAVA_MS) return;
    this.audioAtivo = ativa;
    if (ativa) this.mixer.retomar();
    else this.mixer.suspender();
  }

  private teleportarCamera(w: World): void {
    this.passo.zerar();
    this.olhos.teleportar(w.jogador);
    this.palco.lights.reposicionar();
  }
}
