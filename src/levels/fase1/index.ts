// Fase 1, "Setor de Contenção Leve": tutorial durante uma brecha de contenção, até a perseguição e a luta
// contra o ocupante da cela de isolamento na sala de triagem. Planta em `planta.ts`, textos em `textos.ts`,
// luzes, props e decalques em `cenario.ts`.
import type { LevelDef, PerigoDef } from '../../sim/fase';
import { DECALS, LUZES, PROPS } from './cenario';
import { LEGENDA, PLANTA } from './planta';
import { DOCUMENTOS, MENSAGENS, mensagemCabine } from './textos';

const LESTE = -Math.PI / 2;   // frente = (+1, 0)
const OESTE = Math.PI / 2;    // frente = (-1, 0)

/** Cada comporta fecha o túnel inteiro de um vão (3 colunas da parede divisória × 3 linhas): a 12 m/s o chefe cruza
 * as 3 células (6 m) em ~0,5 s (~0,4 s em investida, a 15 m/s). */
const COMPORTAS: PerigoDef[] = [
  { id: 'comporta-a', tipo: 'comporta', area: [11, 26, 3, 3], duracao: 1.2, recarga: 7, danoChefe: 0.3, danoComum: 60 },
  { id: 'comporta-b', tipo: 'comporta', area: [11, 34, 3, 3], duracao: 1.2, recarga: 7, danoChefe: 0.3, danoComum: 60 },
];

export const fase1: LevelDef = {
  id: 'fase1',
  nome: 'Setor de Contenção Leve',
  planta: PLANTA,
  legenda: LEGENDA,
  spawnYaw: LESTE,
  arsenal: { armas: ['pistola'], municao: { balas: 24 } },
  portas: [
    { id: 'recepcao', em: 'A' },
    { id: 'posto', em: 'B' },
    { id: 'posto-saida', em: 'S' },
    { id: 'bloco', em: 'C', exige: 1, trancada: true },
    { id: 'registros', em: 'H' },
    { id: 'arquivo', em: 'R' },
    { id: 'convivencia', em: 'J' },
    { id: 'convivencia-saida', em: 'K', trancada: true },
    { id: 'isolamento', em: 'N', exige: 2, trancada: true },
    { id: 'cela-isolada', em: 'Q' },
    { id: 'fuga-1', em: 'E' },
    { id: 'fuga-2', em: 'F' },
    { id: 'fuga-3', em: 'G' },
    { id: 'triagem-saida', em: 'X', trancada: true },
  ],
  pickups: [
    // armas e cartões
    { em: [40, 2], tipo: 'arma', arma: 'escopeta', quantidade: 8 },
    { em: [43, 2], tipo: 'cartao', nivel: 1 },
    { em: [2, 14], tipo: 'cartao', nivel: 2 },
    // escritórios e posto
    { em: [28, 9], tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: [17, 9], tipo: 'vida_p' },
    { em: [43, 7], tipo: 'colete_p' },
    { em: [33, 10], tipo: 'municao', municao: 'balas', quantidade: 12 },
    // segredos
    { em: [10, 1], tipo: 'vida_g' },
    { em: [22, 12], tipo: 'colete_g' },
    { em: [32, 24], tipo: 'municao', municao: 'cartuchos', quantidade: 8 },
    // bloco de celas e isolamento
    { em: [27, 20], tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: [37, 13], tipo: 'vida_p' },
    { em: [40, 22], tipo: 'municao', municao: 'cartuchos', quantidade: 6 },
    { em: [47, 28], tipo: 'vida_p' },
    // triagem
    { em: [21, 25], tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: [15, 37], tipo: 'municao', municao: 'cartuchos', quantidade: 6 },
    { em: [8, 37], tipo: 'vida_g' },
    { em: [20, 30], tipo: 'vida_p' },
    { em: [1, 24], tipo: 'colete_p' },
    { em: [3, 32], tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: [1, 37], tipo: 'municao', municao: 'cartuchos', quantidade: 6 },
  ],
  inimigos: [
    // escritórios
    { em: [18, 2], tipo: 'funcionario', dormindo: true, yaw: OESTE },
    { em: [29, 9], tipo: 'funcionario', patrulha: [[29, 9], [17, 8]] },
    // posto e corredor de acesso
    { em: [36, 3], tipo: 'seguranca', yaw: OESTE },
    { em: [41, 6], tipo: 'seguranca', yaw: OESTE },
    { em: [35, 10], tipo: 'funcionario', patrulha: [[35, 10], [42, 9]] },
    // bloco de celas e arquivo
    { em: [26, 13], tipo: 'funcionario' },
    { em: [36, 14], tipo: 'funcionario', dormindo: true },
    { em: [30, 17], tipo: 'funcionario', patrulha: [[26, 18], [48, 17]] },
    { em: [49, 18], tipo: 'seguranca', yaw: OESTE },
    { em: [25, 21], tipo: 'funcionario' },
    { em: [15, 18], tipo: 'funcionario', patrulha: [[11, 18], [20, 19]] },
    { em: [6, 16], tipo: 'funcionario', patrulha: [[3, 16], [18, 16]] },
    { em: [24, 18], tipo: 'seguranca', yaw: LESTE },
  ],
  gatilhos: [
    { id: 'tutorial-andar', quando: { tipo: 'area', area: [1, 1, 10, 8] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.andar }] },
    { id: 'tutorial-porta', quando: { tipo: 'area', area: [8, 6, 3, 3] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.porta }] },
    { id: 'tutorial-lanterna', quando: { tipo: 'area', area: [12, 3, 2, 5] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.lanterna }] },
    { id: 'tutorial-documento', quando: { tipo: 'area', area: [16, 1, 6, 4] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.documento }] },
    {
      id: 'brecha',
      quando: { tipo: 'area', area: [26, 1, 5, 3] },
      faz: [
        { acao: 'alarme', ligado: true },
        { acao: 'mensagem', texto: MENSAGENS.alarme },
      ],
    },
    { id: 'bloco', quando: { tipo: 'area', area: [54, 17, 3, 2] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.bloco }] },
    {
      id: 'travamento',
      quando: { tipo: 'area', area: [38, 20, 7, 3] },
      faz: [
        { acao: 'porta', id: 'convivencia', estado: 'trancar' },
        { acao: 'som', id: 'estalo' },
        { acao: 'mensagem', texto: MENSAGENS.travamento },
        {
          acao: 'spawn',
          inimigos: [
            { em: [37, 20], tipo: 'funcionario', grupo: 'convivencia' },
            { em: [45, 20], tipo: 'funcionario', grupo: 'convivencia' },
            { em: [45, 22], tipo: 'funcionario', grupo: 'convivencia' },
          ],
        },
      ],
    },
    {
      id: 'liberado',
      quando: { tipo: 'grupo_morto', grupo: 'convivencia' },
      faz: [
        { acao: 'porta', id: 'convivencia-saida', estado: 'destrancar' },
        { acao: 'porta', id: 'convivencia', estado: 'abrir' },
        { acao: 'som', id: 'bip' },
        { acao: 'mensagem', texto: MENSAGENS.liberado },
      ],
    },
    { id: 'isolamento', quando: { tipo: 'area', area: [42, 28, 6, 2] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.isolamento }] },
    {
      id: 'desperta',
      // entrar na cela acorda o ocupante; a porta dela fica aberta para ele não perder tempo arrombando
      quando: { tipo: 'area', area: [49, 26, 2, 10] },
      faz: [
        { acao: 'chefe' },
        { acao: 'porta', id: 'cela-isolada', estado: 'abrir' },
        // Reativar o alarme toca o arquivo da sirene uma vez no início da perseguição.
        { acao: 'alarme', ligado: true },
        { acao: 'mensagem', texto: MENSAGENS.desperta },
      ],
    },
    { id: 'triagem', quando: { tipo: 'area', area: [14, 36, 3, 2] }, faz: [{ acao: 'mensagem', texto: MENSAGENS.triagem }] },
    { id: 'cabine', quando: { tipo: 'area', area: [1, 29, 4, 5] }, faz: [{ acao: 'mensagem', texto: mensagemCabine(COMPORTAS[0].recarga) }] },
    { id: 'aciona-comporta-a', quando: { tipo: 'terminal', id: 'terminal-a' }, faz: [{ acao: 'perigo', id: 'comporta-a' }], umaVez: false },
    { id: 'aciona-comporta-b', quando: { tipo: 'terminal', id: 'terminal-b' }, faz: [{ acao: 'perigo', id: 'comporta-b' }], umaVez: false },
    {
      id: 'fim',
      quando: { tipo: 'chefe_morto' },
      faz: [
        { acao: 'porta', id: 'triagem-saida', estado: 'abrir' },
        { acao: 'alarme', ligado: false },
        { acao: 'mensagem', texto: MENSAGENS.fim },
      ],
    },
  ],
  terminais: [
    { id: 'terminal-a', em: 't', rotulo: 'Comporta norte' },
    { id: 'terminal-b', em: 'u', rotulo: 'Comporta sul' },
  ],
  documentos: DOCUMENTOS,
  segredos: [
    { id: 'patamar-recepcao', area: [9, 1, 2, 1] },
    { id: 'duto-escritorios', area: [21, 12, 2, 1] },
    { id: 'fresta-cela-05', area: [30, 24, 4, 1] },
  ],
  // saída do posto, antecâmara (chefe inerte), entrada da triagem
  checkpoints: [[40, 9], [44, 28], [14, 39]],
  saida: [8, 21],
  luzes: LUZES,
  props: PROPS,
  decals: DECALS,
  ambiente: { nevoa: 0.055, corNevoa: 0x05070a, ambiente: 0.12, somDeFundo: 'ventilacao', musica: 'tensao' },
  chefe: {
    tipo: 'entidade096',
    nome: 'SCP-096',
    em: [56, 31],
    yaw: LESTE,   // de costas para a porta da cela
    arena: [1, 24, 22, 15],
    retomada: [52, 38],
    perigos: COMPORTAS,
  },
};
