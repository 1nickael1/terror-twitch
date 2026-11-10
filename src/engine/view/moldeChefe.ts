// Molde do chefe da fase 1 (`entidade096`): figura original, feita só de primitivas a partir da
// descrição (nenhuma imagem de referência). Muito alta e magra, pele quase branca, braços que
// passam dos joelhos com cotovelo (antebraço próprio, para cobrir o rosto), mãos grandes de dedos
// longos, cabeça pequena e alongada sem cabelo, órbitas fundas com olhos sem pupila de brilho frio.
// Medidas no padrão dos moldes (1,8 m); `montar` escala para 2,4 m pelo `TIPOS`.
// Malhas (8): tronco com pescoço e cabeça, olhos, 2 braços, 2 antebraços, 2 pernas. A cabeça vai
// no tronco para caber no limite de 8 malhas; o osso `cabeca` fica vazio.
import { CylinderGeometry, SphereGeometry } from 'three';
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
