import type { CarregamentoAssets } from '../engine/carregamentoAssets';
import { laco, type Bancada, type Laco } from './sintese';

export const ARQUIVO_TRILHA = '/audio/musica/scp-terror-containment.mp3';

/** Decodifica a faixa no loading; só cria a saída após o gesto que inicia o áudio. */
export class AcervoTrilha {
  readonly pronto: Promise<void>;
  private buffer: AudioBuffer | null = null;
  private readonly abortar = new AbortController();
  private descartado = false;

  constructor(carregamento: CarregamentoAssets) {
    this.pronto = this.carregar();
    carregamento.acompanhar('Trilha sonora SCP Terror', this.pronto);
  }

  criar(b: Bancada, destino: AudioNode): Laco | null {
    if (this.descartado || !this.buffer) return null;
    const fonte = b.ctx.createBufferSource(); fonte.buffer = this.buffer; fonte.loop = true;
    const saida = b.ctx.createGain(); fonte.connect(saida);
    const loop = laco(b.ctx, destino, [fonte], saida, 0);
    fonte.addEventListener('ended', () => fonte.disconnect(), { once: true });
    return loop;
  }

  dispose(): void { this.descartado = true; this.abortar.abort(); this.buffer = null; }

  private async carregar(): Promise<void> {
    const resposta = await fetch(ARQUIVO_TRILHA, { signal: this.abortar.signal });
    if (!resposta.ok) throw new Error('Trilha sonora indisponível.');
    const dados = await resposta.arrayBuffer();
    if (this.descartado || typeof window === 'undefined') return;
    const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
    const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
    if (!Ctor) return;
    const buffer = await new Ctor(2, 1, 44100).decodeAudioData(dados);
    if (!this.descartado) this.buffer = buffer;
  }
}
