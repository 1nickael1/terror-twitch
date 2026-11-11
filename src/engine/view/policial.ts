import { AnimationClip, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, type AnimationAction, type Bone, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TIPOS } from '../../sim/ai/tipos';
import type { Inimigo } from '../../sim/world';
import type { MaterialBank } from '../materials';
import { AcervoHumano } from './acervoHumano';
import { AcervoArmaPolicial } from './acervoArmaPolicial';
import type { CarregamentoAssets } from '../carregamentoAssets';
import { construirArmaPolicial, orientacaoDaArma } from './armaPolicial';
import { animacaoDoPolicial, CLIPE_RECUO_POLICIAL, CLIPE_TIRO_POLICIAL, prepararAnimacoesPolicial } from './policialAnimacoes';
import type { Recursos } from './recursos';

export class AcervoPolicial extends AcervoHumano<InstanciaPolicial> {
  private readonly fuzil: AcervoArmaPolicial;
  constructor(bank: MaterialBank, anisotropia = 4, carregamento?: CarregamentoAssets) {
    const fuzil = new AcervoArmaPolicial(bank, anisotropia, carregamento);
    let recuo: AnimationClip;
    const prontoRecuo = fetch('/models/policial/recuo.json').then(async resposta => {
      if (!resposta.ok) throw new Error('Não foi possível carregar a animação de recuo.');
      recuo = AnimationClip.parse(await resposta.json());
      if (recuo.name !== CLIPE_RECUO_POLICIAL) throw new Error('Animação de recuo inválida.');
    });
    carregamento?.acompanhar('Animação de recuo do policial', prontoRecuo);
    super({ id: 'policial', bank, anisotropia, carregamento, preparar: clips => prepararAnimacoesPolicial([...clips, recuo]),
      aguardar: Promise.all([fuzil.pronto, prontoRecuo]).then(() => {}), instanciar: (modelo, clips, rec) => new InstanciaPolicial(modelo, clips, rec, fuzil.modelo ?? undefined) });
    this.fuzil = fuzil;
  }
  override dispose(): void { super.dispose(); this.fuzil.dispose(); }
}

export class InstanciaPolicial {
  readonly raiz = new Group();
  readonly modelo: Object3D;
  readonly arma: ReturnType<typeof construirArmaPolicial>;
  private readonly mixer: AnimationMixer;
  private readonly acoes = new Map<string, AnimationAction>();
  private readonly malhas: SkinnedMesh[] = [];
  private readonly esqueletos = new Set<Skeleton>();
  private atual: AnimationAction | null = null;
  private nome = '';
  private primeiro = true;
  private piscando = false;
  private tiro = 0;
  private flash = 0;
  private reduzirFlashes = false;

  constructor(modelo: Object3D, clips: readonly AnimationClip[], private readonly rec: Recursos, fuzil?: Object3D) {
    this.modelo = clone(modelo);
    const caixa = new Box3().setFromObject(this.modelo, true);
    this.raiz.scale.setScalar(TIPOS.seguranca.altura / Math.max(.01, caixa.max.y - caixa.min.y));
    this.raiz.rotation.y = Math.PI;
    this.modelo.position.set(-(caixa.min.x + caixa.max.x) / 2, -caixa.min.y, -(caixa.min.z + caixa.max.z) / 2);
    this.raiz.add(this.modelo);
    this.modelo.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!m.isMesh) return;
      this.rec.usar(m, 'policial', true); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      this.malhas.push(m); if (m.isSkinnedMesh) this.esqueletos.add(m.skeleton);
    });
    this.mixer = new AnimationMixer(this.modelo);
    for (const c of clips) this.acoes.set(c.name, this.mixer.clipAction(c));
    this.arma = construirArmaPolicial(rec, fuzil);
    const mao = this.modelo.getObjectByName('mixamorigRightHand') as Bone | undefined;
    const tiro = clips.find((c) => c.name === CLIPE_TIRO_POLICIAL);
    if (!mao || !tiro) throw new Error('Policial sem mão direita ou animação de tiro.');
    this.arma.grupo.position.set(0, .10, 0);
    this.arma.grupo.quaternion.copy(orientacaoDaArma(modelo, tiro, this.arma.apoio.position));
    mao.add(this.arma.grupo);
    this.raiz.updateMatrixWorld(true);
  }

  configurar(reduzirFlashes: boolean): void { this.reduzirFlashes = reduzirFlashes; if (reduzirFlashes) this.arma.clarao.visible = false; }

  disparar(): void {
    this.tiro = .35; this.flash = .055;
    if (this.nome === 'TiroParado') this.atual?.reset().play();
    this.arma.clarao.visible = !this.reduzirFlashes;
  }

  animar(i: Pick<Inimigo, 'modo' | 'timer'>, velocidade: number, dt: number, forcar?: string, progresso?: number, podeAtirar = false, recuando = false): void {
    if (i.modo === 'morto' || i.modo === 'dor') this.tiro = this.flash = 0;
    const nome = forcar ?? animacaoDoPolicial(i.modo, velocidade, this.tiro > 0, podeAtirar, recuando);
    if (nome !== this.nome) {
      const proxima = this.acoes.get(nome) ?? this.acoes.get('Mira');
      if (proxima) {
        proxima.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
        const unica = ['Dead', 'Dano', 'Gunshot_Reaction'].includes(nome);
        proxima.setLoop(unica ? LoopOnce : LoopRepeat, unica ? 1 : Infinity); proxima.clampWhenFinished = unica;
        proxima.play();
        if (this.atual && !this.primeiro) proxima.crossFadeFrom(this.atual, .12, false);
        if (this.primeiro && i.modo === 'morto') proxima.time = proxima.getClip().duration;
        this.atual = proxima;
      }
      this.nome = nome;
    }
    this.primeiro = false;
    if (this.atual) {
      this.atual.paused = progresso !== undefined;
      if (progresso !== undefined) this.atual.time = Math.min(.9999, Math.max(0, progresso)) * this.atual.getClip().duration;
      const nominal = nome === 'Running' ? 2.5 : 1.5;
      this.atual.setEffectiveTimeScale(nome === 'Dano' ? 1.8 : forcar || ['Mira', 'Dead', 'TiroParado'].includes(nome) ? 1 : Math.max(.55, Math.min(1.8, velocidade / nominal)));
    }
    this.mixer.update(progresso === undefined ? dt : 0);
    for (const a of this.acoes.values()) if (a !== this.atual && a.isRunning() && a.getEffectiveWeight() < .0001) a.stop();
    this.tiro = Math.max(0, this.tiro - dt); this.flash = Math.max(0, this.flash - dt);
    this.arma.clarao.visible = !this.reduzirFlashes && this.flash > 0;
    // Recuo local pequeno: a fixação e a orientação continuam sendo as do osso da mão.
    this.arma.grupo.position.y = .10 - .008 * (this.flash / .055);
    for (const m of this.malhas) m.castShadow = i.modo !== 'morto' || (this.atual?.time ?? 0) < (this.atual?.getClip().duration ?? 0);
    this.arma.grupo.visible = true;
  }

  piscar(ligado: boolean): void {
    if (this.piscando === ligado) return;
    this.piscando = ligado;
    for (const m of this.malhas) { this.rec.soltarMalha(m); this.rec.usar(m, ligado ? 'policial-dor' : 'policial', true); }
  }

  dispose(): void {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.modelo);
    for (const m of this.malhas) this.rec.soltarMalha(m);
    // As peças da arma são da fase, mas deixam de participar das trocas de material ao remover o NPC.
    this.arma.grupo.traverse((o) => { if ('isMesh' in o && o.isMesh) this.rec.soltarMalha(o as import('three').Mesh); });
    for (const s of this.esqueletos) s.dispose();
    this.raiz.removeFromParent();
  }
}
