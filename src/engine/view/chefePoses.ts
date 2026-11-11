// Poses procedurais do chefe da fase 1, pela fase dele (`world.chefe.fase`), não pelo `modo`:
// inerte (de pé, curvado, balanço lento, ombros tremendo), despertando (mãos no rosto, tremor
// forte), perseguição (corrida desengonçada, braços soltos para trás; perto do jogador ergue um
// braço e o golpe o desce), arrombando (golpes alternados à frente), investida (inclinado, braços
// abertos), pausa (encolhido, mãos no rosto, soluçando) e morto (de bruços). Funções puras.
// O chefe da fase 2 (049) tem as poses próprias em `calcularPoseChefe049`, no fim.
import { CHEFE_049 } from '../../sim/balance';
import type { FaseChefe, FaseChefe049 } from '../../sim/world';
import { aproximar, DOR_VISUAL, type EstadoVisual, type Pose } from './inimigosPoses';
import type { PoseBase } from './moldesInimigos';

/**
 * s da animação do golpe desde o `inimigo_ataque` do chefe (emitido no início do preparo de
 * 0,45 s): o braço fica erguido e desce entre DESCE_DE e DESCE_ATE, junto do dano.
 */
export const GOLPE_CHEFE = 0.6;
const DESCE_DE = 0.3;
const DESCE_ATE = 0.5;
/** distância (m) ao jogador em que o chefe, perseguindo, ergue o braço para o golpe */
export const PERTO_GOLPE = 2;

export interface EntradaChefe {
  fase: FaseChefe;
  timer: number;   // `world.chefe.timer` (segundos restantes da fase)
  perto: boolean;  // a menos de PERTO_GOLPE do jogador
}

/** Braços erguidos à frente com os antebraços dobrados de volta: as mãos cobrem o rosto. */
function maosNoRosto(p: Pose, tremor: number): void {
  // cotovelo à frente e abaixo do ombro; a palma para diante do rosto, dedos até a testa
  p.bracoEX = 1.2 + tremor;
  p.bracoDX = 1.2 - tremor;
  p.bracoEZ = 0.22;
  p.bracoDZ = -0.22;
  p.antebracoEX = 2.58;
  p.antebracoDX = 2.58;
}

/** Pernas e quadril na cadência da passada (`amp` em rad). */
function correr(p: Pose, b: PoseBase, v: EstadoVisual, amp: number): number {
  const s = Math.sin(v.passada);
  p.pernaEX = s * amp;
  p.pernaDX = -s * amp;
  p.pelveY = b.quadril + Math.abs(Math.cos(v.passada)) * 0.05;
  return s;
}

/** Calcula em `p` a pose alvo do chefe (a pose base `b` é o ponto de partida). */
export function calcularPoseChefe(p: Pose, b: PoseBase, v: EstadoVisual, e: EntradaChefe): void {
  for (const c of Object.keys(p) as (keyof Pose)[]) p[c] = 0;
  p.pelveY = b.quadril;
  p.troncoX = b.troncoX;
  p.bracoEX = b.bracoX;
  p.bracoDX = b.bracoX;
  p.bracoEZ = -b.bracoZ;
  p.bracoDZ = b.bracoZ;
  const t = v.t;

  switch (e.fase) {
    case 'morto':
      // de bruços: tomba para a frente no pivô dos pés, braços largados acima da cabeça
      p.corpoX = -Math.PI / 2;
      p.corpoY = 0.1;
      p.troncoX = 0.05;
      p.bracoEX = 2.7;
      p.bracoDX = 2.2;
      p.bracoEZ = -0.5;
      p.bracoDZ = 0.9;
      p.antebracoEX = 0.3;
      p.antebracoDX = -0.4;
      p.pernaEX = -0.08;
      p.pernaDX = 0.12;
      return;
    case 'procurando':
    case 'inerte': {
      // de pé, curvado, balanço lento; os ombros tremem de leve
      const tremor = Math.sin(t * 26) * 0.012;
      p.troncoX += Math.sin(t * 0.6) * 0.04 - 0.05;
      p.troncoZ = Math.sin(t * 0.45) * 0.05;
      p.bracoEZ += tremor;
      p.bracoDZ -= tremor;
      p.bracoEX += Math.sin(t * 0.6 + 0.4) * 0.03;
      p.bracoDX += Math.sin(t * 0.6 + 0.9) * 0.03;
      p.antebracoEX = 0.12;
      p.antebracoDX = 0.12;
      break;
    }
    case 'despertando': {
      // mãos cobrindo o rosto, tremor forte que cresce até o fim
      const k = 1 - Math.min(1, Math.max(0, e.timer / 2.5));
      const forca = 0.05 + 0.05 * k;
      p.troncoX = -0.6 + Math.sin(t * 31) * forca;
      p.troncoZ = Math.cos(t * 27) * forca * 0.8;
      maosNoRosto(p, Math.sin(t * 37) * forca);
      p.pernaEX = 0.05;
      p.pernaDX = -0.05;
      break;
    }
    case 'pausa': {
      // encolhido (quadril baixo, pernas dobradas à frente), mãos no rosto, soluços
      const soluco = Math.abs(Math.sin(t * 4.2)) * 0.08;
      p.pelveY = b.quadril * 0.6;
      p.pernaEX = 0.85;
      p.pernaDX = 0.7;
      p.troncoX = -0.85 + soluco;
      p.troncoZ = Math.sin(t * 1.3) * 0.04;
      maosNoRosto(p, soluco * 0.5);
      break;
    }
    case 'arrombando': {
      // golpes alternados dos dois braços à frente, o tronco acompanha
      const s = Math.sin(t * 6);
      const golpe = Math.sign(s) * Math.sqrt(Math.abs(s));
      p.troncoX = -0.3 - Math.abs(golpe) * 0.15;
      p.troncoZ = golpe * 0.08;
      p.bracoEX = 1.55 + golpe * 0.85;
      p.bracoDX = 1.55 - golpe * 0.85;
      p.antebracoEX = 0.35 - golpe * 0.25;
      p.antebracoDX = 0.35 + golpe * 0.25;
      p.pernaEX = -0.2;
      p.pernaDX = 0.25;
      break;
    }
    case 'investida': {
      // corpo muito inclinado à frente, braços abertos para os lados
      const s = correr(p, b, v, 0.95);
      p.corpoX = -0.3;
      p.troncoX = -0.7;
      p.bracoEX = -0.3 + s * 0.1;
      p.bracoDX = -0.3 - s * 0.1;
      p.bracoEZ = -1.35;
      p.bracoDZ = 1.35;
      p.antebracoEX = 0.25;
      p.antebracoDX = 0.25;
      break;
    }
    case 'perseguicao': {
      // corrida desengonçada: passada larga, braços longos soltos para trás, balançando atrasados
      const amp = 0.25 + Math.min(1, v.vel / 6) * 0.6;
      correr(p, b, v, amp);
      const atraso = Math.sin(v.passada - 0.9) * 0.18;
      p.troncoX = -0.4 - Math.min(1, v.vel / 6) * 0.1;
      p.troncoZ = Math.sin(v.passada) * 0.07;
      p.bracoEX = -0.7 + atraso;
      p.bracoDX = -0.7 - atraso;
      p.bracoEZ = -0.25;
      p.bracoDZ = 0.25;
      p.antebracoEX = 0.15;
      p.antebracoDX = 0.15;
      if (e.perto || v.golpe >= 0) {
        // perto do jogador: ergue o braço direito; o golpe (`inimigo_ataque`) o desce com tudo
        p.troncoX = -0.15;
        p.bracoDX = 2.7;
        p.bracoDZ = 0.35;
        p.antebracoDX = 0.4;
        p.bracoEX = 0.6;
        if (v.golpe >= 0) {
          const k = Math.min(1, Math.max(0, (v.golpe - DESCE_DE) / (DESCE_ATE - DESCE_DE)));
          p.bracoDX = aproximar(2.7, 0.3, k);
          p.troncoX = aproximar(-0.15, -0.6, k);
        }
      }
      break;
    }
  }

  tremorDoAcerto(p, v);
}

/** Acerto no chefe: tremor curto, sem solavanco (ele leva centenas de tiros). */
function tremorDoAcerto(p: Pose, v: EstadoVisual): void {
  if (v.dor >= DOR_VISUAL) return;
  const k = 1 - v.dor / DOR_VISUAL;
  p.troncoX += Math.sin(v.t * 45) * 0.04 * k;
  p.troncoZ += Math.cos(v.t * 41) * 0.04 * k;
}

// --- chefe da fase 2 (049) -------------------------------------------------------------------

export interface EntradaChefe049 {
  fase: FaseChefe049;
  timer: number;       // `world.chefe.timer` (s restantes da fase)
  /** s do preparo do toque (`TIPOS.entidade049.preparo`) e da reanimação (`CHEFE_049.reanimar`) */
  preparo: number;
  reanimar: number;
  /** `timer` visto ao entrar em `despertando` (o restauro começa com `CHEFE_049.retomada`, mais longo) */
  despertarTotal?: number;
}

/** Passada medida: pernas curtas sob o manto, quadril quase parado (ele desliza). */
function passada049(p: Pose, b: PoseBase, v: EstadoVisual, amp: number): number {
  const s = Math.sin(v.passada);
  p.pernaEX = s * amp;
  p.pernaDX = -s * amp;
  p.pelveY = b.quadril + Math.abs(Math.cos(v.passada)) * 0.015;
  return s;
}

/**
 * Pose alvo do chefe 049 pela fase: inerte (ereto, cabeça baixa, mãos juntas à frente), despertando
 * (ergue a cabeça e abre os braços), caminhando (passada medida, a mão direita um pouco à frente),
 * apressado (inclinado, passada larga, a mão estendida), tocando (braço direito estendido ao jogador,
 * a palma acende: o aviso), reanimando (os dois braços erguidos sobre o corpo) e morto (de bruços).
 * Devolve o progresso do aviso do toque (0..1), que a view usa para acender a palma. Função pura.
 */
export function calcularPoseChefe049(p: Pose, b: PoseBase, v: EstadoVisual, e: EntradaChefe049): number {
  for (const c of Object.keys(p) as (keyof Pose)[]) p[c] = 0;
  p.pelveY = b.quadril;
  p.troncoX = b.troncoX;
  p.cabecaX = b.cabecaX;
  p.bracoEX = b.bracoX;
  p.bracoDX = b.bracoX;
  p.bracoEZ = -b.bracoZ;
  p.bracoDZ = b.bracoZ;
  const t = v.t;
  let aviso = 0;

  switch (e.fase) {
    case 'morto':
      // cai de bruços, braços largados para a frente
      p.corpoX = -Math.PI / 2;
      p.corpoY = 0.12;
      p.troncoX = 0.08;
      p.cabecaX = 0.3;
      p.bracoEX = 2.5;
      p.bracoDX = 2.9;
      p.bracoEZ = -0.35;
      p.bracoDZ = 0.2;
      p.pernaEX = -0.05;
      p.pernaDX = 0.1;
      return 0;
    case 'inerte': {
      // ereto e imóvel, cabeça baixa, mãos juntas à frente do corpo; respiração lenta
      const resp = Math.sin(t * 0.8) * 0.015;
      p.troncoX += resp;
      p.cabecaX = -0.4 - resp;
      p.bracoEX = 0.42;
      p.bracoDX = 0.42;
      p.bracoEZ = 0.32;
      p.bracoDZ = -0.32;
      break;
    }
    case 'despertando': {
      // a cabeça sobe devagar e os braços se abrem, como quem recebe um paciente
      // duração: `CHEFE_049.despertar`, ou mais se o timer visto ao começar foi maior (restauro: retomada)
      const total = Math.max(CHEFE_049.despertar, e.despertarTotal ?? 0);
      const k = 1 - Math.min(1, Math.max(0, e.timer / total));
      p.cabecaX = aproximar(-0.4, 0.15, k);
      p.bracoEX = aproximar(0.42, 0.35, k);
      p.bracoDX = aproximar(0.42, 0.35, k);
      p.bracoEZ = aproximar(0.32, -0.55, k);
      p.bracoDZ = aproximar(-0.32, 0.55, k);
      p.troncoX = aproximar(b.troncoX, 0.04, k);
      break;
    }
    case 'caminhando': {
      const amp = 0.12 + Math.min(1, v.vel / 2.5) * 0.25;
      const s = passada049(p, b, v, amp);
      p.troncoZ = s * 0.02;
      // a maleta pesa: o braço esquerdo quase não balança; o direito vai um pouco à frente
      p.bracoEX = b.bracoX - s * 0.05;
      p.bracoDX = 0.38 + s * 0.08;
      p.cabecaX = -0.02;
      break;
    }
    case 'apressado': {
      const amp = 0.3 + Math.min(1, v.vel / 4.5) * 0.35;
      const s = passada049(p, b, v, amp);
      p.troncoX = -0.32;
      p.troncoZ = s * 0.05;
      p.cabecaX = 0.2;
      p.bracoEX = b.bracoX - s * 0.15;
      p.bracoDX = 1.1 + s * 0.1;
      p.bracoDZ = 0.1;
      break;
    }
    case 'tocando': {
      // o braço direito se estende até o jogador; a palma acende conforme o toque se aproxima
      const k = Math.min(1, Math.max(0, 1 - e.timer / Math.max(0.01, e.preparo)));
      aviso = k;
      const tremor = Math.sin(t * 33) * 0.025 * k;
      p.troncoX = aproximar(b.troncoX, -0.18, k);
      p.cabecaX = aproximar(b.cabecaX, 0.12, k);
      p.bracoDX = aproximar(0.38, 1.6, Math.min(1, k * 1.6)) + tremor;
      p.bracoDZ = aproximar(b.bracoZ, -0.08, k);
      p.bracoEX = 0.15;
      p.pernaEX = -0.15 * k;
      p.pernaDX = 0.2 * k;
      break;
    }
    case 'reanimando': {
      // os dois braços se erguem sobre o corpo no primeiro terço e ficam no alto, oscilando
      const k = Math.min(1, Math.max(0, (1 - e.timer / Math.max(0.01, e.reanimar)) * 3));
      const osc = Math.sin(t * 2.4) * 0.08 * k;
      p.troncoX = aproximar(b.troncoX, 0.1, k);
      p.cabecaX = aproximar(b.cabecaX, 0.35, k);
      p.bracoEX = aproximar(b.bracoX, 2.55, k) + osc;
      p.bracoDX = aproximar(b.bracoX, 2.55, k) - osc;
      p.bracoEZ = aproximar(-b.bracoZ, -0.45, k);
      p.bracoDZ = aproximar(b.bracoZ, 0.45, k);
      break;
    }
  }
  tremorDoAcerto(p, v);
  return aviso;
}
