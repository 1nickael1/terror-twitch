// Moldes dos inimigos comuns: esqueleto (juntas), pose base e peças de primitivas por osso.
// Desenho original: cada tipo tem silhueta própria, legível de longe no escuro. As medidas são
// para 1,8 m de altura e 0,35 m de raio; `ModelosInimigos.montar` escala pelo `TIPOS` do tipo.
// Frente = -z local (igual ao `yaw` da simulação); a raiz fica nos pés.
import { BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three';

/** Ossos de todo esqueleto. */
export type OssoBase = 'tronco' | 'cabeca' | 'bracoE' | 'bracoD' | 'pernaE' | 'pernaD';
/** Antebraços: só nos moldes que dobram o cotovelo (filhos do braço, na junta do cotovelo). */
export type Antebraco = 'antebracoE' | 'antebracoD';
export type Osso = OssoBase | Antebraco;

/** Pose base do tipo: ângulos (rad) somados à animação. */
export interface PoseBase {
  quadril: number;       // altura do quadril (m, antes da escala)
  troncoX: number;       // negativo = curvado para a frente
  cabecaX: number;       // negativo = cabeça caída para a frente
  cabecaZ: number;       // cabeça torta
  bracoX: number;        // braços (positivo = mão para a frente)
  bracoZ: number;        // abertura dos braços
  bracoDFixo: number | null;   // braço direito estendido fixo (segurança)
  balancoBraco: number;  // fração do balanço dos braços ao andar
  /** fator de "braço mole": os braços atrasam e balançam mais (funcionário) */
  mole: number;
}

/**
 * Peça do molde. Comum: `cor` (vira cor de vértice). Emissiva: `slot` do banco; `apaga` (padrão
 * true) = some quando o corpo termina de cair (olhos, visor); o crachá não apaga. `brilho`: a boca
 * da arma do segurança, malha própria aditiva que cresce no preparo do ataque.
 */
export interface Peca {
  osso: Osso; geo: () => BufferGeometry; cor?: number; slot?: string;
  pos?: readonly [number, number, number]; rot?: readonly [number, number, number]; esc?: readonly [number, number, number];
  emissivo?: boolean; apaga?: boolean; brilho?: boolean;
}

export type Junta = readonly [number, number, number];

export interface Molde {
  base: PoseBase;
  /** posição de cada osso relativa ao pai (tronco e pernas: pelve; braços e cabeça: tronco; antebraço: braço) */
  juntas: Record<OssoBase, Junta> & Partial<Record<Antebraco, Junta>>;
  pecas: Peca[];
}

export const cap = (r: number, comp: number) => () => new CapsuleGeometry(r, comp, 3, 8);
export const esf = (r: number) => () => new SphereGeometry(r, 10, 8);
export const caixa = (w: number, h: number, d: number) => () => new BoxGeometry(w, h, d);

// cores (sRGB) das peças comuns
const JALECO = 0xd6d1c4;
const PELE = 0xa89a8c;
const CABELO = 0x1e1a17;
const CALCA = 0x34363a;
const FARDA = 0x262d3c;
const COLETE = 0x141619;
const CAPACETE = 0x2c3326;
const GENERICO_COR = 0x7a4646;
const ARMA = 0x2a2c30;

// --- funcionário: jaleco comprido, ombros caídos, braços longos e moles, cabeça torta ---------
export const FUNCIONARIO: Molde = {
  base: {
    quadril: 0.86, troncoX: -0.16, cabecaX: -0.25, cabecaZ: 0.5, bracoX: 0.14, bracoZ: 0.06,
    bracoDFixo: null, balancoBraco: 1.1, mole: 1,
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.1, 0, 0], pernaD: [0.1, 0, 0],
    bracoE: [-0.23, 0.55, 0.02], bracoD: [0.23, 0.53, 0.02], cabeca: [0.02, 0.66, -0.02],
  },
  pecas: [
    // pernas (calça escura) e sapatos
    { osso: 'pernaE', geo: cap(0.07, 0.66), cor: CALCA, pos: [0, -0.41, 0] },
    { osso: 'pernaD', geo: cap(0.07, 0.66), cor: CALCA, pos: [0, -0.41, 0] },
    { osso: 'pernaE', geo: caixa(0.12, 0.07, 0.24), cor: CABELO, pos: [0, -0.83, -0.05] },
    { osso: 'pernaD', geo: caixa(0.12, 0.07, 0.24), cor: CABELO, pos: [0, -0.83, -0.05] },
    // jaleco: tronco afunilado que desce até o joelho, achatado na frente
    {
      osso: 'tronco', geo: () => new CylinderGeometry(0.19, 0.27, 1.06, 10), cor: JALECO,
      pos: [0, 0.1, 0], esc: [1, 1, 0.68],
    },
    // gola em V escura e crachá
    { osso: 'tronco', geo: () => new ConeGeometry(0.07, 0.2, 3), cor: CALCA, pos: [0, 0.52, -0.125], rot: [Math.PI, 0, 0] },
    { osso: 'tronco', geo: caixa(0.06, 0.08, 0.01), slot: 'ini-olho', pos: [-0.1, 0.36, -0.14], emissivo: true, apaga: false },
    // ombros caídos (bolas do jaleco, baixas)
    { osso: 'tronco', geo: esf(0.085), cor: JALECO, pos: [-0.2, 0.55, 0] },
    { osso: 'tronco', geo: esf(0.085), cor: JALECO, pos: [0.2, 0.53, 0] },
    // pescoço
    { osso: 'tronco', geo: () => new CylinderGeometry(0.045, 0.05, 0.12, 6), cor: PELE, pos: [0.01, 0.62, -0.01] },
    // braços longos: manga do jaleco e mão pálida na altura do joelho
    { osso: 'bracoE', geo: cap(0.055, 0.58), cor: JALECO, pos: [0, -0.33, 0] },
    { osso: 'bracoD', geo: cap(0.055, 0.58), cor: JALECO, pos: [0, -0.33, 0] },
    { osso: 'bracoE', geo: cap(0.04, 0.14), cor: PELE, pos: [0, -0.74, 0] },
    { osso: 'bracoD', geo: cap(0.04, 0.14), cor: PELE, pos: [0, -0.74, 0] },
    // cabeça alongada, cabelo ralo e olhos fracos
    { osso: 'cabeca', geo: esf(0.115), cor: PELE, pos: [0, 0.12, 0], esc: [0.9, 1.15, 1] },
    { osso: 'cabeca', geo: () => new SphereGeometry(0.118, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), cor: CABELO, pos: [0, 0.135, 0.01], esc: [0.92, 1.15, 1.02] },
    { osso: 'cabeca', geo: esf(0.018), slot: 'ini-olho', pos: [-0.04, 0.13, -0.098], emissivo: true },
    { osso: 'cabeca', geo: esf(0.018), slot: 'ini-olho', pos: [0.04, 0.13, -0.098], emissivo: true },
  ],
};

// --- segurança: ombros largos, colete escuro, capacete com visor, braço direito estendido ----
export const SEGURANCA: Molde = {
  base: {
    quadril: 0.88, troncoX: 0.02, cabecaX: 0, cabecaZ: 0, bracoX: 0.08, bracoZ: 0.18,
    bracoDFixo: 1.45, balancoBraco: 0.7, mole: 0,
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.13, 0, 0], pernaD: [0.13, 0, 0],
    bracoE: [-0.36, 0.6, 0], bracoD: [0.36, 0.6, 0], cabeca: [0, 0.7, 0],
  },
  pecas: [
    // pernas grossas e botas
    { osso: 'pernaE', geo: cap(0.09, 0.62), cor: FARDA, pos: [0, -0.4, 0] },
    { osso: 'pernaD', geo: cap(0.09, 0.62), cor: FARDA, pos: [0, -0.4, 0] },
    { osso: 'pernaE', geo: caixa(0.15, 0.14, 0.27), cor: COLETE, pos: [0, -0.81, -0.04] },
    { osso: 'pernaD', geo: caixa(0.15, 0.14, 0.27), cor: COLETE, pos: [0, -0.81, -0.04] },
    // tronco em cunha: cintura estreita, peito largo; colete por cima
    { osso: 'tronco', geo: () => new CylinderGeometry(0.3, 0.2, 0.72, 4, 1), cor: FARDA, pos: [0, 0.34, 0], rot: [0, Math.PI / 4, 0], esc: [1.25, 1, 0.75] },
    { osso: 'tronco', geo: caixa(0.56, 0.44, 0.36), cor: COLETE, pos: [0, 0.42, 0] },
    // placas do colete e cinto
    { osso: 'tronco', geo: caixa(0.36, 0.12, 0.05), cor: CAPACETE, pos: [0, 0.32, -0.195] },
    { osso: 'tronco', geo: caixa(0.46, 0.08, 0.34), cor: COLETE, pos: [0, 0.02, 0] },
    // ombreiras largas
    { osso: 'tronco', geo: esf(0.14), cor: COLETE, pos: [-0.33, 0.62, 0], esc: [1.1, 0.75, 1] },
    { osso: 'tronco', geo: esf(0.14), cor: COLETE, pos: [0.33, 0.62, 0], esc: [1.1, 0.75, 1] },
    // braços: manga e luva; o direito segura uma arma curta (de onde sai o projétil)
    { osso: 'bracoE', geo: cap(0.075, 0.46), cor: FARDA, pos: [0, -0.28, 0] },
    { osso: 'bracoD', geo: cap(0.075, 0.46), cor: FARDA, pos: [0, -0.28, 0] },
    { osso: 'bracoE', geo: esf(0.07), cor: COLETE, pos: [0, -0.6, 0] },
    { osso: 'bracoD', geo: esf(0.07), cor: COLETE, pos: [0, -0.6, 0] },
    { osso: 'bracoD', geo: caixa(0.06, 0.26, 0.1), cor: ARMA, pos: [0, -0.72, 0.02] },
    { osso: 'bracoD', geo: esf(0.022), slot: 'ini-visor', pos: [0, -0.86, 0.02], emissivo: true, brilho: true },
    // cabeça com capacete de aba e visor estreito aceso
    { osso: 'cabeca', geo: esf(0.12), cor: PELE, pos: [0, 0.12, 0] },
    { osso: 'cabeca', geo: () => new SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), cor: CAPACETE, pos: [0, 0.14, 0] },
    { osso: 'cabeca', geo: () => new CylinderGeometry(0.19, 0.19, 0.025, 12), cor: CAPACETE, pos: [0, 0.14, -0.02], esc: [1, 1, 1.1] },
    { osso: 'cabeca', geo: caixa(0.2, 0.045, 0.03), slot: 'ini-visor', pos: [0, 0.1, -0.115], emissivo: true },
  ],
};

// --- genérico (tipo de teste ou desconhecido): cápsula com cabeça ----------------------------
export const GENERICO: Molde = {
  base: {
    quadril: 0.5, troncoX: 0, cabecaX: 0, cabecaZ: 0, bracoX: 0, bracoZ: 0,
    bracoDFixo: null, balancoBraco: 0, mole: 0,
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.12, 0, 0], pernaD: [0.12, 0, 0],
    bracoE: [-0.3, 0.7, 0], bracoD: [0.3, 0.7, 0], cabeca: [0, 0.9, 0],
  },
  pecas: [
    { osso: 'pernaE', geo: cap(0.1, 0.3), cor: GENERICO_COR, pos: [0, -0.25, 0] },
    { osso: 'pernaD', geo: cap(0.1, 0.3), cor: GENERICO_COR, pos: [0, -0.25, 0] },
    { osso: 'tronco', geo: cap(0.3, 0.45), cor: GENERICO_COR, pos: [0, 0.45, 0] },
    { osso: 'cabeca', geo: esf(0.17), cor: GENERICO_COR, pos: [0, 0.15, 0] },
    { osso: 'cabeca', geo: caixa(0.2, 0.05, 0.03), slot: 'ini-olho', pos: [0, 0.17, -0.16], emissivo: true },
  ],
};
