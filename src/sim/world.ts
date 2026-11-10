// Estado do mundo da simulação: tipos, input vazio, criação do mundo a partir da fase e checkpoint.
import type { ArmaId, LevelDef, NivelCartao, PickupDef, TipoMunicao } from './fase';
import { alturaPiso, centro, criarGrid, type Coord, type Grid, type Vec2 } from './grid';
import { criarInimigo } from './ai/comum';
import { resolverOnde } from './onde';
import { criarJogador } from './player';

export interface InputFrame {
  frente: number; lado: number; dYaw: number; dPitch: number;
  devagar: boolean;      // Shift: anda devagar e sem ruído
  pular: boolean;        // segurado
  atirar: boolean;       // segurado
  usar: boolean;         // borda
  lanterna: boolean;     // borda
  arma: ArmaId | null;   // teclas 1–4
  roda: -1 | 0 | 1;
}

/** Nenhuma tecla apertada. Congelado: copie com spread para variar. */
export const INPUT_VAZIO: InputFrame = Object.freeze({
  frente: 0, lado: 0, dYaw: 0, dPitch: 0,
  devagar: false, pular: false, atirar: false, usar: false, lanterna: false,
  arma: null, roda: 0,
});

export interface Jogador {
  pos: Vec2; y: number; vy: number; vel: Vec2; yaw: number; pitch: number; noChao: boolean;
  vida: number; colete: number; lanterna: boolean; cartoes: NivelCartao[];
  armas: ArmaId[]; arma: ArmaId; municao: Record<TipoMunicao, number>;
  espera: number;        // segundos até poder atirar
  rajada: number;        // tiros seguidos (espalhamento da smg)
  gatilho: boolean;      // atirar estava apertado no passo anterior
  puloApertado: boolean; // pular estava apertado no passo anterior (o salto sai na borda)
  passoAcum: number;     // metros andados no chão desde o último passo
  reservaPistola: number;  // segundos acumulados para a próxima bala da reserva da pistola
  tiroPendente: number;    // segundos em que um clique dado durante a espera ainda vale
}
export type ModoIA = 'dormindo' | 'patrulha' | 'suspeita' | 'perseguicao' | 'ataque' | 'dor' | 'morto';
export interface Inimigo {
  id: number; tipo: string; grupo: string | null; pos: Vec2; y: number; yaw: number;
  vida: number; modo: ModoIA; timer: number; espera: number;
  alvo: Vec2 | null; rota: Vec2[];
  rotaEm: number;              // segundos até poder recalcular a rota
  patrulha: Vec2[]; patrulhaI: number; lento: number;
  ultimoVisto: Vec2 | null;    // onde viu o jogador pela última vez
  semVer: number;              // segundos perseguindo sem ver o jogador
  semRota: boolean;            // o último cálculo de rota não achou caminho
  destinoRota: Coord | null;   // célula do último destino pedido a `irPara` (zera `semRota` ao mudar)
  rotasCalculadas: number;     // quantas vezes calculou rota (métrica de depuração)
  alertado: boolean;           // já emitiu `inimigo_alerta`; desliga ao voltar à patrulha
}
export interface Porta {
  id: string; coord: Coord; estado: 'fechada' | 'abrindo' | 'aberta' | 'fechando' | 'trancada'; abertura: number; exige: NivelCartao | null;
  trancarAoFechar: boolean;   // ao terminar de fechar, vira 'trancada' em vez de 'fechada'
}
export interface Pickup { def: PickupDef; pos: Vec2; pego: boolean }
export interface Projetil { id: number; de: 'jogador' | 'inimigo'; tipo: string; pos: Vec2; y: number; vel: Vec2; vy: number; dano: number; vida: number }
export interface Nuvem { pos: Vec2; raio: number; resta: number }
export interface Stats { tempo: number; mortos: number; totalInimigos: number; segredos: string[]; documentos: string[] }
export interface World {
  fase: LevelDef; grid: Grid; t: number; semente: number;
  jogador: Jogador; inimigos: Inimigo[]; projeteis: Projetil[]; nuvens: Nuvem[];
  portas: Porta[]; pickups: Pickup[]; gatilhosFeitos: Set<string>;
  gatilhosAtivos: Set<string>;   // gatilhos `umaVez: false` cuja condição valia no passo anterior
  alarme: boolean; luzesDesligadas: Set<string>; cronometro: number | null;
  stats: Stats; tensao: number; estado: 'jogando' | 'morto' | 'concluida';
  checkpoint: string;    // snapshot serializado (JSON) para recomeçar
  checkpointPendente: boolean;   // ação `checkpoint` neste passo: grava no fim dos gatilhos (fora do JSON)
  checkpointsUsados: number[];   // índices de `fase.checkpoints` já pisados (cada um grava uma vez)
  proximoId: number;
}

/** Mundo inicial da fase: grade, jogador no `P` com o arsenal da fase, portas, pickups, inimigos e o primeiro checkpoint. */
export function criarWorld(fase: LevelDef): World {
  const grid = criarGrid(fase.planta, fase.legenda);
  const marcaP = grid.marcas.get('P')?.[0];
  if (!marcaP) throw new Error(`Fase "${fase.id}": a planta precisa de exatamente um P`);
  const pos = centro(marcaP);
  const jogador = criarJogador(pos, fase.spawnYaw, alturaPiso(grid, pos));
  jogador.armas = [...fase.arsenal.armas];
  jogador.arma = jogador.armas[0] ?? 'pistola';
  jogador.municao = { ...jogador.municao, ...fase.arsenal.municao };
  const w: World = {
    fase, grid, t: 0, semente: 1,
    jogador, inimigos: [], projeteis: [], nuvens: [],
    portas: fase.portas.map((def) => ({
      id: def.id, coord: resolverOnde(grid, def.em), estado: def.trancada ? 'trancada' : 'fechada',
      abertura: 0, exige: def.exige ?? null, trancarAoFechar: false,
    })),
    pickups: fase.pickups.map((def) => ({ def, pos: centro(resolverOnde(grid, def.em)), pego: false })),
    gatilhosFeitos: new Set(), gatilhosAtivos: new Set(),
    alarme: false, luzesDesligadas: new Set(), cronometro: null,
    stats: { tempo: 0, mortos: 0, totalInimigos: 0, segredos: [], documentos: [] },
    tensao: 0, estado: 'jogando', checkpoint: '', checkpointPendente: false, checkpointsUsados: [], proximoId: 1,
  };
  // terminais e documentos são resolvidos no `usar`; validar aqui faz um símbolo errado falhar já na criação
  for (const def of [...fase.terminais, ...fase.documentos]) resolverOnde(grid, def.em);
  for (const def of fase.inimigos) {
    w.inimigos.push(criarInimigo(w, def));
    w.stats.totalInimigos++;
  }
  gravarCheckpoint(w);
  return w;
}

/** O que o checkpoint guarda. Os `Set` viram arrays no JSON. */
interface Snapshot {
  jogador: Jogador; inimigos: Inimigo[]; portas: Porta[]; pickups: Pickup[];
  gatilhosFeitos: string[]; gatilhosAtivos: string[]; alarme: boolean; luzesDesligadas: string[];
  stats: Stats; proximoId: number; semente: number; cronometro: number | null; checkpointsUsados: number[];
}

/** Grava em `w.checkpoint` o estado para recomeçar. */
export function gravarCheckpoint(w: World): void {
  const s: Snapshot = {
    jogador: w.jogador, inimigos: w.inimigos, portas: w.portas, pickups: w.pickups,
    gatilhosFeitos: [...w.gatilhosFeitos], gatilhosAtivos: [...w.gatilhosAtivos], alarme: w.alarme,
    luzesDesligadas: [...w.luzesDesligadas], stats: w.stats, proximoId: w.proximoId, semente: w.semente,
    cronometro: w.cronometro, checkpointsUsados: w.checkpointsUsados,
  };
  w.checkpoint = JSON.stringify(s);
}

/**
 * Volta ao último checkpoint (cópias novas), sem projéteis nem nuvens, jogando. O jogador volta
 * parado e sem tensão; `stats.tempo` não volta atrás (o tempo da fase conta as mortes).
 */
export function restaurarCheckpoint(w: World): void {
  const s = JSON.parse(w.checkpoint) as Snapshot;
  w.jogador = s.jogador;
  w.inimigos = s.inimigos;
  w.portas = s.portas;
  w.pickups = s.pickups;
  w.gatilhosFeitos = new Set(s.gatilhosFeitos);
  w.gatilhosAtivos = new Set(s.gatilhosAtivos);
  w.alarme = s.alarme;
  w.luzesDesligadas = new Set(s.luzesDesligadas);
  w.jogador.vel = { x: 0, z: 0 };
  w.jogador.vy = 0;
  w.stats = { ...s.stats, tempo: w.stats.tempo };
  w.tensao = 0;
  w.proximoId = s.proximoId;
  w.semente = s.semente;
  w.cronometro = s.cronometro;
  w.checkpointsUsados = s.checkpointsUsados;
  w.projeteis = [];
  w.nuvens = [];
  w.estado = 'jogando';
}
