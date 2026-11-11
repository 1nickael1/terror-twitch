import {
  AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Quaternion,
  Vector3, type AnimationAction, type AnimationClip, type Bone,
  type Object3D, type Skeleton, type SkinnedMesh,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Inimigo } from '../../sim/world';
import { TIPOS } from '../../sim/ai/tipos';
import type { MaterialBank } from '../materials';
import { animacaoDoDoutor, prepararAnimacoesDoutor } from './doutorAnimacoes';
import type { Recursos } from './recursos';
import { AcervoHumano } from './acervoHumano';
import type { CarregamentoAssets } from '../carregamentoAssets';

/** Acervo do médico, com os recursos e o carregamento comuns aos humanos importados. */
export class AcervoDoutor extends AcervoHumano<InstanciaDoutor> {
  constructor(bank: MaterialBank, anisotropia = 4, carregamento?: CarregamentoAssets) {
    super({ id: 'doutor', bank, anisotropia, carregamento, preparar: prepararAnimacoesDoutor,
      instanciar: (modelo, clips, rec) => new InstanciaDoutor(modelo, clips, rec) });
  }
}

type EstadoDoutor = Pick<Inimigo, 'modo' | 'timer'>;

export class InstanciaDoutor {
  readonly raiz = new Group();
  readonly modelo: Object3D;
  private readonly avanco = new Group();
  private readonly mixer: AnimationMixer;
  private readonly acoes = new Map<string, AnimationAction>();
  private readonly malhas: SkinnedMesh[] = [];
  private readonly esqueletos = new Set<Skeleton>();
  private readonly posesBase = new Map<Bone, Quaternion>();
  private atual: AnimationAction | null = null;
  private nome = '';
  private primeiro = true;
  private piscando = false;
  private golpe = -1;
  private modoAnterior = '';
  private readonly alvo = new Vector3();
  private readonly pos = new Vector3();
  private readonly direcao = new Vector3();
  private readonly inversa = new Quaternion();
  private readonly giro = new Quaternion();
  private readonly eixo = new Vector3(0, 1, 0);
  private readonly ombro = new Vector3();
  private readonly cotovelo = new Vector3();
  private readonly mao = new Vector3();
  private readonly polo = new Vector3();
  private readonly dobradura = new Vector3();

  constructor(modelo: Object3D, clips: readonly AnimationClip[], private readonly rec: Recursos) {
    this.modelo = clone(modelo);
    const caixa = new Box3().setFromObject(this.modelo, true);
    const altura = caixa.max.y - caixa.min.y;
    this.raiz.scale.setScalar(TIPOS.funcionario.altura / Math.max(.01, altura));
    // Meshy olha para +Z; a simulação olha para -Z. Pivô na sola dos pés.
    this.raiz.rotation.y = Math.PI;
    this.avanco.position.y = .9;
    this.modelo.position.set(-(caixa.min.x + caixa.max.x) / 2, -caixa.min.y - .9, -(caixa.min.z + caixa.max.z) / 2);
    this.avanco.add(this.modelo); this.raiz.add(this.avanco);
    this.modelo.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!m.isMesh) return;
      this.rec.usar(m, 'doutor', true);
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
      this.malhas.push(m);
      if (m.isSkinnedMesh) this.esqueletos.add(m.skeleton);
    });
    this.mixer = new AnimationMixer(this.modelo);
    for (const clip of clips) this.acoes.set(clip.name, this.mixer.clipAction(clip));
    for (const nome of ['mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftForeArm', 'mixamorigRightForeArm', 'mixamorigSpine2']) {
      const b = this.modelo.getObjectByName(nome) as Bone | undefined;
      if (b) this.posesBase.set(b, b.quaternion.clone());
    }
    // Atualiza também bindMatrixInverse dos SkinnedMesh após a normalização de escala.
    this.raiz.updateMatrixWorld(true);
  }

  animar(i: EstadoDoutor, velocidade: number, dt: number, forcar?: string): void {
    for (const [b, q] of this.posesBase) b.quaternion.copy(q);
    this.avanco.rotation.x = 0; this.avanco.position.z = 0;
    const nome = forcar ?? animacaoDoDoutor(i.modo, velocidade);
    if (nome !== this.nome) {
      const proxima = this.acoes.get(nome) ?? this.acoes.get('Idle_02');
      if (proxima) {
        proxima.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
        const unica = nome === 'Dead' || nome === 'Dano' || nome === 'Gunshot_Reaction';
        proxima.setLoop(unica ? LoopOnce : LoopRepeat, unica ? 1 : Infinity);
        proxima.clampWhenFinished = unica;
        proxima.play();
        if (this.atual && !this.primeiro) proxima.crossFadeFrom(this.atual, nome === 'Dead' ? .12 : .16, false);
        if (this.primeiro && i.modo === 'morto') proxima.time = proxima.getClip().duration;
        this.atual = proxima;
      }
      this.nome = nome;
    }
    this.primeiro = false;
    if (this.atual) {
      const nominal = nome === 'Walking' ? 1.5 : nome === 'Unsteady_Walk' ? 1.1 : 3.8;
      this.atual.setEffectiveTimeScale(nome === 'Dano' ? 1.8 : nome === 'Dead' || nome === 'Idle_02' || forcar ? 1 : Math.max(.55, Math.min(1.75, velocidade / nominal)));
    }
    this.mixer.update(dt);
    for (const a of this.acoes.values()) if (a !== this.atual && a.isRunning() && a.getEffectiveWeight() < .0001) a.stop();
    for (const [b, q] of this.posesBase) q.copy(b.quaternion);
    if (this.modoAnterior === 'ataque' && i.modo !== 'ataque' && i.modo !== 'morto' && i.modo !== 'dor') this.golpe = 0;
    this.modoAnterior = i.modo;
    if (this.golpe >= 0) this.golpe = this.golpe + dt < .22 ? this.golpe + dt : -1;
    const suave = (k: number) => { const v = Math.min(1, Math.max(0, k)); return v * v * (3 - 2 * v); };
    if (i.modo === 'ataque') {
      const preparo = Math.min(1, Math.max(0, 1 - i.timer / TIPOS.funcionario.preparo));
      const fechar = suave((preparo - .38) / .62);
      const peso = suave(preparo / .22);
      this.avanco.rotation.x = -.07 * peso * (1 - fechar) + .16 * fechar;
      this.avanco.position.z = -.035 * peso * (1 - fechar) + .2 * fechar;
      this.gestoDeAtaque(fechar, peso);
    } else if (this.golpe >= 0 && i.modo !== 'morto' && i.modo !== 'dor') {
      const peso = 1 - suave(this.golpe / .22);
      this.avanco.rotation.x = .16 * peso;
      this.avanco.position.z = .2 * peso;
      this.gestoDeAtaque(1, peso);
    } else this.golpe = -1;
    for (const m of this.malhas) m.castShadow = i.modo !== 'morto' || (this.atual?.time ?? 0) < (this.atual?.getClip().duration ?? 0);
  }

  piscar(ligado: boolean): void {
    if (this.piscando === ligado) return;
    this.piscando = ligado;
    for (const m of this.malhas) {
      this.rec.soltarMalha(m);
      this.rec.usar(m, ligado ? 'doutor-dor' : 'doutor', true);
    }
  }

  dispose(): void {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.modelo);
    for (const m of this.malhas) this.rec.soltarMalha(m);
    for (const s of this.esqueletos) s.dispose();
    this.raiz.removeFromParent();
  }

  /** Antecipação com braços abertos; avanço do tronco e abraço agressivo no momento do dano. */
  private gestoDeAtaque(fechar: number, peso: number): void {
    const tronco = this.modelo.getObjectByName('mixamorigSpine2');
    tronco?.rotateX(.14 * fechar * peso);
    this.raiz.updateWorldMatrix(true, true);
    for (const [lado, sinal] of [['Right', -1], ['Left', 1]] as const) {
      const braco = this.modelo.getObjectByName(`mixamorig${lado}Arm`) as Bone;
      const antebraco = this.modelo.getObjectByName(`mixamorig${lado}ForeArm`) as Bone;
      const mao = this.modelo.getObjectByName(`mixamorig${lado}Hand`) as Bone;
      if (!braco || !antebraco || !mao) continue;
      braco.getWorldPosition(this.ombro); antebraco.getWorldPosition(this.cotovelo); mao.getWorldPosition(this.mao);
      const a = this.ombro.distanceTo(this.cotovelo), b = this.cotovelo.distanceTo(this.mao);
      this.alvo.set(sinal * (.52 - .445 * fechar), 1.43 - .05 * fechar, .12 + .32 * fechar);
      this.modelo.localToWorld(this.alvo);
      const distancia = Math.max(.01, Math.min(a + b - .005, this.ombro.distanceTo(this.alvo)));
      this.direcao.copy(this.alvo).sub(this.ombro).normalize();
      this.polo.set(sinal, -.3, -.05).transformDirection(this.modelo.matrixWorld);
      this.polo.addScaledVector(this.direcao, -this.polo.dot(this.direcao)).normalize();
      const projecao = (a * a - b * b + distancia * distancia) / (2 * distancia);
      const dobra = Math.sqrt(Math.max(0, a * a - projecao * projecao));
      this.dobradura.copy(this.ombro).addScaledVector(this.direcao, projecao).addScaledVector(this.polo, dobra);
      this.mirarOsso(braco, this.dobradura, peso);
      this.mirarOsso(antebraco, this.alvo, peso);
    }
  }

  private mirarOsso(b: Bone, alvo: Vector3, peso: number): void {
    if (!b.parent) return;
    b.getWorldPosition(this.pos);
    b.parent.getWorldQuaternion(this.inversa).invert();
    this.direcao.copy(alvo).sub(this.pos).applyQuaternion(this.inversa).normalize();
    this.pos.copy(this.eixo).applyQuaternion(b.quaternion);
    this.giro.setFromUnitVectors(this.pos, this.direcao).multiply(b.quaternion);
    b.quaternion.slerp(this.giro, peso);
    b.updateWorldMatrix(false, true);
  }
}
