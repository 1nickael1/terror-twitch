// Poses procedurais dos inimigos por estado (`inimigo.modo`): andar na cadência da velocidade,
// preparo e golpe do ataque (garras, arma ou arremesso), solavanco da dor, deitado (morto, ou o
// emboscador `deitado` dormindo, desenhado como corpo), sentado encolhido (dormindo) e levantando
// (do chão até de pé, aos trancos, pelo progresso que a view mede).
import { TIPOS } from '../../sim/ai/tipos';
import type { Inimigo } from '../../sim/world';
import type { PoseBase } from './inimigosModelos';
import { estiloAtaque } from './moldesInimigos';

export const GOLPE = 0.22;           // s da animação do golpe depois do preparo
export const DOR_VISUAL = 0.3;       // s do solavanco

/** Pose animada completa (ângulos em rad, deslocamentos em m), já com a pose base do tipo. */
export interface Pose {
  corpoX: number; corpoY: number; corpoZ: number; pelveY: number;
  troncoX: number; troncoZ: number; cabecaX: number; cabecaZ: number;
  bracoEX: number; bracoEZ: number; bracoDX: number; bracoDZ: number; pernaEX: number; pernaDX: number;
  /** dobra do cotovelo (só nos moldes com antebraço; positivo = mão para a frente e para cima) */
  antebracoEX: number; antebracoDX: number;
}
export const CHAVES = [
  'corpoX', 'corpoY', 'corpoZ', 'pelveY', 'troncoX', 'troncoZ', 'cabecaX', 'cabecaZ',
  'bracoEX', 'bracoEZ', 'bracoDX', 'bracoDZ', 'pernaEX', 'pernaDX', 'antebracoEX', 'antebracoDX',
] as const;
export const novaPose = (): Pose => ({
  corpoX: 0, corpoY: 0, corpoZ: 0, pelveY: 0, troncoX: 0, troncoZ: 0, cabecaX: 0, cabecaZ: 0,
  bracoEX: 0, bracoEZ: 0, bracoDX: 0, bracoDZ: 0, pernaEX: 0, pernaDX: 0, antebracoEX: 0, antebracoDX: 0,
});

/**
 * Estado visual guardado pela view (tempo, velocidade medida, fase da passada, golpe, dor).
 * `levantar`: progresso (0..1) de quem está `levantando` (a view mede pelo `timer` do início).
 */
export interface EstadoVisual { t: number; vel: number; passada: number; golpe: number; dor: number; levantar?: number }
type EstadoSim = Pick<Inimigo, 'modo' | 'timer' | 'tipo'>;

export function aproximar(de: number, para: number, k: number): number {
  return de + (para - de) * k;
}

/** Fração do preparo em que a pose de ataque já está completa (rampa que chega cedo). */
export const RAMPA_PREPARO = 0.6;
/** Fração do levantar em que o corpo já está sentado (depois, fica de pé). */
export const SENTADO_EM = 0.45;

function tipoOuNada(tipo: string) {
  return Object.prototype.hasOwnProperty.call(TIPOS, tipo) ? TIPOS[tipo] : undefined;
}

/**
 * Progresso (0..1) de quem está `levantando`: `total` é o `timer` visto ao começar (0,8 s do emboscador,
 * 1,2 s do corpo reanimado). Total inválido conta como pronto.
 */
export function progressoLevantar(timer: number, total: number): number {
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, 1 - timer / total));
}

/** O inimigo é desenhado como corpo no chão (morto, ou emboscador `deitado` ainda dormindo)? */
export function desenhadoComoCorpo(i: Pick<Inimigo, 'modo' | 'tipo'>): boolean {
  return i.modo === 'morto' || (i.modo === 'dormindo' && tipoOuNada(i.tipo)?.deitado === true);
}

/** De pé, parado, na pose base do tipo. */
function poseDePe(p: Pose, b: PoseBase): void {
  for (const c of CHAVES) p[c] = 0;
  p.pelveY = b.quadril;
  p.troncoX = b.troncoX;
  p.cabecaX = b.cabecaX;
  p.cabecaZ = b.cabecaZ;
  p.bracoEX = b.bracoX;
  p.bracoDX = b.bracoDFixo ?? b.bracoX;
  p.bracoEZ = -b.bracoZ;
  p.bracoDZ = b.bracoZ;
}

/** Deitado de costas: corpo girado para trás no pivô dos pés, braços abertos. */
function poseDeitada(p: Pose, b: PoseBase): void {
  poseDePe(p, b);
  p.corpoX = Math.PI / 2;
  p.corpoY = 0.16;
  p.troncoX = 0;
  p.cabecaX = 0.2;
  p.cabecaZ = b.cabecaZ + 0.6;
  p.bracoEX = 0.5;
  p.bracoDX = 0.9;
  p.bracoEZ = -0.9;
  p.bracoDZ = 0.6;
  p.pernaEX = 0.1;
  p.pernaDX = -0.15;
}

/** Sentado no chão, encolhido, cabeça caída; respira devagar. */
function poseSentada(p: Pose, b: PoseBase, t: number): void {
  poseDePe(p, b);
  const resp = Math.sin(t * 1.3) * 0.035;
  p.pelveY = 0.22;
  p.pernaEX = 1.35;
  p.pernaDX = 1.45;
  p.troncoX = -0.62 + resp;
  p.cabecaX = -0.55 - resp;
  p.cabecaZ = b.cabecaZ * 0.6 + 0.25;
  p.bracoEX = 0.55;
  p.bracoDX = 0.6;
  p.bracoEZ = -0.25;
  p.bracoDZ = 0.25;
}

const deitada = novaPose();
const sentada = novaPose();
const dePe = novaPose();

/**
 * Levantando (`k` 0..1): de costas no chão até sentado (o tronco sobe primeiro, aos trancos) e de
 * sentado até de pé, ainda curvado. Tremores fortes no começo que somem no fim.
 */
function poseLevantando(p: Pose, b: PoseBase, k: number, t: number): void {
  poseDeitada(deitada, b);
  poseSentada(sentada, b, t);
  poseDePe(dePe, b);
  if (k < SENTADO_EM) {
    const e = k / SENTADO_EM;
    const suave = e * e * (3 - 2 * e);
    for (const c of CHAVES) p[c] = aproximar(deitada[c], sentada[c], suave);
  } else {
    const e = (k - SENTADO_EM) / (1 - SENTADO_EM);
    const suave = e * e * (3 - 2 * e);
    for (const c of CHAVES) p[c] = aproximar(sentada[c], dePe[c], suave);
    // ainda curvado ao terminar de levantar; os braços pendem para a frente
    p.troncoX -= 0.25 * (1 - e);
    p.bracoEX += 0.3 * (1 - e);
    p.bracoDX += 0.3 * (1 - e);
  }
  // trancos: a cabeça e o tronco sacodem, mais forte no começo
  const forca = 0.12 * (1 - k);
  p.cabecaX += Math.sin(t * 23) * forca * 1.5;
  p.cabecaZ += Math.sin(t * 17 + 1) * forca;
  p.troncoZ += Math.sin(t * 19 + 2) * forca * 0.6;
  p.bracoEZ -= Math.abs(Math.sin(t * 13)) * forca;
  p.bracoDZ += Math.abs(Math.sin(t * 11 + 1)) * forca;
}

/**
 * Calcula em `p` a pose alvo do estado atual (somada à pose base `b` do tipo). Devolve o
 * progresso da pose de preparo do ataque (0 fora do ataque, 1 = pronto para golpear).
 */
export function calcularPose(p: Pose, b: PoseBase, v: EstadoVisual, i: EstadoSim): number {
  if (desenhadoComoCorpo(i)) {
    poseDeitada(p, b);
    return 0;
  }
  if (i.modo === 'dormindo') {
    poseSentada(p, b, v.t);
    return 0;
  }
  if (i.modo === 'levantando') {
    poseLevantando(p, b, Math.min(1, Math.max(0, v.levantar ?? 0)), v.t);
    return 0;
  }
  poseDePe(p, b);
  const estilo = estiloAtaque(b);

  // andar: balanço na cadência da velocidade medida; o manco arrasta a perna direita
  const amp = Math.min(1, v.vel / 2.5) * 0.55;
  const s = Math.sin(v.passada);
  const manco = b.manco ?? 0;
  p.pernaEX = s * amp;
  p.pernaDX = -s * amp * (1 - manco * 0.6);
  const atraso = b.mole * 0.6; // braço mole atrasa em relação à perna
  const sb = Math.sin(v.passada - atraso) * amp * b.balancoBraco;
  p.bracoEX -= sb;
  if (b.bracoDFixo === null) p.bracoDX += sb;
  p.pelveY += Math.abs(Math.cos(v.passada)) * 0.035 * Math.min(1, v.vel / 2.5);
  p.troncoZ = Math.sin(v.passada) * 0.04 * amp * (1 + b.mole);
  if (manco > 0) {
    // o quadril pende para o lado da perna arrastada e a cabeça acompanha aos trancos
    p.troncoZ += manco * (0.08 + Math.max(0, -s) * 0.1 * Math.min(1, v.vel / 1.5));
    p.pelveY -= manco * Math.max(0, -s) * 0.04 * Math.min(1, v.vel / 1.5);
  }
  // parado: balança de leve (respiração; o funcionário oscila a cabeça)
  p.troncoX += Math.sin(v.t * 1.7) * 0.02;
  p.cabecaZ += Math.sin(v.t * 0.9) * 0.08 * b.mole;
  if (i.modo === 'perseguicao') p.troncoX -= 0.12 * Math.min(1, v.vel / 2);

  const t = tipoOuNada(i.tipo);
  let preparoK = 0;
  if (i.modo === 'ataque') {
    // preparo: o jogador precisa ler o golpe antes
    const preparo = t?.preparo ?? 0.5;
    const k = Math.min(1, Math.max(0, (1 - i.timer / preparo) / RAMPA_PREPARO));
    preparoK = k;
    const tremor = Math.sin(v.t * 40) * 0.03 * k;
    if (estilo === 'garras') {
      // recua o tronco, ergue os dois braços bem acima da cabeça (quase na vertical)
      p.troncoX = aproximar(p.troncoX, 0.18, k);
      p.cabecaX = aproximar(p.cabecaX, 0.25, k);
      p.bracoEX = aproximar(p.bracoEX, 2.85, k) + tremor;
      p.bracoDX = aproximar(p.bracoDX, 3.0, k) - tremor;
      p.bracoEZ = aproximar(p.bracoEZ, -0.3, k);
      p.bracoDZ = aproximar(p.bracoDZ, 0.3, k);
    } else if (estilo === 'arma') {
      // inclina para a frente, ergue o braço da arma à altura dos olhos e firma com o outro
      p.troncoX = aproximar(p.troncoX, -0.14, k);
      p.bracoDX = aproximar(p.bracoDX, 1.62, k) + tremor;
      p.bracoEX = aproximar(p.bracoEX, 1.3, k);
      p.bracoEZ = aproximar(p.bracoEZ, 0.35, k);
    } else {
      // arremesso: o braço direito vai para trás da cabeça (frasco no alto), o esquerdo mira à frente
      p.troncoX = aproximar(p.troncoX, 0.16, k);
      p.troncoZ = aproximar(p.troncoZ, -0.12, k);
      p.cabecaX = aproximar(p.cabecaX, 0.1, k);
      p.bracoDX = aproximar(p.bracoDX, -2.5, k) + tremor;
      p.bracoDZ = aproximar(p.bracoDZ, 0.35, k);
      p.bracoEX = aproximar(p.bracoEX, 1.25, k);
      p.bracoEZ = aproximar(p.bracoEZ, 0.2, k);
    }
    p.pernaEX = -0.25 * k;
    p.pernaDX = 0.2 * k;
  }
  if (v.golpe >= 0) {
    const k = v.golpe / GOLPE;
    if (estilo === 'garras') {
      // braços descem com tudo e o tronco avança
      p.troncoX = aproximar(0.18, -0.5, Math.min(1, k * 2));
      p.bracoEX = aproximar(2.85, 0.2, Math.min(1, k * 2.5));
      p.bracoDX = aproximar(3.0, 0.1, Math.min(1, k * 2.5));
    } else if (estilo === 'arma') {
      // coice do disparo
      p.bracoDX = 1.62 + Math.sin(k * Math.PI) * 0.45;
      p.troncoX = 0.08 * Math.sin(k * Math.PI);
    } else {
      // o braço passa por cima do ombro e termina à frente, o tronco acompanha
      p.bracoDX = aproximar(-2.5, 1.5, Math.min(1, k * 2.2));
      p.troncoX = aproximar(0.16, -0.35, Math.min(1, k * 2));
      p.troncoZ = aproximar(-0.12, 0.1, Math.min(1, k * 2));
    }
  }
  if (v.dor < DOR_VISUAL) {
    // solavanco para trás
    const e = (1 - v.dor / DOR_VISUAL) ** 2;
    p.troncoX += 0.5 * e;
    p.cabecaX += 0.35 * e;
    p.corpoZ += 0.12 * e;
    p.bracoEX += 0.5 * e;
    p.bracoDX += estilo === 'arma' ? 0.2 * e : 0.5 * e;
    p.bracoEZ -= 0.3 * e;
    p.bracoDZ += 0.3 * e;
  }
  return preparoK;
}
