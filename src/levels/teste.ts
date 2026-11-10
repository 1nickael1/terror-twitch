// Fase de teste do checkpoint 1: arena pequena com tudo o que o CP1 implementa. Sai do índice no CP2.
import type { LevelDef } from '../sim/fase';

/*
 * Legenda da planta:
 *   P início   . piso   # parede   _ degrau (0,5 m)   ^ plataforma de salto (1 m)
 *   / rampa (norte-sul) até o mezanino   + mezanino (1,5 m)   = janela   % grade
 *   D porta do cartão nível 1   F eclusa (aberta pelo terminal t, na parede)
 *   letras minúsculas e R: pickups, inimigos e documento (ver as listas abaixo)
 */
const PLANTA = `
########################
#...._..^k#......#.....#
#.P.._..^^=......#.....#
#...._.b..#....u.F.....#
#...r.....D......#.....#
#.....e...#......#..h..#
#.........%......#.....#
#.........#...f..#######
###/#######.g....t######
#+++++l####m....n#######
#c+++++####...v..#######
#############.##########
############w.R#########
########################
`;

export const faseTeste: LevelDef = {
  id: 'teste',
  nome: 'Campo de testes',
  planta: PLANTA,
  legenda: {
    _: { piso: 0.5 },
    '^': { piso: 1 },
    k: { piso: 1 },
    '/': { rampa: 'z' },
    '+': { piso: 1.5 },
    c: { piso: 1.5 },
    l: { piso: 1.5 },
    '=': { tipo: 'janela' },
    '%': { tipo: 'grade' },
    t: { tipo: 'parede' },
  },
  spawnYaw: -Math.PI / 2,
  arsenal: { armas: ['pistola'], municao: { balas: 24 } },
  portas: [
    { id: 'acesso', em: 'D', exige: 1, trancada: true },
    { id: 'eclusa', em: 'F', trancada: true },
  ],
  pickups: [
    { em: 'c', tipo: 'cartao', nivel: 1 },
    { em: 'e', tipo: 'arma', arma: 'escopeta', quantidade: 6 },
    { em: 'm', tipo: 'arma', arma: 'smg', quantidade: 40 },
    { em: 'l', tipo: 'arma', arma: 'lancador', quantidade: 3 },
    { em: 'b', tipo: 'municao', municao: 'balas', quantidade: 12 },
    { em: 'u', tipo: 'municao', municao: 'cartuchos', quantidade: 8 },
    { em: 'v', tipo: 'municao', municao: 'leves', quantidade: 30 },
    { em: 'w', tipo: 'municao', municao: 'capsulas', quantidade: 2 },
    { em: 'r', tipo: 'vida_p' },
    { em: 'R', tipo: 'vida_g' },
    { em: 'k', tipo: 'colete_g' },
  ],
  inimigos: [
    { em: 'f', tipo: 'funcionario', grupo: 'setor2', patrulha: [[14, 7], [14, 2]] },
    { em: 'g', tipo: 'funcionario', grupo: 'setor2', dormindo: true },
    { em: 'h', tipo: 'seguranca', yaw: Math.PI / 2 },
  ],
  gatilhos: [
    {
      id: 'alarme-setor2',
      quando: { tipo: 'area', area: [12, 6, 4, 2] },
      faz: [
        { acao: 'alarme', ligado: true },   // as luzes do grupo `alarme` seguem `world.alarme`
        { acao: 'mensagem', texto: 'Falha de contenção no Setor 2. Siga para a eclusa.' },
      ],
    },
    {
      id: 'abrir-eclusa',
      quando: { tipo: 'terminal', id: 'painel-eclusa' },
      faz: [
        { acao: 'porta', id: 'eclusa', estado: 'abrir' },
        { acao: 'mensagem', texto: 'Eclusa liberada manualmente.' },
      ],
    },
  ],
  terminais: [{ id: 'painel-eclusa', em: 't', rotulo: 'Liberar eclusa' }],
  documentos: [{
    id: 'memorando-07',
    em: 'n',
    titulo: 'Memorando interno 07',
    texto: 'Os cartões de nível 1 ficam no mezanino até segunda ordem. '
      + 'Ninguém entra no Setor 2 sem escolta. A eclusa só abre pelo painel da parede leste.',
  }],
  segredos: [
    { id: 'plataforma', area: [8, 1, 2, 2] },
    { id: 'nicho', area: [12, 12, 3, 1] },
  ],
  checkpoints: [[12, 4]],
  saida: [22, 2],
  luzes: [
    { em: [3, 3], cor: 0x9fc4ff, intensidade: 1.2 },
    { em: [7, 6], cor: 0x7fa6d6, intensidade: 0.9, pisca: 0.3 },
    { em: [3, 10], cor: 0x8fb8e8, intensidade: 0.8, altura: 4 },
    { em: [13, 2], cor: 0xa8d0ff, intensidade: 1.1 },
    { em: [14, 9], cor: 0x86aee0, intensidade: 0.9, pisca: 0.5 },
    { em: [14, 6], cor: 0xff2a1a, intensidade: 1.5, grupo: 'alarme' },
    { em: [20, 3], cor: 0x9cc8ff, intensidade: 1.0 },
    { em: [13, 12], cor: 0x6f93c4, intensidade: 0.6 },
  ],
  props: [],
  decals: [],
  ambiente: { nevoa: 0.06, corNevoa: 0x05070a, ambiente: 0.12, somDeFundo: 'zumbido', musica: 'tensao' },
};
