// Poses procedurais dos inimigos por estado (`inimigo.modo`): andar na cadência da velocidade,
// preparo e golpe do ataque, solavanco da dor, deitado (morto) e sentado encolhido (dormindo).
import { TIPOS } from '../../sim/ai/tipos';
import type { Inimigo } from '../../sim/world';
import type { PoseBase } from './inimigosModelos';

export const GOLPE = 0.22;           // s da animação do golpe depois do preparo
export const DOR_VISUAL = 0.3;       // s do solavanco

/** Pose animada completa (ângulos em rad, deslocamentos em m), já com a pose base do tipo. */
export interface Pose {
  corpoX: number; corpoY: number; corpoZ: number; pelveY: number;
  troncoX: number; troncoZ: number; cabecaX: number; cabecaZ: number;
  bracoEX: number; bracoEZ: number; bracoDX: number; bracoDZ: number; pernaEX: number; pernaDX: number;
}
export const CHAVES = [
  'corpoX', 'corpoY', 'corpoZ', 'pelveY', 'troncoX', 'troncoZ', 'cabecaX', 'cabecaZ',
  'bracoEX', 'bracoEZ', 'bracoDX', 'bracoDZ', 'pernaEX', 'pernaDX',
] as const;
export const novaPose = (): Pose => ({
  corpoX: 0, corpoY: 0, corpoZ: 0, pelveY: 0, troncoX: 0, troncoZ: 0, cabecaX: 0, cabecaZ: 0,
  bracoEX: 0, bracoEZ: 0, bracoDX: 0, bracoDZ: 0, pernaEX: 0, pernaDX: 0,
});

/** Estado visual guardado pela view (tempo, velocidade medida, fase da passada, golpe, dor). */
export interface EstadoVisual { t: number; vel: number; passada: number; golpe: number; dor: number }
type EstadoSim = Pick<Inimigo, 'modo' | 'timer' | 'tipo'>;

export function aproximar(de: number, para: number, k: number): number {
  return de + (para - de) * k;
}

/** Fração do preparo em que a pose de ataque já está completa (rampa que chega cedo). */
export const RAMPA_PREPARO = 0.6;

/**
 * Calcula em `p` a pose alvo do estado atual (somada à pose base `b` do tipo). Devolve o
 * progresso da pose de preparo do ataque (0 fora do ataque, 1 = pronto para golpear).
 */
export function calcularPose(p: Pose, b: PoseBase, v: EstadoVisual, i: EstadoSim): number {
  for (const c of CHAVES) p[c] = 0;
  p.pelveY = b.quadril;
  p.troncoX = b.troncoX;
  p.cabecaX = b.cabecaX;
  p.cabecaZ = b.cabecaZ;
  p.bracoEX = b.bracoX;
  p.bracoDX = b.bracoDFixo ?? b.bracoX;
  p.bracoEZ = -b.bracoZ;
  p.bracoDZ = b.bracoZ;

  if (i.modo === 'morto') {
    // deitado de costas: corpo girado para trás no pivô dos pés, braços abertos
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
    return 0;
  }
  if (i.modo === 'dormindo') {
    // sentado no chão, encolhido, cabeça caída; respira devagar
    const resp = Math.sin(v.t * 1.3) * 0.035;
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
    return 0;
  }

  // andar: balanço na cadência da velocidade medida
  const amp = Math.min(1, v.vel / 2.5) * 0.55;
  const s = Math.sin(v.passada);
  p.pernaEX = s * amp;
  p.pernaDX = -s * amp;
  const atraso = b.mole * 0.6; // braço mole atrasa em relação à perna
  const sb = Math.sin(v.passada - atraso) * amp * b.balancoBraco;
  p.bracoEX -= sb;
  if (b.bracoDFixo === null) p.bracoDX += sb;
  p.pelveY += Math.abs(Math.cos(v.passada)) * 0.035 * Math.min(1, v.vel / 2.5);
  p.troncoZ = Math.sin(v.passada) * 0.04 * amp * (1 + b.mole);
  // parado: balança de leve (respiração; o funcionário oscila a cabeça)
  p.troncoX += Math.sin(v.t * 1.7) * 0.02;
  p.cabecaZ += Math.sin(v.t * 0.9) * 0.08 * b.mole;
  if (i.modo === 'perseguicao') p.troncoX -= 0.12 * Math.min(1, v.vel / 2);

  const t = Object.prototype.hasOwnProperty.call(TIPOS, i.tipo) ? TIPOS[i.tipo] : undefined;
  let preparoK = 0;
  if (i.modo === 'ataque') {
    // preparo: o jogador precisa ler o golpe antes
    const preparo = t?.preparo ?? 0.5;
    const k = Math.min(1, Math.max(0, (1 - i.timer / preparo) / RAMPA_PREPARO));
    preparoK = k;
    const tremor = Math.sin(v.t * 40) * 0.03 * k;
    if (b.bracoDFixo === null) {
      // funcionário: recua o tronco, ergue os dois braços bem acima da cabeça (quase na vertical)
      p.troncoX = aproximar(p.troncoX, 0.18, k);
      p.cabecaX = aproximar(p.cabecaX, 0.25, k);
      p.bracoEX = aproximar(p.bracoEX, 2.85, k) + tremor;
      p.bracoDX = aproximar(p.bracoDX, 3.0, k) - tremor;
      p.bracoEZ = aproximar(p.bracoEZ, -0.3, k);
      p.bracoDZ = aproximar(p.bracoDZ, 0.3, k);
    } else {
      // segurança: inclina para a frente, ergue o braço da arma à altura dos olhos e firma com o outro
      p.troncoX = aproximar(p.troncoX, -0.14, k);
      p.bracoDX = aproximar(p.bracoDX, 1.62, k) + tremor;
      p.bracoEX = aproximar(p.bracoEX, 1.3, k);
      p.bracoEZ = aproximar(p.bracoEZ, 0.35, k);
    }
    p.pernaEX = -0.25 * k;
    p.pernaDX = 0.2 * k;
  }
  if (v.golpe >= 0) {
    const k = v.golpe / GOLPE;
    if (b.bracoDFixo === null) {
      // braços descem com tudo e o tronco avança
      p.troncoX = aproximar(0.18, -0.5, Math.min(1, k * 2));
      p.bracoEX = aproximar(2.85, 0.2, Math.min(1, k * 2.5));
      p.bracoDX = aproximar(3.0, 0.1, Math.min(1, k * 2.5));
    } else {
      // coice do disparo
      p.bracoDX = 1.62 + Math.sin(k * Math.PI) * 0.45;
      p.troncoX = 0.08 * Math.sin(k * Math.PI);
    }
  }
  if (v.dor < DOR_VISUAL) {
    // solavanco para trás
    const e = (1 - v.dor / DOR_VISUAL) ** 2;
    p.troncoX += 0.5 * e;
    p.cabecaX += 0.35 * e;
    p.corpoZ += 0.12 * e;
    p.bracoEX += 0.5 * e;
    p.bracoDX += b.bracoDFixo === null ? 0.5 * e : 0.2 * e;
    p.bracoEZ -= 0.3 * e;
    p.bracoDZ += 0.3 * e;
  }
  return preparoK;
}
