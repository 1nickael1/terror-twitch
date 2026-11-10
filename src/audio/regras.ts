// Regras puras do áudio: que som cada evento da simulação pede, onde ele soa, quanto se
// limita a repetição e qual voz cortar. Sem `three`, DOM nem WebAudio (testável no node).
import { TIPOS } from '../sim/ai/tipos';
import type { ArmaId, PerigoArea } from '../sim/fase';
import type { SimEvent } from '../sim/eventos';
import { alturaPiso, CELL, celula, centro, visivel, type Coord, type Grid, type Solido, type Vec2 } from '../sim/grid';
import type { World } from '../sim/world';

/**
 * Sons avulsos (uma voz cada). Os laços (ambiente, drone, alarme, lamento, perigos de área) ficam
 * fora desta lista, mas contam no limite de vozes (`vagasAvulsas`).
 */
export const NOMES_SOM = [
  'tiroPistola', 'tiroEscopeta', 'tiroSmg', 'disparoLancador', 'explosao', 'impactoParede', 'impactoCarne',
  'passo', 'pulo', 'pouso', 'portaMotor', 'portaBaque', 'portaNegada', 'pickup', 'armaTrocada', 'semMunicao',
  'dorJogador', 'grunhidoAlerta', 'grunhidoAtaque', 'dorInimigo', 'morteInimigo', 'projetil', 'bip',
  'bipDiscreto', 'checkpoint', 'segredo', 'morteJogador', 'faseConcluida',
  // chefe e comportas
  'chefeDesperta', 'chefeArromba', 'chefeInvestida', 'chefeGolpe', 'chefeMorto', 'chefePasso',
  'comportaFecha', 'comportaAbre', 'comportaRecusa',
  // ação `som` dos gatilhos (ids do catálogo)
  'sireneCurta', 'estalo', 'gaveta', 'elevador',
  // fase 2: reanimados, frasco, chefe 049 e perigos de área
  'gemido', 'levantar', 'frascoArremesso', 'vidroQuebra',
  'chefe049Desperta', 'chefe049Passo', 'chefeToque', 'chefeReanima', 'chefeApressa', 'chefe049Morto',
  'uvAviso', 'uvLiga', 'vaporAviso', 'vaporLiga', 'perigoRecusa',
] as const;
export type NomeSom = (typeof NOMES_SOM)[number];

/**
 * Pedido de som: `pos` nulo = som do jogador (sem posicional); `y` = altura absoluta da fonte;
 * `celulaPorta`: a fonte é a porta nesta célula (ela não abafa o próprio som; as outras abafam).
 */
export interface PedidoSom { som: NomeSom; pos: Vec2 | null; y?: number; celulaPorta?: Coord }

export const TIRO_POR_ARMA: Record<ArmaId, NomeSom> = {
  pistola: 'tiroPistola', escopeta: 'tiroEscopeta', smg: 'tiroSmg', lancador: 'disparoLancador',
};

/** Som de cada id da ação `som` dos gatilhos (`SONS_DE_EVENTO` do catálogo). */
export const SOM_DE_GATILHO: Readonly<Record<string, NomeSom>> = Object.freeze({
  bip: 'bip', sirene_curta: 'sireneCurta', estalo: 'estalo', gaveta: 'gaveta', elevador: 'elevador',
});

/** altura da "boca" do inimigo acima do piso dele */
const ALTURA_INIMIGO = 1.3;
/** altura do motor da porta acima do piso da célula */
const ALTURA_PORTA = 1.5;
/** altura do centro da explosão acima do piso */
const ALTURA_EXPLOSAO = 0.6;
/** altura da cabeça do chefe (2,4 m) acima do piso dele */
const ALTURA_CHEFE = 2.2;
/** altura do passo do chefe acima do piso (o pé batendo no chão) */
const ALTURA_PASSO_CHEFE = 0.1;
/** altura do mecanismo da comporta acima do piso */
const ALTURA_COMPORTA = 1.5;
/** altura do corpo no chão (quem levanta) acima do piso */
const ALTURA_CORPO = 0.4;
/** altura dos perigos de área (lâmpadas e canos no alto) acima do piso */
const ALTURA_PERIGO_AREA = 2.4;

function inimigo(w: World, id: number, som: NomeSom, altura = ALTURA_INIMIGO): PedidoSom | null {
  const i = w.inimigos.find((x) => x.id === id);
  return i ? { som, pos: { x: i.pos.x, z: i.pos.z }, y: i.y + altura } : null;
}

/** O chefe é o da fase 2 (049)? Os eventos `chefe_*` comuns aos dois tocam a voz de cada um. */
function chefe049(w: World): boolean {
  return w.chefe?.tipo === 'entidade049';
}

/** Tipo reanimável (os reanimados): gemem em vez de grunhir. */
function reanimavel(w: World, id: number): boolean {
  const i = w.inimigos.find((x) => x.id === id);
  return i !== undefined && Object.prototype.hasOwnProperty.call(TIPOS, i.tipo) && TIPOS[i.tipo].reanimavel;
}

/** Centro da área de um perigo, na altura `altura` acima do piso da primeira célula. */
function centroDaArea(w: World, area: readonly [number, number, number, number], altura: number): { pos: Vec2; y: number } {
  const [c0, r0, larg, alt] = area;
  return { pos: { x: (c0 + larg / 2) * CELL, z: (r0 + alt / 2) * CELL }, y: celula(w.grid, c0, r0).piso + altura };
}

/** Cabeça do chefe (null sem chefe). */
function cabecaDoChefe(w: World): { pos: Vec2; y: number } | null {
  const id = w.chefe?.inimigoId;
  const i = id === undefined ? undefined : w.inimigos.find((x) => x.id === id);
  return i ? { pos: { x: i.pos.x, z: i.pos.z }, y: i.y + ALTURA_CHEFE } : null;
}

/** Som na cabeça do chefe (null sem chefe). */
function doChefe(w: World, som: NomeSom): PedidoSom | null {
  const c = cabecaDoChefe(w);
  return c ? { som, ...c } : null;
}

/**
 * Eventos genéricos de inimigo: os do chefe (um `Inimigo` para a simulação) não usam os sons dos
 * comuns. Dor, morte e alerta dele ficam calados (os sons vêm dos eventos `chefe_*`); o golpe
 * tem som próprio.
 */
function deInimigo(w: World, id: number, som: NomeSom): PedidoSom | null {
  if (w.chefe?.inimigoId !== id) return inimigo(w, id, som);
  return som === 'grunhidoAtaque' ? doChefe(w, 'chefeGolpe') : null;
}

/** Som de cada estado de um perigo de área (UV, vapor); `desliga` só para o laço (sem avulso). */
const SOM_PERIGO_AREA: Readonly<Record<PerigoArea['tipo'], Partial<Record<'aviso' | 'liga', NomeSom>>>> = {
  ultravioleta: { aviso: 'uvAviso', liga: 'uvLiga' },
  vapor: { aviso: 'vaporAviso', liga: 'vaporLiga' },
};

/**
 * Perigo: comporta fecha e abre no centro da área; perigo de área avisa e liga no alto do centro da
 * área. A recusa (recarregando) é retorno ao jogador: o bip da comporta só na comporta; os de área
 * têm a própria recusa.
 */
function doPerigo(w: World, id: string, estado: 'fecha' | 'abre' | 'recarregando' | 'aviso' | 'liga' | 'desliga'): PedidoSom | null {
  const d = w.fase.chefe?.perigos.find((p) => p.id === id);
  if (!d) return null;
  if (d.tipo !== 'comporta') {
    if (estado === 'recarregando') return { som: 'perigoRecusa', pos: null };
    const som = estado === 'aviso' || estado === 'liga' ? SOM_PERIGO_AREA[d.tipo][estado] : undefined;
    return som ? { som, ...centroDaArea(w, d.area, ALTURA_PERIGO_AREA) } : null;
  }
  if (estado === 'recarregando') return { som: 'comportaRecusa', pos: null };
  if (estado !== 'fecha' && estado !== 'abre') return null;
  return { som: estado === 'fecha' ? 'comportaFecha' : 'comportaAbre', ...centroDaArea(w, d.area, ALTURA_COMPORTA) };
}

/** Onde o lamento do chefe 096 inerte toca (laço posicional), ou null se ele não está inerte. */
export function lamentoDoChefe(w: World): { pos: Vec2; y: number } | null {
  // o 049 inerte fica em silêncio: o lamento é do 096
  if (w.chefe?.tipo !== 'entidade096' || w.chefe.fase !== 'inerte') return null;
  const c = cabecaDoChefe(w);
  // curvado: a voz sai mais baixa que a cabeça de pé
  return c ? { pos: c.pos, y: c.y - 0.5 } : null;
}

/** Laços contínuos da fase que devem estar tocando. */
export interface LacosDaFase { ambiente: boolean; drone: boolean; alarme: boolean; lamento: boolean }

/**
 * Quais laços tocam dado o estado do mundo. Fase concluída: nenhum (a tela de fim fica só com o
 * som de conclusão, que é avulso). Morte: seguem (a tela dura 2 s e volta ao checkpoint).
 */
export function lacosDaFase(w: World): LacosDaFase {
  if (w.estado === 'concluida') return { ambiente: false, drone: false, alarme: false, lamento: false };
  return { ambiente: true, drone: true, alarme: w.alarme && w.sirene > 0, lamento: lamentoDoChefe(w) !== null };
}

/**
 * Laço de um perigo de área ligado: zumbido da UV ou jato de vapor, no alto do centro da área.
 * `d`: distância ao ouvinte; `nota`: a distância com a vantagem de quem já toca (a ordem da escolha).
 */
export interface LacoPerigo { id: string; tipo: PerigoArea['tipo']; pos: Vec2; y: number; d: number; nota: number }

/** no máximo estes laços de perigo ao mesmo tempo (os mais próximos do ouvinte) */
export const MAX_LACOS_PERIGO = 2;
/** histerese: um laço já tocando só sai além de `maxDistance × HISTERESE_LACO` (entra a `maxDistance`) */
export const HISTERESE_LACO = 1.15;
/** m de vantagem de um laço já tocando na disputa pelas vagas (não troca por um quase igual) */
export const DESEMPATE_LACO = 2;

const NENHUM: { has(id: string): boolean } = { has: () => false };

/**
 * Laços dos perigos de área que devem tocar: os ligados (`ativo > 0`), audíveis, os `MAX_LACOS_PERIGO`
 * de menor `nota`. Com histerese para não recriar o laço na borda: quem já toca (`tocando`) fica até
 * `maxDistance × HISTERESE_LACO` e ganha DESEMPATE_LACO m de vantagem na ordem. Fase concluída: nenhum.
 * Preenche e devolve `saida` (reaproveitável); sem perigo ligado, nada é alocado.
 */
export function lacosDePerigo(
  w: World, ouvinte: Ouvinte, tocando: { has(id: string): boolean } = NENHUM, saida: LacoPerigo[] = [],
): LacoPerigo[] {
  saida.length = 0;
  if (w.estado === 'concluida') return saida;
  const defs = w.fase.chefe?.perigos;
  if (!defs) return saida;
  for (let i = 0; i < w.perigos.length; i++) {
    const def = defs[i];
    if (!def || def.tipo === 'comporta' || w.perigos[i].ativo <= 0) continue;
    const { pos, y } = centroDaArea(w, def.area, ALTURA_PERIGO_AREA);
    const d = Math.hypot(pos.x - ouvinte.pos.x, y - ouvinte.y, pos.z - ouvinte.pos.z);
    const ja = tocando.has(def.id);
    if (d > POSICIONAL.maxDistance * (ja ? HISTERESE_LACO : 1)) continue;
    saida.push({ id: def.id, tipo: def.tipo, pos, y, d, nota: ja ? d - DESEMPATE_LACO : d });
  }
  if (saida.length > 1) saida.sort((a, b) => a.nota - b.nota);
  if (saida.length > MAX_LACOS_PERIGO) saida.length = MAX_LACOS_PERIGO;
  return saida;
}

/** Quantos laços tocam: os da fase (ambiente, drone, alarme, lamento) mais os dos perigos. */
export function contarLacos(l: LacosDaFase, perigos: number): number {
  return Number(l.ambiente) + Number(l.drone) + Number(l.alarme) + Number(l.lamento) + perigos;
}

/**
 * Vagas das vozes avulsas: o limite de vozes vale para o total (laços + avulsas), então cada laço
 * tocando tira uma vaga dos avulsos (nunca menos que `LIMITE.minAvulsas`).
 */
export function vagasAvulsas(lacos: number): number {
  return Math.max(LIMITE.minAvulsas, LIMITE.vozes - Math.max(0, lacos));
}

/** O som que o evento pede, ou `null` para eventos sem som. Só lê o mundo. */
export function somDoEvento(e: SimEvent, w: World): PedidoSom | null {
  switch (e.tipo) {
    case 'tiro':
      return { som: TIRO_POR_ARMA[e.arma], pos: null };
    case 'impacto':
      return { som: e.em === 'parede' ? 'impactoParede' : 'impactoCarne', pos: { x: e.pos.x, z: e.pos.z }, y: e.y };
    case 'explosao':
      return { som: 'explosao', pos: { x: e.pos.x, z: e.pos.z }, y: alturaPiso(w.grid, e.pos) + ALTURA_EXPLOSAO };
    case 'passo':
      return { som: 'passo', pos: null };
    case 'pulo':
      return { som: 'pulo', pos: null };
    case 'pouso':
      return { som: 'pouso', pos: null };
    case 'porta': {
      const p = w.portas.find((x) => x.id === e.id);
      if (!p) return null;
      const motor = e.estado === 'abrindo' || e.estado === 'fechando';
      const [col, row] = p.coord;
      return {
        som: motor ? 'portaMotor' : 'portaBaque', pos: centro(p.coord), y: celula(w.grid, col, row).piso + ALTURA_PORTA, celulaPorta: p.coord,
      };
    }
    case 'porta_negada':
      return { som: 'portaNegada', pos: null };
    case 'pickup':
      return { som: 'pickup', pos: null };
    case 'arma_trocada':
      return { som: 'armaTrocada', pos: null };
    case 'sem_municao':
      return { som: 'semMunicao', pos: null };
    case 'dano_jogador':
      return { som: 'dorJogador', pos: null };
    case 'inimigo_alerta':
      // os reanimados gemem em vez de grunhir
      return deInimigo(w, e.id, reanimavel(w, e.id) ? 'gemido' : 'grunhidoAlerta');
    case 'inimigo_levanta':
      // o corpo levantando do chão (reanimado pelo 049 ou o emboscador deitado)
      return w.chefe?.inimigoId === e.id ? null : inimigo(w, e.id, 'levantar', ALTURA_CORPO);
    case 'inimigo_ataque':
      return deInimigo(w, e.id, 'grunhidoAtaque');
    case 'inimigo_dor':
      return deInimigo(w, e.id, 'dorInimigo');
    case 'inimigo_morto':
      return deInimigo(w, e.id, 'morteInimigo');
    case 'projetil': {
      // o projétil do jogador (lançador) já soa no `tiro`
      const p = w.projeteis.find((x) => x.id === e.id);
      if (!p || p.de !== 'inimigo') return null;
      // projétil em arco (frasco do enfermeiro): o arremesso tem som próprio
      const arco = Object.prototype.hasOwnProperty.call(TIPOS, p.tipo) && TIPOS[p.tipo].projetil?.arco !== undefined;
      return { som: arco ? 'frascoArremesso' : 'projetil', pos: { x: p.pos.x, z: p.pos.z }, y: p.y };
    }
    case 'frasco_quebra':
      return { som: 'vidroQuebra', pos: { x: e.pos.x, z: e.pos.z }, y: e.y };
    case 'terminal':
    case 'documento':
      return { som: 'bip', pos: null };
    case 'checkpoint':
      return { som: 'checkpoint', pos: null };
    case 'segredo':
      return { som: 'segredo', pos: null };
    case 'mensagem':
      return { som: 'bipDiscreto', pos: null };
    case 'som':
      return Object.prototype.hasOwnProperty.call(SOM_DE_GATILHO, e.id) ? { som: SOM_DE_GATILHO[e.id], pos: null } : null;
    case 'chefe_desperta':
      return doChefe(w, chefe049(w) ? 'chefe049Desperta' : 'chefeDesperta');
    case 'chefe_investida':
      return doChefe(w, 'chefeInvestida');
    case 'chefe_morto':
      return { som: chefe049(w) ? 'chefe049Morto' : 'chefeMorto', pos: null };
    case 'chefe_passo':
      return {
        som: chefe049(w) ? 'chefe049Passo' : 'chefePasso', pos: { x: e.pos.x, z: e.pos.z },
        y: alturaPiso(w.grid, e.pos) + ALTURA_PASSO_CHEFE,
      };
    case 'chefe_toque':
      return doChefe(w, 'chefeToque');
    case 'chefe_reanima':
      return doChefe(w, 'chefeReanima');
    case 'chefe_apressa':
      return doChefe(w, 'chefeApressa');
    case 'chefe_arromba': {
      const p = w.portas.find((x) => x.id === e.porta);
      if (!p) return null;
      const [col, row] = p.coord;
      return { som: 'chefeArromba', pos: centro(p.coord), y: celula(w.grid, col, row).piso + ALTURA_PORTA, celulaPorta: p.coord };
    }
    case 'perigo':
      return doPerigo(w, e.id, e.estado);
    case 'jogador_morto':
      return { som: 'morteJogador', pos: null };
    case 'fase_concluida':
      return { som: 'faseConcluida', pos: null };
    // o alarme é um laço que segue `world.alarme`; ruído, gatilho e luz não têm som
    case 'alarme':
    case 'ruido':
    case 'gatilho':
    case 'luz':
      return null;
  }
}

/**
 * `vozes`: limite do total de vozes (laços + avulsas); `minAvulsas`: vagas avulsas que sobram mesmo
 * com muitos laços tocando.
 */
export const LIMITE = { intervaloMs: 30, porQuadro: 3, vozes: 24, minAvulsas: 12 } as const;

/**
 * Limita a repetição por tipo: até `porQuadro` do mesmo tipo no mesmo quadro (ex.: os balins da
 * escopeta) e, entre quadros, o tipo só volta depois de `intervaloMs` desde o último quadro em que tocou.
 */
export class LimitadorSons {
  private agora = 0;
  private readonly ultimo = new Map<string, number>();
  private readonly noQuadro = new Map<string, number>();

  constructor(
    private readonly intervaloMs: number = LIMITE.intervaloMs,
    private readonly porQuadro: number = LIMITE.porQuadro,
  ) {}

  novoQuadro(agoraMs: number): void {
    this.agora = agoraMs;
    this.noQuadro.clear();
  }

  permitir(som: string): boolean {
    const n = this.noQuadro.get(som) ?? 0;
    if (n >= this.porQuadro) return false;
    if (n === 0) {
      const u = this.ultimo.get(som);
      if (u !== undefined && this.agora - u < this.intervaloMs) return false;
      this.ultimo.set(som, this.agora);
    }
    this.noQuadro.set(som, n + 1);
    return true;
  }
}

/** Vozes em ordem de criação; acima do limite, a mais antiga sai (quem chama faz o corte). */
export class RegistroVozes<T> {
  private readonly vozes: T[] = [];

  constructor(private limite: number = LIMITE.vozes) {}

  get tamanho(): number {
    return this.vozes.length;
  }

  get vagas(): number {
    return this.limite;
  }

  /**
   * Muda o limite (ex.: `vagasAvulsas` com os laços tocando). Devolve as vozes mais antigas que
   * passaram do limite novo (quem chama faz o corte); elas já saem do registro.
   */
  definirLimite(n: number): T[] {
    this.limite = Math.max(1, Math.floor(n));
    const excesso = this.vozes.length - this.limite;
    return excesso > 0 ? this.vozes.splice(0, excesso) : [];
  }

  /**
   * Registra a voz nova; devolve a voz que precisa ser cortada para abrir vaga, ou `null`. (Depois de
   * `definirLimite` o registro já está no limite: nunca há mais de uma a cortar aqui.)
   */
  adicionar(v: T): T | null {
    const cortada = this.vozes.length >= this.limite ? (this.vozes.shift() ?? null) : null;
    this.vozes.push(v);
    return cortada;
  }

  remover(v: T): boolean {
    const i = this.vozes.indexOf(v);
    if (i < 0) return false;
    this.vozes.splice(i, 1);
    return true;
  }

  todas(): readonly T[] {
    return this.vozes;
  }

  limpar(): T[] {
    return this.vozes.splice(0, this.vozes.length);
  }
}

export const POSICIONAL = {
  refDistance: 2, maxDistance: 40, rolloffFactor: 1.2, corteOclusao: 900, ganhoOclusao: 0.6,
} as const;

export interface Ouvinte { pos: Vec2; y: number; yaw: number }

/** Fonte a mais de `maxDistance` (3D) não é criada. */
export function audivel(ouvinte: Ouvinte, pos: Vec2, y: number): boolean {
  return Math.hypot(pos.x - ouvinte.pos.x, y - ouvinte.y, pos.z - ouvinte.pos.z) <= POSICIONAL.maxDistance;
}

/**
 * Fonte fora da linha de visão (2D, sem alturas) soa abafada. `solido` (portas fechadas) também
 * abafa, exceto a célula `ignorar` (a porta que é a própria fonte). Chamar depois da distância e do limitador.
 */
export function ocluido(g: Grid, ouvinte: Ouvinte, pos: Vec2, solido?: Solido, ignorar?: Coord): boolean {
  const s = solido && ignorar ? (c: number, r: number) => !(c === ignorar[0] && r === ignorar[1]) && solido(c, r) : solido;
  return !visivel(g, ouvinte.pos, pos, s);
}

/**
 * O contexto de áudio deve estar rodando? Aba oculta: nunca. Em jogo (sem pausa): só com a trava
 * do ponteiro (ou `jogarSemTrava`). Pausado pela interface: só nas telas que mantêm o áudio
 * (morte, fim de fase, final, documento: `audioNaPausa`); a pausa de verdade e o título suspendem.
 */
export function audioDeveTocar(e: {
  oculta: boolean; pausado: boolean; audioNaPausa: boolean; travado: boolean; semTrava: boolean;
}): boolean {
  if (e.oculta) return false;
  if (e.pausado) return e.audioNaPausa;
  return e.travado || e.semTrava;
}
