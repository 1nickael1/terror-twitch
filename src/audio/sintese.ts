// Síntese dos sons do jogo, toda em WebAudio (nenhum arquivo de som). Cada função monta o som
// a partir de `t`, conecta a saída em `destino` e devolve as fontes (para saber quando acaba).
// Timbre de terror: seco, grave, pouco brilho. Base: um buffer de ruído branco gerado uma vez.

export interface Bancada {
  ctx: AudioContext;
  /** ruído branco (2 s), gerado uma vez pelo mixer */
  ruido: AudioBuffer;
  /** se presente, recebe toda fonte iniciada (o mixer para as órfãs se a síntese lançar no meio) */
  coletor: AudioScheduledSourceNode[] | null;
}

/** Inicia a fonte em `t` (com `offset`, para buffers), agenda o fim e a registra no coletor da bancada. */
function iniciar<T extends AudioScheduledSourceNode>(b: Bancada, f: T, t: number, fim: number, offset?: number): T {
  // `OscillatorNode.start` ignora o segundo argumento
  (f as AudioScheduledSourceNode as AudioBufferSourceNode).start(t, offset);
  b.coletor?.push(f);
  f.stop(fim);
  return f;
}

export type Fontes = AudioScheduledSourceNode[];
export type Sintese = (b: Bancada, destino: AudioNode, t: number) => Fontes;

/** piso das rampas exponenciais (não pode chegar a 0) */
const MIN = 0.0001;

export function criarRuidoBranco(ctx: AudioContext, segundos = 2): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Ruído rosa (filtro de Paul Kellet), para camas em laço. */
export function criarRuidoRosa(ctx: AudioContext, segundos = 4): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

// ---------- blocos ----------

/** Envelope: 0 → `pico` em `ataque` s, queda exponencial até quase 0 em `queda` s. */
function envelope(ctx: AudioContext, destino: AudioNode, t: number, ataque: number, pico: number, queda: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN, t);
  g.gain.exponentialRampToValueAtTime(Math.max(MIN, pico), t + ataque);
  g.gain.exponentialRampToValueAtTime(MIN, t + ataque + queda);
  g.connect(destino);
  return g;
}

function filtro(ctx: AudioContext, destino: AudioNode, tipo: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(destino);
  return f;
}

/** Trecho de ruído branco começando num ponto aleatório do buffer. */
function ruido(b: Bancada, destino: AudioNode, t: number, dur: number, taxa = 1): AudioBufferSourceNode {
  const s = b.ctx.createBufferSource();
  s.buffer = b.ruido;
  s.loop = true;
  s.playbackRate.value = taxa;
  s.connect(destino);
  return iniciar(b, s, t, t + dur, Math.random() * (b.ruido.duration - 0.1));
}

/** Oscilador com queda exponencial de frequência `f0 → f1` em `dur` s. */
function tom(b: Bancada, destino: AudioNode, tipo: OscillatorType, f0: number, f1: number, t: number, dur: number): OscillatorNode {
  const o = b.ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  o.connect(destino);
  return iniciar(b, o, t, t + dur + 0.02);
}

/** pequena variação aleatória (±fração) para repetições não soarem idênticas */
function variar(v: number, fracao = 0.08): number {
  return v * (1 + (Math.random() * 2 - 1) * fracao);
}

/** Estalo de ruído filtrado + queda rápida de um oscilador grave: a base dos tiros. */
function disparo(
  b: Bancada, destino: AudioNode, t: number,
  o: { corte: number; q: number; ganhoRuido: number; quedaRuido: number; f0: number; f1: number; ganhoTom: number; quedaTom: number },
): Fontes {
  const { ctx } = b;
  const er = envelope(ctx, destino, t, 0.002, o.ganhoRuido, o.quedaRuido);
  const lp = filtro(ctx, er, 'lowpass', o.corte * 1.8);
  const bp = filtro(ctx, lp, 'bandpass', variar(o.corte), o.q);
  const et = envelope(ctx, destino, t, 0.002, o.ganhoTom, o.quedaTom);
  return [ruido(b, bp, t, o.quedaRuido + 0.05), tom(b, et, 'sine', variar(o.f0, 0.05), o.f1, t, o.quedaTom)];
}

// ---------- armas ----------

export const tiroPistola: Sintese = (b, d, t) =>
  disparo(b, d, t, { corte: 1700, q: 0.8, ganhoRuido: 0.55, quedaRuido: 0.13, f0: 150, f1: 45, ganhoTom: 0.45, quedaTom: 0.16 });

export const tiroEscopeta: Sintese = (b, d, t) => {
  // soma dos picos (ruído + tom + cauda) = 1,3: a arma mais forte
  const f = disparo(b, d, t, { corte: 1100, q: 0.5, ganhoRuido: 0.6, quedaRuido: 0.32, f0: 100, f1: 30, ganhoTom: 0.55, quedaTom: 0.32 });
  // cauda grave do estampido
  const cauda = envelope(b.ctx, d, t + 0.01, 0.02, 0.15, 0.55);
  f.push(ruido(b, filtro(b.ctx, cauda, 'lowpass', 450), t + 0.01, 0.65));
  return f;
};

export const tiroSmg: Sintese = (b, d, t) =>
  disparo(b, d, t, { corte: 2100, q: 0.9, ganhoRuido: 0.45, quedaRuido: 0.06, f0: 190, f1: 60, ganhoTom: 0.35, quedaTom: 0.07 });

export const disparoLancador: Sintese = (b, d, t) => {
  const { ctx } = b;
  const et = envelope(ctx, d, t, 0.004, 0.65, 0.28);
  const es = envelope(ctx, d, t, 0.015, 0.35, 0.35);
  const bp = filtro(ctx, es, 'bandpass', 500, 0.9);
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.exponentialRampToValueAtTime(250, t + 0.35);
  return [tom(b, et, 'sine', 75, 32, t, 0.28), ruido(b, bp, t, 0.4)];
};

export const explosao: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = envelope(ctx, d, t, 0.005, 0.7, 1.5);
  const lp = filtro(ctx, er, 'lowpass', 1000, 0.5);
  lp.frequency.setValueAtTime(1100, t);
  lp.frequency.exponentialRampToValueAtTime(140, t + 1.4);
  const et = envelope(ctx, d, t, 0.005, 0.6, 0.9);
  return [ruido(b, lp, t, 1.6, 0.7), tom(b, et, 'sine', 60, 24, t, 0.9)];
};

// ---------- impactos e corpo do jogador ----------

export const impactoParede: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = envelope(ctx, d, t, 0.001, 0.35, 0.05);
  const et = envelope(ctx, d, t, 0.001, 0.15, 0.045);
  return [ruido(b, filtro(ctx, er, 'bandpass', variar(2300, 0.2), 1.8), t, 0.07), tom(b, et, 'triangle', variar(320), 120, t, 0.045)];
};

export const impactoCarne: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = envelope(ctx, d, t, 0.002, 0.28, 0.09);
  const et = envelope(ctx, d, t, 0.002, 0.22, 0.08);
  return [ruido(b, filtro(ctx, er, 'lowpass', variar(700, 0.15)), t, 0.11), tom(b, et, 'sine', variar(110), 55, t, 0.08)];
};

export const passo: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = envelope(ctx, d, t, 0.003, 0.13, 0.07);
  const et = envelope(ctx, d, t, 0.003, 0.07, 0.06);
  return [ruido(b, filtro(ctx, er, 'lowpass', variar(380, 0.2)), t, 0.09), tom(b, et, 'sine', variar(75), 48, t, 0.06)];
};

export const pulo: Sintese = (b, d, t) => {
  const er = envelope(b.ctx, d, t, 0.01, 0.12, 0.1);
  return [ruido(b, filtro(b.ctx, er, 'bandpass', 420, 1.2), t, 0.13)];
};

export const pouso: Sintese = (b, d, t) => {
  const { ctx } = b;
  const er = envelope(ctx, d, t, 0.002, 0.16, 0.12);
  const et = envelope(ctx, d, t, 0.002, 0.14, 0.12);
  return [ruido(b, filtro(ctx, er, 'lowpass', 260), t, 0.15), tom(b, et, 'sine', 62, 34, t, 0.12)];
};

export const dorJogador: Sintese = (b, d, t) => {
  const { ctx } = b;
  const et = envelope(ctx, d, t, 0.004, 0.5, 0.22);
  const er = envelope(ctx, d, t, 0.005, 0.3, 0.25);
  return [
    tom(b, filtro(ctx, et, 'lowpass', 420), 'sine', 95, 48, t, 0.22),
    ruido(b, filtro(ctx, er, 'lowpass', 900), t, 0.3),
  ];
};

// ---------- portas ----------

/** Baque seco da porta batendo no batente. */
function baque(b: Bancada, d: AudioNode, t: number, ganho: number): Fontes {
  const { ctx } = b;
  const et = envelope(ctx, d, t, 0.003, ganho, 0.18);
  const er = envelope(ctx, d, t, 0.002, ganho * 0.6, 0.12);
  return [tom(b, et, 'sine', 85, 40, t, 0.18), ruido(b, filtro(ctx, er, 'lowpass', 320), t, 0.15)];
}

/** `motor`: zumbido curto de servo (abrindo/fechando); sem motor, só o baque. */
export function porta(b: Bancada, d: AudioNode, t: number, motor: boolean): Fontes {
  if (!motor) return baque(b, d, t, 0.32);
  const { ctx } = b;
  const em = envelope(ctx, d, t, 0.04, 0.32, 0.45);
  const lp = filtro(ctx, em, 'lowpass', 300, 1.5);
  const o = tom(b, lp, 'sawtooth', 52, 46, t, 0.5);
  const er = envelope(ctx, d, t, 0.04, 0.16, 0.45);
  return [o, ruido(b, filtro(ctx, er, 'bandpass', 180, 1.5), t, 0.5), ...baque(b, d, t + 0.45, 0.2)];
}

export const portaMotor: Sintese = (b, d, t) => porta(b, d, t, true);
export const portaBaque: Sintese = (b, d, t) => porta(b, d, t, false);

/** Dois bipes graves de recusa. */
export const portaNegada: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f: Fontes = [];
  for (const k of [0, 0.18]) {
    const e = envelope(ctx, d, t + k, 0.005, 0.3, 0.12);
    f.push(tom(b, filtro(ctx, e, 'lowpass', 600), 'square', 98, 98, t + k, 0.13));
  }
  return f;
};

// ---------- interface ----------

/** Bip curto ascendente, escuro (triângulo filtrado). */
export const pickup: Sintese = (b, d, t) => {
  const e = envelope(b.ctx, d, t, 0.005, 0.3, 0.1);
  return [tom(b, filtro(b.ctx, e, 'lowpass', 1600), 'triangle', 220, 330, t, 0.1)];
};

/** Clique mecânico duplo (trava e encaixe). */
export const armaTrocada: Sintese = (b, d, t) => {
  const { ctx } = b;
  const f: Fontes = [];
  for (const [k, fq] of [[0, 2600], [0.07, 1800]] as const) {
    const e = envelope(ctx, d, t + k, 0.001, 0.3, 0.02);
    f.push(ruido(b, filtro(ctx, e, 'bandpass', fq, 3), t + k, 0.03));
  }
  return f;
};

/** Clique seco do gatilho em vazio. */
export const semMunicao: Sintese = (b, d, t) => {
  const { ctx } = b;
  const e = envelope(ctx, d, t, 0.001, 0.25, 0.015);
  const et = envelope(ctx, d, t, 0.001, 0.05, 0.012);
  return [ruido(b, filtro(ctx, e, 'highpass', 2000), t, 0.025), tom(b, et, 'triangle', 900, 700, t, 0.012)];
};

/** Bip de interface (terminal, documento, gatilho `som: bip`). */
export const bip: Sintese = (b, d, t) => {
  const e = envelope(b.ctx, d, t, 0.004, 0.3, 0.08);
  return [tom(b, filtro(b.ctx, e, 'lowpass', 1400), 'square', 440, 440, t, 0.09)];
};

export const bipDiscreto: Sintese = (b, d, t) => {
  const e = envelope(b.ctx, d, t, 0.004, 0.15, 0.06);
  return [tom(b, e, 'sine', 360, 360, t, 0.07)];
};

/** Sequência de tons suaves (triângulo filtrado). */
function tons(b: Bancada, d: AudioNode, t: number, freqs: readonly number[], passo: number, dur: number, ganho: number): Fontes {
  return freqs.map((fq, k) => {
    const e = envelope(b.ctx, d, t + k * passo, 0.02, ganho, dur);
    return tom(b, filtro(b.ctx, e, 'lowpass', 1200), 'triangle', fq, fq, t + k * passo, dur);
  });
}

export const checkpoint: Sintese = (b, d, t) => tons(b, d, t, [220, 262], 0.2, 0.35, 0.2);
/** sol, si bemol, ré: três tons ascendentes em menor */
export const segredo: Sintese = (b, d, t) => tons(b, d, t, [196, 233, 294], 0.16, 0.4, 0.15);
/** acorde menor curto e grave */
export const faseConcluida: Sintese = (b, d, t) => tons(b, d, t, [110, 165, 220, 262], 0, 1.1, 0.08);

export const morteJogador: Sintese = (b, d, t) => {
  const { ctx } = b;
  const e = envelope(ctx, d, t, 0.02, 0.55, 1.6);
  const er = envelope(ctx, d, t, 0.05, 0.25, 1.5);
  return [
    tom(b, filtro(ctx, e, 'lowpass', 500), 'sawtooth', 160, 28, t, 1.6),
    ruido(b, filtro(ctx, er, 'lowpass', 200), t, 1.6, 0.5),
  ];
};

// ---------- inimigos ----------

/** Grunhido: dente-de-serra com vibrato passando por dois formantes graves, mais um sopro. */
export function grunhido(b: Bancada, d: AudioNode, t: number, o: { f0: number; f1: number; dur: number; ganho: number }): Fontes {
  const { ctx } = b;
  const e = envelope(ctx, d, t, 0.04, o.ganho, o.dur);
  const f1 = filtro(ctx, e, 'bandpass', 480, 1.6);
  const f2 = filtro(ctx, e, 'bandpass', 900, 2.5);
  const o1 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.setValueAtTime(variar(o.f0), t);
  o1.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  o1.connect(f1);
  o1.connect(f2);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = variar(7, 0.2);
  const prof = ctx.createGain();
  prof.gain.value = o.f0 * 0.08;
  lfo.connect(prof);
  prof.connect(o1.frequency);
  const fim = t + o.dur + 0.06;
  iniciar(b, o1, t, fim);
  iniciar(b, lfo, t, fim);
  const er = envelope(ctx, d, t, 0.03, o.ganho * 0.3, o.dur);
  return [o1, lfo, ruido(b, filtro(ctx, er, 'bandpass', 700, 1.2), t, o.dur + 0.05)];
}

export const grunhidoAlerta: Sintese = (b, d, t) => grunhido(b, d, t, { f0: 85, f1: 70, dur: 0.6, ganho: 0.46 });
export const grunhidoAtaque: Sintese = (b, d, t) => grunhido(b, d, t, { f0: 140, f1: 105, dur: 0.28, ganho: 0.46 });
export const dorInimigo: Sintese = (b, d, t) => grunhido(b, d, t, { f0: 120, f1: 75, dur: 0.22, ganho: 0.46 });

export const morteInimigo: Sintese = (b, d, t) => {
  const f = grunhido(b, d, t, { f0: 115, f1: 40, dur: 0.9, ganho: 0.46 });
  f.push(...baque(b, d, t + 0.75, 0.3));
  return f;
};

/** Sopro curto do projétil saindo. */
export const projetil: Sintese = (b, d, t) => {
  const e = envelope(b.ctx, d, t, 0.02, 0.3, 0.25);
  const bp = filtro(b.ctx, e, 'bandpass', 900, 1);
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(400, t + 0.27);
  return [ruido(b, bp, t, 0.3)];
};

// ---------- laços ----------

/** Laço contínuo: `parar(t)` faz uma rampa curta e desliga tudo. */
export interface Laco { saida: GainNode; parar: (t: number) => void }

/** subida do laço ao entrar (constante de tempo, s): sem degrau */
const ENTRADA_LACO = 0.05;

function laco(ctx: AudioContext, destino: AudioNode, fontes: AudioScheduledSourceNode[], saida: GainNode, alvo: number): Laco {
  const t = ctx.currentTime;
  saida.gain.setValueAtTime(0, t);
  if (alvo > 0) saida.gain.setTargetAtTime(alvo, t, ENTRADA_LACO);
  saida.connect(destino);
  for (const f of fontes) f.start();
  let parado = false;
  return {
    saida,
    parar: (t) => {
      if (parado) return;
      parado = true;
      saida.gain.cancelScheduledValues(t);
      saida.gain.setValueAtTime(saida.gain.value, t);
      saida.gain.linearRampToValueAtTime(0, t + 0.08);
      for (const f of fontes) {
        try {
          f.stop(t + 0.1);
        } catch {
          /* já parada */
        }
      }
      fontes[0].onended = () => saida.disconnect();
    },
  };
}

/** Sirene de dois tons (quadrada escura, alternando 330/440 Hz) em laço. */
export function alarme(b: Bancada, destino: AudioNode): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const lp = filtro(ctx, saida, 'lowpass', 1100, 1);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = 385;
  o.connect(lp);
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 0.8;
  const prof = ctx.createGain();
  prof.gain.value = 55;
  lfo.connect(prof);
  prof.connect(o.frequency);
  return laco(ctx, destino, [o, lfo], saida, 0.3);
}

/** Cama `zumbido`: ruído rosa bem filtrado + rede elétrica em 50 Hz com batimento lento. */
export function zumbido(b: Bancada, destino: AudioNode, rosa: AudioBuffer): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const r = ctx.createBufferSource();
  r.buffer = rosa;
  r.loop = true;
  const gr = ctx.createGain();
  gr.gain.value = 0.12;
  gr.connect(saida);
  r.connect(filtro(ctx, gr, 'lowpass', 320, 0.5));
  const go = ctx.createGain();
  go.gain.value = 0.035;
  go.connect(saida);
  const a = ctx.createOscillator();
  a.frequency.value = 50;
  const c = ctx.createOscillator();
  c.frequency.value = 50.35;
  const h = ctx.createOscillator();
  h.frequency.value = 100;
  const gh = ctx.createGain();
  gh.gain.value = 0.3;
  a.connect(go);
  c.connect(go);
  h.connect(gh);
  gh.connect(go);
  return laco(ctx, destino, [r, a, c, h], saida, 1);
}

/** Drone de tensão: dois osciladores graves desafinados + ruído filtrado; o ganho de `saida` segue a tensão. */
export function drone(b: Bancada, destino: AudioNode): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const lp = filtro(ctx, saida, 'lowpass', 240, 0.8);
  const a = ctx.createOscillator();
  a.type = 'triangle';
  a.frequency.value = 55;
  const c = ctx.createOscillator();
  c.type = 'triangle';
  c.frequency.value = 55.6;
  const go = ctx.createGain();
  go.gain.value = 0.35;
  go.connect(lp);
  a.connect(go);
  c.connect(go);
  const r = ctx.createBufferSource();
  r.buffer = b.ruido;
  r.loop = true;
  const gr = ctx.createGain();
  gr.gain.value = 0.2;
  gr.connect(saida);
  r.connect(filtro(ctx, gr, 'bandpass', 130, 1.2));
  return laco(ctx, destino, [a, c, r], saida, 0);
}
