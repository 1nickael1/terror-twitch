// tests/sim/ajuda.ts
import type { Coord } from '../../src/sim/grid';
import type { ChefeDef, LevelDef } from '../../src/sim/fase';
import { criarInimigo } from '../../src/sim/ai/comum';
import { TIPOS } from '../../src/sim/ai/tipos';
import type { Inimigo, World } from '../../src/sim/world';

export function faseMinima(planta: string, extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'teste', nome: 'Teste', planta, legenda: {}, spawnYaw: -Math.PI / 2,
    arsenal: { armas: ['pistola', 'escopeta', 'smg', 'lancador'], municao: { balas: 50, cartuchos: 20, leves: 100, capsulas: 5 } },
    portas: [], pickups: [], inimigos: [], gatilhos: [], terminais: [], documentos: [], segredos: [],
    checkpoints: [], saida: [1, 1], luzes: [], props: [], decals: [],
    ambiente: { nevoa: 0, corNevoa: 0, ambiente: 1, somDeFundo: '', musica: '' },
    ...extra,
  };
}

/**
 * Fase mínima com o chefe 096 em `em`. Sem `arena`, a arena fica numa célula de parede (nunca
 * entra); sem `retomada`, é o próprio `em`.
 */
export function faseComChefe(planta: string, chefe: Partial<ChefeDef> & { em: ChefeDef['em'] }, extra: Partial<LevelDef> = {}): LevelDef {
  return faseMinima(planta, {
    chefe: {
      tipo: 'entidade096', nome: 'SCP-096', yaw: 0, arena: [0, 0, 1, 1], retomada: chefe.em, perigos: [],
      ...chefe,
    },
    ...extra,
  });
}

export function porInimigo(w: World, tipo: string, coord: Coord): Inimigo {
  const i = criarInimigo(w, { em: coord, tipo });
  w.inimigos.push(i);
  w.stats.totalInimigos++;
  return i;
}

/**
 * Alvo parado e resistente, só para testes. Registrado em `TIPOS` ao carregar este módulo (fora
 * do catálogo de produção: o validador de fases não o aceita numa fase real).
 */
TIPOS.reforcado_teste = {
  ...TIPOS.funcionario,
  arquetipo: 'avancador', vida: 400, velocidade: 0, raio: 0.35, altura: 1.8,
  visao: 0, visaoEscuro: 0, audicao: 0,
  dano: 0, alcanceAtaque: 0, cadencia: 9, preparo: 9, dor: 0.25,
  distanciaIdeal: 0, projetil: null,
};
