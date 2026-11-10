// Som da fase carregada: cama de ambiente, drone de tensão, alarme, o lamento posicional do chefe
// inerte e os sons dos eventos do quadro. Quais laços tocam vem de `lacosDaFase` (fase concluída:
// nenhum, com rampa de FADE_FIM; os sons avulsos, como o de conclusão, continuam).
// Só lê o World; nasce e morre junto com a fase. Antes de o mixer ter contexto, não faz nada.
import { solidoDe } from '../sim/doors';
import type { SimEvent } from '../sim/eventos';
import type { LevelDef } from '../sim/fase';
import type { World } from '../sim/world';
import { LamentoChefe } from './lamentoChefe';
import type { Mixer } from './Mixer';
import { atualizarOuvinte, criarCadeiaPosicional } from './posicional';
import {
  audivel, lacosDaFase, lamentoDoChefe, LimitadorSons, ocluido, somDoEvento, type NomeSom, type Ouvinte,
} from './regras';
import * as S from './sintese';
import * as C from './sinteseCenario';
import * as CH from './sinteseChefe';

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
  sireneCurta: C.sireneCurta, estalo: C.estalo,
};

/** s entre dois testes de oclusão do lamento (raio na grade) */
const OCLUSAO_LAMENTO = 0.25;

/** ganho do drone com tensão 0 e 1 */
const DRONE_MIN = 0.03;
const DRONE_MAX = 0.6;
/** suavização do drone (constante de tempo, s) */
const DRONE_SUAVE = 0.8;
/** a tensão precisa mudar isto para reagendar o ganho */
const DRONE_PASSO = 0.01;
/** rampa (s) dos laços que param porque a fase terminou */
const FADE_FIM = 0.4;

export class SomDaFase {
  private readonly limitador = new LimitadorSons();
  private ctx: AudioContext | null = null;
  private ambiente: S.Laco | null = null;
  private drone: S.Laco | null = null;
  private alarme: S.Laco | null = null;
  private lamento: LamentoChefe | null = null;
  private lamentoTestadoEm = -Infinity;
  private tensaoAplicada = -1;
  private descartado = false;

  constructor(
    private readonly mixer: Mixer,
    private readonly fase: LevelDef,
  ) {}

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
      // suspenso (pausa, aba oculta): nem ouvinte (automação acumulada) nem sons para tocar todos de uma vez depois
      if (ctx.state !== 'running') return;
      atualizarOuvinte(ctx, ouvinte);
      this.limitador.novoQuadro(ctx.currentTime * 1000);
      for (const e of eventos) this.tocarEvento(ctx, world, e, ouvinte);
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
    } catch {
      /* contexto já fechado */
    }
    this.lamento = null;
    this.ctx = null;
  }

  /** Contexto novo: os laços do antigo morreram com ele; são refeitos sob demanda (`seguir*`). */
  private trocarContexto(b: S.Bancada): void {
    this.ctx = b.ctx;
    this.tensaoAplicada = -1;
    this.ambiente = this.drone = this.alarme = null;
    this.lamento?.parar();
    this.lamento = null;
  }

  private seguirAmbiente(b: S.Bancada, efeitos: GainNode, ligado: boolean, rampa?: number): void {
    if (ligado && !this.ambiente) {
      if (this.fase.ambiente.somDeFundo === 'zumbido') {
        this.ambiente = S.zumbido(b, efeitos, S.criarRuidoRosa(b.ctx));
      } else if (this.fase.ambiente.somDeFundo === 'ventilacao') {
        this.ambiente = C.ventilacao(b, efeitos, S.criarRuidoRosa(b.ctx));
      }
    } else if (!ligado && this.ambiente) {
      this.ambiente.parar(b.ctx.currentTime, rampa);
      this.ambiente = null;
    }
  }

  private seguirDrone(b: S.Bancada, musica: GainNode, ligado: boolean, rampa?: number): void {
    if (ligado && !this.drone) {
      this.drone = S.drone(b, musica);
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
    if (t - this.lamentoTestadoEm >= OCLUSAO_LAMENTO) {
      this.lamentoTestadoEm = t;
      this.lamento.abafar(ocluido(world.grid, ouvinte, alvo.pos, solidoDe(world)));
    }
  }

  private tocarEvento(ctx: AudioContext, world: World, e: SimEvent, ouvinte: Ouvinte): void {
    const p = somDoEvento(e, world);
    if (!p) return;
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
