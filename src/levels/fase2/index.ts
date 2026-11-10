// Fase 2, "Ala Médica e Pesquisa": triagem, enfermaria, laboratório de patologia, o necrotério (espera pelo
// elevador de macas enquanto as gavetas se abrem) e o anfiteatro cirúrgico, onde o visitante de máscara
// espera entre os corpos. Planta em `planta.ts`, textos em `textos.ts`, luzes, props e decalques em `cenario.ts`.
import type { Area, GatilhoDef, InimigoDef, LevelDef, PerigoArea } from '../../sim/fase';
import { DECALS_SOLTOS, faixasDosPerigos, LUZES, PROPS } from './cenario';
import { LEGENDA, PLANTA } from './planta';
import { DOCUMENTOS, MENSAGENS, mensagemContagem, mensagemNecroterio } from './textos';

const NORTE = 0;              // frente = (0, -1)
const SUL = Math.PI;          // frente = (0, +1)
const LESTE = -Math.PI / 2;   // frente = (+1, 0)
const OESTE = Math.PI / 2;    // frente = (-1, 0)

/** Segundos entre o travamento do necrotério e a porta do elevador abrir (o adendo pede de 40 a 50). */
export const CHEGADA_ELEVADOR = 45;
/** Segundos da "viagem": porta da frente fechada até a do fundo abrir. */
export const VIAGEM_ELEVADOR = 5;
/** Avisos de contagem (s que faltam). */
const CONTAGEM = [30, 15, 5];

/**
 * Gavetas que se abrem durante a espera: em cada uma, um reanimado sai em frente à parede de gavetas
 * (props em `cenario.ts`: oeste na coluna 42, leste na 54; a frente é a célula vizinha para dentro). Ficam nas
 * linhas 21–25, longe das linhas 19–20 do gatilho `necroterio` (onde o jogador está quando a contagem começa).
 */
const GAVETAS: { apos: number; em: [number, number][] }[] = [
  { apos: 6, em: [[43, 23]] },
  { apos: 13, em: [[53, 23]] },
  { apos: 20, em: [[43, 21], [53, 25]] },
  { apos: 28, em: [[53, 21]] },
  { apos: 36, em: [[43, 25]] },
];

/**
 * Perigos do anfiteatro. Cada terminal fica na parede, com uma faixa de uma célula livre à frente (onde o
 * jogador para para usar); a área começa logo depois. O chefe, que anda sempre na direção do jogador, entra na
 * área ao chegar para o toque, e de dentro dela o terminal fica fora de alcance (3 m > 2,2 m).
 * Lâmpadas UV: áreas grandes no piso central (oeste e leste). Vapor: linhas curtas no degrau do meio das
 * arquibancadas, abaixo da galeria (norte) e acima dela (sul).
 */
const UV = { aviso: 1, duracao: 4, recarga: 9, danoChefePorSeg: 0.07, danoPorSeg: 22 } as const;      // 28% por acionamento
const VAPOR = { aviso: 0.6, duracao: 2.5, recarga: 7, danoChefePorSeg: 0.12, danoPorSeg: 30 } as const; // 30% por acionamento
export const PERIGOS: PerigoArea[] = [
  { id: 'uv-oeste', tipo: 'ultravioleta', area: [28, 34, 5, 8], ...UV },
  { id: 'uv-leste', tipo: 'ultravioleta', area: [41, 34, 5, 8], ...UV },
  { id: 'vapor-norte', tipo: 'vapor', area: [35, 32, 5, 1], ...VAPOR },
  { id: 'vapor-sul', tipo: 'vapor', area: [34, 43, 5, 1], ...VAPOR },
];

/** Terminal de cada perigo (mesma ordem de `PERIGOS`): id, símbolo na planta e rótulo. */
const TERMINAIS = [
  { id: 'terminal-uv-oeste', em: 'k', rotulo: 'Lâmpadas UV oeste' },
  { id: 'terminal-uv-leste', em: 'm', rotulo: 'Lâmpadas UV leste' },
  { id: 'terminal-vapor-norte', em: 'n', rotulo: 'Vapor norte' },
  { id: 'terminal-vapor-sul', em: 'q', rotulo: 'Vapor sul' },
];

/** Borda das áreas UV voltada para o terminal (a coluna que o chefe cruza ao vir na direção dele). */
const BORDAS_UV: Area[] = [[28, 34, 1, 8], [45, 34, 1, 8]];

const reanimado = (em: [number, number], extra: Partial<InimigoDef> = {}): InimigoDef => ({ em, tipo: 'reanimado', ...extra });
const corpo = (em: [number, number], tipo = 'reanimado'): InimigoDef => ({ em, tipo, corpo: true });
const cirurgico = (em: [number, number]): InimigoDef => ({ em, tipo: 'reanimado_cirurgico' });

const NECROTERIO: GatilhoDef[] = [
  {
    id: 'necroterio',
    quando: { tipo: 'area', area: [43, 19, 11, 2] },
    faz: [
      { acao: 'porta', id: 'necroterio', estado: 'trancar' },
      { acao: 'som', id: 'estalo' },
      { acao: 'mensagem', texto: mensagemNecroterio(CHEGADA_ELEVADOR) },
    ],
  },
  ...GAVETAS.map((g, k): GatilhoDef => ({
    id: `gaveta-${k + 1}`,
    quando: { tipo: 'tempo', apos: g.apos, desde: 'necroterio' },
    faz: [{ acao: 'som', id: 'gaveta' }, { acao: 'spawn', inimigos: g.em.map((em) => reanimado(em, { yaw: em[0] < 48 ? LESTE : OESTE })) }],
  })),
  ...CONTAGEM.map((faltam): GatilhoDef => ({
    id: `elevador-${faltam}`,
    quando: { tipo: 'tempo', apos: CHEGADA_ELEVADOR - faltam, desde: 'necroterio' },
    faz: [{ acao: 'mensagem', texto: mensagemContagem(faltam) }],
  })),
  {
    id: 'elevador',
    quando: { tipo: 'tempo', apos: CHEGADA_ELEVADOR, desde: 'necroterio' },
    faz: [
      { acao: 'som', id: 'elevador' },
      { acao: 'porta', id: 'elevador', estado: 'abrir' },
      { acao: 'mensagem', texto: MENSAGENS.elevadorAberto },
    ],
  },
  {
    // dentro da cabine: a porta da frente fecha e tranca; a do fundo abre depois da "viagem". Só a linha 28: a 27,
    // colada na porta H, fica de folga (quem dá ré logo depois do gatilho não fica trancado do lado de fora)
    id: 'elevador-entra',
    quando: { tipo: 'area', area: [47, 28, 3, 1] },
    faz: [
      { acao: 'porta', id: 'elevador', estado: 'trancar' },
      { acao: 'mensagem', texto: MENSAGENS.elevadorDescendo },
    ],
  },
  {
    id: 'elevador-chega',
    quando: { tipo: 'tempo', apos: VIAGEM_ELEVADOR, desde: 'elevador-entra' },
    faz: [
      { acao: 'som', id: 'elevador' },
      { acao: 'porta', id: 'elevador-fundo', estado: 'abrir' },
      { acao: 'mensagem', texto: MENSAGENS.elevadorChegou },
    ],
  },
];

export const fase2: LevelDef = {
  id: 'fase2',
  nome: 'Ala Médica e Pesquisa',
  planta: PLANTA,
  legenda: LEGENDA,
  spawnYaw: LESTE,
  arsenal: { armas: ['pistola', 'escopeta'], municao: { balas: 24, cartuchos: 6 } },
  portas: [
    { id: 'triagem-saida', em: 'A', trancada: true },
    { id: 'posto', em: 'B' },
    { id: 'prescricao', em: 'C' },
    { id: 'enfermaria-saida', em: 'D', exige: 1, trancada: true },
    { id: 'laboratorio', em: 'E' },
    { id: 'sala-limpa', em: 'L' },
    { id: 'laboratorio-saida', em: 'F', exige: 2, trancada: true },
    { id: 'necroterio', em: 'G' },
    { id: 'elevador', em: 'H', trancada: true },
    { id: 'elevador-fundo', em: 'I', trancada: true },
    { id: 'anfiteatro', em: 'J' },
    { id: 'anfiteatro-saida', em: 'K', trancada: true },
  ],
  pickups: [
    // triagem (o balcão alto é segredo)
    { em: [8, 8], tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: [15, 8], tipo: 'municao', municao: 'cartuchos', quantidade: 4 },
    { em: [1, 1], tipo: 'municao', municao: 'cartuchos', quantidade: 8 },
    // posto: a submetralhadora logo depois da triagem
    { em: [23, 3], tipo: 'arma', arma: 'smg', quantidade: 40 },
    { em: [19, 7], tipo: 'municao', municao: 'leves', quantidade: 30 },
    { em: [24, 7], tipo: 'vida_p' },
    // enfermaria, rouparia (segredo) e prescrição (cartão nível 1)
    { em: [10, 17], tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: [20, 18], tipo: 'municao', municao: 'leves', quantidade: 30 },
    { em: [28, 20], tipo: 'colete_p' },
    { em: [3, 15], tipo: 'vida_p' },
    { em: [28, 11], tipo: 'colete_g' },
    { em: [2, 26], tipo: 'cartao', nivel: 1 },
    { em: [7, 26], tipo: 'vida_p' },
    // corredor de observação e depósito escondido (segredo)
    { em: [34, 16], tipo: 'municao', municao: 'leves', quantidade: 30 },
    { em: [29, 3], tipo: 'vida_g' },
    { em: [30, 4], tipo: 'municao', municao: 'leves', quantidade: 40 },
    // laboratório e sala limpa (cartão nível 2)
    { em: [37, 11], tipo: 'municao', municao: 'cartuchos', quantidade: 6 },
    { em: [50, 11], tipo: 'municao', municao: 'leves', quantidade: 30 },
    { em: [51, 3], tipo: 'cartao', nivel: 2 },
    { em: [47, 2], tipo: 'colete_p' },
    // antecâmara e necrotério
    { em: [47, 15], tipo: 'municao', municao: 'leves', quantidade: 40 },
    { em: [49, 16], tipo: 'vida_g' },
    { em: [43, 25], tipo: 'municao', municao: 'cartuchos', quantidade: 6 },
    { em: [53, 18], tipo: 'vida_p' },
    // corredor de serviço e anfiteatro
    { em: [36, 28], tipo: 'colete_p' },
    { em: [28, 31], tipo: 'municao', municao: 'leves', quantidade: 40 },
    { em: [45, 31], tipo: 'vida_p' },
    { em: [27, 44], tipo: 'vida_g' },
    { em: [46, 41], tipo: 'municao', municao: 'cartuchos', quantidade: 8 },
    { em: [31, 42], tipo: 'municao', municao: 'leves', quantidade: 40 },
    { em: [44, 33], tipo: 'colete_p' },
  ],
  inimigos: [
    // triagem: o grupo que trava a saída
    reanimado([12, 3], { grupo: 'triagem', dormindo: true, yaw: OESTE }),
    reanimado([14, 6], { grupo: 'triagem', dormindo: true, yaw: OESTE }),
    reanimado([11, 8], { grupo: 'triagem', dormindo: true, yaw: NORTE }),
    corpo([7, 2]),
    // posto
    reanimado([19, 3], { dormindo: true, yaw: SUL }),
    // enfermaria: cirúrgicos deitados entre corpos de verdade, e um andando pelo corredor central
    cirurgico([5, 15]),
    cirurgico([12, 20]),
    cirurgico([19, 15]),
    cirurgico([26, 20]),
    corpo([8, 15]),
    corpo([9, 20]),
    corpo([15, 15]),
    corpo([16, 20]),
    corpo([23, 15]),
    corpo([22, 20]),
    reanimado([15, 17], { patrulha: [[4, 17], [27, 18]] }),
    // prescrição
    cirurgico([6, 24]),
    // laboratório: enfermeiros atrás do vidro (e um na sala limpa)
    { em: [40, 5], tipo: 'enfermeiro', yaw: OESTE },
    { em: [42, 9], tipo: 'enfermeiro', yaw: OESTE },
    { em: [49, 3], tipo: 'enfermeiro', yaw: SUL },
    reanimado([38, 11], { dormindo: true, yaw: OESTE }),
    // necrotério
    corpo([45, 21]),
    corpo([51, 21]),
    cirurgico([48, 23]),
    // anfiteatro: corpos que o visitante pode levantar
    corpo([31, 36]),
    corpo([43, 39]),
    corpo([35, 33]),
    corpo([40, 42]),
    corpo([39, 35], 'reanimado_cirurgico'),
    corpo([30, 40]),
    corpo([44, 36], 'reanimado_cirurgico'),
  ],
  gatilhos: [
    { id: 'entrada', quando: { tipo: 'area', area: [1, 3, 4, 5] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.entrada }] },
    {
      id: 'triagem-livre',
      quando: { tipo: 'grupo_morto', grupo: 'triagem' },
      faz: [
        { acao: 'porta', id: 'triagem-saida', estado: 'destrancar' },
        { acao: 'porta', id: 'triagem-saida', estado: 'abrir' },
        { acao: 'som', id: 'bip' },
        { acao: 'mensagem', texto: MENSAGENS.triagemLivre },
      ],
    },
    { id: 'enfermaria', quando: { tipo: 'area', area: [20, 14, 4, 2] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.enfermaria }] },
    { id: 'observacao', quando: { tipo: 'area', area: [33, 14, 2, 3] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.observacao }] },
    { id: 'antecamara', quando: { tipo: 'area', area: [46, 14, 5, 2] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.antecamara }] },
    ...NECROTERIO,
    {
      // a porta J fica em [30, 29], com o patamar [30, 30] de folga: a área (toda a largura da galeria e o degrau
      // abaixo) fica a 2 células dela, e quem dá ré logo depois do gatilho não fica trancado do lado de fora
      id: 'anfiteatro',
      quando: { tipo: 'area', area: [27, 31, 20, 2] },
      faz: [
        { acao: 'porta', id: 'anfiteatro', estado: 'trancar' },
        { acao: 'chefe' },
        { acao: 'alarme', ligado: true },
        { acao: 'mensagem', texto: MENSAGENS.anfiteatro },
      ],
    },
    ...PERIGOS.map((p, k): GatilhoDef => ({
      id: `aciona-${p.id}`,
      quando: { tipo: 'terminal', id: TERMINAIS[k].id },
      faz: [{ acao: 'perigo', id: p.id }],
      umaVez: false,
    })),
    { id: 'chefe-ferido', quando: { tipo: 'chefe_vida', abaixo: 0.5 }, faz: [{ acao: 'mensagem', texto: MENSAGENS.chefeFerido }] },
    {
      id: 'fim',
      quando: { tipo: 'chefe_morto' },
      faz: [
        { acao: 'porta', id: 'anfiteatro-saida', estado: 'abrir' },
        { acao: 'alarme', ligado: false },
        { acao: 'mensagem', texto: MENSAGENS.fim },
      ],
    },
  ],
  terminais: TERMINAIS,
  documentos: DOCUMENTOS,
  segredos: [
    { id: 'balcao-triagem', area: [1, 1, 2, 1] },
    { id: 'rouparia', area: [26, 10, 4, 3] },
    { id: 'deposito-patologia', area: [28, 2, 4, 3] },
  ],
  // posto, corredor de observação, antecâmara do necrotério, corredor de serviço (depois do elevador)
  checkpoints: [[21, 5], [33, 16], [48, 15], [42, 28]],
  saida: [48, 41],
  luzes: LUZES,
  props: PROPS,
  decals: [...faixasDosPerigos(BORDAS_UV, PERIGOS.filter((p) => p.tipo === 'vapor').map((p) => p.area)), ...DECALS_SOLTOS],
  ambiente: { nevoa: 0.05, corNevoa: 0x06100c, ambiente: 0.13, somDeFundo: 'hospital', musica: 'tensao', revestimento: 'azulejo' },
  chefe: {
    tipo: 'entidade049',
    nome: 'SCP-049',
    em: [37, 37],
    yaw: NORTE,   // de frente para a galeria por onde o jogador entra
    arena: [27, 31, 20, 14],
    retomada: [37, 38],
    perigos: PERIGOS,
  },
};
