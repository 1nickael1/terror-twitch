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
export interface InimigoDef { em: Onde; tipo: string; grupo?: string; patrulha?: Coord[]; dormindo?: boolean; yaw?: number }
export type Area = readonly [col: number, row: number, larg: number, alt: number];
export type Condicao =
  | { tipo: 'area'; area: Area }
  | { tipo: 'pickup'; indice: number }
  | { tipo: 'grupo_morto'; grupo: string }
  | { tipo: 'terminal'; id: string }
  | { tipo: 'chefe_vida'; abaixo: number };
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
export interface PropDef { em: Coord; tipo: string; yaw?: number }
export interface DecalDef { em: Coord; tipo: 'sangue' | 'queimado' | 'marca'; parede?: 'n' | 's' | 'l' | 'o' }
export interface AmbienteDef { nevoa: number; corNevoa: number; ambiente: number; somDeFundo: string; musica: string }
export interface LevelDef {
  id: string; nome: string; planta: string; legenda: Record<string, CelulaDef>; spawnYaw: number;
  arsenal: { armas: ArmaId[]; municao: Partial<Record<TipoMunicao, number>> };
  portas: PortaDef[]; pickups: PickupDef[]; inimigos: InimigoDef[]; gatilhos: GatilhoDef[];
  terminais: TerminalDef[]; documentos: DocumentoDef[]; segredos: SegredoDef[];
  checkpoints: Coord[]; saida: Coord;
  luzes: LuzDef[]; props: PropDef[]; decals: DecalDef[]; ambiente: AmbienteDef;
}
