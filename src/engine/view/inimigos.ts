// Inimigos: um esqueleto por inimigo (modelos em `inimigosModelos.ts`) com animação procedural
// por estado. Casa por id a cada quadro; nada do World é guardado entre quadros. O estado
// puramente visual (fase da passada, tempo desde a morte, golpe, progresso do levantar) vive aqui,
// indexado por id. Corpo que volta de `morto` (reanimado pelo 049) passa por `levantando`: a queda
// zera e a pose sobe do chão. O chefe (`world.chefe.inimigoId`) usa as poses de `chefePoses.ts` pela
// fase dele (096 ou 049); acerto nele é um tremor curto, sem clarão, e a queda dura mais.
// Inimigo sem linha de visão da grade até o jogador (e a mais de `PERTO_SEMPRE`) não é desenhado (`oclusao.ts`).
import { Group } from 'three';
import { tipoDe } from '../../sim/ai/tipos';
import { alvoDisponivelParaTiro } from '../../sim/ai/percepcao';
import { CHEFE_049, CHEFE_096 } from '../../sim/balance';
import { solidoDe } from '../../sim/doors';
import type { SimEvent } from '../../sim/eventos';
import type { EstadoChefe, Inimigo, World } from '../../sim/world';
import { calcularPoseChefe, calcularPoseChefe049, GOLPE_CHEFE, PERTO_GOLPE } from './chefePoses';
import { ModelosInimigos, type Rig } from './inimigosModelos';
import {
  CHAVES, DOR_VISUAL, GOLPE, aproximar, calcularPose, desenhadoComoCorpo, novaPose, progressoLevantar, type Pose,
} from './inimigosPoses';
import { aVista } from './oclusao';
import type { Recursos } from './recursos';
import type { AcervoDoutor, InstanciaDoutor } from './doutor';
import type { AcervoPolicial, InstanciaPolicial } from './policial';
import { movimentoParaTras } from './policialAnimacoes';

const QUEDA = 0.4;            // s até o corpo estar no chão
const QUEDA_CHEFE = 0.6;      // s do chefe desabando
const CLARAO_DOR = 0.09;      // s do clarão no corpo
const PASSADA = 4.4;          // rad de fase por metro andado
const SUAVE_YAW = 14;         // 1/s
const SUAVE_POSE = 18;        // 1/s
const SUAVE_VEL = 10;         // 1/s
const TELEPORTE = 1;          // m entre dois passos: não interpola
/** duração mínima (s) do levantar (evita divisão por zero se o `timer` já chegou a 0) */
const MIN_LEVANTAR = 0.2;

/** Corpo se contorcendo no chão (o chefe 049 o está reanimando): somado à pose deitada. */
function convulsao(p: Pose, t: number): void {
  p.troncoZ += Math.sin(t * 21) * 0.12;
  p.cabecaZ += Math.sin(t * 27 + 1) * 0.3;
  p.cabecaX += Math.abs(Math.sin(t * 9)) * 0.25;
  p.bracoEX += Math.sin(t * 17 + 2) * 0.35;
  p.bracoDX += Math.sin(t * 15) * 0.35;
  p.pernaEX += Math.sin(t * 13 + 1) * 0.15;
  p.pernaDX += Math.sin(t * 19) * 0.15;
}

interface Vista {
  tipo: string; rig: Rig;
  doutor: InstanciaDoutor | null;
  policial: InstanciaPolicial | null;
  antes: { x: number; y: number; z: number }; agora: { x: number; y: number; z: number };
  yaw: number; vel: number; recuando: boolean; passada: number; t: number;
  modo: Inimigo['modo']; golpe: number; dor: number; clarao: number; piscando: boolean;
  morto: number; poseMorte: Pose; pose: Pose;
  /** progresso da pose de preparo do ataque (0..1): acende a boca da arma */
  preparo: number;
  /** último quadro em que o inimigo estava no World (os que somem são removidos) */
  quadro: number;
  /** é o chefe: poses próprias, queda e golpe mais longos, acerto sem clarão */
  chefe: boolean; queda: number; duracaoGolpe: number;
  /** levantando: progresso 0..1 e o `timer` visto ao começar (a duração) */
  levantar: number; levantarTotal: number;
  /** chefe 049: a última fase vista e a duração do despertar em curso (timer visto ao começar) */
  faseChefe: string; despertarTotal: number;
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

  constructor(private readonly rec: Recursos, grupo: Group, private readonly doutor?: AcervoDoutor, private readonly policial?: AcervoPolicial) {
    this.raiz.name = 'inimigos';
    grupo.add(this.raiz);
    this.modelos = new ModelosInimigos(rec);
  }

  configurar(reduzirFlashes: boolean): void {
    this.reduzirFlashes = reduzirFlashes;
    for (const v of this.vistas.values()) v.policial?.configurar(reduzirFlashes);
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
    const chefe = world.chefe;
    for (const i of world.inimigos) {
      let v = this.vistas.get(i.id);
      const ehChefe = chefe?.inimigoId === i.id;
      if (v && (v.tipo !== i.tipo || v.chefe !== ehChefe)) {
        this.remover(i.id);
        v = undefined;
      }
      if (!v) v = this.criar(i, ehChefe ? chefe : null, world);
      v.quadro = quadro;
      if (novoPasso) {
        const dx = i.pos.x - v.agora.x, dz = i.pos.z - v.agora.z;
        const d = Math.hypot(dx, dz);
        const salto = d > TELEPORTE;
        v.recuando = !salto && movimentoParaTras(dx, dz, i.yaw);
        v.antes.x = salto ? i.pos.x : v.agora.x;
        v.antes.y = salto ? i.y : v.agora.y;
        v.antes.z = salto ? i.pos.z : v.agora.z;
        v.agora.x = i.pos.x;
        v.agora.y = i.y;
        v.agora.z = i.pos.z;
        if (simDt > 0) v.vel = aproximar(v.vel, d > TELEPORTE ? 0 : d / simDt, 1 - Math.exp(-simDt * SUAVE_VEL));
      }
      this.animar(v, i, ehChefe ? chefe : null, world, simDt, dt, alfa);
    }
    for (const [id, v] of this.vistas) if (v.quadro !== quadro) this.remover(id);

    // atrás de parede ou porta fechada: não desenha (as malhas de um inimigo custam ~8 draw calls)
    const solido = solidoDe(world);
    const olho = world.jogador.pos;
    for (const v of this.vistas.values()) {
      const p = v.rig.raiz.position;
      v.rig.raiz.visible = aVista(world.grid, olho, { x: p.x, z: p.z }, tipoDe(v.tipo).raio, solido);
    }

    // o clarão anda em tempo real e desconta antes dos eventos: o acerto deste quadro sempre pisca
    for (const v of this.vistas.values()) v.clarao = Math.max(0, v.clarao - dt);
    for (const e of eventos) {
      if (e.tipo === 'projetil' && e.inimigoId !== undefined) {
        this.vistas.get(e.inimigoId)?.policial?.disparar();
        continue;
      }
      if (e.tipo !== 'inimigo_dor' && e.tipo !== 'inimigo_ataque') continue;
      const v = this.vistas.get(e.id);
      if (!v) continue;
      if (e.tipo === 'inimigo_ataque') {
        // o golpe do chefe desce o braço erguido (os comuns animam pela troca de modo)
        if (v.chefe) v.golpe = 0;
        continue;
      }
      v.dor = 0;
      if (!this.reduzirFlashes && !v.chefe) v.clarao = CLARAO_DOR;
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

  private criar(i: Inimigo, chefe: EstadoChefe | null, world: World): Vista {
    const rig = this.modelos.montar(i.tipo);
    rig.raiz.name = `inimigo:${i.id}`;
    this.raiz.add(rig.raiz);
    const v: Vista = {
      tipo: i.tipo, rig, doutor: null, policial: null, antes: { x: i.pos.x, y: i.y, z: i.pos.z }, agora: { x: i.pos.x, y: i.y, z: i.pos.z }, yaw: i.yaw, vel: 0, recuando: false, passada: 0, t: (i.id * 0.37) % 6,
      modo: i.modo, golpe: -1, dor: DOR_VISUAL, clarao: 0, piscando: false,
      // já morto ao aparecer (checkpoint): deitado desde o início
      morto: 0, poseMorte: novaPose(), pose: novaPose(), quadro: this.quadro, preparo: 0,
      chefe: chefe !== null, queda: chefe ? QUEDA_CHEFE : QUEDA, duracaoGolpe: chefe ? GOLPE_CHEFE : GOLPE,
      levantar: 0, levantarTotal: Math.max(MIN_LEVANTAR, i.timer),
      // aparecendo já despertando (restauro): a duração é o timer de agora
      faseChefe: '', despertarTotal: chefe?.tipo === 'entidade049' && chefe.fase === 'despertando' ? chefe.timer : 0,
    };
    if (i.modo === 'morto') v.morto = v.queda;
    v.preparo = this.poseAlvo(v, i, chefe, world);
    Object.assign(v.pose, alvo);
    this.vistas.set(i.id, v);
    return v;
  }

  private remover(id: number): void {
    const v = this.vistas.get(id);
    if (!v) return;
    v.doutor?.dispose();
    v.policial?.dispose();
    this.raiz.remove(v.rig.raiz);
    for (const m of v.rig.malhas) this.rec.soltarMalha(m.malha);
    this.vistas.delete(id);
  }

  /** Troca as malhas do corpo (não as emissivas) para o material do clarão de dor, ou de volta. */
  private piscar(v: Vista, ligado: boolean): void {
    v.doutor?.piscar(ligado);
    v.policial?.piscar(ligado);
    if (v.piscando === ligado) return;
    v.piscando = ligado;
    for (const m of v.rig.malhas) {
      if (m.emissivo) continue;
      this.rec.soltarMalha(m.malha);
      this.rec.usar(m.malha, ligado ? 'ini-dor' : m.slot);
    }
  }

  /** Pose alvo em `alvo`; devolve o progresso do preparo do ataque (o aviso do toque no 049; 0 no 096). */
  private poseAlvo(v: Vista, i: Inimigo, chefe: EstadoChefe | null, world: World): number {
    if (!chefe) {
      const k = calcularPose(alvo, v.rig.base, v, i);
      // o corpo que o chefe 049 está reanimando se contorce no chão
      if (i.modo === 'morto' && world.chefe?.tipo === 'entidade049' && world.chefe.fase === 'reanimando' && world.chefe.corpoAlvo === i.id) {
        convulsao(alvo, v.t);
      }
      return k;
    }
    if (chefe.tipo === 'entidade049') {
      return calcularPoseChefe049(alvo, v.rig.base, v, {
        // o `Inimigo` morre um passo antes de a fase do chefe virar `morto`
        fase: i.modo === 'morto' ? 'morto' : chefe.fase, timer: chefe.timer,
        preparo: tipoDe(i.tipo).preparo, reanimar: CHEFE_049.reanimar, despertarTotal: v.despertarTotal,
      });
    }
    const j = world.jogador;
    calcularPoseChefe(alvo, v.rig.base, v, {
      // o `Inimigo` morre um passo antes de a fase do chefe virar `morto`
      // no preparo da investida (timer acima de investidaMax) ele fica encolhido, como na pausa
      fase: i.modo === 'morto' ? 'morto' : chefe.fase === 'investida' && chefe.timer > CHEFE_096.investidaMax ? 'pausa' : chefe.fase,
      timer: chefe.timer,
      perto: Math.hypot(j.pos.x - i.pos.x, j.pos.z - i.pos.z) < PERTO_GOLPE,
    });
    return 0;
  }

  private animar(v: Vista, i: Inimigo, chefe: EstadoChefe | null, world: World, simDt: number, dt: number, alfa: number): void {
    // transições de estado (o chefe 096 golpeia pelo evento `inimigo_ataque`; o 049 não tem golpe)
    if (!v.chefe && v.modo === 'ataque' && i.modo === 'perseguicao') v.golpe = 0;
    // golpe do 096 só vale na perseguição: não volta com o braço erguido depois da investida
    if (chefe && (chefe.tipo !== 'entidade096' || chefe.fase !== 'perseguicao')) v.golpe = -1;
    if (i.modo === 'dor' && v.modo !== 'dor') v.dor = 0;
    if (i.modo === 'morto' && v.modo !== 'morto') {
      Object.assign(v.poseMorte, v.pose);
      v.morto = 0;
    }
    if (i.modo === 'levantando' && v.modo !== 'levantando') {
      // começou a levantar (corpo reanimado ou emboscador deitado): a queda de corpo zera e a pose
      // parte do chão; a duração é o `timer` visto agora (mais o que já correu neste passo)
      v.morto = 0;
      v.levantarTotal = Math.max(MIN_LEVANTAR, i.timer + simDt);
    }
    v.levantar = i.modo === 'levantando' ? progressoLevantar(i.timer, v.levantarTotal) : 0;
    if (chefe?.tipo === 'entidade049') {
      // o despertar do 049 dura `CHEFE_049.despertar`, ou o timer visto ao começar (restauro: retomada)
      if (chefe.fase === 'despertando' && v.faseChefe !== 'despertando') v.despertarTotal = chefe.timer + simDt;
      v.faseChefe = chefe.fase;
    }
    v.modo = i.modo;
    v.t += simDt;
    v.passada += simDt * v.vel * PASSADA;
    if (v.golpe >= 0) v.golpe = v.golpe + simDt > v.duracaoGolpe ? -1 : v.golpe + simDt;
    v.dor = Math.min(DOR_VISUAL, v.dor + simDt);

    v.preparo = this.poseAlvo(v, i, chefe, world);
    if (i.modo === 'morto') {
      v.morto = Math.min(v.queda, v.morto + simDt);
      const k = v.morto / v.queda;
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
    if (v.tipo === 'funcionario' && !v.doutor && this.doutor?.estado === 'pronto') {
      v.doutor = this.doutor.criar(this.rec);
      if (v.doutor) {
        v.rig.corpo.visible = false;
        v.rig.raiz.add(v.doutor.raiz);
      }
    }
    v.doutor?.animar(i, v.vel, simDt);
    if (v.tipo === 'seguranca' && !v.policial && this.policial?.estado === 'pronto') {
      v.policial = this.policial.criar(this.rec);
      if (v.policial) {
        v.policial.configurar(this.reduzirFlashes);
        v.rig.corpo.visible = false; v.rig.raiz.add(v.policial.raiz);
      }
    }
    if (v.policial) {
      const podeAtirar = v.vel > .3 && (i.modo === 'perseguicao' || i.modo === 'ataque') && alvoDisponivelParaTiro(world, i);
      v.policial.animar(i, v.vel, simDt, undefined, undefined, podeAtirar, v.recuando);
    }
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
    ossos.antebracoE?.rotation.set(p.antebracoEX, 0, 0);
    ossos.antebracoD?.rotation.set(p.antebracoDX, 0, 0);
    // no fim da queda: olhos e visor apagam (o crachá fica) e nenhuma malha projeta sombra; o
    // emboscador deitado dormindo já é desenhado como corpo (olhos apagados até levantar)
    const vivo = i.modo === 'morto' ? v.morto < v.queda : !desenhadoComoCorpo(i);
    for (const m of malhas) {
      if (m.apaga) m.malha.visible = vivo;
      m.malha.castShadow = m.sombra && vivo;
      if (m.brilho) m.malha.scale.setScalar(1 + v.preparo * 3);
    }
  }
}
