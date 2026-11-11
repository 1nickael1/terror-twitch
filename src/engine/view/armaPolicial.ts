import { AdditiveBlending, AnimationMixer, BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Quaternion, SphereGeometry, Vector3, type AnimationClip, type Bone } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Recursos } from './recursos';
import { AMOSTRA_MIRA_POLICIAL } from './policialAnimacoes';

/** Calibra uma única transformação local; a arma passa a acompanhar a mão, inclusive no recuo. */
export function orientacaoDaArma(modelo: Object3D, tiro: AnimationClip, pontoApoio = new Vector3(0, .015, .29)): Quaternion {
  const copia = clone(modelo);
  const mixer = new AnimationMixer(copia); mixer.clipAction(tiro).play(); mixer.setTime(AMOSTRA_MIRA_POLICIAL);
  copia.updateMatrixWorld(true);
  const mao = copia.getObjectByName('mixamorigRightHand') as Bone | undefined;
  if (!mao) throw new Error('Osso mixamorigRightHand ausente.');
  const esquerda = copia.getObjectByName('mixamorigLeftHand');
  if (!esquerda) throw new Error('Osso mixamorigLeftHand ausente.');
  const empunhadura = mao.localToWorld(new Vector3(0, .10, 0));
  const apoio = esquerda.localToWorld(new Vector3(0, .10, 0)).sub(empunhadura).normalize();
  const alinhamento = new Quaternion().setFromUnitVectors(pontoApoio.clone().normalize(), apoio);
  const local = mao.getWorldQuaternion(new Quaternion()).invert().multiply(alinhamento).normalize();
  // Alinha o guarda-mão com a palma esquerda, mantendo a fixação no osso direito.
  mixer.stopAllAction(); mixer.uncacheRoot(copia);
  copia.traverse((o) => { if ('isSkinnedMesh' in o && o.isSkinnedMesh) (o as import('three').SkinnedMesh).skeleton.dispose(); });
  return local;
}

/** Fuzil com empunhadura na origem e cano para +Z; geometria simples como contingência. */
export function construirArmaPolicial(rec: Recursos, fuzil?: Object3D): { grupo: Group; cano: Object3D; apoio: Object3D; clarao: Mesh } {
  const grupo = new Group(); grupo.name = 'policial:carabina-provisoria';
  const caixa = (w: number, h: number, d: number, x: number, y: number, z: number, slot = 'arma') => {
    const m = rec.usar(new Mesh(rec.geo(new BoxGeometry(w, h, d))), slot);
    m.position.set(x, y, z); m.castShadow = true; grupo.add(m); return m;
  };
  if (!fuzil) {
    caixa(.065, .085, .24, 0, .055, .06);
    caixa(.037, .11, .05, 0, -.01, 0, 'arma-cabo');
    caixa(.05, .04, .20, 0, .052, -.16, 'arma-detalhe');
    caixa(.07, .12, .055, 0, .02, -.28, 'arma-cabo');
    caixa(.055, .055, .23, 0, .05, .275, 'arma-cabo');
    caixa(.045, .13, .07, 0, -.04, .12);
    caixa(.02, .025, .035, 0, .11, .045, 'arma-detalhe');
    caixa(.012, .035, .018, 0, .095, .365, 'arma-detalhe');
    const tubo = rec.usar(new Mesh(rec.geo(new CylinderGeometry(.012, .014, .19, 12).rotateX(Math.PI / 2))), 'arma-detalhe');
    tubo.position.set(0, .055, .43); grupo.add(tubo);
  }
  const cano = new Object3D(); cano.position.set(0, .055, .535); cano.name = 'policial:cano'; grupo.add(cano);
  const apoio = new Object3D(); apoio.position.set(0, .015, .29); apoio.name = 'policial:apoio'; grupo.add(apoio);
  if (fuzil) {
    // As geometrias e mapas são compartilhados pelo acervo; cada NPC só clona os nós.
    const copia = fuzil.clone(true);
    copia.traverse((o) => { const m = o as Mesh; if (m.isMesh) { rec.usar(m, 'policial-fuzil', true); m.castShadow = m.receiveShadow = true; } });
    grupo.name = 'policial:fuzil-olive-drab'; grupo.add(copia);
    cano.position.set(0, .081, .601); apoio.position.set(0, .045, .30);
  }
  const mat = rec.mat(new MeshBasicMaterial({ color: 0xffcb74, transparent: true, opacity: .85, depthWrite: false, blending: AdditiveBlending }));
  const clarao = new Mesh(rec.geo(new SphereGeometry(.035, 7, 5)), mat);
  clarao.scale.set(1, 1, 2.2); clarao.visible = false; cano.add(clarao);
  return { grupo, cano, apoio, clarao };
}

