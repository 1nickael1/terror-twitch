// Respiração áspera, voz humana degradada, tecido e sapatos do médico de jaleco.
import { baque, envelope, filtro, grunhido, ruido, tom, variar, type Sintese } from './sintese';

export const doutorAlerta: Sintese = (b, d, t) => {
  const sopro = envelope(b.ctx, d, t, .12, .21, .48);
  return [...grunhido(b, d, t + .1, { f0: 112, f1: 78, dur: .65, ganho: .29 }), ruido(b, filtro(b.ctx, sopro, 'bandpass', 1250, .8), t, .7)];
};
export const doutorAtaque: Sintese = (b, d, t) => {
  const roupa = envelope(b.ctx, d, t + .08, .025, .09, .23);
  return [...grunhido(b, d, t, { f0: 165, f1: 98, dur: .28, ganho: .36 }), ruido(b, filtro(b.ctx, roupa, 'bandpass', 1800, .6), t + .08, .27)];
};
export const doutorDor: Sintese = (b, d, t) => grunhido(b, d, t, { f0: 190, f1: 115, dur: .18, ganho: .32 });
export const doutorMorte: Sintese = (b, d, t) => {
  const exalar = envelope(b.ctx, d, t + .25, .08, .15, 1.1);
  // O corpo toca o piso perto do fim de Dead (2,97 s), não no início da queda.
  return [...grunhido(b, d, t, { f0: 120, f1: 42, dur: .85, ganho: .31 }), ruido(b, filtro(b.ctx, exalar, 'bandpass', 750, .6), t + .25, 1.2), ...baque(b, d, t + 2.15, .28)];
};
export const doutorPasso: Sintese = (b, d, t) => {
  const sola = envelope(b.ctx, d, t, .004, .18, .075);
  const tecido = envelope(b.ctx, d, t + .015, .012, .055, .11);
  const grave = envelope(b.ctx, d, t, .003, .1, .08);
  return [ruido(b, filtro(b.ctx, sola, 'bandpass', variar(650, .25), .7), t, .1), ruido(b, filtro(b.ctx, tecido, 'bandpass', 1750, .6), t + .015, .15), tom(b, grave, 'sine', variar(100), 52, t, .09)];
};
