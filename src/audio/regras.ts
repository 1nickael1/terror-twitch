// Regras puras do áudio: que som cada evento da simulação pede, onde ele soa, quanto se
// limita a repetição e qual voz cortar. Sem `three`, DOM nem WebAudio (testável no node).
import type { ArmaId } from '../sim/fase';
import type { SimEvent } from '../sim/eventos';
import { alturaPiso, celula, centro, visivel, type Coord, type Grid, type Solido, type Vec2 } from '../sim/grid';
import type { World } from '../sim/world';

/** Sons avulsos (uma voz cada). Os laços (ambiente, drone, alarme) ficam fora desta lista. */
export const NOMES_SOM = [
  'tiroPistola', 'tiroEscopeta', 'tiroSmg', 'disparoLancador', 'explosao', 'impactoParede', 'impactoCarne',
  'passo', 'pulo', 'pouso', 'portaMotor', 'portaBaque', 'portaNegada', 'pickup', 'armaTrocada', 'semMunicao',
  'dorJogador', 'grunhidoAlerta', 'grunhidoAtaque', 'dorInimigo', 'morteInimigo', 'projetil', 'bip',
  'bipDiscreto', 'checkpoint', 'segredo', 'morteJogador', 'faseConcluida',
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

/** Ids do evento `som` (ação de gatilho) que têm som de mesmo nome. */
export const SONS_DE_GATILHO: ReadonlySet<string> = new Set<NomeSom>(['bip']);

/** altura da "boca" do inimigo acima do piso dele */
const ALTURA_INIMIGO = 1.3;
/** altura do motor da porta acima do piso da célula */
const ALTURA_PORTA = 1.5;
/** altura do centro da explosão acima do piso */
const ALTURA_EXPLOSAO = 0.6;

function inimigo(w: World, id: number, som: NomeSom): PedidoSom | null {
  const i = w.inimigos.find((x) => x.id === id);
  return i ? { som, pos: { x: i.pos.x, z: i.pos.z }, y: i.y + ALTURA_INIMIGO } : null;
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
      return inimigo(w, e.id, 'grunhidoAlerta');
    case 'inimigo_ataque':
      return inimigo(w, e.id, 'grunhidoAtaque');
    case 'inimigo_dor':
      return inimigo(w, e.id, 'dorInimigo');
    case 'inimigo_morto':
      return inimigo(w, e.id, 'morteInimigo');
    case 'projetil': {
      // o projétil do jogador (lançador) já soa no `tiro`
      const p = w.projeteis.find((x) => x.id === e.id);
      return p && p.de === 'inimigo' ? { som: 'projetil', pos: { x: p.pos.x, z: p.pos.z }, y: p.y } : null;
    }
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
      return SONS_DE_GATILHO.has(e.id) ? { som: e.id as NomeSom, pos: null } : null;
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

export const LIMITE = { intervaloMs: 30, porQuadro: 3, vozes: 24 } as const;

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

  constructor(private readonly limite: number = LIMITE.vozes) {}

  get tamanho(): number {
    return this.vozes.length;
  }

  /** Registra a voz nova; devolve a voz que precisa ser cortada para abrir vaga, ou `null`. */
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
