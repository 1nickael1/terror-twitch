// Pickups: um InstancedMesh por forma (vida, colete, munição por tipo, arma por arma, cartão por
// nível), girando devagar e flutuando; a instância some (escala 0) quando o pickup foi pego.
import {
  BoxGeometry, CylinderGeometry, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Group,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { alturaPiso } from '../../sim/grid';
import type { PickupDef } from '../../sim/fase';
import type { World } from '../../sim/world';
import type { Recursos } from './recursos';

interface Forma { geo: () => BufferGeometry; slot: string }

function caixa(w: number, h: number, d: number, x = 0, y = 0, z = 0, rz = 0): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  return g.translate(x, y, z);
}

function cilindro(r: number, comp: number, x = 0, y = 0, z = 0): BufferGeometry {
  return new CylinderGeometry(r, r, comp, 10).rotateZ(Math.PI / 2).translate(x, y, z);
}

function unir(partes: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(partes, false);
  for (const p of partes) p.dispose();
  if (!g) throw new Error('Falha ao montar a forma do pickup');
  return g;
}

/** Silhuetas simples de cada arma, de lado (comprimento em x). */
const ARMAS: Record<string, () => BufferGeometry> = {
  pistola: () => unir([caixa(0.3, 0.08, 0.06), caixa(0.07, 0.15, 0.05, -0.08, -0.1, 0, 0.2)]),
  escopeta: () => unir([caixa(0.75, 0.07, 0.07), caixa(0.25, 0.12, 0.06, -0.42, -0.04, 0, 0.15), caixa(0.2, 0.06, 0.08, 0.12, -0.06)]),
  smg: () => unir([caixa(0.45, 0.1, 0.07), caixa(0.06, 0.2, 0.05, 0.05, -0.14), caixa(0.07, 0.13, 0.05, -0.12, -0.1, 0, 0.2)]),
  lancador: () => unir([cilindro(0.08, 0.6), caixa(0.07, 0.16, 0.05, -0.05, -0.13, 0, 0.15), caixa(0.1, 0.1, 0.1, 0.27)]),
};

const MUNICAO: Record<string, () => BufferGeometry> = {
  balas: () => caixa(0.22, 0.14, 0.16),
  cartuchos: () => caixa(0.3, 0.16, 0.2),
  leves: () => unir([caixa(0.32, 0.12, 0.18), caixa(0.08, 0.06, 0.18, 0.08, 0.09)]),
  capsulas: () => unir([cilindro(0.07, 0.22, 0, 0, -0.06), cilindro(0.07, 0.22, 0, 0, 0.06)]),
};

/** Chave da forma e escala da instância. */
function formaDe(def: PickupDef): { chave: string; forma: Forma; escala: number } {
  switch (def.tipo) {
    case 'vida_p':
    case 'vida_g':
      return {
        chave: 'vida', escala: def.tipo === 'vida_g' ? 1.4 : 1,
        forma: { slot: 'pk-vida', geo: () => caixa(0.36, 0.28, 0.14) },
      };
    case 'colete_p':
    case 'colete_g':
      return {
        chave: 'colete', escala: def.tipo === 'colete_g' ? 1.3 : 1,
        forma: { slot: 'pk-colete', geo: () => unir([caixa(0.36, 0.44, 0.06), caixa(0.2, 0.1, 0.07, 0, 0.2)]) },
      };
    case 'municao': {
      const tipo = def.municao ?? 'balas';
      return { chave: `municao:${tipo}`, escala: 1, forma: { slot: `pk-${tipo}`, geo: MUNICAO[tipo] } };
    }
    case 'arma': {
      const arma = def.arma ?? 'pistola';
      return { chave: `arma:${arma}`, escala: 1, forma: { slot: 'pk-arma', geo: ARMAS[arma] } };
    }
    case 'cartao': {
      const nivel = def.nivel ?? 1;
      return { chave: `cartao:${nivel}`, escala: 1, forma: { slot: `nivel-${nivel}`, geo: () => caixa(0.26, 0.16, 0.02) } };
    }
  }
}

interface Instancia { malha: InstancedMesh; i: number; escala: number; fase: number }

const ALTURA = 0.55;
const GIRO = 1.2;   // rad/s
const FLUTUA = 0.07;

export class PickupsView {
  private readonly instancias: Instancia[] = [];
  private readonly pisos: number[];
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly rot = new Quaternion();
  private readonly esc = new Vector3();
  private readonly euler = new Euler();

  constructor(world: World, rec: Recursos, grupo: Group) {
    const grupos = new Map<string, { forma: Forma; indices: number[] }>();
    const formas = world.pickups.map((p) => formaDe(p.def));
    formas.forEach((f, i) => {
      const gr = grupos.get(f.chave) ?? { forma: f.forma, indices: [] };
      gr.indices.push(i);
      grupos.set(f.chave, gr);
    });
    for (const [chave, { forma, indices }] of grupos) {
      const malha = rec.usar(new InstancedMesh(rec.geo(forma.geo()), undefined, indices.length), forma.slot);
      malha.name = `pickup:${chave}`;
      malha.castShadow = true;
      malha.frustumCulled = false; // as instâncias se espalham pela fase
      grupo.add(malha);
      indices.forEach((indice, i) => {
        this.instancias[indice] = { malha, i, escala: formas[indice].escala, fase: indice * 1.7 };
      });
    }
    this.pisos = world.pickups.map((p) => alturaPiso(world.grid, p.pos));
  }

  /** Casa por índice (estável na fase e no checkpoint). `t` em segundos. */
  sincronizar(world: World, t: number): void {
    const tocadas = new Set<InstancedMesh>();
    world.pickups.forEach((p, indice) => {
      const inst = this.instancias[indice];
      if (!inst) return;
      const s = p.pego ? 0 : inst.escala;
      this.pos.set(p.pos.x, this.pisos[indice] + ALTURA + Math.sin(t * 2 + inst.fase) * FLUTUA, p.pos.z);
      this.rot.setFromEuler(this.euler.set(0, t * GIRO + inst.fase, 0));
      this.esc.set(s, s, s);
      inst.malha.setMatrixAt(inst.i, this.m.compose(this.pos, this.rot, this.esc));
      tocadas.add(inst.malha);
    });
    for (const malha of tocadas) malha.instanceMatrix.needsUpdate = true;
  }
}
