// Decisão pura das marcas de tiro: impacto em porta ou janela não deixa marca. A simulação bloqueia
// a célula inteira, então o impacto cai na borda dela, mas a folha da porta e o vidro ficam no meio:
// a marca ficaria flutuando (e continuaria lá com a porta aberta).
import { coordDe, celula, type Vec2 } from '../../sim/grid';
import type { World } from '../../sim/world';

/** quanto (m) avançar além do impacto, no sentido do tiro, para achar a célula atingida */
const AVANCO = 0.1;

/** A célula logo adiante do impacto (da câmera para o ponto) é uma porta (qualquer estado) ou uma janela? */
export function impactoEmPortaOuJanela(w: World, cam: Vec2, x: number, z: number): boolean {
  const dx = x - cam.x;
  const dz = z - cam.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return false;
  const [col, row] = coordDe({ x: x + (dx / d) * AVANCO, z: z + (dz / d) * AVANCO });
  if (celula(w.grid, col, row).tipo === 'janela') return true;
  return w.portas.some((p) => p.coord[0] === col && p.coord[1] === row);
}
