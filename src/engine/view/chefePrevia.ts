import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AcervoHumano } from './acervoHumano';
import type { MaterialBank } from '../materials';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { Recursos } from './recursos';
import { TIPOS } from '../../sim/ai/tipos';

/** Acervo da bancada, com os movimentos originais disponíveis para comparação. */
export class AcervoChefePrevia extends AcervoHumano<InstanciaChefePrevia> {
  constructor(bank: MaterialBank, carregamento: CarregamentoAssets) {
    super({ id: 'chefe1', bank, anisotropia: 4, carregamento, preparar: clips => [...clips],
      instanciar: (modelo, clips, rec) => new InstanciaChefePrevia(modelo, clips, rec) });
  }
}

export class InstanciaChefePrevia {
  readonly raiz = new Group();
  readonly modelo: Object3D;
  readonly mixer: AnimationMixer;
  readonly clips: readonly AnimationClip[];
  private atual: AnimationAction | null = null;
  private readonly malhas: SkinnedMesh[] = [];
  private readonly esqueletos = new Set<Skeleton>();

  constructor(modelo: Object3D, clips: readonly AnimationClip[], private readonly rec: Recursos) {
    this.modelo = clone(modelo);
    this.clips = clips;
    const caixa = new Box3().setFromObject(this.modelo, true);
    this.raiz.scale.setScalar(TIPOS.entidade096.altura / Math.max(.01, caixa.max.y - caixa.min.y));
    this.raiz.rotation.y = Math.PI;
    this.modelo.position.set(-(caixa.min.x + caixa.max.x) / 2, -caixa.min.y, -(caixa.min.z + caixa.max.z) / 2);
    this.raiz.add(this.modelo);
    this.modelo.traverse(o => {
      const m = o as SkinnedMesh;
      if (!m.isMesh) return;
      rec.usar(m, 'chefe1', true);
      m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      this.malhas.push(m);
      if (m.isSkinnedMesh) this.esqueletos.add(m.skeleton);
    });
    this.raiz.updateMatrixWorld(true);
    this.mixer = new AnimationMixer(this.modelo);
  }

  selecionar(nome: string, repetir: boolean, noLugar: boolean): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.modelo);
    const original = this.clips.find(c => c.name === nome);
    if (!original) { this.atual = null; return; }
    const clip = original.clone();
    if (noLugar) for (const t of clip.tracks) {
      if (t.name !== 'mixamorigHips.position') continue;
      const x = t.values[0], z = t.values[2];
      for (let i = 0; i < t.values.length; i += 3) { t.values[i] = x; t.values[i + 2] = z; }
    }
    this.atual = this.mixer.clipAction(clip);
    this.atual.setLoop(repetir ? LoopRepeat : LoopOnce, repetir ? Infinity : 1);
    this.atual.clampWhenFinished = true;
    this.atual.reset().play();
    this.mixer.update(0);
  }

  atualizar(dt: number, velocidade: number, pausado: boolean, quadro?: number): number {
    if (!this.atual) return 0;
    const duracao = this.atual.getClip().duration;
    if (quadro !== undefined) {
      this.atual.time = Math.max(0, Math.min(duracao, quadro));
      this.atual.enabled = true;
    }
    this.atual.paused = pausado;
    this.atual.setEffectiveTimeScale(velocidade);
    this.mixer.update(quadro !== undefined ? 0 : dt);
    return this.atual.time;
  }

  dispose(): void {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.modelo);
    for (const m of this.malhas) this.rec.soltarMalha(m);
    for (const s of this.esqueletos) s.dispose();
    this.raiz.removeFromParent();
  }
}
