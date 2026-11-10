// Props decorativos da fase (sem colisão; a fase os põe junto às paredes). Um InstancedMesh por
// tipo, de primitivas unidas com cor de vértice (a luminária UV ganha um segundo, com os tubos acesos).
// Fase 2: parede de gavetas de necrotério, cortina hospitalar, autoclave, carrinho e luminária UV. Frente do prop = -z local; com `parede`, ele
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
import { ladrilhosDasPlacas, layoutAtlas, linhasDaPlaca, normalParede, uvNoAtlas } from './placasLogica';
import type { Recursos } from './recursos';
import { texturaAtlasPlacas } from './texturasCenario';
import { superficieDoProp } from './propsMateriais';

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

type PropComModelo = Exclude<TipoProp, 'placa'>;

const cilindro = (rt: number, rb: number, h: number, cor: number, x: number, y: number, z: number, seg = 10): Peca =>
  [new CylinderGeometry(rt, rb, h, seg), cor, x, y, z];
/** Cilindro deitado ao longo de x (`eixo` 'x') ou de z ('z'). */
const deitado = (r: number, h: number, eixo: 'x' | 'z', cor: number, x: number, y: number, z: number, seg = 10): Peca => {
  const g = new CylinderGeometry(r, r, h, seg);
  return [eixo === 'x' ? g.rotateZ(Math.PI / 2) : g.rotateX(Math.PI / 2), cor, x, y, z];
};

const ACO_HOSPITAL = 0x7d8489;
const PUXADOR = 0xb9bec2;
const ETIQUETA = 0xd8d4c4;
const PANO = 0x8fa596;
const PANO_SUJO = 0x5f6d5e;

/** Parede de gavetas de necrotério: 3×3 portas quadradas de aço, puxador e etiqueta em cada uma. */
function gavetas(): Peca[] {
  const pecas: Peca[] = [
    caixa(2.0, 2.1, 0.75, ACO_HOSPITAL, 0, 1.05, 0),
    caixa(2.04, 0.06, 0.78, ACO, 0, 2.13, 0),          // cornija
    caixa(2.04, 0.1, 0.78, ACO, 0, 0.05, 0),           // rodapé
  ];
  for (const col of [-0.65, 0, 0.65]) {
    for (const y of [0.45, 1.1, 1.75]) {
      pecas.push(caixa(0.58, 0.58, 0.03, 0x8c9399, col, y, -0.385));
      pecas.push(caixa(0.28, 0.035, 0.05, PUXADOR, col, y - 0.12, -0.41));
      pecas.push(caixa(0.13, 0.06, 0.01, ETIQUETA, col + 0.17, y + 0.19, -0.402));
    }
  }
  return pecas;
}

/** Cortina hospitalar: trilho no alto e o pano em pregas (painéis em zigue-zague), barra suja embaixo. */
function cortina(): Peca[] {
  const pecas: Peca[] = [caixa(1.9, 0.035, 0.05, ACO_CLARO, 0, 2.32, 0)];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const x = -0.84 + k * 0.24;
    const z = k % 2 === 0 ? -0.025 : 0.025;
    pecas.push(caixa(0.25, 1.75, 0.015, PANO, x, 1.4, z));
    pecas.push(caixa(0.25, 0.2, 0.017, PANO_SUJO, x, 0.43, z));
    pecas.push(caixa(0.02, 0.06, 0.02, ACO_CLARO, x, 2.29, 0));   // argola
  }
  return pecas;
}

/** Autoclave: câmara cilíndrica de aço deitada sobre um gabinete, porta redonda com volante, manômetro. */
function autoclave(): Peca[] {
  return [
    caixa(1.0, 0.8, 0.85, 0x5b6268, 0, 0.4, 0),
    caixa(0.9, 0.05, 0.02, 0x1c1f22, 0, 0.62, -0.43),                // fresta do gabinete
    deitado(0.4, 0.85, 'z', ACO_CLARO, 0, 1.22, 0, 14),
    deitado(0.43, 0.07, 'z', 0x9aa1a6, 0, 1.22, -0.45, 14),           // porta
    deitado(0.12, 0.05, 'z', 0x3a3d42, 0, 1.22, -0.5, 8),             // cubo do volante
    caixa(0.5, 0.035, 0.03, 0x3a3d42, 0, 1.22, -0.52),                // raios do volante
    caixa(0.035, 0.5, 0.03, 0x3a3d42, 0, 1.22, -0.52),
    cilindro(0.025, 0.025, 0.2, ACO, 0.2, 1.7, 0.1, 6),               // cano do manômetro
    deitado(0.08, 0.04, 'z', 0xe0dccc, 0.2, 1.84, 0.1, 10),           // manômetro
    caixa(0.18, 0.3, 0.05, 0x2a2c30, 0.38, 0.55, -0.44),              // painel de controle
  ];
}

/** Carrinho de curativos: duas prateleiras, quatro rodízios, alça atrás e frascos em cima. */
function carrinho(): Peca[] {
  const pecas: Peca[] = [
    caixa(0.8, 0.03, 0.5, ACO_CLARO, 0, 0.35, 0),
    caixa(0.8, 0.03, 0.5, ACO_CLARO, 0, 0.88, 0),
    caixa(0.82, 0.08, 0.02, ACO_CLARO, 0, 0.93, -0.25),               // borda da bandeja
    caixa(0.82, 0.08, 0.02, ACO_CLARO, 0, 0.93, 0.25),
    caixa(0.6, 0.03, 0.03, PUXADOR, 0, 1.0, 0.3),                     // alça
    caixa(0.03, 0.12, 0.03, PUXADOR, -0.3, 0.94, 0.28),
    caixa(0.03, 0.12, 0.03, PUXADOR, 0.3, 0.94, 0.28),
    // frascos, uma caixa de luvas e uma bandeja rim
    cilindro(0.035, 0.035, 0.16, 0x7a8f52, -0.28, 0.98, -0.1, 8),
    cilindro(0.03, 0.03, 0.12, 0x9a6a3a, -0.18, 0.96, -0.12, 8),
    cilindro(0.03, 0.03, 0.14, 0xc8dcd6, -0.22, 0.97, 0.05, 8),
    caixa(0.22, 0.1, 0.12, 0x3d6a8a, 0.15, 0.95, 0.08),
    caixa(0.25, 0.03, 0.14, 0x9aa1a6, 0.12, 0.91, -0.12),
    caixa(0.34, 0.2, 0.3, 0x5a5f56, 0.1, 0.47, 0),                    // caixa na prateleira de baixo
  ];
  for (const [x, z] of [[-0.37, -0.22], [0.37, -0.22], [-0.37, 0.22], [0.37, 0.22]] as const) {
    pecas.push(caixa(0.025, 0.85, 0.025, ACO_CLARO, x, 0.5, z));
    pecas.push(deitado(0.045, 0.03, 'x', 0x1c1f22, x, 0.045, z, 8));
  }
  return pecas;
}

/** Luminária UV de parede (decorativa): base e grade; os tubos emissivos vêm à parte. */
function lampadaUV(): Peca[] {
  const pecas: Peca[] = [
    caixa(1.3, 0.2, 0.06, ACO, 0, 2.2, 0.1),
    caixa(1.36, 0.04, 0.18, ACO, 0, 2.31, 0.04),
    caixa(0.04, 0.2, 0.16, ACO, -0.66, 2.2, 0.03),
    caixa(0.04, 0.2, 0.16, ACO, 0.66, 2.2, 0.03),
  ];
  for (const x of [-0.4, 0, 0.4]) pecas.push(caixa(0.012, 0.2, 0.012, ACO_CLARO, x, 2.2, -0.04));   // grade
  return pecas;
}

/** Peças de cada tipo (sem `placa`) e a profundidade (m, ao longo de z local) para encostar na parede. */
const MODELOS: Record<PropComModelo, { pecas: () => Peca[]; prof: number; emissivas?: () => Peca[] }> = {
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
  gavetas: { prof: 0.78, pecas: gavetas },
  cortina: { prof: 0.1, pecas: cortina },
  autoclave: { prof: 0.9, pecas: autoclave },
  carrinho: { prof: 0.6, pecas: carrinho },
  lampada_uv: {
    prof: 0.3, pecas: lampadaUV,
    emissivas: () => [deitado(0.025, 1.2, 'x', 0xffffff, 0, 2.16, 0.02, 8), deitado(0.025, 1.2, 'x', 0xffffff, 0, 2.24, 0.02, 8)],
  },
};

const LARGURA_PLACA = 0.9;
const ALTURA_PLACA = 0.45;
const ALTURA_CENTRO_PLACA = 1.75;
/** caracteres por linha da placa */
const LINHA_PLACA = 16;

function geometriaDo(pecas: () => Peca[]): BufferGeometry {
  return unir(pecas().map(([g, cor, x, y, z]) => pintar(g.translate(x, y, z), cor)));
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
  const m = new Matrix4();
  const q = new Quaternion();
  const um = new Vector3(1, 1, 1);
  const eixoY = new Vector3(0, 1, 0);

  for (const tipo of Object.keys(MODELOS) as PropComModelo[]) {
    const defs = fase.props.filter((d) => d.tipo === tipo);
    if (defs.length === 0) continue;
    const modelo = MODELOS[tipo];
    // Uma instância por superfície: aço, madeira e tecido recebem os mapas adequados.
    const porSuperficie = new Map<string, Peca[]>();
    for (const p of modelo.pecas()) {
      const superficie = superficieDoProp(p[1]);
      const pecas = porSuperficie.get(superficie) ?? [];
      pecas.push(p); porSuperficie.set(superficie, pecas);
    }
    const malhas = [...porSuperficie.entries()].map(([superficie, pecas]) => {
      const geo = geometriaDo(() => pecas.map(([g, cor, x, y, z]) => [g, superficie === 'madeira' || superficie === 'papel' ? 0xffffff : cor, x, y, z]));
      const malha = rec.usar(new InstancedMesh(rec.geo(geo), undefined, defs.length), `prop-${superficie}`);
      malha.name = `props:${tipo}:${superficie}`;
      malha.castShadow = true;
      return malha;
    });
    if (modelo.emissivas) {
      // partes acesas (tubos da luminária UV): slot emissivo do banco, sem sombra
      const brilho = rec.slot('prop-uv', { color: 0x2a1a40, emissive: 0xa070ff, emissiveIntensity: 0.9 });
      const e = rec.usar(new InstancedMesh(rec.geo(geometriaDo(modelo.emissivas)), undefined, defs.length), brilho);
      e.name = `props:${tipo}:luz`;
      malhas.push(e);
    }
    defs.forEach((d, i) => {
      const c = colocar(g, d, modelo.prof);
      m.compose(new Vector3(c.x, c.y, c.z), q.setFromAxisAngle(eixoY, c.yaw), um);
      for (const malha of malhas) malha.setMatrixAt(i, m);
    });
    for (const malha of malhas) {
      malha.instanceMatrix.needsUpdate = true;
      malha.computeBoundingSphere();
      malha.receiveShadow = true;
      grupo.add(malha);
    }
  }

  // placas: um atlas de textura e uma malha só para todas (uma draw call), sem sombra própria
  const placas = fase.props.filter((d) => d.tipo === 'placa');
  if (placas.length === 0) return;
  // textos repetidos dividem o ladrilho (o atlas não encolhe à toa)
  const { unicos, indice } = ladrilhosDasPlacas(placas.map((d) => d.texto ?? ''));
  const layout = layoutAtlas(unicos.length);
  const tex = rec.tex(texturaAtlasPlacas(unicos.map((t) => linhasDaPlaca(t, LINHA_PLACA)), layout));
  const quads = placas.map((d, i) => {
    const q = new PlaneGeometry(LARGURA_PLACA, ALTURA_PLACA);
    const [u0, v0, u1, v1] = uvNoAtlas(indice[i], layout);
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
