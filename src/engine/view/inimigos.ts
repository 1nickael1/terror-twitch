// Inimigos: um esqueleto por inimigo (modelos em `inimigosModelos.ts`) com animação procedural
// por estado. Casa por id a cada quadro; nada do World é guardado entre quadros. O estado
// puramente visual (fase da passada, tempo desde a morte, golpe) vive aqui, indexado por id.
import { Group } from 'three';
import type { SimEvent } from '../../sim/eventos';
import type { Inimigo, World } from '../../sim/world';
import { ModelosInimigos, type Rig } from './inimigosModelos';
import { CHAVES, DOR_VISUAL, GOLPE, aproximar, calcularPose, novaPose, type Pose } from './inimigosPoses';
import type { Recursos } from './recursos';

const QUEDA = 0.4;            // s até o corpo estar no chão
const CLARAO_DOR = 0.09;      // s do clarão no corpo
const PASSADA = 4.4;          // rad de fase por metro andado
const SUAVE_YAW = 14;         // 1/s
const SUAVE_POSE = 18;        // 1/s
const SUAVE_VEL = 10;         // 1/s
const TELEPORTE = 1;          // m entre dois passos: não interpola

interface Vista {
  tipo: string; rig: Rig;
  antes: { x: number; y: number; z: number }; agora: { x: number; y: number; z: number };
  yaw: number; vel: number; passada: number; t: number;
  modo: Inimigo['modo']; golpe: number; dor: number; clarao: number; piscando: boolean;
  morto: number; poseMorte: Pose; pose: Pose;
  /** progresso da pose de preparo do ataque (0..1): acende a boca da arma */
  preparo: number;
  /** último quadro em que o inimigo estava no World (os que somem são removidos) */
  quadro: number;
}

const alvo = novaPose();

function difAngulo(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export class InimigosView {
  private readonly raiz = new Group();
  private readonly vistas = new Map<number, Vista>();
  private readonly modelos: ModelosInimigos;
  private reduzirFlashes = false;
  private ultimoT = -1;
  private quadro = 0;

  constructor(private readonly rec: Recursos, grupo: Group) {
    this.raiz.name = 'inimigos';
    grupo.add(this.raiz);
    this.modelos = new ModelosInimigos(rec);
  }

  configurar(reduzirFlashes: boolean): void {
    this.reduzirFlashes = reduzirFlashes;
    if (!reduzirFlashes) return;
    for (const v of this.vistas.values()) {
      v.clarao = 0;
      this.piscar(v, false);
    }
  }

  /** `alfa`: fração do passo para interpolar a posição (como a câmera). */
  sincronizar(world: World, eventos: readonly SimEvent[], dt: number, alfa = 1): void {
    // tempo de simulação deste quadro: com o jogo parado, a animação congela
    const novoPasso = world.t !== this.ultimoT;
    const simDt = this.ultimoT < 0 ? 0 : Math.max(0, Math.min(0.1, world.t - this.ultimoT));
    this.ultimoT = world.t;

    const quadro = ++this.quadro;
    for (const i of world.inimigos) {
      let v = this.vistas.get(i.id);
      if (v && v.tipo !== i.tipo) {
        this.remover(i.id);
        v = undefined;
      }
      if (!v) v = this.criar(i);
      v.quadro = quadro;
      if (novoPasso) {
        const d = Math.hypot(i.pos.x - v.agora.x, i.pos.z - v.agora.z);
        const salto = d > TELEPORTE;
        v.antes.x = salto ? i.pos.x : v.agora.x;
        v.antes.y = salto ? i.y : v.agora.y;
        v.antes.z = salto ? i.pos.z : v.agora.z;
        v.agora.x = i.pos.x;
        v.agora.y = i.y;
        v.agora.z = i.pos.z;
        if (simDt > 0) v.vel = aproximar(v.vel, d > TELEPORTE ? 0 : d / simDt, 1 - Math.exp(-simDt * SUAVE_VEL));
      }
      this.animar(v, i, simDt, dt, alfa);
    }
    for (const [id, v] of this.vistas) if (v.quadro !== quadro) this.remover(id);

    // o clarão anda em tempo real e desconta antes dos eventos: o acerto deste quadro sempre pisca
    for (const v of this.vistas.values()) v.clarao = Math.max(0, v.clarao - dt);
    for (const e of eventos) {
      if (e.tipo !== 'inimigo_dor') continue;
      const v = this.vistas.get(e.id);
      if (!v) continue;
      v.dor = 0;
      if (!this.reduzirFlashes) v.clarao = CLARAO_DOR;
    }
    for (const v of this.vistas.values()) this.piscar(v, v.clarao > 0);
  }

  /** Remove tudo (depois do checkpoint os ids podem ser reaproveitados). */
  limpar(): void {
    for (const id of [...this.vistas.keys()]) this.remover(id);
    this.ultimoT = -1;
  }

  dispose(): void {
    this.limpar();
    this.raiz.removeFromParent();
  }

  private criar(i: Inimigo): Vista {
    const rig = this.modelos.montar(i.tipo);
    rig.raiz.name = `inimigo:${i.id}`;
    this.raiz.add(rig.raiz);
    const v: Vista = {
      tipo: i.tipo, rig, antes: { x: i.pos.x, y: i.y, z: i.pos.z }, agora: { x: i.pos.x, y: i.y, z: i.pos.z }, yaw: i.yaw, vel: 0, passada: 0, t: (i.id * 0.37) % 6,
      modo: i.modo, golpe: -1, dor: DOR_VISUAL, clarao: 0, piscando: false,
      // já morto ao aparecer (checkpoint): deitado desde o início
      morto: i.modo === 'morto' ? QUEDA : 0, poseMorte: novaPose(), pose: novaPose(), quadro: this.quadro, preparo: 0,
    };
    v.preparo = calcularPose(alvo, v.rig.base, v, i);
    Object.assign(v.pose, alvo);
    this.vistas.set(i.id, v);
    return v;
  }

  private remover(id: number): void {
    const v = this.vistas.get(id);
    if (!v) return;
    this.raiz.remove(v.rig.raiz);
    for (const m of v.rig.malhas) this.rec.soltarMalha(m.malha);
    this.vistas.delete(id);
  }

  /** Troca as malhas do corpo (não as emissivas) para o material do clarão de dor, ou de volta. */
  private piscar(v: Vista, ligado: boolean): void {
    if (v.piscando === ligado) return;
    v.piscando = ligado;
    for (const m of v.rig.malhas) {
      if (m.emissivo) continue;
      this.rec.soltarMalha(m.malha);
      this.rec.usar(m.malha, ligado ? 'ini-dor' : m.slot);
    }
  }

  private animar(v: Vista, i: Inimigo, simDt: number, dt: number, alfa: number): void {
    // transições de estado
    if (v.modo === 'ataque' && i.modo === 'perseguicao') v.golpe = 0;
    if (i.modo === 'dor' && v.modo !== 'dor') v.dor = 0;
    if (i.modo === 'morto' && v.modo !== 'morto') {
      Object.assign(v.poseMorte, v.pose);
      v.morto = 0;
    }
    v.modo = i.modo;
    v.t += simDt;
    v.passada += simDt * v.vel * PASSADA;
    if (v.golpe >= 0) v.golpe = v.golpe + simDt > GOLPE ? -1 : v.golpe + simDt;
    v.dor = Math.min(DOR_VISUAL, v.dor + simDt);

    v.preparo = calcularPose(alvo, v.rig.base, v, i);
    if (i.modo === 'morto') {
      v.morto = Math.min(QUEDA, v.morto + simDt);
      const k = v.morto / QUEDA;
      const e = k * k; // cai acelerando
      for (const c of CHAVES) v.pose[c] = aproximar(v.poseMorte[c], alvo[c], e);
    } else {
      const k = 1 - Math.exp(-dt * SUAVE_POSE);
      for (const c of CHAVES) v.pose[c] = aproximar(v.pose[c], alvo[c], k);
    }
    this.aplicar(v, i);

    // posição interpolada entre o passo anterior e o atual; yaw suavizado
    const a = Math.min(1, Math.max(0, alfa));
    v.rig.raiz.position.set(
      aproximar(v.antes.x, v.agora.x, a), aproximar(v.antes.y, v.agora.y, a), aproximar(v.antes.z, v.agora.z, a),
    );
    if (i.modo !== 'morto') v.yaw += difAngulo(i.yaw, v.yaw) * (1 - Math.exp(-dt * SUAVE_YAW));
    v.rig.raiz.rotation.y = v.yaw;
  }

  private aplicar(v: Vista, i: Inimigo): void {
    const { corpo, pelve, ossos, malhas } = v.rig;
    const p = v.pose;
    corpo.rotation.x = p.corpoX;
    corpo.position.set(0, p.corpoY, p.corpoZ);
    pelve.position.y = p.pelveY;
    ossos.tronco.rotation.set(p.troncoX, 0, p.troncoZ);
    ossos.cabeca.rotation.set(p.cabecaX, 0, p.cabecaZ);
    ossos.bracoE.rotation.set(p.bracoEX, 0, p.bracoEZ);
    ossos.bracoD.rotation.set(p.bracoDX, 0, p.bracoDZ);
    ossos.pernaE.rotation.x = p.pernaEX;
    ossos.pernaD.rotation.x = p.pernaDX;
    // no fim da queda: olhos e visor apagam (o crachá fica) e nenhuma malha projeta sombra
    const vivo = i.modo !== 'morto' || v.morto < QUEDA;
    for (const m of malhas) {
      if (m.apaga) m.malha.visible = vivo;
      m.malha.castShadow = m.sombra && vivo;
      if (m.brilho) m.malha.scale.setScalar(1 + v.preparo * 3);
    }
  }
}
