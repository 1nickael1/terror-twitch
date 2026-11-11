import { AnimationClip, Quaternion, QuaternionKeyframeTrack, Vector3, type KeyframeTrack } from 'three';
import type { ModoIA } from '../../sim/world';
import { prepararAnimacoesDoutor } from './doutorAnimacoes';

export const CLIPE_TIRO_POLICIAL = 'Walk_Forward_While_Shooting';
export const AMOSTRA_MIRA_POLICIAL = .65;
export const CLIPE_MIRA_ARCO = 'Archery_Aim_with_Lateral_Scan';
export const CLIPE_CAMINHADA_ARCO = 'Walk_Forward_with_Bow_Aimed';
export const CLIPE_RECUO_POLICIAL = 'Walk_Backward_with_Bow';

/** Recuo real em relação à frente do NPC; deslocamentos laterais e ruído não contam. */
export function movimentoParaTras(dx: number, dz: number, yaw: number): boolean {
  const d = Math.hypot(dx, dz);
  return d > .00001 && (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / d < -.35;
}

const inferior = (t: KeyframeTrack) => /mixamorig(?:Hips\.|(?:Left|Right)(?:UpLeg|Leg|Foot|Toe))/.test(t.name);
const amostra = (t: KeyframeTrack, tempo: number) => Array.from(t.InterpolantFactoryMethodLinear().evaluate(tempo));
function fixar(t: KeyframeTrack, tempo: number): KeyframeTrack {
  const copia = t.clone(), valores = amostra(t, tempo);
  copia.times = new Float32Array([0, 1]); copia.values = new Float32Array([...valores, ...valores]);
  return copia;
}
function rotacao(c: AnimationClip, osso: string, tempo: number): Quaternion {
  const t = c.tracks.find(t => t.name === `mixamorig${osso}.quaternion`);
  return t ? new Quaternion().fromArray(amostra(t, tempo)).normalize() : new Quaternion();
}
function cabeca(c: AnimationClip, tempo: number): Quaternion {
  const q = new Quaternion();
  for (const osso of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) q.multiply(rotacao(c, osso, tempo));
  return q.normalize();
}
function trilhaRotacao(nome: string, duracao: number, avaliar: (t: number) => Quaternion): QuaternionKeyframeTrack {
  const tempos: number[] = [], valores: number[] = [];
  const quadros = Math.ceil(duracao * 60);
  let anterior: Quaternion | undefined;
  for (let n = 0; n <= quadros; n++) {
    const t = n / quadros * duracao, q = avaliar(t).normalize();
    if (anterior && anterior.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    tempos.push(t); valores.push(...q.toArray()); anterior = q;
  }
  return new QuaternionKeyframeTrack(`mixamorig${nome}.quaternion`, tempos, valores);
}

export function prepararAnimacoesPolicial(originais: readonly AnimationClip[]): AnimationClip[] {
  const clips = prepararAnimacoesDoutor(originais);
  const tiro = clips.find((c) => c.name === CLIPE_TIRO_POLICIAL);
  const arco = clips.find(c => c.name === CLIPE_MIRA_ARCO);
  if (!tiro || !arco) throw new Error('O policial precisa dos clipes de tiro e mira.');
  // A postura de arco tem os dois pés apoiados. Congelamos toda a cadeia inferior,
  // inclusive o quadril, para que o tronco do tiro não faça os pés deslizar ou girar.
  const base = arco.tracks.filter(inferior).map(t => fixar(t, AMOSTRA_MIRA_POLICIAL));
  const quadrilBase = rotacao(arco, 'Hips', AMOSTRA_MIRA_POLICIAL);
  const tronco = tiro.tracks.filter(t => !inferior(t));
  const espinha = trilhaRotacao('Spine', tiro.duration, t => quadrilBase.clone().invert()
    .multiply(rotacao(tiro, 'Hips', t)).multiply(rotacao(tiro, 'Spine', t)));
  const parado = new AnimationClip('TiroParado', tiro.duration, [...base.map(t => t.clone()),
    ...tronco.filter(t => t.name !== 'mixamorigSpine.quaternion').map(t => t.clone()), espinha]);
  clips.push(parado);
  clips.push(new AnimationClip('Mira', 1, parado.tracks.map(t => fixar(t, AMOSTRA_MIRA_POLICIAL))));

  // Os originais do asset ficam intactos. As cópias de arco conservam pernas e
  // varredura, mas usam os braços, mãos e tronco da empunhadura de rifle.
  const quadrilRifle = rotacao(tiro, 'Hips', AMOSTRA_MIRA_POLICIAL);
  const espinhaRifle = rotacao(tiro, 'Spine', AMOSTRA_MIRA_POLICIAL);
  const cabecaRifle = rotacao(tiro, 'Head', AMOSTRA_MIRA_POLICIAL);
  for (const nome of [CLIPE_MIRA_ARCO, CLIPE_CAMINHADA_ARCO, CLIPE_RECUO_POLICIAL]) {
    const indice = clips.findIndex(c => c.name === nome), origem = clips[indice];
    if (!origem) continue;
    const lateral = nome === CLIPE_MIRA_ARCO;
    const quadrilReferencia = rotacao(origem, 'Hips', AMOSTRA_MIRA_POLICIAL);
    const olhar = (t: number) => lateral
      ? rotacao(origem, 'Hips', t).invert().multiply(cabeca(origem, t))
      : cabeca(origem, t);
    const referencia = olhar(AMOSTRA_MIRA_POLICIAL);
    const varredura = (t: number) => {
      const frente = new Vector3(0, 0, 1).applyQuaternion(olhar(t).multiply(referencia.clone().invert()));
      return Math.max(-.35, Math.min(.35, Math.atan2(frente.x, frente.z)));
    };
    const qY = (angulo: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angulo);
    const superior = tronco.filter(t => !['mixamorigSpine.quaternion', 'mixamorigHead.quaternion'].includes(t.name))
      .map(t => fixar(t, AMOSTRA_MIRA_POLICIAL));
    // Na mira lateral a correção é fixa: o tronco herda o giro animado do quadril.
    // Só a caminhada estabiliza a mira compensando o balanço da pelve a cada quadro.
    const spine = trilhaRotacao('Spine', origem.duration, t => (lateral ? quadrilReferencia.clone() : rotacao(origem, 'Hips', t)).invert()
      .multiply(qY(varredura(t) * .45)).multiply(quadrilRifle).multiply(espinhaRifle));
    const head = trilhaRotacao('Head', origem.duration, t => qY(varredura(t) * .55).multiply(cabecaRifle));
    clips[indice] = new AnimationClip(nome, origem.duration, [...origem.tracks.filter(inferior).map(t => t.clone()), ...superior, spine, head]);
  }
  return clips;
}

export function animacaoDoPolicial(modo: ModoIA, velocidade: number, atirando: boolean, podeAtirar = false, recuando = false): string {
  if (modo === 'morto') return 'Dead';
  if (modo === 'dor') return 'Dano';
  if (recuando && velocidade > .12) return CLIPE_RECUO_POLICIAL;
  if (atirando) return velocidade > .3 ? CLIPE_TIRO_POLICIAL : 'TiroParado';
  if (velocidade > .3 && podeAtirar && (modo === 'perseguicao' || modo === 'ataque')) return CLIPE_TIRO_POLICIAL;
  if (modo === 'ataque' || (modo === 'suspeita' && velocidade < .12)) return CLIPE_MIRA_ARCO;
  if (velocidade < .12) return 'Mira';
  return CLIPE_CAMINHADA_ARCO;
}
