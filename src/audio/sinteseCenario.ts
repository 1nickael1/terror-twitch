// Síntese dos sons de cenário citados pelas fases: ids da ação `som` (`sirene_curta`, `estalo`;
// `bip` fica em `sintese.ts`) e a cama de fundo `ventilacao`. WebAudio puro, nenhum arquivo.
import { envelope, filtro, iniciar, laco, ruido, tom, variar, type Bancada, type Fontes, type Laco, type Sintese } from './sintese';

/** Sirene curta (1,6 s): dois ciclos de subida e descida, quadrada escura. */
export const sireneCurta: Sintese = (b, d, t) => {
  const { ctx } = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
  g.gain.setValueAtTime(0.22, t + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  g.connect(d);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(280, t);
  for (const k of [0, 0.8]) {
    o.frequency.exponentialRampToValueAtTime(620, t + k + 0.4);
    o.frequency.exponentialRampToValueAtTime(280, t + k + 0.8);
  }
  o.connect(filtro(ctx, g, 'lowpass', 1300, 1));
  return [iniciar(b, o, t, t + 1.65)];
};

/** Estalo: dois ou três cliques secos de estrutura e uma batida grave de madeira/metal. */
export const estalo: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f: Fontes = [];
  for (const k of [0, 0.045, 0.11]) {
    const e = envelope(ctx, d, t + k, 0.001, variar(0.35, 0.3), 0.025);
    f.push(ruido(b, filtro(ctx, e, 'highpass', variar(1800, 0.3)), t + k, 0.04));
  }
  const et = envelope(ctx, d, t, 0.002, 0.2, 0.14);
  f.push(tom(b, filtro(ctx, et, 'bandpass', 220, 3), 'triangle', variar(190), 150, t, 0.14));
  return f;
};

/** Cama `ventilacao`: ruído rosa grave filtrado com uma leve ondulação lenta e um tom de duto. */
export function ventilacao(b: Bancada, destino: AudioNode, rosa: AudioBuffer): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const r = ctx.createBufferSource();
  r.buffer = rosa;
  r.loop = true;
  const onda = ctx.createGain();
  onda.gain.value = 0.13;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const prof = ctx.createGain();
  prof.gain.value = 0.035;
  lfo.connect(prof);
  prof.connect(onda.gain);
  onda.connect(saida);
  const lp = filtro(ctx, onda, 'lowpass', 520, 0.6);
  r.connect(lp);
  // ressonância do duto
  const gd = ctx.createGain();
  gd.gain.value = 0.6;
  gd.connect(onda);
  r.connect(filtro(ctx, gd, 'bandpass', 170, 4));
  return laco(ctx, destino, [r, lfo], saida, 1);
}
