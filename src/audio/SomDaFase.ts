// Som da fase carregada: cama de ambiente, drone de tensão, alarme, o lamento posicional do chefe
// inerte, os laços posicionais dos perigos de área ligados (zumbido da UV, jato de vapor) e os sons
// dos eventos do quadro. Quais laços tocam vem de `lacosDaFase` e `lacosDePerigo` (fase concluída:
// nenhum, com rampa de FADE_FIM; os sons avulsos, como o de conclusão, continuam). Cada laço
// tocando ocupa uma vaga do limite de vozes (`Mixer.reservarLacos`).
// Só lê o World; nasce e morre junto com a fase. Antes de o mixer ter contexto, não faz nada.
import { solidoDe } from '../sim/doors';
import type { SimEvent } from '../sim/eventos';
import type { LevelDef } from '../sim/fase';
import type { World } from '../sim/world';
import { LacoPosicional, LamentoChefe } from './lamentoChefe';
import type { Mixer } from './Mixer';
import { atualizarOuvinte, criarCadeiaPosicional } from './posicional';
import {
  audivel, contarLacos, lacosDaFase, lacosDePerigo, lamentoDoChefe, LimitadorSons, ocluido, somDoEvento,
  type LacoPerigo, type LacosDaFase, type NomeSom, type Ouvinte, type PedidoSom,
} from './regras';
import * as S from './sintese';
import * as C from './sinteseCenario';
import * as CH from './sinteseChefe';
import * as F2 from './sinteseFase2';
import { trilha } from './trilha';
import * as D from './sinteseDoutor';
import { PassosDoutor } from './passosDoutor';

const SONS: Record<NomeSom, S.Sintese> = {
  tiroPistola: S.tiroPistola, tiroEscopeta: S.tiroEscopeta, tiroSmg: S.tiroSmg, disparoLancador: S.disparoLancador,
  explosao: S.explosao, impactoParede: S.impactoParede, impactoCarne: S.impactoCarne,
  passo: S.passo, pulo: S.pulo, pouso: S.pouso, portaMotor: S.portaMotor, portaBaque: S.portaBaque,
  portaNegada: S.portaNegada, pickup: S.pickup, armaTrocada: S.armaTrocada, semMunicao: S.semMunicao,
  dorJogador: S.dorJogador, grunhidoAlerta: S.grunhidoAlerta, grunhidoAtaque: S.grunhidoAtaque,
  dorInimigo: S.dorInimigo, morteInimigo: S.morteInimigo, projetil: S.projetil, bip: S.bip,
  bipDiscreto: S.bipDiscreto, checkpoint: S.checkpoint, segredo: S.segredo, morteJogador: S.morteJogador,
  faseConcluida: S.faseConcluida,
  chefeDesperta: CH.chefeDesperta, chefeArromba: CH.chefeArromba, chefeInvestida: CH.chefeInvestida,
  chefeGolpe: CH.chefeGolpe, chefeMorto: CH.chefeMorto, chefePasso: CH.chefePasso,
  comportaFecha: CH.comportaFecha, comportaAbre: CH.comportaAbre, comportaRecusa: CH.comportaRecusa,
  sireneCurta: C.sireneCurta, estalo: C.estalo, gaveta: F2.gaveta, elevador: F2.elevador,
  gemido: F2.gemido, levantar: F2.levantar, frascoArremesso: F2.frascoArremesso, vidroQuebra: F2.vidroQuebra,
  chefe049Desperta: F2.chefe049Desperta, chefe049Passo: F2.chefe049Passo, chefeToque: F2.chefeToque,
  chefeReanima: F2.chefeReanima, chefeApressa: F2.chefeApressa, chefe049Morto: F2.chefe049Morto,
  uvAviso: F2.uvAviso, uvLiga: F2.uvLiga, vaporAviso: F2.vaporAviso, vaporLiga: F2.vaporLiga,
  perigoRecusa: F2.perigoRecusa,
  doutorAlerta: D.doutorAlerta, doutorAtaque: D.doutorAtaque, doutorDor: D.doutorDor, doutorMorte: D.doutorMorte, doutorPasso: D.doutorPasso,
};

/** Laço de cada tipo de perigo de área. */
const LACO_PERIGO: Record<LacoPerigo['tipo'], (b: S.Bancada, destino: AudioNode) => S.Laco> = {
  ultravioleta: F2.uvZumbido,
  vapor: F2.vaporJato,
};

function contemId(lista: readonly LacoPerigo[], id: string): boolean {
  for (let k = 0; k < lista.length; k++) if (lista[k].id === id) return true;
  return false;
}

/** s entre dois testes de oclusão dos laços posicionais (raio na grade) */
const OCLUSAO_LACO = 0.25;

/** ganho do drone com tensão 0 e 1 */
const DRONE_MIN = 0.18;
const DRONE_MAX = 0.7;
/** suavização do drone (constante de tempo, s) */
const DRONE_SUAVE = 0.8;
/** a tensão precisa mudar isto para reagendar o ganho */
const DRONE_PASSO = 0.01;
/** rampa (s) dos laços que param porque a fase terminou */
const FADE_FIM = 0.4;
/** rampa (s) do laço de perigo que desliga (a UV apaga, o vapor cessa) */
const RAMPA_PERIGO = 0.25;

export class SomDaFase {
  private readonly limitador = new LimitadorSons();
  private readonly passosDoutor = new PassosDoutor();
  private ctx: AudioContext | null = null;
  private ambiente: S.Laco | null = null;
  private drone: S.Laco | null = null;
  private alarme: S.Laco | null = null;
  private lamento: LamentoChefe | null = null;
  private lamentoTestadoEm = -Infinity;
  /** laços dos perigos de área tocando, por id do perigo */
  private readonly perigos = new Map<string, { laco: LacoPosicional; testadoEm: number }>();
  /** saída reaproveitada de `lacosDePerigo` e o estado dos laços para `contarLacos` (sem alocar por quadro) */
  private readonly alvosPerigo: LacoPerigo[] = [];
  private readonly lacosTocando: LacosDaFase = { ambiente: false, drone: false, alarme: false, lamento: false };
  private readonly temPerigoArea: boolean;
  private tensaoAplicada = -1;
  private descartado = false;

  constructor(
    private readonly mixer: Mixer,
    private readonly fase: LevelDef,
  ) {
    this.temPerigoArea = (fase.chefe?.perigos ?? []).some((p) => p.tipo !== 'comporta');
  }

  sincronizar(world: World, eventos: readonly SimEvent[], ouvinte: Ouvinte): void {
    if (this.descartado) return;
    const b = this.mixer.bancada;
    const efeitos = this.mixer.efeitos;
    const musica = this.mixer.musica;
    if (!b || !efeitos || !musica || b.ctx.state === 'closed') return;
    try {
      if (this.ctx !== b.ctx) this.trocarContexto(b);
      const ctx = b.ctx;
      const lacos = lacosDaFase(world);
      // laço que deixa de valer porque a fase terminou sai com rampa longa; os demais, com a curta
      const rampa = world.estado === 'concluida' ? FADE_FIM : undefined;
      this.seguirAmbiente(b, efeitos, lacos.ambiente, rampa);
      this.seguirDrone(b, musica, lacos.drone, rampa);
      this.seguirTensao(ctx, world.tensao);
      this.seguirAlarme(b, efeitos, lacos.alarme, rampa);
      this.seguirLamento(b, efeitos, world, ouvinte, lacos.lamento, rampa);
      this.seguirPerigos(b, efeitos, world, ouvinte, rampa);
      // cada laço tocando tira uma vaga das vozes avulsas (o total não passa do limite)
      const t = this.lacosTocando;
      t.ambiente = this.ambiente !== null;
      t.drone = this.drone !== null;
      t.alarme = this.alarme !== null;
      t.lamento = this.lamento !== null;
      this.mixer.reservarLacos(contarLacos(t, this.perigos.size));
      // suspenso (pausa, aba oculta): nem ouvinte (automação acumulada) nem sons para tocar todos de uma vez depois
      if (ctx.state !== 'running') return;
      atualizarOuvinte(ctx, ouvinte);
      this.limitador.novoQuadro(ctx.currentTime * 1000);
      for (const e of eventos) this.tocarEvento(ctx, world, e, ouvinte);
      for (const p of this.passosDoutor.atualizar(world)) this.tocarPedido(ctx, world, p, ouvinte);
    } catch {
      /* WebAudio falhou no meio: o jogo segue sem som */
    }
  }

  dispose(): void {
    if (this.descartado) return;
    this.descartado = true;
    const t = this.ctx && this.ctx.state !== 'closed' ? this.ctx.currentTime : 0;
    for (const l of [this.ambiente, this.drone, this.alarme]) {
      try {
        l?.parar(t);
      } catch {
        /* contexto já fechado */
      }
    }
    this.ambiente = this.drone = this.alarme = null;
    try {
      this.lamento?.parar();
      for (const p of this.perigos.values()) p.laco.parar();
    } catch {
      /* contexto já fechado */
    }
    this.lamento = null;
    this.perigos.clear();
    this.ctx = null;
    // sem os laços desta fase, as avulsas voltam a ter todas as vagas
    this.mixer.reservarLacos(0);
  }

  /** Contexto novo: os laços do antigo morreram com ele; são refeitos sob demanda (`seguir*`). */
  private trocarContexto(b: S.Bancada): void {
    this.ctx = b.ctx;
    this.tensaoAplicada = -1;
    this.ambiente = this.drone = this.alarme = null;
    this.lamento?.parar();
    this.lamento = null;
    for (const p of this.perigos.values()) p.laco.parar();
    this.perigos.clear();
  }

  private seguirAmbiente(b: S.Bancada, efeitos: GainNode, ligado: boolean, rampa?: number): void {
    if (ligado && !this.ambiente) {
      const fundo = this.fase.ambiente.somDeFundo;
      if (fundo === 'zumbido') this.ambiente = S.zumbido(b, efeitos, S.criarRuidoRosa(b.ctx));
      else if (fundo === 'ventilacao') this.ambiente = C.ventilacao(b, efeitos, S.criarRuidoRosa(b.ctx));
      else if (fundo === 'hospital') this.ambiente = F2.hospital(b, efeitos, S.criarRuidoRosa(b.ctx));
    } else if (!ligado && this.ambiente) {
      this.ambiente.parar(b.ctx.currentTime, rampa);
      this.ambiente = null;
    }
  }

  private seguirDrone(b: S.Bancada, musica: GainNode, ligado: boolean, rampa?: number): void {
    if (ligado && !this.drone) {
      this.drone = trilha(b, musica, this.fase.ambiente.somDeFundo === 'hospital');
      this.tensaoAplicada = -1;
    } else if (!ligado && this.drone) {
      this.drone.parar(b.ctx.currentTime, rampa);
      this.drone = null;
    }
  }

  private seguirTensao(ctx: AudioContext, tensao: number): void {
    if (!this.drone) return;
    const v = Math.min(1, Math.max(0, tensao));
    if (Math.abs(v - this.tensaoAplicada) < DRONE_PASSO) return;
    this.tensaoAplicada = v;
    const g = this.drone.saida.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(DRONE_MIN + (DRONE_MAX - DRONE_MIN) * v, ctx.currentTime, DRONE_SUAVE);
  }

  private seguirAlarme(b: S.Bancada, efeitos: GainNode, ligado: boolean, rampa?: number): void {
    if (ligado && !this.alarme) this.alarme = S.alarme(b, efeitos);
    else if (!ligado && this.alarme) {
      this.alarme.parar(b.ctx.currentTime, rampa);
      this.alarme = null;
    }
  }

  /** Lamento do chefe enquanto ele está inerte: nasce, acompanha a posição e a oclusão, e para. */
  private seguirLamento(b: S.Bancada, efeitos: GainNode, world: World, ouvinte: Ouvinte, ligado: boolean, rampa?: number): void {
    const alvo = ligado ? lamentoDoChefe(world) : null;
    if (!alvo) {
      this.lamento?.parar(rampa);
      this.lamento = null;
      return;
    }
    if (!this.lamento) {
      this.lamento = new LamentoChefe(b, efeitos, alvo.pos.x, alvo.y, alvo.pos.z);
      this.lamentoTestadoEm = -Infinity;
    }
    this.lamento.mover(alvo.pos.x, alvo.y, alvo.pos.z);
    const t = b.ctx.currentTime;
    if (t - this.lamentoTestadoEm >= OCLUSAO_LACO) {
      this.lamentoTestadoEm = t;
      this.lamento.abafar(ocluido(world.grid, ouvinte, alvo.pos, solidoDe(world)));
    }
  }

  /** Laços dos perigos de área ligados (os mais próximos): nascem no `liga`, param no `desliga`. */
  private seguirPerigos(b: S.Bancada, efeitos: GainNode, world: World, ouvinte: Ouvinte, rampa?: number): void {
    // fase sem perigo de área nem laço tocando: nada a fazer (nem alocar)
    if (!this.temPerigoArea && this.perigos.size === 0) return;
    // quem já toca tem histerese (não é recriado na borda do alcance nem num empate)
    const alvos = lacosDePerigo(world, ouvinte, this.perigos, this.alvosPerigo);
    for (const [id, p] of this.perigos) {
      if (contemId(alvos, id)) continue;
      p.laco.parar(rampa ?? RAMPA_PERIGO);
      this.perigos.delete(id);
    }
    const t = b.ctx.currentTime;
    for (const a of alvos) {
      let p = this.perigos.get(a.id);
      if (!p) {
        p = { laco: new LacoPosicional(b, efeitos, a.pos.x, a.y, a.pos.z, LACO_PERIGO[a.tipo]), testadoEm: -Infinity };
        this.perigos.set(a.id, p);
      }
      if (t - p.testadoEm >= OCLUSAO_LACO) {
        p.testadoEm = t;
        p.laco.abafar(ocluido(world.grid, ouvinte, a.pos, solidoDe(world)));
      }
    }
  }

  private tocarEvento(ctx: AudioContext, world: World, e: SimEvent, ouvinte: Ouvinte): void {
    const p = somDoEvento(e, world);
    if (!p) return;
    this.tocarPedido(ctx, world, p, ouvinte);
  }

  private tocarPedido(ctx: AudioContext, world: World, p: PedidoSom, ouvinte: Ouvinte): void {
    let cadeia: AudioNode[] = [];
    if (p.pos) {
      // distância, limitador e só então a visibilidade (a mais cara)
      const y = p.y ?? ouvinte.y;
      if (!audivel(ouvinte, p.pos, y)) return;
      if (!this.limitador.permitir(p.som)) return;
      const abafado = ocluido(world.grid, ouvinte, p.pos, solidoDe(world), p.celulaPorta);
      cadeia = criarCadeiaPosicional(ctx, p.pos.x, y, p.pos.z, abafado);
    } else if (!this.limitador.permitir(p.som)) return;
    this.mixer.tocar(SONS[p.som], cadeia);
  }
}
