// Moldes dos chefes. Fase 1 (`entidade096`; o da fase 2 fica no fim do arquivo): figura original, feita só de primitivas a partir da
// descrição (nenhuma imagem de referência). Muito alta e magra, pele quase branca, braços que
// passam dos joelhos com cotovelo (antebraço próprio, para cobrir o rosto), mãos grandes de dedos
// longos, cabeça pequena e alongada sem cabelo, órbitas fundas com olhos sem pupila de brilho frio.
// Medidas no padrão dos moldes (1,8 m); `montar` escala para 2,4 m pelo `TIPOS`.
// Malhas (8): tronco com pescoço e cabeça, olhos, 2 braços, 2 antebraços, 2 pernas. A cabeça vai
// no tronco para caber no limite de 8 malhas; o osso `cabeca` fica vazio.
import { ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { cap, caixa, esf, type Molde, type Peca } from './moldesInimigos';

/** slot dos olhos do chefe (definido pelo `ModelosInimigos`) */
export const SLOT_OLHO_CHEFE = 'chefe-olho';

const PELE = 0xdcd8cf;
const PELE_MEMBRO = 0xd2cdc3;
const ORBITA = 0x4a4440;
const BOCA = 0x2a2523;

/** Mão grande: palma achatada, quatro dedos longos e o polegar (lado = -1 esquerda, 1 direita). */
function mao(osso: 'antebracoE' | 'antebracoD', lado: number): Peca[] {
  const pecas: Peca[] = [
    { osso, geo: cap(0.024, 0.34), cor: PELE_MEMBRO, pos: [0, -0.2, 0] },
    { osso, geo: caixa(0.065, 0.13, 0.026), cor: PELE_MEMBRO, pos: [0, -0.45, 0] },
  ];
  for (const [k, dx] of [-0.023, -0.008, 0.008, 0.023].entries()) {
    const comp = k === 0 || k === 3 ? 0.11 : 0.14;
    pecas.push({ osso, geo: cap(0.0085, comp), cor: PELE_MEMBRO, pos: [dx * lado, -0.52 - comp / 2, 0] });
  }
  // polegar do lado de dentro (voltado ao corpo), aberto
  pecas.push({ osso, geo: cap(0.01, 0.08), cor: PELE_MEMBRO, pos: [-0.04 * lado, -0.47, -0.012], rot: [0, 0, 0.5 * lado] });
  return pecas;
}

function perna(osso: 'pernaE' | 'pernaD'): Peca[] {
  return [
    { osso, geo: cap(0.042, 0.36), cor: PELE_MEMBRO, pos: [0, -0.22, 0] },
    { osso, geo: esf(0.044), cor: PELE_MEMBRO, pos: [0, -0.44, 0] },
    { osso, geo: cap(0.033, 0.4), cor: PELE_MEMBRO, pos: [0, -0.67, 0] },
    { osso, geo: caixa(0.06, 0.035, 0.17), cor: PELE_MEMBRO, pos: [0, -0.93, -0.05] },
  ];
}

export const ENTIDADE096: Molde = {
  base: {
    quadril: 0.95, troncoX: -0.3, cabecaX: 0, cabecaZ: 0, bracoX: 0.05, bracoZ: 0.08,
    bracoDFixo: null, balancoBraco: 0.8, mole: 1,
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.075, 0, 0], pernaD: [0.075, 0, 0],
    bracoE: [-0.15, 0.5, 0.01], bracoD: [0.15, 0.5, 0.01], cabeca: [0, 0.62, -0.02],
    antebracoE: [0, -0.42, 0], antebracoD: [0, -0.42, 0],
  },
  pecas: [
    ...perna('pernaE'),
    ...perna('pernaD'),
    // bacia estreita, abdome fino e caixa torácica afunilada (achatada na frente)
    { osso: 'tronco', geo: caixa(0.17, 0.1, 0.1), cor: PELE, pos: [0, 0.03, 0] },
    { osso: 'tronco', geo: () => new CylinderGeometry(0.068, 0.064, 0.22, 8), cor: PELE, pos: [0, 0.17, 0], esc: [1, 1, 0.7] },
    { osso: 'tronco', geo: () => new CylinderGeometry(0.12, 0.08, 0.27, 9), cor: PELE, pos: [0, 0.39, 0], esc: [1, 1, 0.62] },
    // vértebras saltadas nas costas (o que o jogador vê com ele de costas)
    // Costelas, clavículas e tendões em relevo; permanecem na malha unida do tronco.
    ...[-1, 1].flatMap((lado) => [
      ...[0, 1, 2, 3, 4].map((i): Peca => ({
        osso: 'tronco', geo: cap(.009, .065 - i * .004), cor: 0xbbb7ad,
        pos: [lado * (.049 - i * .003), .46 - i * .034, -.057], rot: [0, 0, lado * 1.25],
      })),
      { osso: 'tronco', geo: cap(.012, .10), cor: PELE_MEMBRO, pos: [lado * .064, .51, -.045], rot: [0, 0, lado * 1.4] } as Peca,
    ]),
    { osso: 'tronco', geo: esf(0.02), cor: PELE, pos: [0, 0.28, 0.065] },
    { osso: 'tronco', geo: esf(0.02), cor: PELE, pos: [0, 0.37, 0.072] },
    { osso: 'tronco', geo: esf(0.02), cor: PELE, pos: [0, 0.46, 0.07] },
    // ombros ossudos
    { osso: 'tronco', geo: esf(0.045), cor: PELE, pos: [-0.14, 0.5, 0.005] },
    { osso: 'tronco', geo: esf(0.045), cor: PELE, pos: [0.14, 0.5, 0.005] },
    // pescoço comprido e fino
    { osso: 'tronco', geo: () => new CylinderGeometry(0.024, 0.03, 0.15, 6), cor: PELE, pos: [0, 0.58, -0.01] },
    // cabeça pequena e alongada, queixo estreito, boca em fenda escura
    { osso: 'tronco', geo: () => new SphereGeometry(0.07, 12, 10), cor: PELE, pos: [0, 0.72, -0.025], esc: [0.8, 1.4, 0.95] },
    { osso: 'tronco', geo: esf(0.05), cor: PELE, pos: [0, 0.65, -0.04], esc: [0.72, 1, 0.9] },
    { osso: 'tronco', geo: caixa(0.045, 0.008, 0.012), cor: BOCA, pos: [0, 0.642, -0.083] },
    // órbitas fundas e os olhos sem pupila
    { osso: 'tronco', geo: esf(0.019), cor: ORBITA, pos: [-0.024, 0.73, -0.074] },
    { osso: 'tronco', geo: esf(0.019), cor: ORBITA, pos: [0.024, 0.73, -0.074] },
    { osso: 'tronco', geo: esf(0.011), slot: SLOT_OLHO_CHEFE, pos: [-0.024, 0.73, -0.085], emissivo: true },
    { osso: 'tronco', geo: esf(0.011), slot: SLOT_OLHO_CHEFE, pos: [0.024, 0.73, -0.085], emissivo: true },
    // braços: úmero comprido e o cotovelo ossudo
    { osso: 'bracoE', geo: cap(0.028, 0.36), cor: PELE_MEMBRO, pos: [0, -0.21, 0] },
    { osso: 'bracoD', geo: cap(0.028, 0.36), cor: PELE_MEMBRO, pos: [0, -0.21, 0] },
    { osso: 'bracoE', geo: esf(0.03), cor: PELE_MEMBRO, pos: [0, -0.42, 0] },
    { osso: 'bracoD', geo: esf(0.03), cor: PELE_MEMBRO, pos: [0, -0.42, 0] },
    ...mao('antebracoE', -1),
    ...mao('antebracoD', 1),
  ],
};

// --- chefe da fase 2 (`entidade049`) ---------------------------------------------------------
// Figura original, só de primitivas a partir da descrição textual (nenhuma imagem de referência):
// alta e ereta, manto escuro até os tornozelos com capa curta nos ombros e cordão na cintura, capuz
// fundo, máscara de marfim com um bico estilizado inclinado para baixo e duas lentes redondas de
// brasa fraca; luvas escuras e uma maleta de couro na mão esquerda. A mão direita leva o brilho do
// toque (cresce no preparo: o aviso visual). Medidas no padrão de 1,8 m; `montar` escala para 2,0 m.
// Malhas (8): 2 pernas, tronco (manto), cabeça, lentes, 2 braços (a maleta vai no esquerdo), brilho.

/** slot das lentes da máscara (definido pelo `ModelosInimigos`) */
export const SLOT_LENTE_049 = 'chefe049-lente';

// escuro, mas não preto: precisa ler como silhueta sob o foco da arena (playtest do CP3)
const MANTO = 0x3a3440;
const CAPA = 0x0f0e12;
const CORDAO = 0x4a3c26;
const MARFIM = 0xe2dac6;   // clara: lê-se na arena escura (lote final do CP3)
const BICO = 0xcabfa3;
const LUVA = 0x231e1b;
const MALETA = 0x3a2418;
const LATAO = 0x8a7440;
const CALCA_ESCURA = 0x1a1a1c;

export const ENTIDADE049: Molde = {
  base: {
    quadril: 0.95, troncoX: -0.05, cabecaX: -0.08, cabecaZ: 0, bracoX: 0.12, bracoZ: 0.06,
    bracoDFixo: null, balancoBraco: 0.35, mole: 0,
  },
  juntas: {
    tronco: [0, 0, 0], pernaE: [-0.09, 0, 0], pernaD: [0.09, 0, 0],
    bracoE: [-0.24, 0.56, 0], bracoD: [0.24, 0.56, 0], cabeca: [0, 0.7, -0.01],
  },
  pecas: [
    // pernas quase escondidas pelo manto: calça e sapatos escuros
    { osso: 'pernaE', geo: cap(0.06, 0.72), cor: CALCA_ESCURA, pos: [0, -0.44, 0] },
    { osso: 'pernaD', geo: cap(0.06, 0.72), cor: CALCA_ESCURA, pos: [0, -0.44, 0] },
    { osso: 'pernaE', geo: caixa(0.1, 0.06, 0.25), cor: CAPA, pos: [0, -0.92, -0.05] },
    { osso: 'pernaD', geo: caixa(0.1, 0.06, 0.25), cor: CAPA, pos: [0, -0.92, -0.05] },
    // manto: dos ombros aos tornozelos, abrindo em sino; cordão na cintura
    { osso: 'tronco', geo: () => new CylinderGeometry(0.2, 0.37, 1.48, 14), cor: MANTO, pos: [0, -0.12, 0], esc: [1, 1, 0.8] },
    // Pregas verticais do tecido, fechos envelhecidos e suturas na máscara.
    ...[-.21, -.105, 0, .105, .21].map((x): Peca => ({
      osso: 'tronco', geo: cap(.012, .94), cor: 0x292630,
      pos: [x, -.28, -.22 + Math.abs(x) * .13], rot: [0, 0, x * -.22],
    })),
    ...[.28, .39, .50].map((y): Peca => ({ osso: 'tronco', geo: esf(.014), cor: LATAO, pos: [0, y, -.205] })),
    { osso: 'tronco', geo: () => new CylinderGeometry(0.27, 0.27, 0.035, 14), cor: CORDAO, pos: [0, 0.06, 0], esc: [1, 1, 0.8] },
    { osso: 'tronco', geo: cap(0.012, 0.32), cor: CORDAO, pos: [-0.08, -0.13, -0.215], rot: [0.05, 0, 0.08] },
    // capa curta sobre os ombros e gola alta
    { osso: 'tronco', geo: () => new CylinderGeometry(0.17, 0.34, 0.36, 14), cor: CAPA, pos: [0, 0.47, 0], esc: [1, 1, 0.82] },
    { osso: 'tronco', geo: () => new CylinderGeometry(0.1, 0.13, 0.14, 10), cor: CAPA, pos: [0, 0.68, 0], esc: [1, 1, 0.9] },
    // capuz fundo e a máscara de marfim com o bico
    { osso: 'cabeca', geo: () => new SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), cor: CAPA, pos: [0, 0.12, 0.025], esc: [1, 1.12, 1.12] },
    { osso: 'cabeca', geo: esf(0.11), cor: MARFIM, pos: [0, 0.1, -0.035], esc: [0.86, 1.05, 0.72] },
    { osso: 'cabeca', geo: () => new ConeGeometry(0.048, 0.27, 10), cor: BICO, pos: [0, 0.05, -0.19], rot: [-Math.PI / 2 - 0.32, 0, 0] },
    ...[-1, 1].flatMap((lado) => [0, 1, 2].map((i): Peca => ({
      osso: 'cabeca', geo: esf(.004), cor: 0x5e5343, pos: [lado * .025, .08 - i * .013, -.16 - i * .025],
    }))),
    { osso: 'cabeca', geo: caixa(0.12, 0.012, 0.02), cor: CAPA, pos: [0, 0.165, -0.1] },          // costura da testa
    { osso: 'cabeca', geo: esf(0.033), cor: CAPA, pos: [-0.045, 0.135, -0.095] },               // aros das lentes
    { osso: 'cabeca', geo: esf(0.033), cor: CAPA, pos: [0.045, 0.135, -0.095] },
    { osso: 'cabeca', geo: esf(0.024), slot: SLOT_LENTE_049, pos: [-0.045, 0.135, -0.112], emissivo: true },
    { osso: 'cabeca', geo: esf(0.024), slot: SLOT_LENTE_049, pos: [0.045, 0.135, -0.112], emissivo: true },
    // mangas largas e luvas escuras
    { osso: 'bracoE', geo: () => new CylinderGeometry(0.05, 0.09, 0.62, 10), cor: MANTO, pos: [0, -0.32, 0] },
    { osso: 'bracoD', geo: () => new CylinderGeometry(0.05, 0.09, 0.62, 10), cor: MANTO, pos: [0, -0.32, 0] },
    { osso: 'bracoE', geo: esf(0.08), cor: CAPA, pos: [0, -0.02, 0] },
    { osso: 'bracoD', geo: esf(0.08), cor: CAPA, pos: [0, -0.02, 0] },
    { osso: 'bracoE', geo: cap(0.042, 0.12), cor: LUVA, pos: [0, -0.7, 0] },
    { osso: 'bracoD', geo: cap(0.042, 0.12), cor: LUVA, pos: [0, -0.7, 0] },
    // dedos da mão direita (a que toca), um pouco abertos
    ...[-0.022, 0, 0.022].map((dx): Peca => ({ osso: 'bracoD', geo: cap(0.011, 0.08), cor: LUVA, pos: [dx, -0.8, -0.01] })),
    // maleta de couro na mão esquerda: corpo, fecho e alça
    { osso: 'bracoE', geo: caixa(0.12, 0.2, 0.3), cor: MALETA, pos: [0, -0.9, 0] },
    { osso: 'bracoE', geo: caixa(0.13, 0.03, 0.06), cor: LATAO, pos: [0, -0.8, -0.04] },
    { osso: 'bracoE', geo: caixa(0.02, 0.05, 0.12), cor: MALETA, pos: [0, -0.77, 0] },
    // brilho do toque na palma direita
    { osso: 'bracoD', geo: esf(0.035), slot: SLOT_LENTE_049, pos: [0, -0.79, -0.03], emissivo: true, brilho: true, corBrilho: 0xb8d0ff },
  ],
};
