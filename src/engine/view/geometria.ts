// Peças de geometria estática: quads com UV em metros e o coletor que une tudo por material.
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Recursos } from './recursos';

/** 1 repetição de textura a cada 2 m */
export const UV_POR_METRO = 0.5;

export type P3 = readonly [x: number, y: number, z: number];

/**
 * Quad p0..p3 em sentido anti-horário visto da frente. A normal vem do método de Newell, que
 * aguenta quad degenerado (triângulo de parede de rampa). UVs dados em metros.
 */
export function quad(p: readonly [P3, P3, P3, P3], uv: readonly [number, number][]): BufferGeometry {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(p.flat(), 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 2, 3].flatMap(() => [nx / len, ny / len, nz / len]), 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv.flatMap(([u, v]) => [u * UV_POR_METRO, v * UV_POR_METRO]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/**
 * Face vertical do segmento A→B do chão, de `base` a `topo` em cada ponta. A normal aponta para
 * a esquerda de A→B vista de cima (normal = (-dz, 0, dx)). Devolve null se não tem altura.
 */
export function faceVertical(
  a: { x: number; z: number }, b: { x: number; z: number },
  baseA: number, baseB: number, topoA: number, topoB: number,
): BufferGeometry | null {
  if (topoA - baseA < 1e-3 && topoB - baseB < 1e-3) return null;
  const tA = Math.max(baseA, topoA);
  const tB = Math.max(baseB, topoB);
  // u cresce para a direita de quem olha a face de frente: direita = (nz, 0, -nx), com
  // n = (-dz, 0, dx) normalizada. Vem da coordenada do mundo, então emenda entre células.
  const comp = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const nx = -(b.z - a.z) / comp;
  const nz = (b.x - a.x) / comp;
  const u = (p: { x: number; z: number }) => p.x * nz - p.z * nx;
  return quad(
    [[a.x, baseA, a.z], [b.x, baseB, b.z], [b.x, tB, b.z], [a.x, tA, a.z]],
    [[u(a), baseA], [u(b), baseB], [u(b), tB], [u(a), tA]],
  );
}

/** Junta geometrias por slot e cria uma malha por slot no fim. */
export class Coletor {
  private readonly porSlot = new Map<string, BufferGeometry[]>();

  add(slot: string, g: BufferGeometry | null): void {
    if (!g) return;
    // só posição, normal e uv: todas as peças têm de ter os mesmos atributos para o merge
    for (const nome of Object.keys(g.attributes)) {
      if (nome !== 'position' && nome !== 'normal' && nome !== 'uv') g.deleteAttribute(nome);
    }
    const lista = this.porSlot.get(slot) ?? [];
    lista.push(g);
    this.porSlot.set(slot, lista);
  }

  /**
   * Cria as malhas no grupo. `semSombra`: slots que não projetam sombra (vidro, telas). `renomear`: slot do
   * coletor → slot do material (revestimento da fase; C3.5, correção 1); o que não está nele fica igual.
   */
  finalizar(rec: Recursos, grupo: Group, semSombra: ReadonlySet<string>, renomear: Readonly<Record<string, string>> = {}): void {
    for (const [origem, lista] of this.porSlot) {
      const slot = renomear[origem] ?? origem;
      if (lista.length === 0) continue;
      const unida = mergeGeometries(lista, false);
      for (const g of lista) g.dispose();
      if (!unida) throw new Error(`Falha ao unir a geometria do slot "${slot}"`);
      unida.computeBoundingSphere();
      const m = rec.usar(new Mesh(unida), slot);
      m.castShadow = !semSombra.has(slot);
      m.receiveShadow = true;
      m.name = `fase:${slot}`;
      grupo.add(m);
    }
    this.porSlot.clear();
  }
}
