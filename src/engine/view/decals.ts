// Decalques: os `DecalDef` da fase (sangue, queimado, marca, faixa de perigo) e as marcas de tiro. Quads com
// `polygonOffset` (slots do banco: reagem à luz e trocam lambert/standard com o filtro).
// DecalDef: no chão da célula, ou na parede indicada (n = -z, s = +z, l = +x, o = -x).
// Marcas de tiro: pool de 64 instâncias, recicla a mais antiga. Sem raycast: o ponto do evento
// fica numa borda de célula (parede), no piso ou no teto; a orientação sai da grade e, se o
// ponto não está em nenhuma superfície conhecida, o quad fica voltado para a câmera.
import {
  InstancedMesh, Matrix4, PlaneGeometry, Quaternion, Vector3, type Group, type PerspectiveCamera,
} from 'three';
import type { SimEvent } from '../../sim/eventos';
import type { DecalDef, LevelDef } from '../../sim/fase';
import { CELL, alturaPiso, celula, centro, coordDe, type Grid } from '../../sim/grid';
import type { World } from '../../sim/world';
import { impactoEmPortaOuJanela } from './marcasTiro';
import type { Recursos } from './recursos';
import { texturaFaixa, texturaFuro, texturaMarca, texturaQueimado, texturaSangue } from './texturasEfeitos';

const MAX_MARCAS = 64;
const TAMANHO_MARCA = 0.14;
const TAMANHO: Record<DecalDef['tipo'], number> = { sangue: 1.5, queimado: 1.7, marca: 1.0, faixa: CELL };
/** decalques que cobrem a célula inteira, alinhados, sem giro nem escala aleatória (emendam com os vizinhos) */
const ALINHADOS: ReadonlySet<DecalDef['tipo']> = new Set(['faixa']);
const ALTURA_PAREDE = 1.15;
/** a esta distância (m) de uma borda de célula, piso ou teto, o impacto conta como nela */
const PERTO = 0.12;
/** recuo (m) do ponto do impacto na direção de quem atirou */
const RECUO = 0.1;
const NORMAL_PAREDE: Record<NonNullable<DecalDef['parede']>, readonly [number, number]> = {
  n: [0, 1], s: [0, -1], l: [-1, 0], o: [1, 0],
};

const Z = new Vector3(0, 0, 1);

export class DecalsView {
  private readonly marcas: InstancedMesh;
  private proxima = 0;
  private usadas = 0;
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly normal = new Vector3();
  private readonly rot = new Quaternion();
  private readonly giro = new Quaternion();
  private readonly esc = new Vector3();

  constructor(fase: LevelDef, g: Grid, rec: Recursos, grupo: Group, private readonly camera: PerspectiveCamera) {
    const quad = rec.geo(new PlaneGeometry(1, 1));
    const texturas = { sangue: texturaSangue, queimado: texturaQueimado, marca: texturaMarca, faixa: texturaFaixa };

    for (const tipo of ['sangue', 'queimado', 'marca', 'faixa'] as const) {
      const defs = fase.decals.filter((d) => d.tipo === tipo);
      if (defs.length === 0) continue;
      const slot = rec.slot(`decal-${tipo}`, { map: rec.tex(texturas[tipo]()), decal: true, roughness: 0.9 });
      const malha = rec.usar(new InstancedMesh(quad, undefined, defs.length), slot);
      malha.name = `decal:${tipo}`;
      malha.receiveShadow = true;
      malha.frustumCulled = false;
      defs.forEach((d, i) => malha.setMatrixAt(i, this.matrizDef(g, d, i)));
      malha.instanceMatrix.needsUpdate = true;
      grupo.add(malha);
    }

    const slotFuro = rec.slot('decal-furo', { map: rec.tex(texturaFuro()), decal: true, roughness: 1 });
    this.marcas = rec.usar(new InstancedMesh(quad, undefined, MAX_MARCAS), slotFuro);
    this.marcas.name = 'decal:tiros';
    this.marcas.receiveShadow = true;
    this.marcas.frustumCulled = false;
    this.marcas.count = 0;
    grupo.add(this.marcas);
  }

  sincronizar(world: World, eventos: readonly SimEvent[]): void {
    let mudou = false;
    for (const e of eventos) {
      if (e.tipo !== 'impacto' || e.em !== 'parede') continue;
      // porta ou janela: só a faísca (a marca ficaria no ar, longe da folha ou do vidro)
      if (impactoEmPortaOuJanela(world, { x: this.camera.position.x, z: this.camera.position.z }, e.pos.x, e.pos.z)) continue;
      this.marcar(world, e.pos.x, e.y, e.pos.z);
      mudou = true;
    }
    if (mudou) this.marcas.instanceMatrix.needsUpdate = true;
  }

  /** Apaga as marcas de tiro (checkpoint). Os decalques da fase ficam. */
  limparMarcas(): void {
    this.marcas.count = 0;
    this.proxima = 0;
    this.usadas = 0;
  }

  private matrizDef(g: Grid, d: DecalDef, i: number): Matrix4 {
    const [col, row] = d.em;
    const c = celula(g, col, row);
    const { x, z } = centro(d.em);
    const alinhado = ALINHADOS.has(d.tipo);
    const s = alinhado ? TAMANHO[d.tipo] : TAMANHO[d.tipo] * (0.85 + ((i * 0.37) % 0.3));
    if (d.parede) {
      const [nx, nz] = NORMAL_PAREDE[d.parede];
      // a face fica na borda da célula, do lado oposto à normal
      this.pos.set(x - nx * (CELL / 2), c.piso + ALTURA_PAREDE, z - nz * (CELL / 2));
      this.normal.set(nx, 0, nz);
    } else {
      // altura do piso no centro (rampa: meio da subida)
      this.pos.set(x, alturaPiso(g, { x, z }), z);
      this.normal.set(0, 1, 0);
    }
    this.orientar(alinhado ? 0 : i * 2.39);
    this.esc.set(s, s, 1);
    return this.m.compose(this.pos, this.rot, this.esc);
  }

  /** Quaternion que leva +z do quad à normal e gira em volta dela. */
  private orientar(angulo: number): void {
    this.rot.setFromUnitVectors(Z, this.normal);
    this.giro.setFromAxisAngle(Z, angulo);
    this.rot.multiply(this.giro);
  }

  private marcar(world: World, x: number, y: number, z: number): void {
    const g = world.grid;
    const cam = this.camera.position;
    // o ponto do evento pode estar dentro da célula da parede: piso e teto vêm de um ponto
    // recuado RECUO m na direção da câmera (a célula de onde veio o tiro)
    const hx = cam.x - x;
    const hz = cam.z - z;
    const h = Math.hypot(hx, hz) || 1;
    const rx = x + (hx / h) * RECUO;
    const rz = z + (hz / h) * RECUO;
    const [col, row] = coordDe({ x: rx, z: rz });
    const piso = alturaPiso(g, { x: rx, z: rz });
    const teto = celula(g, col, row).teto;
    const bx = Math.abs(x - Math.round(x / CELL) * CELL);
    const bz = Math.abs(z - Math.round(z / CELL) * CELL);
    this.pos.set(x, y, z);
    // de um lado só: um tiro inclinado que acerta a parede baixa não vira furo no chão
    if (y < piso + PERTO) {
      this.normal.set(0, 1, 0);
      this.pos.y = piso;
    } else if (y > teto - PERTO) {
      this.normal.set(0, -1, 0);
      this.pos.y = teto;
    } else if (Math.min(bx, bz) < PERTO) {
      // parede numa borda de célula: normal para o lado de quem atirou
      if (bx < bz) {
        this.pos.x = Math.round(x / CELL) * CELL;
        this.normal.set(Math.sign(cam.x - this.pos.x) || 1, 0, 0);
      } else {
        this.pos.z = Math.round(z / CELL) * CELL;
        this.normal.set(0, 0, Math.sign(cam.z - this.pos.z) || 1);
      }
    } else {
      // superfície desconhecida (folha de porta, degrau no meio da célula): voltado para a câmera
      this.normal.set(cam.x - x, cam.y - y, cam.z - z).normalize();
      this.pos.set(rx, y, rz);
    }
    this.orientar(Math.random() * Math.PI * 2);
    const s = TAMANHO_MARCA * (0.8 + Math.random() * 0.4);
    this.esc.set(s, s, 1);
    this.marcas.setMatrixAt(this.proxima, this.m.compose(this.pos, this.rot, this.esc));
    this.proxima = (this.proxima + 1) % MAX_MARCAS;
    this.usadas = Math.min(MAX_MARCAS, this.usadas + 1);
    this.marcas.count = this.usadas;
  }
}
