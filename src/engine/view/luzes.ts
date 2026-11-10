// Luzes da fase. Cada LuzDef tem uma luminária visível no teto; a iluminação vem de um pool fixo
// de PointLights (sem sombra) entregue às luzes acesas a até 24 m do jogador, primeiro as que ele
// vê (linha de visão da grade; só calculada quando há mais candidatas que vagas, com cache por
// célula do olho e portas abertas), depois por distância; entre 20 e 24 m a luz esmaece. Pool
// fixo = número de luzes constante = nenhum shader recompilado no caminho.
// Luzes do grupo 'alarme' são giroflexes: SpotLight vermelho girando enquanto `world.alarme`.
import {
  BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PointLight, SpotLight, Vector3, type Group,
} from 'three';
import { PORTA } from '../../sim/balance';
import { solidoDe } from '../../sim/doors';
import { celula, centro, coordDe, visivel, type Grid } from '../../sim/grid';
import type { LevelDef, LuzDef } from '../../sim/fase';
import type { World } from '../../sim/world';
import type { Recursos } from './recursos';

export const GRUPO_ALARME = 'alarme';
const MAX_LUZES = 8;
const DISTANCIA_ATIVA = 24;
/** candela por unidade de `LuzDef.intensidade` (com o multiplicador do filtro em 1) */
const LUZ_BASE = 10;
/** alcance de cada luz (m): uma sala não acende a vizinha através da parede */
const ALCANCE_LUZ = 9;
/** a partir daqui a luz esmaece até apagar em DISTANCIA_ATIVA */
const INICIO_ESMAECER = 20;
const MAX_ALARMES = 2;
const ALARME_BASE = 14;
const GIRO_ALARME = 3; // rad/s
const BRILHO_LUMINARIA = 1.6;

interface LuzFase { def: LuzDef; pos: Vector3; piso: number; teto: number; indice: number; alarme: boolean }

/** 0..1: brilho da luminária agora. `pisca` é a chance de a luminária estar falhando. */
export function brilhoPisca(pisca: number, t: number, i: number): number {
  if (pisca <= 0) return 1;
  const falha = Math.sin(t * 1.7 + i * 2.39) * 0.5 + Math.sin(t * 0.61 + i * 5.1) * 0.5;
  if (falha <= 1 - pisca * 1.2) return 1;
  return Math.sin(t * 31 + i * 7.1) + Math.sin(t * 13.7 + i) > 0.3 ? 1 : 0.08;
}

export class LuzesFase {
  private readonly luzes: LuzFase[];
  private readonly pool: PointLight[] = [];
  private readonly alarmes: { luz: LuzFase; spot: SpotLight; alvo: Object3D }[] = [];
  private readonly luminarias: InstancedMesh | null = null;
  private multiplicador = 1;
  private emissivo = 1;
  private reduzirFlashes = false;
  private readonly cor = new Color();
  private readonly candidatas: { luz: LuzFase; d: number; m: number; ve: boolean }[] = [];
  /**
   * Visibilidade de cada luz a partir do olho (-1 = não calculada), válida enquanto o olho fica
   * na mesma célula e o número de portas abertas não muda.
   */
  private readonly visCache: Int8Array;
  private visCol = NaN;
  private visRow = NaN;
  private visPortas = -1;

  constructor(fase: LevelDef, g: Grid, rec: Recursos, grupo: Group) {
    this.luzes = fase.luzes.map((def, indice) => {
      const c = celula(g, def.em[0], def.em[1]);
      const { x, z } = centro(def.em);
      const y = def.altura ?? c.teto - 0.3;
      return { def, pos: new Vector3(x, y, z), piso: c.piso, teto: c.teto, indice, alarme: def.grupo === GRUPO_ALARME };
    });
    this.visCache = new Int8Array(this.luzes.length).fill(-1);

    for (let i = 0; i < MAX_LUZES; i++) {
      const l = rec.obj(new PointLight(0xffffff, 0, ALCANCE_LUZ, 2));
      grupo.add(l);
      this.pool.push(l);
    }
    for (const luz of this.luzes.filter((l) => l.alarme).slice(0, MAX_ALARMES)) {
      const spot = rec.obj(new SpotLight(luz.def.cor, 0, 12, 0.6, 0.5, 2));
      const alvo = new Object3D();
      spot.position.copy(luz.pos);
      spot.target = alvo;
      grupo.add(spot, alvo);
      this.alarmes.push({ luz, spot, alvo });
    }

    if (this.luzes.length > 0) {
      const mat = rec.mat(new MeshBasicMaterial({ color: 0xffffff }));
      const lum = rec.obj(new InstancedMesh(rec.geo(new BoxGeometry(1.2, 0.06, 0.3)), mat, this.luzes.length));
      const m = new Matrix4();
      for (const l of this.luzes) {
        // giroflex: caixa pequena e alta; luminária comum: régua no teto
        if (l.alarme) m.makeScale(0.25, 2.5, 0.8).setPosition(l.pos.x, l.teto - 0.075, l.pos.z);
        else m.makeTranslation(l.pos.x, l.teto - 0.03, l.pos.z);
        lum.setMatrixAt(l.indice, m);
        lum.setColorAt(l.indice, this.cor.set(0));
      }
      lum.computeBoundingSphere();
      lum.name = 'fase:luminarias';
      grupo.add(lum);
      this.luminarias = lum;
    }
  }

  configurar(multiplicador: number, emissivo: number, reduzirFlashes: boolean): void {
    this.multiplicador = multiplicador;
    this.emissivo = emissivo;
    this.reduzirFlashes = reduzirFlashes;
  }

  sincronizar(world: World, olho: Vector3, t: number): void {
    const acesa = (l: LuzFase) => !(l.def.grupo && world.luzesDesligadas.has(l.def.grupo));
    this.candidatas.length = 0;

    for (const l of this.luzes) {
      let m = 0;
      if (l.alarme) {
        m = acesa(l) && world.alarme ? (this.reduzirFlashes ? 0.55 + 0.45 * Math.sin(t * 1.5) : 1) : 0;
      } else if (acesa(l)) {
        m = this.reduzirFlashes ? 1 : brilhoPisca(l.def.pisca ?? 0, t, l.indice);
        const d = l.pos.distanceTo(olho);
        if (d <= DISTANCIA_ATIVA) {
          const esmaece = Math.min(1, (DISTANCIA_ATIVA - d) / (DISTANCIA_ATIVA - INICIO_ESMAECER));
          this.candidatas.push({ luz: l, d, m: m * esmaece, ve: true });
        }
      }
      if (this.luminarias) {
        const k = m > 0 ? m * BRILHO_LUMINARIA * this.emissivo : 0.03;
        this.luminarias.setColorAt(l.indice, this.cor.set(l.def.cor).multiplyScalar(k));
      }
    }
    if (this.luminarias?.instanceColor) this.luminarias.instanceColor.needsUpdate = true;

    // só ordena por visibilidade quando sobram candidatas para as vagas do pool
    if (this.candidatas.length > MAX_LUZES) this.marcarVisiveis(world, olho);
    this.candidatas.sort((a, b) => (a.ve === b.ve ? a.d - b.d : a.ve ? -1 : 1));
    this.pool.forEach((p, i) => {
      const c = this.candidatas[i];
      if (!c) {
        p.intensity = 0;
        return;
      }
      p.position.copy(c.luz.pos);
      p.color.set(c.luz.def.cor);
      p.intensity = c.luz.def.intensidade * LUZ_BASE * this.multiplicador * c.m;
    });

    for (const { luz, spot, alvo } of this.alarmes) {
      const ligado = acesa(luz) && world.alarme;
      const pulso = this.reduzirFlashes ? 0.55 + 0.45 * Math.sin(t * 1.5) : 1;
      spot.intensity = ligado ? luz.def.intensidade * ALARME_BASE * this.multiplicador * pulso : 0;
      if (this.reduzirFlashes) alvo.position.set(luz.pos.x, luz.piso, luz.pos.z);
      else alvo.position.set(luz.pos.x + Math.cos(t * GIRO_ALARME) * 2.5, luz.piso, luz.pos.z + Math.sin(t * GIRO_ALARME) * 2.5);
      alvo.updateMatrixWorld();
    }
  }

  /** Preenche `ve` das candidatas, com cache por célula do olho e portas abertas. */
  private marcarVisiveis(world: World, olho: Vector3): void {
    const [col, row] = coordDe({ x: olho.x, z: olho.z });
    let abertas = 0;
    for (const p of world.portas) if (p.abertura >= PORTA.livreEm) abertas++;
    if (col !== this.visCol || row !== this.visRow || abertas !== this.visPortas) {
      this.visCache.fill(-1);
      this.visCol = col;
      this.visRow = row;
      this.visPortas = abertas;
    }
    let solido: ReturnType<typeof solidoDe> | null = null;
    for (const c of this.candidatas) {
      const i = c.luz.indice;
      if (this.visCache[i] < 0) {
        solido ??= solidoDe(world);
        const ve = visivel(world.grid, { x: olho.x, z: olho.z }, { x: c.luz.pos.x, z: c.luz.pos.z }, solido, olho.y, c.luz.pos.y);
        this.visCache[i] = ve ? 1 : 0;
      }
      c.ve = this.visCache[i] === 1;
    }
  }
}
