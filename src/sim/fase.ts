// Tipos de dados de fase (só tipos, sem lógica).
import type { CelulaDef, Coord } from './grid';

/** Coordenada, ou símbolo que aparece uma única vez na planta. */
export type Onde = Coord | string;
export type NivelCartao = 1 | 2 | 3;
export type ArmaId = 'pistola' | 'escopeta' | 'smg' | 'lancador';
export type TipoMunicao = 'balas' | 'cartuchos' | 'leves' | 'capsulas';
export interface PortaDef { id: string; em: Onde; exige?: NivelCartao; trancada?: boolean }
export type PickupTipo = 'vida_p' | 'vida_g' | 'colete_p' | 'colete_g' | 'municao' | 'arma' | 'cartao';
export interface PickupDef { em: Onde; tipo: PickupTipo; municao?: TipoMunicao; quantidade?: number; arma?: ArmaId; nivel?: NivelCartao }
export interface InimigoDef {
  em: Onde; tipo: string; grupo?: string; patrulha?: Coord[]; dormindo?: boolean; yaw?: number;
  corpo?: boolean;       // começa morto no chão (só tipo `reanimavel`; regra na C3.2)
}
export type Area = readonly [col: number, row: number, larg: number, alt: number];
export type Condicao =
  | { tipo: 'area'; area: Area }
  | { tipo: 'pickup'; indice: number }
  | { tipo: 'grupo_morto'; grupo: string }
  | { tipo: 'terminal'; id: string }
  | { tipo: 'chefe_vida'; abaixo: number }   // vida/vidaMax do chefe < abaixo (sem chefe, nunca)
  | { tipo: 'chefe_morto' }
  | { tipo: 'tempo'; apos: number; desde: string };   // `apos` s depois de o gatilho `desde` disparar (World.relogio)
export type Acao =
  | { acao: 'porta'; id: string; estado: 'abrir' | 'fechar' | 'trancar' | 'destrancar' }
  | { acao: 'spawn'; inimigos: InimigoDef[] }
  | { acao: 'alarme'; ligado: boolean }
  | { acao: 'luz'; grupo: string; ligada: boolean }
  | { acao: 'som'; id: string }
  | { acao: 'mensagem'; texto: string }
  | { acao: 'chefe' }
  | { acao: 'perigo'; id: string }
  | { acao: 'checkpoint' }
  | { acao: 'teleporte'; para: Coord; yaw?: number }
  | { acao: 'cronometro'; segundos: number };
export interface GatilhoDef { id: string; quando: Condicao; faz: Acao[]; umaVez?: boolean }
export interface TerminalDef { id: string; em: Onde; rotulo: string }
export interface DocumentoDef { id: string; em: Onde; titulo: string; texto: string }
export interface SegredoDef { id: string; area: Area }
export interface LuzDef { em: Coord; cor: number; intensidade: number; grupo?: string; pisca?: number; altura?: number }
export type TipoProp =
  | 'mesa' | 'cadeira' | 'armario' | 'caixa' | 'maca' | 'cama' | 'placa' | 'lixeira'
  | 'gavetas' | 'cortina' | 'autoclave' | 'carrinho' | 'lampada_uv';
export interface PropDef { em: Coord; tipo: TipoProp; yaw?: number; texto?: string; parede?: 'n' | 's' | 'l' | 'o' }
/** `faixa`: listras diagonais de perigo, alinhadas à célula e do tamanho dela (sem giro nem escala aleatória). */
export interface DecalDef { em: Coord; tipo: 'sangue' | 'queimado' | 'marca' | 'faixa'; parede?: 'n' | 's' | 'l' | 'o' }
/** Revestimento das paredes (C3.5, correção 1): `escritorio` = o concreto de sempre (fase 1); `azulejo` = azulejo verde-hospital. */
export type Revestimento = 'escritorio' | 'azulejo';
export interface AmbienteDef {
  nevoa: number; corNevoa: number; ambiente: number; somDeFundo: string; musica: string;
  revestimento?: Revestimento;   // ausente = 'escritorio'
}
export type PerigoDef = PerigoComporta | PerigoArea;
/** Comporta: fecha células por `duracao` s e fere uma vez quem está no vão. */
export interface PerigoComporta {
  id: string;
  tipo: 'comporta';
  area: Area;            // células fechadas pela comporta
  duracao: number;       // s fechada (as células ficam sólidas)
  recarga: number;       // s desde o acionamento até poder usar de novo
  danoChefe: number;     // fração da vidaMax do chefe (0..1), uma vez por acionamento
  danoComum: number;     // dano em inimigos comuns e no jogador no vão, uma vez por acionamento
}
/** Perigo de área: depois do aviso, fere por segundo quem está na área, sem bloquear células. */
export interface PerigoArea {
  id: string;
  tipo: 'ultravioleta' | 'vapor';
  area: Area;
  aviso: number;           // s entre o acionamento e o início do dano (luz piscando / chiado subindo)
  duracao: number;         // s ferindo, depois do aviso
  recarga: number;         // s desde o acionamento até poder usar de novo
  danoChefePorSeg: number; // fração da vidaMax do chefe por segundo
  danoPorSeg: number;      // inimigos comuns (vivos, inclusive reanimados) e jogador, por segundo
}
export interface ChefeDef {
  tipo: string;          // chave em TIPOS (fase 1: 'entidade096')
  nome: string;          // nome na barra de vida (fase 1: 'SCP-096')
  em: Onde; yaw: number;
  arena: Area;
  retomada: Onde;        // onde reaparece ao restaurar um checkpoint com ele acordado
  perigos: PerigoDef[];
}
export interface LevelDef {
  id: string; nome: string; planta: string; legenda: Record<string, CelulaDef>; spawnYaw: number;
  arsenal: { armas: ArmaId[]; municao: Partial<Record<TipoMunicao, number>> };
  portas: PortaDef[]; pickups: PickupDef[]; inimigos: InimigoDef[]; gatilhos: GatilhoDef[];
  terminais: TerminalDef[]; documentos: DocumentoDef[]; segredos: SegredoDef[];
  checkpoints: Coord[]; saida: Coord;
  luzes: LuzDef[]; props: PropDef[]; decals: DecalDef[]; ambiente: AmbienteDef;
  chefe?: ChefeDef;
}
