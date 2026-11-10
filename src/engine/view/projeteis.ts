// Projéteis e nuvens. Projéteis: um `InstancedMesh` de núcleo e outro de halo aditivo (quads
// voltados para a câmera, com textura macia), cor por
// origem (os de inimigo claros e bem visíveis, porque o jogador precisa desviar; a cápsula do
// lançador esverdeada). A posição recua `(1 - alfa)` de passo pela velocidade, como a câmera.
// Nuvens (`world.nuvens`, casadas por índice): um grupo de planos aditivos voltados para a
// câmera, girando devagar dentro do raio; somem conforme `resta` chega a zero.
import {
  AdditiveBlending, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion,
  SphereGeometry, Vector3, type PerspectiveCamera,
} from 'three';
import { TIPOS } from '../../sim/ai/tipos';
import { NUVEM } from '../../sim/balance';
import { alturaPiso } from '../../sim/grid';
import { PASSO } from '../../sim/step';
import type { World } from '../../sim/world';
import type { Recursos } from './recursos';
import { texturaBolha } from './texturasEfeitos';

const MAX_PROJETEIS = 64;
const MAX_NUVENS = 6;
const PLANOS_NUVEM = 7;
const HALO = 3.2;
const COR_INIMIGO = new Color(0xfff0b0);
const HALO_INIMIGO = new Color(0xff8a30);
const COR_LANCADOR = new Color(0xa8ff70);
const HALO_LANCADOR = new Color(0x3fa040);
/** raio visual do núcleo (m) quando o tipo não diz */
const RAIO_PADRAO = 0.12;

interface PlanoNuvem { malha: Mesh; ang: number; dist: number; altura: number; giro: number; escala: number }
interface VistaNuvem { grupo: Group; mat: MeshBasicMaterial; planos: PlanoNuvem[] }

export class ProjeteisView {
  private readonly nucleo: InstancedMesh;
  private readonly halo: InstancedMesh;
  private readonly nuvens: VistaNuvem[] = [];
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly rot = new Quaternion();
  private readonly esc = new Vector3();
  private t = 0;

  constructor(rec: Recursos, grupo: Group, private readonly camera: PerspectiveCamera) {
    const esfera = rec.geo(new SphereGeometry(1, 10, 8));
    this.nucleo = rec.obj(new InstancedMesh(esfera, rec.mat(new MeshBasicMaterial({ color: 0xffffff })), MAX_PROJETEIS));
    const bolha = rec.tex(texturaBolha());
    const plano = rec.geo(new PlaneGeometry(1, 1));
    this.halo = rec.obj(new InstancedMesh(plano, rec.mat(new MeshBasicMaterial({
      map: bolha, color: 0xffffff, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false,
    })), MAX_PROJETEIS));
    for (const im of [this.nucleo, this.halo]) {
      im.count = 0;
      im.frustumCulled = false;
      im.name = im === this.nucleo ? 'projeteis' : 'projeteis-halo';
      grupo.add(im);
    }
    // inicializa a cor por instância (o atributo nasce no primeiro setColorAt)
    for (let i = 0; i < MAX_PROJETEIS; i++) {
      this.nucleo.setColorAt(i, COR_INIMIGO);
      this.halo.setColorAt(i, HALO_INIMIGO);
    }

    for (let n = 0; n < MAX_NUVENS; n++) {
      const mat = rec.mat(new MeshBasicMaterial({
        map: bolha, color: 0x7fd04a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false,
      }));
      const g = new Group();
      g.visible = false;
      g.name = `nuvem:${n}`;
      const planos: PlanoNuvem[] = [];
      for (let k = 0; k < PLANOS_NUVEM; k++) {
        const malha = new Mesh(plano, mat);
        g.add(malha);
        planos.push({
          malha, ang: (k / PLANOS_NUVEM) * Math.PI * 2 + n, dist: 0.25 + ((k * 0.37) % 0.6),
          altura: 0.35 + ((k * 0.53) % 1.1), giro: (k % 2 ? 1 : -1) * (0.25 + (k % 3) * 0.1),
          escala: 1.4 + ((k * 0.71) % 1),
        });
      }
      grupo.add(g);
      this.nuvens.push({ grupo: g, mat, planos });
    }
  }

  sincronizar(world: World, dt: number, alfa = 1): void {
    this.t += dt;
    this.sincronizarProjeteis(world, alfa);
    this.sincronizarNuvens(world);
  }

  /** Esconde tudo (checkpoint limpa projéteis e nuvens). */
  limpar(): void {
    this.nucleo.count = 0;
    this.halo.count = 0;
    for (const n of this.nuvens) n.grupo.visible = false;
  }

  private sincronizarProjeteis(world: World, alfa: number): void {
    const atraso = (1 - Math.min(1, Math.max(0, alfa))) * PASSO;
    let i = 0;
    for (const p of world.projeteis) {
      if (i >= MAX_PROJETEIS) break;
      const doLancador = p.de === 'jogador';
      const t = Object.prototype.hasOwnProperty.call(TIPOS, p.tipo) ? TIPOS[p.tipo] : undefined;
      const raio = doLancador ? 0.09 : (t?.projetil?.raio ?? RAIO_PADRAO) * 0.8;
      this.pos.set(p.pos.x - p.vel.x * atraso, p.y - p.vy * atraso, p.pos.z - p.vel.z * atraso);
      this.esc.setScalar(raio);
      this.nucleo.setMatrixAt(i, this.m.compose(this.pos, this.rot, this.esc));
      this.esc.setScalar(raio * HALO);
      this.halo.setMatrixAt(i, this.m.compose(this.pos, this.camera.quaternion, this.esc));
      this.nucleo.setColorAt(i, doLancador ? COR_LANCADOR : COR_INIMIGO);
      this.halo.setColorAt(i, doLancador ? HALO_LANCADOR : HALO_INIMIGO);
      i++;
    }
    this.publicar(this.nucleo, i);
    this.publicar(this.halo, i);
  }

  private publicar(im: InstancedMesh, n: number): void {
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  private sincronizarNuvens(world: World): void {
    for (let indice = 0; indice < this.nuvens.length; indice++) {
      const v = this.nuvens[indice];
      const n = world.nuvens[indice];
      v.grupo.visible = n !== undefined;
      if (!n) continue;
      // entra em 0,25 s e some no último segundo
      const entrada = Math.min(1, (NUVEM.duracao - n.resta) / 0.25);
      v.mat.opacity = 0.32 * Math.min(1, n.resta) * Math.max(0, entrada);
      v.grupo.position.set(n.pos.x, alturaPiso(world.grid, n.pos), n.pos.z);
      for (const p of v.planos) {
        const a = p.ang + this.t * p.giro * 0.4;
        p.malha.position.set(Math.cos(a) * p.dist * n.raio, p.altura, Math.sin(a) * p.dist * n.raio);
        p.malha.quaternion.copy(this.camera.quaternion);
        p.malha.rotateZ(this.t * p.giro);
        p.malha.scale.setScalar(p.escala * n.raio * 0.75);
      }
    }
  }
}
