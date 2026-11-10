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
  /**
   * Pose do ataque: `garras` (ergue os dois braços e desce), `arma` (aponta o braço direito) ou
   * `arremesso` (leva o braço direito para trás da cabeça e lança). Padrão: `arma` com `bracoDFixo`, senão `garras`.
   */
  ataque?: EstiloAtaque;
  /** 0..1: uma perna arrasta (passada curta dela e o quadril pendendo para o lado) */
  manco?: number;
}

export type EstiloAtaque = 'garras' | 'arma' | 'arremesso';

export function estiloAtaque(b: PoseBase): EstiloAtaque {
  return b.ataque ?? (b.bracoDFixo === null ? 'garras' : 'arma');
}

/**
 * Peça do molde. Comum: `cor` (vira cor de vértice). Emissiva: `slot` do banco; `apaga` (padrão
 * true) = some quando o corpo termina de cair (olhos, visor); o crachá não apaga. `brilho`: a boca
 * da arma do segurança, malha própria aditiva que cresce no preparo do ataque (`corBrilho`, padrão laranja).
 */
export interface Peca {
  osso: Osso; geo: () => BufferGeometry; cor?: number; slot?: string;
  pos?: readonly [number, number, number]; rot?: readonly [number, number, number]; esc?: readonly [number, number, number];
  emissivo?: boolean; apaga?: boolean; brilho?: boolean; corBrilho?: number;
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

// cores da fase 2
const PELE_CINZA = 0x8a8f86;
const PELE_CINZA_ESCURA = 0x6c7069;
const AVENTAL = 0x9fb3b0;
const MANCHA = 0x4a2a20;
const LENCOL = 0xd9dad2;
const PIJAMA = 0x2f5a5a;
const MASCARA = 0xa9c4d0;
const COSTURA = 0x2a1c1a;
const COURO = 0x3a2a1e;
const VIDRO_VERDE = 0x7f9a4a;

/** Pernas nuas, cinzentas, com os pés descalços (reanimados). */
function pernasNuas(dx: number): Peca[] {
  return [
    { osso: 'pernaE', geo: cap(0.062, 0.66), cor: PELE_CINZA, pos: [0, -0.41, 0] },
    { osso: 'pernaD', geo: cap(0.062, 0.66), cor: PELE_CINZA, pos: [0, -0.41, 0] },
    { osso: 'pernaE', geo: caixa(0.1, 0.05, 0.22), cor: PELE_CINZA_ESCURA, pos: [-dx, -0.84, -0.05] },
    { osso: 'pernaD', geo: caixa(0.1, 0.05, 0.22), cor: PELE_CINZA_ESCURA, pos: [dx, -0.84, -0.05] },
  ];
}

/** Cabeça calva e cinzenta, órbitas fundas com olhos leitosos e a boca caída aberta. */
function cabecaMorta(sutura: boolean): Peca[] {
  const pecas: Peca[] = [
    { osso: 'cabeca', geo: esf(0.115), cor: PELE_CINZA, pos: [0, 0.12, 0], esc: [0.88, 1.12, 1] },
    { osso: 'cabeca', geo: esf(0.022), cor: COSTURA, pos: [-0.038, 0.13, -0.092] },
    { osso: 'cabeca', geo: esf(0.022), cor: COSTURA, pos: [0.038, 0.13, -0.092] },
    { osso: 'cabeca', geo: caixa(0.05, 0.045, 0.02), cor: COSTURA, pos: [0, 0.03, -0.098] },
    { osso: 'cabeca', geo: esf(0.013), slot: 'ini-olho', pos: [-0.038, 0.13, -0.104], emissivo: true },
    { osso: 'cabeca', geo: esf(0.013), slot: 'ini-olho', pos: [0.038, 0.13, -0.104], emissivo: true },
  ];
  // sutura de necrópsia atravessando o crânio
  if (sutura) pecas.push({ osso: 'cabeca', geo: caixa(0.2, 0.012, 0.012), cor: COSTURA, pos: [0, 0.22, -0.02], rot: [0.35, 0, 0] });
  return pecas;
}

/** Braços nus e cinzentos, compridos, com mãos pendentes. `manga`: cor da manga curta (ou nenhuma). */
function bracosMortos(manga: number | null): Peca[] {
  const pecas: Peca[] = [];
  for (const osso of ['bracoE', 'bracoD'] as const) {
    if (manga !== null) pecas.push({ osso, geo: cap(0.068, 0.14), cor: manga, pos: [0, -0.1, 0] });
    pecas.push({ osso, geo: cap(0.046, 0.5), cor: PELE_CINZA, pos: [0, -0.4, 0] });
    pecas.push({ osso, geo: cap(0.042, 0.12), cor: PELE_CINZA_ESCURA, pos: [0, -0.74, -0.01] });
  }
  return pecas;
}

// --- reanimado: curvado, braços pendentes, pele acinzentada, avental hospitalar aberto atrás --
export const REANIMADO: Molde = {
  base: {
    quadril: 0.84, troncoX: -0.42, cabecaX: -0.32, cabecaZ: 0.38, bracoX: 0.55, bracoZ: 0.1,
    bracoDFixo: null, balancoBraco: 0.55, mole: 1.3, ataque: 'garras', manco: 0.55,
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.11, 0, 0], pernaD: [0.11, 0, 0],
    bracoE: [-0.22, 0.52, 0.01], bracoD: [0.22, 0.52, 0.01], cabeca: [0, 0.62, -0.03],
  },
  pecas: [
    ...pernasNuas(0),
    // avental hospitalar: dos ombros até o joelho, achatado; aberto nas costas (a pele aparece)
    { osso: 'tronco', geo: () => new CylinderGeometry(0.2, 0.28, 0.98, 10), cor: AVENTAL, pos: [0, 0.11, 0], esc: [1, 1, 0.7] },
    { osso: 'tronco', geo: caixa(0.07, 0.86, 0.012), cor: PELE_CINZA, pos: [0, 0.16, 0.17], rot: [-0.08, 0, 0] },
    { osso: 'tronco', geo: caixa(0.1, 0.02, 0.015), cor: AVENTAL, pos: [0, 0.38, 0.175] },   // laço das costas
    // manchas escuras na frente
    { osso: 'tronco', geo: caixa(0.15, 0.2, 0.012), cor: MANCHA, pos: [0.05, 0.22, -0.155] },
    { osso: 'tronco', geo: caixa(0.08, 0.12, 0.012), cor: MANCHA, pos: [-0.09, -0.12, -0.18] },
    // ombros do avental e pescoço
    { osso: 'tronco', geo: esf(0.08), cor: AVENTAL, pos: [-0.2, 0.52, 0] },
    { osso: 'tronco', geo: esf(0.08), cor: AVENTAL, pos: [0.2, 0.52, 0] },
    { osso: 'tronco', geo: () => new CylinderGeometry(0.045, 0.052, 0.12, 6), cor: PELE_CINZA, pos: [0, 0.6, -0.02] },
    ...bracosMortos(AVENTAL),
    // pulseira de identificação no pulso esquerdo
    { osso: 'bracoE', geo: () => new CylinderGeometry(0.05, 0.05, 0.03, 8), cor: LENCOL, pos: [0, -0.64, 0] },
    ...cabecaMorta(false),
  ],
};

// --- reanimado cirúrgico: torso nu com incisão em Y costurada, lençol enrolado na cintura -----
export const CIRURGICO: Molde = {
  base: {
    quadril: 0.85, troncoX: -0.22, cabecaX: -0.18, cabecaZ: -0.32, bracoX: 0.25, bracoZ: 0.16,
    bracoDFixo: null, balancoBraco: 1.0, mole: 0.7, ataque: 'garras',
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.1, 0, 0], pernaD: [0.1, 0, 0],
    bracoE: [-0.21, 0.54, 0.01], bracoD: [0.21, 0.54, 0.01], cabeca: [0, 0.64, -0.02],
  },
  pecas: [
    ...pernasNuas(0),
    // etiqueta no dedão do pé direito
    { osso: 'pernaD', geo: caixa(0.05, 0.03, 0.005), cor: 0xc9b98a, pos: [0, -0.82, -0.17], rot: [0.4, 0, 0] },
    // lençol enrolado da cintura aos joelhos, com a ponta caindo
    { osso: 'tronco', geo: () => new CylinderGeometry(0.22, 0.27, 0.48, 10), cor: LENCOL, pos: [0, -0.16, 0], esc: [1, 1, 0.75] },
    { osso: 'tronco', geo: caixa(0.14, 0.42, 0.02), cor: LENCOL, pos: [0.14, -0.3, -0.19], rot: [0.08, 0, -0.12] },
    // torso nu, magro, costelas marcadas
    { osso: 'tronco', geo: () => new CylinderGeometry(0.19, 0.16, 0.6, 10), cor: PELE_CINZA, pos: [0, 0.34, 0], esc: [1, 1, 0.66] },
    ...[0.24, 0.31, 0.38].map((y): Peca => ({ osso: 'tronco', geo: caixa(0.3, 0.012, 0.012), cor: PELE_CINZA_ESCURA, pos: [0, y, -0.12] })),
    // incisão em Y costurada
    { osso: 'tronco', geo: caixa(0.012, 0.36, 0.012), cor: COSTURA, pos: [0, 0.26, -0.122] },
    { osso: 'tronco', geo: caixa(0.012, 0.2, 0.012), cor: COSTURA, pos: [-0.075, 0.5, -0.115], rot: [0, 0, -0.9] },
    { osso: 'tronco', geo: caixa(0.012, 0.2, 0.012), cor: COSTURA, pos: [0.075, 0.5, -0.115], rot: [0, 0, 0.9] },
    { osso: 'tronco', geo: esf(0.075), cor: PELE_CINZA, pos: [-0.19, 0.54, 0] },
    { osso: 'tronco', geo: esf(0.075), cor: PELE_CINZA, pos: [0.19, 0.54, 0] },
    { osso: 'tronco', geo: () => new CylinderGeometry(0.042, 0.05, 0.12, 6), cor: PELE_CINZA, pos: [0, 0.62, -0.01] },
    ...bracosMortos(null),
    ...cabecaMorta(true),
  ],
};

// --- enfermeiro: pijama cirúrgico, touca e máscara, bolsa de frascos a tiracolo ---------------
export const ENFERMEIRO: Molde = {
  base: {
    quadril: 0.88, troncoX: -0.06, cabecaX: -0.05, cabecaZ: 0.18, bracoX: 0.12, bracoZ: 0.1,
    bracoDFixo: null, balancoBraco: 0.8, mole: 0.25, ataque: 'arremesso',
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.11, 0, 0], pernaD: [0.11, 0, 0],
    bracoE: [-0.24, 0.56, 0.01], bracoD: [0.24, 0.56, 0.01], cabeca: [0, 0.67, -0.01],
  },
  pecas: [
    // calça do pijama e tamancos claros
    { osso: 'pernaE', geo: cap(0.075, 0.64), cor: PIJAMA, pos: [0, -0.4, 0] },
    { osso: 'pernaD', geo: cap(0.075, 0.64), cor: PIJAMA, pos: [0, -0.4, 0] },
    { osso: 'pernaE', geo: caixa(0.11, 0.08, 0.25), cor: LENCOL, pos: [0, -0.83, -0.04] },
    { osso: 'pernaD', geo: caixa(0.11, 0.08, 0.25), cor: LENCOL, pos: [0, -0.83, -0.04] },
    // blusa do pijama com decote em V e bolso
    { osso: 'tronco', geo: () => new CylinderGeometry(0.21, 0.23, 0.74, 10), cor: PIJAMA, pos: [0, 0.24, 0], esc: [1, 1, 0.7] },
    { osso: 'tronco', geo: () => new ConeGeometry(0.06, 0.16, 3), cor: PELE, pos: [0, 0.55, -0.14], rot: [Math.PI, 0, 0] },
    { osso: 'tronco', geo: caixa(0.1, 0.09, 0.012), cor: 0x264a4a, pos: [-0.1, 0.36, -0.16] },
    // alça da bolsa atravessando o peito e a bolsa no quadril esquerdo, com frascos para fora
    { osso: 'tronco', geo: caixa(0.05, 0.8, 0.02), cor: COURO, pos: [0, 0.27, -0.165], rot: [0, 0, 0.62] },
    { osso: 'tronco', geo: caixa(0.05, 0.6, 0.02), cor: COURO, pos: [0, 0.3, 0.165], rot: [0, 0, -0.62] },
    { osso: 'tronco', geo: caixa(0.26, 0.2, 0.12), cor: COURO, pos: [-0.27, -0.06, -0.04] },
    ...[-0.34, -0.28, -0.22].map((x, k): Peca => ({
      osso: 'tronco', geo: () => new CylinderGeometry(0.022, 0.022, 0.1, 6), cor: k === 1 ? 0x9a6a3a : VIDRO_VERDE, pos: [x, 0.07, -0.05],
    })),
    { osso: 'tronco', geo: esf(0.08), cor: PIJAMA, pos: [-0.22, 0.56, 0] },
    { osso: 'tronco', geo: esf(0.08), cor: PIJAMA, pos: [0.22, 0.56, 0] },
    { osso: 'tronco', geo: () => new CylinderGeometry(0.045, 0.05, 0.12, 6), cor: PELE, pos: [0, 0.64, -0.01] },
    // braços: manga curta, luva de látex; o direito segura um frasco (brilha no preparo do arremesso)
    { osso: 'bracoE', geo: cap(0.068, 0.16), cor: PIJAMA, pos: [0, -0.1, 0] },
    { osso: 'bracoD', geo: cap(0.068, 0.16), cor: PIJAMA, pos: [0, -0.1, 0] },
    { osso: 'bracoE', geo: cap(0.048, 0.48), cor: PELE, pos: [0, -0.4, 0] },
    { osso: 'bracoD', geo: cap(0.048, 0.48), cor: PELE, pos: [0, -0.4, 0] },
    { osso: 'bracoE', geo: cap(0.044, 0.12), cor: MASCARA, pos: [0, -0.72, 0] },
    { osso: 'bracoD', geo: cap(0.044, 0.12), cor: MASCARA, pos: [0, -0.72, 0] },
    { osso: 'bracoD', geo: () => new CylinderGeometry(0.035, 0.04, 0.15, 8), cor: VIDRO_VERDE, pos: [0, -0.8, -0.04] },
    { osso: 'bracoD', geo: esf(0.05), slot: 'ini-olho', pos: [0, -0.8, -0.04], emissivo: true, brilho: true, corBrilho: 0x9ac83a },
    // cabeça: touca cirúrgica, máscara cobrindo boca e nariz, olhos acesos entre as duas
    { osso: 'cabeca', geo: esf(0.115), cor: PELE, pos: [0, 0.12, 0], esc: [0.92, 1.08, 1] },
    { osso: 'cabeca', geo: () => new SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), cor: PIJAMA, pos: [0, 0.14, 0.005], esc: [1, 1.05, 1.05] },
    { osso: 'cabeca', geo: caixa(0.17, 0.09, 0.05), cor: MASCARA, pos: [0, 0.06, -0.09] },
    { osso: 'cabeca', geo: caixa(0.23, 0.01, 0.01), cor: LENCOL, pos: [0, 0.09, -0.02] },     // elástico
    { osso: 'cabeca', geo: esf(0.016), slot: 'ini-olho', pos: [-0.04, 0.135, -0.1], emissivo: true },
    { osso: 'cabeca', geo: esf(0.016), slot: 'ini-olho', pos: [0.04, 0.135, -0.1], emissivo: true },
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
