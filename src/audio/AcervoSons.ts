import type { CarregamentoAssets } from '../engine/carregamentoAssets';
import { ARMAS } from '../sim/balance';
import type { NomeSom } from './regras';
import { iniciar, type Sintese } from './sintese';

export const ARQUIVOS_SOM = {
  tiroPistola: '/audio/pistola/tiro.mp3',
  municaoPistola: '/audio/pistola/municao.mp3',
  tiroEscopeta: '/audio/escopeta/tiro.mp3',
  recargaEscopeta: '/audio/escopeta/recarga.mp3',
  recuperarVida: '/audio/itens/recuperar-vida.mp3',
  pegarColete: '/audio/itens/pegar-colete.mp3',
  tiroSmg: '/audio/smg/tiro.mp3',
  disparoLancador: '/audio/lancador/tiro.mp3',
  pegarCartao: '/audio/itens/cartao.mp3',
  portaMotor: '/audio/portas/movimento.mp3?v=2',
  portaNegada: '/audio/portas/negada.mp3',
  portaDesbloqueada: '/audio/portas/desbloqueio.mp3',
  doutorAtaque: '/audio/medico/ataque.mp3',
  doutorMorte: '/audio/medico/morte.mp3',
  chefeDistante: '/audio/chefe/grito-distante.mp3',
  explosao: '/audio/lancador/impacto.mp3',
  sireneCurta: '/audio/sirene/alarme.mp3',
} as const;
type ArquivoSom = keyof typeof ARQUIVOS_SOM;

/** O ciclo ocupa 92% da cadência: 27% de antecipação e 65% para o engatilhamento. */
export function temposEscopeta() {
  const cadencia = ARMAS.escopeta.cadencia;
  return { atraso: cadencia * .27, duracao: cadencia * .65 };
}

/** Decodifica no loading, sem abrir uma saída de áudio antes do gesto do usuário. */
export class AcervoSons {
  readonly pronto: Promise<void>;
  private readonly sons = new Map<NomeSom, Sintese>();
  private readonly buffers = new Map<ArquivoSom, AudioBuffer>();
  private readonly recargas = new Set<AudioBufferSourceNode>();
  private sirene: AudioBufferSourceNode | null = null;
  private readonly abortar = new AbortController();
  private descartado = false;

  constructor(carregamento: CarregamentoAssets) {
    let decodificador: OfflineAudioContext | null = null;
    if (typeof window !== 'undefined') {
      const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
      const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
      if (Ctor) { try { decodificador = new Ctor(2, 1, 44100); } catch { /* navegador sem decodificação offline */ } }
    }
    const tarefas = Object.entries(ARQUIVOS_SOM).map(([nome, url]) => {
      const tarefa = this.carregar(nome as ArquivoSom, url, decodificador);
      carregamento.acompanhar(`Áudio ${nome}`, tarefa);
      return tarefa;
    });
    this.pronto = Promise.allSettled(tarefas).then(() => {});
  }
  obter(nome: NomeSom): Sintese | undefined { return this.sons.get(nome); }
  private async carregar(nome: ArquivoSom, url: string, decodificador: OfflineAudioContext | null): Promise<void> {
    const resposta = await fetch(url, { signal: this.abortar.signal });
    if (!resposta.ok) throw new Error(`Áudio indisponível: ${url}`);
    const dados = await resposta.arrayBuffer();
    if (!decodificador || this.descartado) return;
    const buffer = await decodificador.decodeAudioData(dados);
    if (this.descartado) return;
    this.buffers.set(nome, buffer);
    const som: Sintese = (b, destino, t) => {
      if (nome === 'sireneCurta') this.cancelarSirene();
      const fonte = b.ctx.createBufferSource(); fonte.buffer = buffer; fonte.connect(destino);
      fonte.loop = false;
      if (nome === 'sireneCurta') {
        this.sirene = fonte;
        fonte.onended = () => { if (this.sirene === fonte) this.sirene = null; };
      }
      return [iniciar(b, fonte, t, t + buffer.duration)];
    };
    if (nome !== 'recargaEscopeta') this.sons.set(nome, som);
    else this.sons.set('municaoEscopeta', som);
    this.prepararEscopeta();
  }
  private prepararEscopeta(): void {
    const tiro = this.buffers.get('tiroEscopeta'), recarga = this.buffers.get('recargaEscopeta');
    if (!tiro || !recarga) return;
    this.sons.set('tiroEscopeta', (b, destino, t) => {
      this.cancelarRecarga();
      const tempos = temposEscopeta();
      const disparo = b.ctx.createBufferSource(); disparo.buffer = tiro; disparo.connect(destino);
      iniciar(b, disparo, t, t + tiro.duration);
      const bomba = b.ctx.createBufferSource(); bomba.buffer = recarga; bomba.connect(destino);
      bomba.playbackRate.value = recarga.duration / tempos.duracao;
      iniciar(b, bomba, t + tempos.atraso, t + tempos.atraso + tempos.duracao);
      this.recargas.add(bomba);
      bomba.addEventListener('ended', () => this.recargas.delete(bomba), { once: true });
      return [disparo, bomba];
    });
  }
  cancelarRecarga(): void {
    for (const fonte of this.recargas) {
      try { fonte.stop(); fonte.disconnect(); } catch { /* contexto fechado */ }
    }
    this.recargas.clear();
  }
  cancelarSirene(): void {
    try { this.sirene?.stop(); this.sirene?.disconnect(); } catch { /* contexto fechado */ }
    this.sirene = null;
  }
  dispose(): void { this.descartado = true; this.cancelarRecarga(); this.cancelarSirene(); this.abortar.abort(); this.sons.clear(); this.buffers.clear(); }
}
