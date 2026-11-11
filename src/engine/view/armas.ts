// Armas em primeira pessoa: só a arma atual aparece, presa à câmera. Balanço ao andar, atraso
// ao girar, recuo por evento `tiro`, clarão de cano (plano aditivo + `ClaraoCano`), troca em
// 0,25 s no evento `arma_trocada` (desce, troca o modelo, sobe). Com "reduzir flashes", sem
// plano aditivo nem luz. O suporte é pequeno e fica a menos de 0,3 m do olho (o raio do jogador):
// assim a arma não entra nas paredes mesmo com `depthTest` normal.
import {
  AdditiveBlending, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Object3D, type PerspectiveCamera,
} from 'three';
import type { SimEvent } from '../../sim/eventos';
import type { ArmaId } from '../../sim/fase';
import type { World } from '../../sim/world';
import type { ClaraoCano } from '../lights';
import { construirArmas, type ModeloArma } from './armasModelos';
import type { Recursos } from './recursos';
import { texturaClarao } from './texturasEfeitos';

/** escala do suporte: os modelos são feitos em tamanho "de mão" */
const ESCALA = 0.42;
/** posição da empunhadura na tela (antes da escala) */
const POSICAO = { x: 0.2, y: -0.17, z: -0.38 } as const;
/** Ajuste por modelo para esconder mais a empunhadura; shotgun é a referência visual. */
const ALTURA_MODELO: Record<ArmaId, number> = { pistola: -.10, escopeta: 0, smg: -.04, lancador: -.025 };
/**
 * a boca do cano fica no máximo a esta distância em z (antes da escala): 0,6 × 0,42 = 0,25 m, e
 * com o deslocamento lateral, o balanço e o atraso a ponta fica a menos de 0,28 m do olho na
 * horizontal (o raio do jogador é 0,3 m: a arma não entra na parede)
 */
const ALCANCE_Z = 0.6;
const TROCA = 0.25;
const DESCIDA_TROCA = 0.22;
const DURACAO_PLANO = 0.05;

interface Retorno { recuo: number; giro: number; clarao: number; luz: number; cor: number }
const RETORNO: Record<ArmaId, Retorno> = {
  pistola: { recuo: 0.05, giro: 0.2, clarao: 1, luz: 8, cor: 0xffc27a },
  escopeta: { recuo: 0.09, giro: 0.38, clarao: 1.7, luz: 14, cor: 0xffb060 },
  smg: { recuo: 0.022, giro: 0.06, clarao: 0.8, luz: 6, cor: 0xffcf8a },
  lancador: { recuo: 0.07, giro: 0.26, clarao: 0.7, luz: 4, cor: 0xb8ff9a },
};

export class ArmasView {
  private readonly suporte = new Group();
  private readonly balanco = new Group();
  private readonly modelos: Record<ArmaId, ModeloArma>;
  private readonly plano: Mesh;
  private readonly matPlano: MeshBasicMaterial;
  private mostrada: ArmaId | null = null;
  private troca = -1;
  private recuo = 0;
  private planoT = 0;
  private fase = 0;
  private giroTambor = 0;
  private alvoTambor = 0;
  private atrasoX = 0;
  private atrasoY = 0;
  private yawAntes: number | null = null;
  private pitchAntes = 0;
  private abaixada = 0;
  private ultimoT = -1;
  private reduzirFlashes = false;
  private luz = 1;

  constructor(rec: Recursos, private readonly camera: PerspectiveCamera, private readonly clarao: ClaraoCano, pistola?: Object3D, escopeta?: Object3D, smg?: Object3D, lancador?: Object3D) {
    this.suporte.name = 'armas';
    this.suporte.scale.setScalar(ESCALA);
    this.suporte.add(this.balanco);
    this.modelos = construirArmas(rec, pistola, escopeta, smg, lancador);
    for (const id of Object.keys(this.modelos) as ArmaId[]) {
      const m = this.modelos[id];
      m.grupo.visible = false;
      m.grupo.position.y = ALTURA_MODELO[id];
      // armas compridas (escopeta, smg, lançador) vêm mais para trás
      m.grupo.position.z = Math.max(0, -(POSICAO.z + m.cano.position.z) - ALCANCE_Z);
      this.balanco.add(m.grupo);
    }
    this.matPlano = rec.mat(new MeshBasicMaterial({
      map: rec.tex(texturaClarao()), color: 0xffffff, transparent: true, blending: AdditiveBlending,
      depthWrite: false, fog: false,
    }));
    this.plano = new Mesh(rec.geo(new PlaneGeometry(0.2, 0.2)), this.matPlano);
    this.plano.visible = false;
    this.plano.renderOrder = 10;
    this.balanco.add(this.plano);
    camera.add(this.suporte);
  }

  /**
   * `luz`: multiplicador das luzes do filtro. A luz do clarão acompanha as da fase, com piso de
   * 0,6: no filtro Lanterna (luzes 0,25) o tiro ainda clareia o corredor.
   */
  configurar(reduzirFlashes: boolean, luz: number): void {
    this.reduzirFlashes = reduzirFlashes;
    this.luz = Math.max(0.6, luz);
    this.clarao.reduzirFlashes = reduzirFlashes;
    if (reduzirFlashes) this.plano.visible = false;
  }

  sincronizar(world: World, eventos: readonly SimEvent[], dt: number): void {
    const j = world.jogador;
    const simDt = this.ultimoT < 0 ? 0 : Math.max(0, Math.min(0.1, world.t - this.ultimoT));
    this.ultimoT = world.t;

    // o tempo do clarão desconta antes dos eventos: o tiro deste quadro sempre aparece
    this.planoT = Math.max(0, this.planoT - dt);
    for (const e of eventos) {
      if (e.tipo === 'tiro') this.disparar(e.arma);
      // troca nova no meio de outra: continua da fase atual (no máximo do meio, onde troca o modelo)
      else if (e.tipo === 'arma_trocada' && this.mostrada !== null) this.troca = this.troca >= 0 ? Math.min(this.troca, TROCA / 2) : 0;
    }

    // troca: desce até a metade, troca o modelo, sobe
    if (this.troca >= 0) {
      this.troca += dt;
      if (this.troca >= TROCA / 2 && this.mostrada !== j.arma) this.mostrar(j.arma);
      if (this.troca >= TROCA) this.troca = -1;
    } else if (this.mostrada !== j.arma) {
      this.mostrar(j.arma); // checkpoint ou primeiro quadro: sem animação
    }

    // balanço pela velocidade no chão (congela com o jogo parado)
    const vel = j.noChao ? Math.hypot(j.vel.x, j.vel.z) : 0;
    const amp = Math.min(1, vel / 9);
    this.fase += simDt * vel * 1.1;
    // atraso ao girar o olhar
    if (this.yawAntes === null) {
      this.yawAntes = j.yaw;
      this.pitchAntes = j.pitch;
    }
    const dYaw = Math.atan2(Math.sin(j.yaw - this.yawAntes), Math.cos(j.yaw - this.yawAntes));
    const dPitch = j.pitch - this.pitchAntes;
    this.yawAntes = j.yaw;
    this.pitchAntes = j.pitch;
    const kAtraso = 1 - Math.exp(-dt * 10);
    this.atrasoX += (Math.max(-0.05, Math.min(0.05, dYaw * 0.6)) - this.atrasoX) * kAtraso;
    this.atrasoY += (Math.max(-0.04, Math.min(0.04, -dPitch * 0.5)) - this.atrasoY) * kAtraso;

    this.recuo *= Math.exp(-dt * 13);
    this.abaixada += ((world.estado === 'morto' ? 1 : 0) - this.abaixada) * (1 - Math.exp(-dt * 4));
    const k = this.troca >= 0 ? Math.sin((this.troca / TROCA) * Math.PI) : 0;
    const r = RETORNO[this.mostrada ?? 'pistola'];
    const respira = Math.sin(world.t * 1.6) * 0.003;

    this.balanco.position.set(
      POSICAO.x + Math.sin(this.fase * 0.5) * 0.016 * amp + this.atrasoX,
      POSICAO.y - Math.abs(Math.cos(this.fase * 0.5)) * 0.013 * amp + respira + this.atrasoY
        - k * DESCIDA_TROCA - this.abaixada * 0.35 + this.recuo * r.recuo * 0.3,
      POSICAO.z + this.recuo * r.recuo,
    );
    this.balanco.rotation.set(this.recuo * r.giro - k * 0.7, -this.atrasoX * 2, -this.atrasoX * 1.5);

    const m = this.mostrada ? this.modelos[this.mostrada] : null;
    if (m?.tambor) {
      this.giroTambor += (this.alvoTambor - this.giroTambor) * (1 - Math.exp(-dt * 18));
      m.tambor.rotation.z = this.giroTambor;
    }
    this.plano.visible = this.planoT > 0 && !this.reduzirFlashes && m !== null;
    if (m && this.plano.visible) this.plano.position.copy(m.cano.position).add(m.grupo.position).setZ(m.cano.position.z + m.grupo.position.z - 0.02);
    this.clarao.atualizar(dt);
  }

  /** Depois do checkpoint: sem troca, recuo ou clarão pendentes. */
  reiniciar(): void {
    this.troca = -1;
    this.recuo = 0;
    this.planoT = 0;
    this.plano.visible = false;
    this.yawAntes = null;
    this.ultimoT = -1;
    this.abaixada = 0;
  }

  /** Mostra ou esconde a arma (fora de jogo: título, fim de fase). Escondida, não dispara clarão. */
  exibir(v: boolean): void {
    this.suporte.visible = v;
    if (!v) {
      this.planoT = 0;
      this.plano.visible = false;
    }
  }

  dispose(): void {
    this.camera.remove(this.suporte);
  }

  private mostrar(arma: ArmaId): void {
    for (const [id, m] of Object.entries(this.modelos)) m.grupo.visible = id === arma;
    this.mostrada = arma;
    this.giroTambor = this.alvoTambor = 0;
  }

  private disparar(arma: ArmaId): void {
    const r = RETORNO[arma];
    if (!this.suporte.visible) return;
    this.recuo = Math.min(1.4, this.recuo + 1);
    if (arma === 'lancador') this.alvoTambor += Math.PI / 3;
    if (this.reduzirFlashes) return;
    this.planoT = DURACAO_PLANO;
    this.matPlano.color.setHex(r.cor);
    this.plano.rotation.z = Math.random() * Math.PI * 2;
    this.plano.scale.setScalar(r.clarao * (0.8 + Math.random() * 0.4));
    this.clarao.disparar(r.luz * this.luz, r.cor);
  }
}
