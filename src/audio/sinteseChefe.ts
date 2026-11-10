// Síntese dos sons do chefe da fase 1 e das comportas (WebAudio, nenhum arquivo). Timbre próprio:
// voz feita de dentes-de-serra desafinados passando por formantes, com sopro de ruído; metal feito
// de parciais inarmônicas. O laço do lamento (chefe inerte) fica no fim.
import {
  baque, envelope, filtro, iniciar, laco, MIN, ruido, tom, variar, type Bancada, type Fontes, type Laco, type Sintese,
} from './sintese';

/** Voz: duas serras desafinadas com vibrato por formantes paralelos. `curva`: [t relativo, Hz]. */
function voz(
  b: Bancada, destino: AudioNode, t: number,
  o: { curva: readonly (readonly [number, number])[]; formantes: readonly (readonly [number, number])[]; vibrato: number; dur: number },
): Fontes {
  const { ctx } = b;
  const soma = ctx.createGain();
  soma.gain.value = 0.5;
  for (const [fq, q] of o.formantes) soma.connect(filtro(ctx, destino, 'bandpass', fq, q));
  const fim = t + o.dur + 0.05;
  const fontes: Fontes = [];
  for (const desafino of [1, 1.013]) {
    const s = ctx.createOscillator();
    s.type = 'sawtooth';
    s.frequency.setValueAtTime(o.curva[0][1] * desafino, t);
    for (const [k, fq] of o.curva.slice(1)) s.frequency.exponentialRampToValueAtTime(fq * desafino, t + k);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = variar(5.5, 0.1);
    const prof = ctx.createGain();
    prof.gain.value = o.curva[0][1] * o.vibrato;
    lfo.connect(prof);
    prof.connect(s.frequency);
    s.connect(soma);
    fontes.push(iniciar(b, s, t, fim), iniciar(b, lfo, t, fim));
  }
  return fontes;
}

/** Ganho com rampa de entrada, patamar e saída (pontos [t relativo, ganho]). */
function curvaGanho(ctx: AudioContext, destino: AudioNode, t: number, pontos: readonly (readonly [number, number])[]): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN, t);
  for (const [k, v] of pontos) g.gain.exponentialRampToValueAtTime(Math.max(MIN, v), t + k);
  g.connect(destino);
  return g;
}

/** Grito longo que sobe (2,5 s): começa num gemido e abre num urro agudo e áspero. */
export const chefeDesperta: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = curvaGanho(ctx, d, t, [[0.5, 0.25], [2.1, 0.55], [2.5, MIN]]);
  const f = voz(b, g, t, {
    curva: [[0, 170], [1.2, 260], [2.3, 560]],
    formantes: [[650, 3.5], [1150, 5], [2500, 6]], vibrato: 0.04, dur: 2.5,
  });
  const sopro = curvaGanho(ctx, d, t, [[0.3, 0.06], [2.0, 0.2], [2.5, MIN]]);
  const bp = filtro(ctx, sopro, 'bandpass', 1400, 1);
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 2.3);
  f.push(ruido(b, bp, t, 2.55));
  return f;
};

/** Uma pancada pesada em metal: baque grave e parciais inarmônicas que ressoam. */
function pancada(b: Bancada, d: AudioNode, t: number, ganho: number): Fontes {
  const { ctx } = b;
  const f = baque(b, d, t, ganho);
  const et = envelope(ctx, d, t, 0.002, ganho * 0.9, 0.25);
  f.push(tom(b, filtro(ctx, et, 'lowpass', 300), 'sine', 68, 32, t, 0.25));
  for (const [fq, g, q] of [[213, 0.1, 0.9], [347, 0.07, 0.7], [529, 0.05, 0.6], [811, 0.03, 0.4]] as const) {
    const e = envelope(ctx, d, t, 0.002, ganho * g * 2, q);
    f.push(tom(b, e, 'sine', variar(fq, 0.03), fq * 0.98, t, q));
  }
  const er = envelope(ctx, d, t, 0.001, ganho * 0.5, 0.08);
  f.push(ruido(b, filtro(ctx, er, 'bandpass', 600, 0.8), t, 0.1));
  return f;
}

/** Pancadas pesadas em metal durante o arrombamento (3 s, ritmo irregular). */
export const chefeArromba: Sintese = (b, d, t) =>
  [0, 0.36, 0.82, 1.15, 1.62, 1.95, 2.42, 2.74].flatMap((k, i) => pancada(b, d, t + k, i % 2 === 0 ? 0.55 : 0.42));

/** Urro curto e rouco do início da investida. */
export const chefeInvestida: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = curvaGanho(ctx, d, t, [[0.06, 0.6], [0.5, 0.35], [0.75, MIN]]);
  const f = voz(b, g, t, { curva: [[0, 150], [0.7, 95]], formantes: [[520, 3], [900, 4], [2100, 5]], vibrato: 0.06, dur: 0.75 });
  const er = envelope(ctx, d, t, 0.02, 0.25, 0.6);
  f.push(ruido(b, filtro(ctx, er, 'lowpass', 1300, 0.8), t, 0.7));
  return f;
};

/** Golpe do chefe: deslocamento de ar descendo e um baque surdo. */
export const chefeGolpe: Sintese = (b, d, t) => {
  const { ctx } = b;
  const es = envelope(ctx, d, t, 0.05, 0.35, 0.22);
  const bp = filtro(ctx, es, 'bandpass', 900, 1.2);
  bp.frequency.setValueAtTime(1100, t);
  bp.frequency.exponentialRampToValueAtTime(220, t + 0.25);
  const f: Fontes = [ruido(b, bp, t, 0.3)];
  const et = envelope(ctx, d, t + 0.2, 0.003, 0.55, 0.22);
  f.push(tom(b, filtro(ctx, et, 'lowpass', 260), 'sine', 62, 30, t + 0.2, 0.22));
  return f;
};

/**
 * Passo pesado do chefe correndo: baque grave curto (seno caindo de ~58 a 28 Hz), um raspado de
 * ruído abafado e um estalo seco no início. Altura e ganho variam a cada passo.
 */
export const chefePasso: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = variar(0.6, 0.12);
  const et = envelope(ctx, d, t, 0.004, g, 0.2);
  const f: Fontes = [tom(b, filtro(ctx, et, 'lowpass', 180), 'sine', variar(58, 0.08), 28, t, 0.22)];
  const er = envelope(ctx, d, t, 0.002, g * 0.45, 0.09);
  f.push(ruido(b, filtro(ctx, er, 'lowpass', 420, 0.9), t, 0.12));
  const es = envelope(ctx, d, t, 0.001, g * 0.12, 0.025);
  f.push(ruido(b, filtro(ctx, es, 'bandpass', 1800, 1.2), t, 0.04));
  return f;
};

/** Lamento que cai (3 s) e o corpo batendo no chão. */
export const chefeMorto: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = curvaGanho(ctx, d, t, [[0.15, 0.45], [1.6, 0.3], [3.0, MIN]]);
  const f = voz(b, g, t, {
    curva: [[0, 430], [1.0, 240], [3.0, 62]], formantes: [[600, 3], [1000, 4], [2300, 6]], vibrato: 0.05, dur: 3,
  });
  const er = envelope(ctx, d, t, 0.2, 0.08, 2.6);
  f.push(ruido(b, filtro(ctx, er, 'bandpass', 800, 1), t, 2.9));
  f.push(...baque(b, d, t + 0.6, 0.5));
  return f;
};

/** Chiado hidráulico curto (válvula) de `dur` s. */
function chiado(b: Bancada, d: AudioNode, t: number, dur: number, ganho: number): Fontes {
  const { ctx } = b;
  const e = envelope(ctx, d, t, 0.02, ganho, dur);
  const bp = filtro(ctx, e, 'bandpass', 3200, 0.9);
  bp.frequency.setValueAtTime(3600, t);
  bp.frequency.exponentialRampToValueAtTime(1500, t + dur);
  return [ruido(b, filtro(ctx, bp, 'highpass', 1200), t, dur + 0.05)];
}

/** Comporta fechando: chiado hidráulico e o baque pesado da chapa no chão (0,15 s depois). */
export const comportaFecha: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f = chiado(b, d, t, 0.25, 0.3);
  const et = envelope(ctx, d, t + 0.15, 0.002, 0.75, 0.45);
  f.push(tom(b, filtro(ctx, et, 'lowpass', 220), 'sine', 55, 26, t + 0.15, 0.45));
  f.push(...pancada(b, d, t + 0.15, 0.5));
  return f;
};

/** Comporta abrindo: chiado curto e o motor subindo. */
export const comportaAbre: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f = chiado(b, d, t, 0.35, 0.2);
  const em = envelope(ctx, d, t, 0.05, 0.2, 0.55);
  f.push(tom(b, filtro(ctx, em, 'lowpass', 260, 1.4), 'sawtooth', 44, 58, t, 0.6));
  return f;
};

/** Recarregando: bip grave de recusa, duas notas descendo. */
export const comportaRecusa: Sintese = (b, d, t) => {
  const { ctx } = b;
  return [[0, 140], [0.16, 104]].map(([k, fq]) => {
    const e = envelope(ctx, d, t + k, 0.004, 0.32, 0.14);
    return tom(b, filtro(ctx, e, 'lowpass', 700), 'square', fq, fq, t + k, 0.15);
  });
};

/**
 * Lamento do chefe inerte (laço): soluços de ruído filtrado com tremolo e um formante grave que
 * entra e sai devagar, com a altura caindo a cada soluço.
 */
export function lamentoInerte(b: Bancada, destino: AudioNode): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  // soluço: ruído em banda com tremolo irregular
  const r = ctx.createBufferSource();
  r.buffer = b.ruido;
  r.loop = true;
  const trem = ctx.createGain();
  trem.gain.value = 0.5;
  const lfoTrem = ctx.createOscillator();
  lfoTrem.frequency.value = 4.6;
  const profTrem = ctx.createGain();
  profTrem.gain.value = 0.45;
  lfoTrem.connect(profTrem);
  profTrem.connect(trem.gain);
  const gr = ctx.createGain();
  gr.gain.value = 0.35;
  gr.connect(saida);
  trem.connect(filtro(ctx, gr, 'bandpass', 850, 2.5));
  r.connect(trem);
  // voz grave intermitente: porta lenta (quadrada suavizada) sobre uma serra por formantes
  const v = ctx.createOscillator();
  v.type = 'sawtooth';
  v.frequency.value = 112;
  const lfoAltura = ctx.createOscillator();
  lfoAltura.frequency.value = 0.21;
  const profAltura = ctx.createGain();
  profAltura.gain.value = 9;
  lfoAltura.connect(profAltura);
  profAltura.connect(v.frequency);
  const porta = ctx.createGain();
  porta.gain.value = 0.5;
  const lfoPorta = ctx.createOscillator();
  lfoPorta.type = 'square';
  lfoPorta.frequency.value = 0.33;
  const suave = ctx.createBiquadFilter();
  suave.type = 'lowpass';
  suave.frequency.value = 3;
  const profPorta = ctx.createGain();
  profPorta.gain.value = 0.5;
  lfoPorta.connect(suave);
  suave.connect(profPorta);
  profPorta.connect(porta.gain);
  const gv = ctx.createGain();
  gv.gain.value = 0.22;
  gv.connect(saida);
  for (const [fq, q] of [[380, 4], [760, 5]] as const) porta.connect(filtro(ctx, gv, 'bandpass', fq, q));
  v.connect(porta);
  return laco(ctx, destino, [r, lfoTrem, v, lfoAltura, lfoPorta], saida, 0.6);
}
