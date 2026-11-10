// Estado do mundo da simulação: tipos, input vazio, criação do mundo a partir da fase e checkpoint.
import type { ArmaId, ChefeDef, LevelDef, NivelCartao, PickupDef, TipoMunicao } from './fase';
import { CHEFE_096 } from './balance';
import { alturaPiso, centro, criarGrid, type Coord, type Grid, type Vec2 } from './grid';
import { modoDoChefe } from './ai/chefe096';
import { avancadorDeChefe } from './ai/chefes';
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
  refugio: Vec2 | null;        // avançador vendo o jogador sem rota até ele: célula alcançável mais próxima dele
}
export type FaseChefe = 'inerte' | 'despertando' | 'perseguicao' | 'arrombando' | 'investida' | 'pausa' | 'morto';
export interface EstadoChefe {
  inimigoId: number;          // o chefe é um Inimigo em w.inimigos (tiro, dano e views valem)
  fase: FaseChefe;
  timer: number;              // segundos restantes da fase (despertando, arrombando, investida, pausa); na perseguição, do preparo do golpe;
                              // na investida, acima de CHEFE_096.investidaMax é o preparo parado
  olhar: number;              // segundos acumulados de mira enquanto inerte
  naArena: boolean;
  portaAlvo: string | null;   // porta sendo arrombada
  investida: Vec2 | null;     // direção da investida atual (unitária)
  passo: number;              // metros andados desde o último `chefe_passo`
}
export interface EstadoPerigo { id: string; ativo: number; recarga: number }   // segundos restantes
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
  chefe: EstadoChefe | null;     // null: fase sem chefe
  perigos: EstadoPerigo[];       // um por `fase.chefe.perigos`, na mesma ordem
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
    chefe: null, perigos: (fase.chefe?.perigos ?? []).map((p) => ({ id: p.id, ativo: 0, recarga: 0 })),
  };
  // terminais e documentos são resolvidos no `usar`; validar aqui faz um símbolo errado falhar já na criação
  for (const def of [...fase.terminais, ...fase.documentos]) resolverOnde(grid, def.em);
  for (const def of fase.inimigos) {
    w.inimigos.push(criarInimigo(w, def));
    w.stats.totalInimigos++;
  }
  if (fase.chefe) criarChefe(w, fase.chefe);
  gravarCheckpoint(w);
  return w;
}

/** Cria o inimigo do chefe (conta no total) e o estado dele, inerte. */
function criarChefe(w: World, def: ChefeDef): void {
  if (!avancadorDeChefe(def.tipo)) throw new Error(`Fase "${w.fase.id}": "${def.tipo}" não é um tipo de chefe`);
  resolverOnde(w.grid, def.retomada);   // símbolo errado falha já na criação
  const i = criarInimigo(w, { em: def.em, tipo: def.tipo, yaw: def.yaw });
  w.inimigos.push(i);
  w.stats.totalInimigos++;
  w.chefe = { inimigoId: i.id, fase: 'inerte', timer: 0, olhar: 0, naArena: false, portaAlvo: null, investida: null, passo: 0 };
}

/** O que o checkpoint guarda. Os `Set` viram arrays no JSON. */
interface Snapshot {
  jogador: Jogador; inimigos: Inimigo[]; portas: Porta[]; pickups: Pickup[];
  gatilhosFeitos: string[]; gatilhosAtivos: string[]; alarme: boolean; luzesDesligadas: string[];
  stats: Stats; proximoId: number; semente: number; cronometro: number | null; checkpointsUsados: number[];
  chefe: EstadoChefe | null; perigos: EstadoPerigo[];
}

/** Grava em `w.checkpoint` o estado para recomeçar. */
export function gravarCheckpoint(w: World): void {
  const s: Snapshot = {
    jogador: w.jogador, inimigos: w.inimigos, portas: w.portas, pickups: w.pickups,
    gatilhosFeitos: [...w.gatilhosFeitos], gatilhosAtivos: [...w.gatilhosAtivos], alarme: w.alarme,
    luzesDesligadas: [...w.luzesDesligadas], stats: w.stats, proximoId: w.proximoId, semente: w.semente,
    cronometro: w.cronometro, checkpointsUsados: w.checkpointsUsados, chefe: w.chefe, perigos: w.perigos,
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
  w.chefe = s.chefe;
  w.perigos = s.perigos;
  retomarChefe(w);
  w.estado = 'jogando';
}

/** Chefe acordado (nem inerte nem morto) no snapshot: volta na `retomada`, `despertando`. */
function retomarChefe(w: World): void {
  const c = w.chefe;
  const def = w.fase.chefe;
  if (!c || !def || c.fase === 'inerte' || c.fase === 'morto') return;
  const i = w.inimigos.find((x) => x.id === c.inimigoId);
  // morto no mesmo passo em que o checkpoint gravou (comporta num gatilho): a fase vira 'morto' no próximo passo
  if (!i || i.modo === 'morto') return;
  i.pos = centro(resolverOnde(w.grid, def.retomada));
  i.y = alturaPiso(w.grid, i.pos);
  i.rota = [];
  i.rotaEm = 0;
  i.espera = 0;
  c.fase = 'despertando';
  i.modo = modoDoChefe(c.fase);
  c.timer = CHEFE_096.retomada;
  c.portaAlvo = null;
  c.investida = null;
}
