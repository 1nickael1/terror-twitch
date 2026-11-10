// Recorte por oclusão da grade: objetos atrás de parede ou porta fechada não vão para a GPU. Conta pura.
import { visivel, type Grid, type Solido, type Vec2 } from '../../sim/grid';

/** Até esta distância (m) do olho tudo é desenhado (sem custo de raio e sem estalo na quina). */
export const PERTO_SEMPRE = 4;
/** Folga (m) além do raio para as amostras laterais: um ombro aparecendo na quina já conta. */
const FOLGA_LATERAL = 0.35;

/**
 * O objeto de `raio` em `alvo` pode aparecer para o olho: perto, ou com linha de visão em planta
 * até o centro ou até um dos dois pontos laterais (perpendiculares à linha olho→alvo).
 */
export function aVista(g: Grid, olho: Vec2, alvo: Vec2, raio: number, solido?: Solido): boolean {
  const dx = alvo.x - olho.x;
  const dz = alvo.z - olho.z;
  const d = Math.hypot(dx, dz);
  if (d <= PERTO_SEMPRE) return true;
  if (visivel(g, olho, alvo, solido)) return true;
  const lado = (raio + FOLGA_LATERAL) / d;
  const px = -dz * lado;
  const pz = dx * lado;
  return visivel(g, olho, { x: alvo.x + px, z: alvo.z + pz }, solido)
    || visivel(g, olho, { x: alvo.x - px, z: alvo.z - pz }, solido);
}
