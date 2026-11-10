// Síntese dos sons da fase 2 (Ala Médica), toda em WebAudio, nenhum arquivo: reanimados (gemido,
// levantar), frasco (arremesso, vidro quebrando), chefe 049 (despertar, passo, aviso do toque,
// reanimar, pressa, morte), perigos de área (UV: aviso, estalo e o laço do zumbido; vapor: aviso,
// estouro e o laço do jato; recusa), cenário (`gaveta`, `elevador`) e a cama de fundo `hospital`.
// Timbres próprios: voz grave por formantes, vidro de parciais altas, chiado de ruído filtrado.
import { TIPOS } from '../sim/ai/tipos';
import { curvaGanho, pancada, voz } from './sinteseChefe';
import {
  baque, envelope, filtro, iniciar, laco, MIN, ruido, tom, variar, type Bancada, type Fontes, type Laco, type Sintese,
} from './sintese';

// ---------- reanimados ----------

/** Gemido do reanimado ao notar o jogador: voz grave arrastada que oscila e cai (1,3 s). */
export const gemido: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = curvaGanho(ctx, d, t, [[0.25, 0.4], [0.9, 0.3], [1.3, MIN]]);
  const f0 = variar(92, 0.1);
  const f = voz(b, g, t, {
    curva: [[0, f0], [0.5, f0 * 1.12], [1.25, f0 * 0.72]], formantes: [[380, 3], [760, 4], [1900, 6]], vibrato: 0.07, dur: 1.3,
  });
  const er = envelope(ctx, d, t, 0.15, 0.1, 1.1);
  f.push(ruido(b, filtro(ctx, er, 'bandpass', 600, 1.4), t, 1.3));
  return f;
};

/** Corpo levantando: estalos secos de juntas em série, roçar de pano e um arquejo curto (1,1 s). */
export const levantar: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f: Fontes = [];
  for (const k of [0, 0.13, 0.21, 0.42, 0.5, 0.78]) {
    const e = envelope(ctx, d, t + k, 0.001, variar(0.32, 0.3), 0.02);
    f.push(ruido(b, filtro(ctx, e, 'highpass', variar(2400, 0.3), 1.5), t + k, 0.035));
    const et = envelope(ctx, d, t + k, 0.001, 0.12, 0.04);
    f.push(tom(b, et, 'triangle', variar(260, 0.2), 140, t + k, 0.04));
  }
  const pano = envelope(ctx, d, t + 0.05, 0.2, 0.12, 0.9);
  f.push(ruido(b, filtro(ctx, pano, 'bandpass', 1300, 0.8), t + 0.05, 1.0));
  const g = curvaGanho(ctx, d, t + 0.7, [[0.08, 0.22], [0.4, MIN]]);
  f.push(...voz(b, g, t + 0.7, { curva: [[0, 120], [0.4, 80]], formantes: [[450, 3], [900, 4]], vibrato: 0.03, dur: 0.4 }));
  return f;
};

// ---------- frasco ----------

/** Vidro: parciais altas inarmônicas com queda rápida (`n` lascas espalhadas em `espalha` s). */
function vidro(b: Bancada, d: AudioNode, t: number, n: number, espalha: number, ganho: number): Fontes {
  const { ctx } = b;
  const f: Fontes = [];
  for (let k = 0; k < n; k++) {
    const tk = t + Math.random() * espalha;
    const fq = 2200 + Math.random() * 4200;
    const dur = 0.04 + Math.random() * 0.2;
    const e = envelope(ctx, d, tk, 0.001, ganho * (0.5 + Math.random() * 0.5), dur);
    f.push(tom(b, e, 'sine', fq, fq * 0.995, tk, dur));
  }
  return f;
}

/** Frasco arremessado: zunido do braço e o tilintar do vidro na mão. */
export const frascoArremesso: Sintese = (b, d, t) => {
  const { ctx } = b;
  const es = envelope(ctx, d, t, 0.06, 0.22, 0.2);
  const bp = filtro(ctx, es, 'bandpass', 600, 1.2);
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.exponentialRampToValueAtTime(1600, t + 0.12);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.26);
  const f: Fontes = [ruido(b, bp, t, 0.3)];
  f.push(...vidro(b, d, t, 2, 0.03, 0.09));
  return f;
};

/** Frasco quebrando: estilhaço de ruído agudo, lascas tilintando e o líquido espirrando. */
export const vidroQuebra: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = envelope(ctx, d, t, 0.001, 0.5, 0.16);
  const f: Fontes = [ruido(b, filtro(ctx, er, 'highpass', 3200, 0.8), t, 0.2)];
  f.push(...vidro(b, d, t, 9, 0.28, 0.14));
  const el = envelope(ctx, d, t + 0.01, 0.005, 0.28, 0.18);
  f.push(ruido(b, filtro(ctx, el, 'lowpass', 900, 1.2), t + 0.01, 0.22, 0.6));
  return f;
};

// ---------- chefe 049 ----------

/** Desperta: um suspiro longo e uma voz grave e calma, murmurada (2,2 s). Nada de grito. */
export const chefe049Desperta: Sintese = (b, d, t) => {
  const { ctx } = b;
  const sopro = curvaGanho(ctx, d, t, [[0.5, 0.14], [1.0, 0.08], [1.3, MIN]]);
  const bp = filtro(ctx, sopro, 'bandpass', 700, 0.9);
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(400, t + 1.2);
  const f: Fontes = [ruido(b, bp, t, 1.35)];
  const g = curvaGanho(ctx, d, t + 0.9, [[0.25, 0.32], [0.9, 0.26], [1.3, MIN]]);
  f.push(...voz(b, g, t + 0.9, {
    curva: [[0, 82], [0.5, 90], [1.3, 74]], formantes: [[420, 4], [700, 5], [2400, 7]], vibrato: 0.012, dur: 1.3,
  }));
  return f;
};

/** Passo do 049: medido e mais leve que o do 096 — salto de couro e um baque abafado. */
export const chefe049Passo: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = variar(0.4, 0.1);
  const es = envelope(ctx, d, t, 0.001, g * 0.35, 0.03);
  const f: Fontes = [ruido(b, filtro(ctx, es, 'bandpass', variar(1500, 0.1), 2), t, 0.05)];
  const et = envelope(ctx, d, t + 0.01, 0.003, g, 0.14);
  f.push(tom(b, filtro(ctx, et, 'lowpass', 200), 'sine', variar(72, 0.06), 42, t + 0.01, 0.15));
  return f;
};

/**
 * Aviso do toque (dura o preparo, 0,9 s): grave que cresce, dois tons dissonantes subindo juntos e um
 * sussurro de ar; corta seco no fim (quando o toque acerta ou erra).
 */
export const chefeToque: Sintese = (b, d, t) => {
  const { ctx } = b;
  // dura o preparo do toque do tipo (o corte seco cai junto do acerto)
  const dur = TIPOS.entidade049.preparo;
  const g = curvaGanho(ctx, d, t, [[0.7, 0.45], [dur, 0.5], [dur + 0.06, MIN]]);
  const lp = filtro(ctx, g, 'lowpass', 900, 0.8);
  const f: Fontes = [];
  for (const [f0, f1] of [[52, 60], [110, 128], [116.5, 136]] as const) f.push(tom(b, lp, 'sawtooth', f0, f1, t, dur + 0.05));
  const sopro = curvaGanho(ctx, d, t, [[0.8, 0.12], [dur + 0.05, MIN]]);
  const bp = filtro(ctx, sopro, 'bandpass', 1800, 1.5);
  bp.frequency.setValueAtTime(1200, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + dur);
  f.push(ruido(b, bp, t, dur + 0.06));
  return f;
};

/** Reanimar (1,6 s): acorde grave que abre e sobe, ar crescendo e batidas que aceleram no fim. */
export const chefeReanima: Sintese = (b, d, t) => {
  const { ctx } = b;
  const dur = 1.6;
  const g = curvaGanho(ctx, d, t, [[1.4, 0.4], [dur, 0.45], [dur + 0.25, MIN]]);
  const lp = filtro(ctx, g, 'lowpass', 300, 1.5);
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + dur);
  const f: Fontes = [];
  for (const [f0, f1] of [[65, 98], [97.5, 147], [131, 196], [138, 207]] as const) f.push(tom(b, lp, 'sawtooth', f0, f1, t, dur + 0.25));
  const ar = curvaGanho(ctx, d, t, [[dur, 0.16], [dur + 0.3, MIN]]);
  f.push(ruido(b, filtro(ctx, ar, 'bandpass', 900, 0.7), t, dur + 0.3));
  // batidas surdas, cada vez mais próximas
  for (const k of [0.2, 0.62, 0.95, 1.2, 1.38, 1.5, 1.58]) {
    const e = envelope(ctx, d, t + k, 0.003, 0.25 + k * 0.12, 0.12);
    f.push(tom(b, filtro(ctx, e, 'lowpass', 160), 'sine', 58, 36, t + k, 0.13));
  }
  return f;
};

/** Pressa: uma inspiração cortante e um tom grave curto (ele aperta o passo). */
export const chefeApressa: Sintese = (b, d, t) => {
  const { ctx } = b;
  const ei = envelope(ctx, d, t, 0.2, 0.2, 0.12);
  const bp = filtro(ctx, ei, 'bandpass', 900, 1.2);
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(2200, t + 0.3);
  const f: Fontes = [ruido(b, bp, t, 0.35)];
  const g = curvaGanho(ctx, d, t + 0.3, [[0.04, 0.35], [0.5, MIN]]);
  f.push(...voz(b, g, t + 0.3, { curva: [[0, 95], [0.5, 80]], formantes: [[400, 3], [800, 4]], vibrato: 0.01, dur: 0.5 }));
  return f;
};

/** Morte do 049: um gemido grave que cai, o corpo no chão e a maleta batendo em seguida (3 s). */
export const chefe049Morto: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = curvaGanho(ctx, d, t, [[0.2, 0.4], [1.5, 0.28], [2.6, MIN]]);
  const f = voz(b, g, t, {
    curva: [[0, 110], [1.2, 78], [2.6, 40]], formantes: [[380, 4], [720, 5], [2200, 7]], vibrato: 0.02, dur: 2.6,
  });
  f.push(...baque(b, d, t + 1.1, 0.55));
  // a maleta: um estalo de couro e o fecho de metal
  const em = envelope(ctx, d, t + 1.35, 0.002, 0.25, 0.08);
  f.push(ruido(b, filtro(ctx, em, 'bandpass', 700, 1.4), t + 1.35, 0.1));
  const ef = envelope(ctx, d, t + 1.37, 0.001, 0.1, 0.12);
  f.push(tom(b, ef, 'triangle', 1900, 1800, t + 1.37, 0.12));
  return f;
};

// ---------- perigos de área ----------

/** Aviso da UV: o reator estalando antes de pegar (cliques irregulares e um zumbido subindo). */
export const uvAviso: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f: Fontes = [];
  for (const k of [0, 0.17, 0.41, 0.55, 0.8, 0.92]) {
    const e = envelope(ctx, d, t + k, 0.001, 0.22, 0.03);
    f.push(ruido(b, filtro(ctx, e, 'bandpass', 3000, 2), t + k, 0.04));
  }
  const g = curvaGanho(ctx, d, t, [[1.0, 0.12], [1.1, MIN]]);
  f.push(tom(b, filtro(ctx, g, 'bandpass', 600, 2), 'sawtooth', 100, 120, t, 1.1));
  return f;
};

/** UV ligando: estalo elétrico forte e um baque do reator. */
export const uvLiga: Sintese = (b, d, t) => {
  const { ctx } = b;
  const e = envelope(ctx, d, t, 0.001, 0.6, 0.05);
  const f: Fontes = [ruido(b, filtro(ctx, e, 'highpass', 1800, 0.8), t, 0.07)];
  const et = envelope(ctx, d, t, 0.002, 0.35, 0.18);
  f.push(tom(b, filtro(ctx, et, 'lowpass', 300), 'square', 120, 60, t, 0.18));
  return f;
};

/** Laço do zumbido elétrico da UV acesa: rede em 100/200 Hz rasgada e um crepitar fino. */
export function uvZumbido(b: Bancada, destino: AudioNode): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const s = ctx.createOscillator();
  s.type = 'sawtooth';
  s.frequency.value = 100;
  const gs = ctx.createGain();
  gs.gain.value = 0.5;
  s.connect(filtro(ctx, gs, 'bandpass', 900, 1.5));
  gs.connect(saida);
  const q = ctx.createOscillator();
  q.type = 'square';
  q.frequency.value = 200.6;
  const gq = ctx.createGain();
  gq.gain.value = 0.18;
  q.connect(filtro(ctx, gq, 'lowpass', 700, 1));
  gq.connect(saida);
  const r = ctx.createBufferSource();
  r.buffer = b.ruido;
  r.loop = true;
  const gr = ctx.createGain();
  gr.gain.value = 0.08;
  r.connect(filtro(ctx, gr, 'highpass', 5000, 0.7));
  gr.connect(saida);
  return laco(ctx, destino, [s, q, r], saida, 0.4);
}

/** Aviso do vapor: chiado que sobe na válvula (1,2 s). */
export const vaporAviso: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = curvaGanho(ctx, d, t, [[1.1, 0.3], [1.25, MIN]]);
  const bp = filtro(ctx, g, 'bandpass', 1500, 1.4);
  bp.frequency.setValueAtTime(1200, t);
  bp.frequency.exponentialRampToValueAtTime(4200, t + 1.15);
  return [ruido(b, filtro(ctx, bp, 'highpass', 800), t, 1.3)];
};

/** Vapor ligando: estouro de pressão (baque grave e um jato de ruído). */
export const vaporLiga: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f = baque(b, d, t, 0.4);
  const e = envelope(ctx, d, t, 0.005, 0.55, 0.35);
  f.push(ruido(b, filtro(ctx, e, 'highpass', 900, 0.7), t, 0.4));
  return f;
};

/** Laço do jato de vapor: chiado forte e largo com uma tremulação lenta. */
export function vaporJato(b: Bancada, destino: AudioNode): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const r = ctx.createBufferSource();
  r.buffer = b.ruido;
  r.loop = true;
  const trem = ctx.createGain();
  trem.gain.value = 0.8;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.3;
  const prof = ctx.createGain();
  prof.gain.value = 0.15;
  lfo.connect(prof);
  prof.connect(trem.gain);
  trem.connect(saida);
  r.connect(filtro(ctx, filtro(ctx, trem, 'bandpass', 2800, 0.6), 'highpass', 900, 0.7));
  return laco(ctx, destino, [r, lfo], saida, 0.45);
}

/** Recusa de um perigo de área em recarga: um zumbido grave curto (não é o bip da comporta). */
export const perigoRecusa: Sintese = (b, d, t) => {
  const e = envelope(b.ctx, d, t, 0.005, 0.28, 0.24);
  return [tom(b, filtro(b.ctx, e, 'lowpass', 500), 'sawtooth', 85, 80, t, 0.26)];
};

// ---------- cenário ----------

/** Gaveta do necrotério abrindo: trilho rolando, chiado de metal e o baque no fim (1,1 s). */
export const gaveta: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = curvaGanho(ctx, d, t, [[0.08, 0.3], [0.8, 0.25], [0.9, MIN]]);
  const trilho = filtro(ctx, er, 'lowpass', 500, 1.2);
  const trepida = ctx.createGain();
  trepida.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 26;
  const prof = ctx.createGain();
  prof.gain.value = 0.4;
  lfo.connect(prof);
  prof.connect(trepida.gain);
  trepida.connect(trilho);
  const f: Fontes = [ruido(b, trepida, t, 0.9), iniciar(b, lfo, t, t + 0.9)];
  const es = curvaGanho(ctx, d, t + 0.1, [[0.3, 0.05], [0.7, MIN]]);
  f.push(tom(b, filtro(ctx, es, 'bandpass', 1000, 6), 'sine', 880, 1150, t + 0.1, 0.7));
  f.push(...pancada(b, d, t + 0.88, 0.4));
  return f;
};

/** Elevador chegando: motor que desacelera, um sino de dois tons e as portas correndo (2,6 s). */
export const elevador: Sintese = (b, d, t) => {
  const { ctx } = b;
  const em = curvaGanho(ctx, d, t, [[0.1, 0.28], [0.8, 0.2], [1.0, MIN]]);
  const f: Fontes = [tom(b, filtro(ctx, em, 'lowpass', 250, 1.4), 'sawtooth', 70, 42, t, 1.0)];
  // sino: duas notas com parciais inarmônicas, decaindo devagar
  for (const [k, fq] of [[1.0, 784], [1.35, 622]] as const) {
    for (const [mult, g, q] of [[1, 0.3, 1.6], [2.76, 0.08, 0.7], [5.4, 0.04, 0.35]] as const) {
      const e = envelope(ctx, d, t + k, 0.003, g, q);
      f.push(tom(b, e, 'sine', fq * mult, fq * mult, t + k, q));
    }
  }
  const ep = curvaGanho(ctx, d, t + 1.6, [[0.15, 0.18], [0.8, 0.12], [1.0, MIN]]);
  f.push(ruido(b, filtro(ctx, ep, 'bandpass', 700, 1), t + 1.6, 1.0));
  f.push(...baque(b, d, t + 2.55, 0.22));
  return f;
};

// ---------- cama de fundo ----------

/** s do ciclo do monitor distante (um bipe por ciclo) */
const CICLO_MONITOR = 1.35;

/** Buffer de um ciclo do monitor cardíaco distante: um bipe curto e silêncio (gerado, nenhum arquivo). */
function bufferMonitor(ctx: AudioContext): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * CICLO_MONITOR);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const bip = Math.floor(ctx.sampleRate * 0.11);
  for (let i = 0; i < bip; i++) {
    const env = Math.min(1, i / 200) * Math.min(1, (bip - i) / 400);
    d[i] = Math.sin((2 * Math.PI * 960 * i) / ctx.sampleRate) * env;
  }
  return buf;
}

/**
 * Cama `hospital`: zumbido de reatores fluorescentes (120/240 Hz), ar-condicionado em ruído rosa
 * grave e um monitor cardíaco bipando longe, abafado.
 */
export function hospital(b: Bancada, destino: AudioNode, rosa: AudioBuffer): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const r = ctx.createBufferSource();
  r.buffer = rosa;
  r.loop = true;
  const gr = ctx.createGain();
  gr.gain.value = 0.1;
  r.connect(filtro(ctx, gr, 'lowpass', 420, 0.6));
  gr.connect(saida);
  const go = ctx.createGain();
  go.gain.value = 0.025;
  go.connect(saida);
  const a = ctx.createOscillator();
  a.frequency.value = 120;
  const c = ctx.createOscillator();
  c.type = 'triangle';
  c.frequency.value = 240.4;
  const gc = ctx.createGain();
  gc.gain.value = 0.35;
  a.connect(go);
  c.connect(gc);
  gc.connect(go);
  const m = ctx.createBufferSource();
  m.buffer = bufferMonitor(ctx);
  m.loop = true;
  const gm = ctx.createGain();
  gm.gain.value = 0.035;
  m.connect(filtro(ctx, gm, 'lowpass', 1400, 0.7));
  gm.connect(saida);
  return laco(ctx, destino, [r, a, c, m], saida, 1);
}
