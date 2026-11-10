import { AnimationClip, AnimationUtils } from 'three';
import type { ModoIA } from '../../sim/world';

export type AnimacaoDoutor = 'Idle_02' | 'Walking' | 'Unsteady_Walk' | 'Running' | 'Run_02' | 'Dano' | 'Dead';

/** Retira só o deslocamento horizontal do quadril; a simulação continua comandando a posição. */
export function prepararAnimacoesDoutor(clips: readonly AnimationClip[]): AnimationClip[] {
  const preparados = clips.map((original) => {
    const clip = original.clone();
    for (const t of clip.tracks) {
      if (t.name !== 'mixamorigHips.position') continue;
      for (let i = 0; i < t.values.length; i += 3) { t.values[i] = 0; t.values[i + 2] = 0; }
    }
    return clip;
  });
  const dano = preparados.find((a) => a.name === 'Gunshot_Reaction');
  if (dano) preparados.push(AnimationUtils.subclip(dano, 'Dano', 0, 40, 60));
  return preparados;
}

export function animacaoDoDoutor(modo: ModoIA, velocidade: number): AnimacaoDoutor {
  if (modo === 'morto') return 'Dead';
  if (modo === 'dor') return 'Dano';
  if (modo === 'ataque' || modo === 'dormindo' || velocidade < .12) return 'Idle_02';
  if (modo === 'perseguicao' && velocidade > 3) return 'Run_02';
  return 'Unsteady_Walk';
}
