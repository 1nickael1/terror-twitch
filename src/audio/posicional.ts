// Som 3D: PannerNode (HRTF, queda inversa) na posição da fonte e o ouvinte nos olhos do jogador.
// Fonte fora da linha de visão passa por um passa-baixa e perde ganho (oclusão barata).
import { POSICIONAL, type Ouvinte } from './regras';

/**
 * Cadeia já ligada entre si, na ordem do sinal: [filtro?, ganho?, panner]. Quem toca liga a voz
 * no primeiro nó e o último no barramento.
 */
export function criarCadeiaPosicional(ctx: AudioContext, x: number, y: number, z: number, ocluido: boolean): AudioNode[] {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = POSICIONAL.refDistance;
  p.maxDistance = POSICIONAL.maxDistance;
  p.rolloffFactor = POSICIONAL.rolloffFactor;
  if (p.positionX) {
    p.positionX.value = x;
    p.positionY.value = y;
    p.positionZ.value = z;
  } else {
    p.setPosition(x, y, z);
  }
  if (!ocluido) return [p];
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = POSICIONAL.corteOclusao;
  const g = ctx.createGain();
  g.gain.value = POSICIONAL.ganhoOclusao;
  f.connect(g);
  g.connect(p);
  return [f, g, p];
}

/** Ouvinte nos olhos, olhando para frente = (-sin yaw, 0, -cos yaw), cima = (0, 1, 0). */
export function atualizarOuvinte(ctx: AudioContext, o: Ouvinte): void {
  const l = ctx.listener;
  const fx = -Math.sin(o.yaw);
  const fz = -Math.cos(o.yaw);
  if (l.positionX) {
    const t = ctx.currentTime;
    const k = 0.015;
    l.positionX.setTargetAtTime(o.pos.x, t, k);
    l.positionY.setTargetAtTime(o.y, t, k);
    l.positionZ.setTargetAtTime(o.pos.z, t, k);
    l.forwardX.setTargetAtTime(fx, t, k);
    l.forwardY.setTargetAtTime(0, t, k);
    l.forwardZ.setTargetAtTime(fz, t, k);
    l.upX.setTargetAtTime(0, t, k);
    l.upY.setTargetAtTime(1, t, k);
    l.upZ.setTargetAtTime(0, t, k);
  } else {
    // navegadores sem AudioParam no ouvinte (Firefox antigo)
    l.setPosition(o.pos.x, o.y, o.pos.z);
    l.setOrientation(fx, 0, fz, 0, 1, 0);
  }
}
