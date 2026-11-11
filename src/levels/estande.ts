import type { LevelDef, PickupDef } from '../sim/fase';

// Quatro corredores de tiro e um arsenal aberto atrás da linha de segurança.
const planta = Array.from({ length: 29 }, (_, r) => Array.from({ length: 27 }, (_, c) => {
  if (r === 0 || r === 28 || c === 0 || c === 26) return '#';
  if (r < 16 && [7, 13, 19].includes(c)) return '#';
  if (c === 13 && r === 20) return 'D';
  if (r >= 20 && r <= 23 && (c === 12 || c === 14 || (r === 23 && c === 13))) return '#';
  for (const [centro, simbolo] of [[4, 'E'], [9, 'F']] as const) {
    if (r === 24 && c === centro) return simbolo;
    if (r >= 24 && r <= 27 && (c === centro - 1 || c === centro + 1 || (r === 27 && c === centro))) return '#';
  }
  if (r === 18 && c === 10) return 'P';
  return 's';
}).join('')).join('\n');

const suprimentos: PickupDef[] = [
  { em: [3, 20], tipo: 'arma', arma: 'pistola', quantidade: 30 },
  { em: [5, 20], tipo: 'municao', municao: 'balas', quantidade: 60 },
  { em: [8, 20], tipo: 'arma', arma: 'escopeta', quantidade: 12 },
  { em: [10, 20], tipo: 'municao', municao: 'cartuchos', quantidade: 24 },
  { em: [16, 20], tipo: 'arma', arma: 'smg', quantidade: 80 },
  { em: [18, 20], tipo: 'municao', municao: 'leves', quantidade: 100 },
  { em: [21, 20], tipo: 'arma', arma: 'lancador', quantidade: 2 },
  { em: [23, 20], tipo: 'municao', municao: 'capsulas', quantidade: 8 },
  { em: [3, 22], tipo: 'vida_p' }, { em: [5, 22], tipo: 'vida_g' },
  { em: [8, 22], tipo: 'colete_p' }, { em: [10, 22], tipo: 'colete_g' },
  { em: [17, 22], tipo: 'cartao', nivel: 1 },
  { em: [20, 22], tipo: 'cartao', nivel: 2 },
  { em: [23, 22], tipo: 'cartao', nivel: 3 },
];

export const ESTANDE: LevelDef = {
  id: 'estande', nome: 'Estande de tiro · testes', treino: { vidaInicial: 60 },
  planta, legenda: { s: { teto: 4 }, P: { teto: 4 }, D: { teto: 4 }, E: { teto: 4 }, F: { teto: 4 } }, spawnYaw: 0,
  arsenal: {
    armas: ['pistola', 'escopeta', 'smg', 'lancador'],
    municao: { balas: 24, cartuchos: 12, leves: 80, capsulas: 2 },
  },
  portas: [
    { id: 'porta-teste', em: 'D', trancada: true, exige: 1 },
    { id: 'porta-teste-n2', em: 'E', trancada: true, exige: 2 },
    { id: 'porta-teste-n3', em: 'F', trancada: true, exige: 3 },
  ], pickups: suprimentos,
  inimigos: [...[4, 10, 16, 22].flatMap((c) => [5, 12].map((r) => ({
    em: [c, r] as const, tipo: 'alvo_treino', yaw: Math.PI,
  }))), ...['funcionario', 'seguranca', 'entidade096'].map((tipo, i) => ({
    em: [9 + i * 3, 16] as const, tipo, yaw: Math.PI, imovel: true, grupo: 'exposicao-fase1',
  }))],
  gatilhos: [{
    id: 'bem-vindo', quando: { tipo: 'area', area: [1, 16, 25, 8] },
    faz: [{ acao: 'mensagem', texto: 'ESTANDE: 1–4 troca armas · Portas de teste 1/2/3 atrás das coletas: use E com o cartão · Esc reinicia tudo.' }],
  }, {
    id: 'sirene-estande', quando: { tipo: 'terminal', id: 'sirene-teste' }, umaVez: false,
    faz: [{ acao: 'alarme', ligado: true }],
  }],
  terminais: [{ id: 'sirene-teste', em: [24, 18], rotulo: 'Testar sirene / grito distante' }],
  documentos: [], segredos: [], checkpoints: [], saida: [15, 23],
  ambiente: { nevoa: 0.002, corNevoa: 0x353e46, ambiente: 5, somDeFundo: '', musica: '' },
  luzes: [4, 10, 16, 22].flatMap((c) => [4, 11, 18, 22, 26].map((r) => ({
    em: [c, r] as const, cor: 0xe7f1ff, intensidade: 5, altura: 3.5,
  }))),
  props: [
    { em: [12, 19], tipo: 'placa', parede: 's', texto: 'PORTA DE TESTE / CARTÃO 1 / E' },
    { em: [5, 23], tipo: 'placa', parede: 's', texto: 'TESTE / CARTÃO 2 / E' },
    { em: [10, 23], tipo: 'placa', parede: 's', texto: 'TESTE / CARTÃO 3 / E' },
    ...[4, 10, 16, 22].map((c, i) => ({
      em: [c, 1] as const, tipo: 'placa' as const, parede: 'n' as const,
      texto: `LINHA 0${i + 1} / ALVOS`,
    })),
    ...[[2, 'PISTOLA'], [12, 'ESPINGARDA'], [18, 'SUBMETRALHADORA'], [23, 'LANÇA-AGENTE']].map(([c, texto]) => ({
      em: [c as number, 27] as const, tipo: 'placa' as const, parede: 's' as const, texto: texto as string,
    })),
    { em: [1, 21], tipo: 'placa', parede: 'o', texto: 'VIDA / COLETES / CARTÕES' },
    { em: [25, 18], tipo: 'placa', parede: 'l', texto: 'ESC > REINICIAR ESTANDE' },
    ...[3, 8, 16, 21].map((c) => ({ em: [c, 23] as const, tipo: 'armario' as const })),
  ],
  decals: [4, 10, 16, 22].map((c) => ({ em: [c, 17] as const, tipo: 'faixa' })),
};
