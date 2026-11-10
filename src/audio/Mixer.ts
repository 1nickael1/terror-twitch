// Mixer: o AudioContext, os barramentos (geral → efeitos e música) e as vozes avulsas.
// O contexto só nasce em `iniciar()`, chamado num gesto do usuário. Sem WebAudio (ou se a criação
// lançar), tudo vira operação nula, sem erro nem aviso.
import { RegistroVozes, vagasAvulsas } from './regras';
import { criarRuidoBranco, type Bancada, type Sintese } from './sintese';

/** rampa dos volumes (constante de tempo, s) */
const RAMPA_VOLUME = 0.03;
/**
 * Recuo fixo do barramento de efeitos antes do geral: a soma típica (tiro 1,0 + 3 impactos 0,5 +
 * passo 0,2 = 2,7 em picos de envelope) × 0,3 × geral 0,8 ≈ 0,65, logo abaixo do limiar (-3 dB ≈ 0,71).
 */
export const RECUO_EFEITOS = 0.3;
/** corte da voz mais antiga quando passa do limite (s) */
const RAMPA_CORTE = 0.015;

interface Voz {
  ganho: GainNode;
  fontes: AudioScheduledSourceNode[];
  cadeia: AudioNode[];
  pendentes: number;
  liberada: boolean;
}

type CtorAudio = new () => AudioContext;

function construtorAudio(): CtorAudio | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: CtorAudio; webkitAudioContext?: CtorAudio };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class Mixer {
  private _ctx: AudioContext | null = null;
  private _efeitos: GainNode | null = null;
  private _musica: GainNode | null = null;
  private geral: GainNode | null = null;
  private _bancada: Bancada | null = null;
  private readonly vozes = new RegistroVozes<Voz>();
  private vol = { geral: 0.8, efeitos: 1, musica: 0.7 };
  private descartado = false;

  get ctx(): AudioContext | null {
    return this._ctx;
  }

  get efeitos(): GainNode | null {
    return this._efeitos;
  }

  get musica(): GainNode | null {
    return this._musica;
  }

  /** contexto e ruído base, para quem monta sons e laços */
  get bancada(): Bancada | null {
    return this._bancada;
  }

  /** depuração: vozes avulsas tocando agora */
  get vozesAtivas(): number {
    return this.vozes.tamanho;
  }

  /**
   * Cria o contexto (uma vez) e o retoma; chamar dentro de um gesto do usuário (o Safari só deixa
   * retomar no próprio gesto). Com `tocar` falso (jogo pausado pela interface), cria e deixa suspenso.
   * A conciliação com a simulação fica para a engine, no quadro seguinte.
   */
  iniciar(tocar = true): void {
    if (this.descartado) return;
    if (this._ctx) {
      if (tocar && this._ctx.state === 'suspended') this.retomar();
      return;
    }
    const Ctor = construtorAudio();
    if (!Ctor) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctor();
      const geral = ctx.createGain();
      // limitador de verdade: nada passa muito de -3 dB
      const limitador = ctx.createDynamicsCompressor();
      limitador.threshold.value = -3;
      limitador.knee.value = 0;
      limitador.ratio.value = 20;
      limitador.attack.value = 0.002;
      limitador.release.value = 0.1;
      geral.connect(limitador);
      limitador.connect(ctx.destination);
      const efeitos = ctx.createGain();
      const musica = ctx.createGain();
      const recuo = ctx.createGain();
      recuo.gain.value = RECUO_EFEITOS;
      efeitos.connect(recuo);
      recuo.connect(geral);
      musica.connect(geral);
      geral.gain.value = this.vol.geral;
      efeitos.gain.value = this.vol.efeitos;
      musica.gain.value = this.vol.musica;
      this._bancada = { ctx, ruido: criarRuidoBranco(ctx), coletor: null };
      this._ctx = ctx;
      this.geral = geral;
      this._efeitos = efeitos;
      this._musica = musica;
      // criado no gesto ele já nasce rodando; com o jogo pausado pela interface, fica suspenso
      if (!tocar) this.suspender();
      else if (ctx.state === 'suspended') this.retomar();
    } catch {
      this._ctx = null;
      this._bancada = null;
      this.geral = this._efeitos = this._musica = null;
      if (ctx) {
        ctx.close().catch(() => {
          /* ignorado */
        });
      }
    }
  }

  volumes(geral: number, efeitos: number, musica: number): void {
    this.vol = { geral, efeitos, musica };
    const ctx = this._ctx;
    if (!ctx || !this.geral || !this._efeitos || !this._musica) return;
    const t = ctx.currentTime;
    this.geral.gain.setTargetAtTime(geral, t, RAMPA_VOLUME);
    this._efeitos.gain.setTargetAtTime(efeitos, t, RAMPA_VOLUME);
    this._musica.gain.setTargetAtTime(musica, t, RAMPA_VOLUME);
  }

  suspender(): void {
    const ctx = this._ctx;
    if (!ctx || ctx.state === 'closed') return;
    ctx.suspend().catch(() => {
      /* ignorado */
    });
  }

  retomar(): void {
    const ctx = this._ctx;
    if (!ctx || ctx.state === 'closed') return;
    ctx.resume().catch(() => {
      /* sem gesto (Safari): o próximo clique, em `iniciar()`, tenta de novo */
    });
  }

  /**
   * Toca uma voz avulsa: `montar` liga o som na entrada da voz; `cadeia` (ex.: posicional) fica
   * entre a voz e o barramento de efeitos. Acima das vagas (24 menos os laços tocando), a mais antiga é cortada.
   */
  tocar(montar: Sintese, cadeia: AudioNode[] = []): void {
    const ctx = this._ctx;
    const b = this._bancada;
    const bus = this._efeitos;
    if (!ctx || !b || !bus) return;
    let ganho: GainNode | null = null;
    b.coletor = [];
    try {
      const t = ctx.currentTime;
      ganho = ctx.createGain();
      let saida: AudioNode = ganho;
      if (cadeia.length > 0) {
        ganho.connect(cadeia[0]);
        saida = cadeia[cadeia.length - 1];
      }
      saida.connect(bus);
      const fontes = montar(b, ganho, t);
      b.coletor = null;
      const voz: Voz = { ganho, fontes, cadeia, pendentes: fontes.length, liberada: false };
      for (const f of fontes) {
        f.onended = () => {
          voz.pendentes--;
          if (voz.pendentes <= 0) this.liberar(voz);
        };
      }
      if (fontes.length === 0) {
        this.liberar(voz);
        return;
      }
      const cortada = this.vozes.adicionar(voz);
      if (cortada) this.cortar(cortada, t);
    } catch {
      // síntese lançou no meio (ou contexto fechado): para as fontes já iniciadas e solta o grafo
      for (const f of b.coletor ?? []) {
        try {
          f.onended = null;
          f.stop();
          f.disconnect();
        } catch {
          /* já parada */
        }
      }
      for (const n of ganho ? [ganho, ...cadeia] : cadeia) {
        try {
          n.disconnect();
        } catch {
          /* já desligado */
        }
      }
    } finally {
      b.coletor = null;
    }
  }

  /**
   * Laços tocando agora (ambiente, drone, alarme, lamento, perigos): cada um ocupa uma vaga do limite
   * de vozes (`vagasAvulsas`). Se as avulsas passarem das vagas novas, as mais antigas são cortadas.
   */
  reservarLacos(lacos: number): void {
    const vagas = vagasAvulsas(lacos);
    if (vagas === this.vozes.vagas) return;
    const cortadas = this.vozes.definirLimite(vagas);
    const ctx = this._ctx;
    if (!ctx) return;
    for (const v of cortadas) this.cortar(v, ctx.currentTime);
  }

  /** Corta todas as vozes avulsas com a rampa curta (ao descarregar a fase). */
  cortarTodas(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    for (const v of [...this.vozes.todas()]) this.cortar(v, ctx.currentTime);
  }

  dispose(): void {
    if (this.descartado) return;
    this.descartado = true;
    for (const v of this.vozes.limpar()) this.desligar(v);
    const ctx = this._ctx;
    this._ctx = null;
    this._bancada = null;
    this._efeitos = null;
    this._musica = null;
    this.geral = null;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {
        /* ignorado */
      });
    }
  }

  /** Rampa de 15 ms até o silêncio e para as fontes logo depois (sem estalo). */
  private cortar(v: Voz, t: number): void {
    const g = v.ganho.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + RAMPA_CORTE);
    for (const f of v.fontes) {
      try {
        f.stop(t + RAMPA_CORTE + 0.005);
      } catch {
        /* já parada */
      }
    }
  }

  private liberar(v: Voz): void {
    if (v.liberada) return;
    this.vozes.remover(v);
    this.desligar(v);
  }

  private desligar(v: Voz): void {
    v.liberada = true;
    for (const f of v.fontes) {
      f.onended = null;
      try {
        f.disconnect();
      } catch {
        /* já desligada */
      }
    }
    v.ganho.disconnect();
    for (const n of v.cadeia) n.disconnect();
  }
}
