// Props decorativos da fase (sem colisão; a fase os põe junto às paredes). Um InstancedMesh por
// tipo, de primitivas unidas com cor de vértice. Frente do prop = -z local; com `parede`, ele
// encosta as costas nessa parede (e, sem `yaw`, olha para dentro da célula). Placas: todas numa malha
// só, com um atlas de textura (`texturaAtlasPlacas`), cada uma presa na parede indicada (`parede` ou `yaw`).
import {
  BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3,
  type BufferGeometry,
} from 'three';
import type { LevelDef, PropDef, TipoProp } from '../../sim/fase';
import { CELL, alturaPiso, centro, type Grid } from '../../sim/grid';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pintar, unir } from './inimigosModelos';
import { layoutAtlas, linhasDaPlaca, normalParede, uvNoAtlas } from './placasLogica';
import type { Recursos } from './recursos';
import { texturaAtlasPlacas } from './texturasCenario';

type Peca = [geo: BufferGeometry, cor: number, x: number, y: number, z: number];

const MADEIRA = 0x7d6e58;
const ACO = 0x3b3e42;
const ACO_CLARO = 0x8f959b;
const ESTOFADO = 0x2c3236;

const caixa = (w: number, h: number, d: number, cor: number, x: number, y: number, z: number): Peca =>
  [new BoxGeometry(w, h, d), cor, x, y, z];

function pernas(dx: number, dz: number, alt: number, esp: number, cor: number): Peca[] {
  return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => caixa(esp, alt, esp, cor, sx * dx, alt / 2, sz * dz)));
}

/** Peças de cada tipo (sem `placa`) e a profundidade (m, ao longo de z local) para encostar na parede. */
const MODELOS: Record<Exclude<TipoProp, 'placa'>, { pecas: () => Peca[]; prof: number }> = {
  mesa: {
    prof: 0.75,
    pecas: () => [caixa(1.4, 0.05, 0.75, MADEIRA, 0, 0.765, 0), ...pernas(0.64, 0.31, 0.74, 0.05, ACO)],
  },
  cadeira: {
    prof: 0.45,
    pecas: () => [
      caixa(0.45, 0.05, 0.45, ESTOFADO, 0, 0.47, 0), ...pernas(0.19, 0.19, 0.45, 0.03, ACO),
      caixa(0.45, 0.42, 0.04, ESTOFADO, 0, 0.73, 0.21),
    ],
  },
  armario: {
    prof: 0.5,
    pecas: () => [
      caixa(0.9, 1.9, 0.5, 0x56606a, 0, 0.95, 0),
      caixa(0.012, 1.8, 0.01, 0x1c1f22, 0, 0.95, -0.255),
      caixa(0.025, 0.16, 0.03, ACO_CLARO, -0.06, 1.0, -0.265),
      caixa(0.025, 0.16, 0.03, ACO_CLARO, 0.06, 1.0, -0.265),
      ...[1.62, 1.68, 1.74].map((y) => caixa(0.3, 0.015, 0.01, 0x1c1f22, -0.22, y, -0.255)),
      ...[1.62, 1.68, 1.74].map((y) => caixa(0.3, 0.015, 0.01, 0x1c1f22, 0.22, y, -0.255)),
    ],
  },
  caixa: {
    prof: 0.5,
    pecas: () => [caixa(0.6, 0.45, 0.5, 0x8a6a42, 0, 0.225, 0), caixa(0.61, 0.01, 0.09, 0xb59a6a, 0, 0.455, 0)],
  },
  maca: {
    prof: 0.65,
    pecas: () => [
      caixa(1.9, 0.12, 0.62, 0xc3c9c2, 0, 0.83, 0),
      caixa(1.95, 0.05, 0.66, ACO_CLARO, 0, 0.745, 0),
      ...pernas(0.86, 0.27, 0.72, 0.04, ACO_CLARO),
      caixa(0.4, 0.08, 0.5, 0xe0e2dc, -0.7, 0.93, 0),
    ],
  },
  cama: {
    prof: 0.8,
    pecas: () => [caixa(1.95, 0.3, 0.8, 0x5b5853, 0, 0.15, 0), caixa(1.85, 0.08, 0.72, 0x6f6a5c, 0, 0.34, 0)],
  },
  lixeira: {
    prof: 0.42,
    pecas: () => [
      [new CylinderGeometry(0.2, 0.17, 0.5, 12), 0x3c4a3e, 0, 0.25, 0],
      [new CylinderGeometry(0.215, 0.215, 0.035, 12), 0x2a2f2b, 0, 0.5, 0],
    ],
  },
};

const LARGURA_PLACA = 0.9;
const ALTURA_PLACA = 0.45;
const ALTURA_CENTRO_PLACA = 1.75;
/** caracteres por linha da placa */
const LINHA_PLACA = 16;

function geometriaDo(tipo: Exclude<TipoProp, 'placa'>): BufferGeometry {
  return unir(MODELOS[tipo].pecas().map(([g, cor, x, y, z]) => pintar(g.translate(x, y, z), cor)));
}

/** Posição (pés) e yaw de um prop comum. */
function colocar(g: Grid, d: PropDef, prof: number): { x: number; y: number; z: number; yaw: number } {
  const p = centro(d.em);
  let yaw = d.yaw ?? 0;
  if (d.parede) {
    const n = normalParede(d.parede, 0);
    const recuo = CELL / 2 - prof / 2 - 0.03;
    p.x -= n.x * recuo;
    p.z -= n.z * recuo;
    // de costas para a parede: frente = (-sin yaw, -cos yaw) = normal
    if (d.yaw === undefined) yaw = Math.atan2(-n.x, -n.z);
  }
  return { x: p.x, y: alturaPiso(g, p), z: p.z, yaw };
}

export function construirProps(fase: LevelDef, g: Grid, rec: Recursos, grupo: Group): void {
  if (fase.props.length === 0) return;
  const slot = rec.slot('prop', { color: 0xffffff, roughness: 0.8, metalness: 0.1, vertexColors: true });
  const m = new Matrix4();
  const q = new Quaternion();
  const um = new Vector3(1, 1, 1);
  const eixoY = new Vector3(0, 1, 0);

  for (const tipo of Object.keys(MODELOS) as Exclude<TipoProp, 'placa'>[]) {
    const defs = fase.props.filter((d) => d.tipo === tipo);
    if (defs.length === 0) continue;
    const malha = rec.usar(new InstancedMesh(rec.geo(geometriaDo(tipo)), undefined, defs.length), slot);
    malha.name = `props:${tipo}`;
    defs.forEach((d, i) => {
      const c = colocar(g, d, MODELOS[tipo].prof);
      m.compose(new Vector3(c.x, c.y, c.z), q.setFromAxisAngle(eixoY, c.yaw), um);
      malha.setMatrixAt(i, m);
    });
    malha.instanceMatrix.needsUpdate = true;
    malha.computeBoundingSphere();
    malha.castShadow = true;
    malha.receiveShadow = true;
    grupo.add(malha);
  }

  // placas: um atlas de textura e uma malha só para todas (uma draw call), sem sombra própria
  const placas = fase.props.filter((d) => d.tipo === 'placa');
  if (placas.length === 0) return;
  const layout = layoutAtlas(placas.length);
  const tex = rec.tex(texturaAtlasPlacas(placas.map((d) => linhasDaPlaca(d.texto ?? '', LINHA_PLACA)), layout));
  const quads = placas.map((d, i) => {
    const q = new PlaneGeometry(LARGURA_PLACA, ALTURA_PLACA);
    const [u0, v0, u1, v1] = uvNoAtlas(i, layout);
    const uv = q.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) < 0.5 ? u0 : u1, uv.getY(k) < 0.5 ? v0 : v1);
    const n = normalParede(d.parede, d.yaw ?? 0);
    const c = centro(d.em);
    // na face da parede atrás da placa, 2 cm à frente dela
    q.rotateY(Math.atan2(n.x, n.z));
    q.translate(c.x - n.x * (CELL / 2 - 0.02), alturaPiso(g, c) + ALTURA_CENTRO_PLACA, c.z - n.z * (CELL / 2 - 0.02));
    return q;
  });
  const unida = mergeGeometries(quads, false);
  for (const q of quads) q.dispose();
  if (!unida) throw new Error('Falha ao unir as placas');
  const malha = rec.usar(new Mesh(rec.geo(unida)), rec.slot('placas', { map: tex, roughness: 0.7 }));
  malha.name = 'placas';
  malha.castShadow = false;
  malha.receiveShadow = true;
  grupo.add(malha);
}
