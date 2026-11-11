import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcervoSons, temposEscopeta } from '../../src/audio/AcervoSons';
import { ARMAS } from '../../src/sim/balance';
import { CarregamentoAssets } from '../../src/engine/carregamentoAssets';
import type { Bancada } from '../../src/audio/sintese';

function preparar() {
  const resolver: Array<(b: AudioBuffer) => void> = [];
  class Decoder {
    decodeAudioData = vi.fn(() => new Promise<AudioBuffer>(r => resolver.push(r)));
  }
  vi.stubGlobal('window', { OfflineAudioContext: Decoder });
  const fetch = vi.fn<(url: string, opcoes?: RequestInit) => Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>>()
    .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  vi.stubGlobal('fetch', fetch);
  const lote = new CarregamentoAssets(), acervo = new AcervoSons(lote); lote.fechar();
  return { resolver, fetch, lote, acervo };
}
afterEach(() => vi.unstubAllGlobals());
describe('arquivos de áudio fornecidos pelo usuário', () => {
  it('baixa e decodifica no loading antes de liberar os sons, sem criar uma saída de áudio', async () => {
    const a = preparar(), pronto = vi.fn(); void a.lote.pronto.then(pronto);
    await vi.waitFor(() => expect(a.resolver).toHaveLength(17));
    expect(pronto).not.toHaveBeenCalled();
    const tiro = { duration: 1.968 } as AudioBuffer, coleta = { duration: .84 } as AudioBuffer;
    a.resolver[0](tiro); a.resolver[1](coleta);
    a.resolver[2]({ duration: 2.686 } as AudioBuffer); a.resolver[3]({ duration: .6 } as AudioBuffer);
    a.resolver[4]({ duration: 1 } as AudioBuffer); a.resolver[5]({ duration: 1 } as AudioBuffer);
    const smg = { duration: .81 } as AudioBuffer, lancador = { duration: 2.5 } as AudioBuffer;
    a.resolver[6](smg); a.resolver[7](lancador);
    for (const resolver of a.resolver.slice(8)) resolver({ duration: 1 } as AudioBuffer);
    await a.acervo.pronto; await a.lote.pronto;
    expect(a.acervo.obter('recuperarVida')).toBeTypeOf('function');
    expect(a.acervo.obter('pegarColete')).toBeTypeOf('function');
    for (const som of ['pegarCartao', 'portaMotor', 'portaNegada', 'portaDesbloqueada', 'doutorAtaque', 'doutorMorte', 'chefeDistante', 'explosao', 'sireneCurta'] as const) expect(a.acervo.obter(som)).toBeTypeOf('function');
    expect(a.fetch.mock.calls.map(c => c[0])).toEqual(['/audio/pistola/tiro.mp3', '/audio/pistola/municao.mp3', '/audio/escopeta/tiro.mp3', '/audio/escopeta/recarga.mp3', '/audio/itens/recuperar-vida.mp3', '/audio/itens/pegar-colete.mp3', '/audio/smg/tiro.mp3', '/audio/lancador/tiro.mp3', '/audio/itens/cartao.mp3', '/audio/portas/movimento.mp3?v=2', '/audio/portas/negada.mp3', '/audio/portas/desbloqueio.mp3', '/audio/medico/ataque.mp3', '/audio/medico/morte.mp3', '/audio/chefe/grito-distante.mp3', '/audio/lancador/impacto.mp3', '/audio/sirene/alarme.mp3']);
    const fontes: Array<{ buffer: AudioBuffer | null; connect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
    const b = { ctx: { createBufferSource: () => {
      const fonte = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; fontes.push(fonte); return fonte;
    } }, coletor: [], ruido: tiro } as unknown as Bancada;
    const destino = {} as AudioNode;
    const somTiro = a.acervo.obter('tiroPistola')!, somColeta = a.acervo.obter('municaoPistola')!;
    expect(a.acervo.obter('tiroSmg')).not.toBe(somTiro);
    const somCartuchos = a.acervo.obter('municaoEscopeta')!;
    expect(somTiro(b, destino, 4)).toHaveLength(1); expect(somColeta(b, destino, 6)).toHaveLength(1);
    expect(fontes[0].buffer).toBe(tiro); expect(fontes[1].buffer).toBe(coleta);
    expect(fontes[0].connect).toHaveBeenCalledWith(destino); expect(fontes[0].start).toHaveBeenCalledWith(4, undefined);
    expect(fontes[0].stop).toHaveBeenCalledWith(5.968); expect(b.coletor).toHaveLength(2);
    expect(somCartuchos(b, destino, 8)).toHaveLength(1);
    expect(fontes[2].buffer).toEqual({ duration: .6 });
    expect(fontes[2].start).toHaveBeenCalledWith(8, undefined);
    expect(fontes[2].stop).toHaveBeenCalledWith(8.6);
    a.acervo.obter('tiroSmg')!(b, destino, 10);
    a.acervo.obter('disparoLancador')!(b, destino, 12);
    expect(fontes[3].buffer).toBe(smg); expect(fontes[4].buffer).toBe(lancador);
    expect(fontes[3].start).toHaveBeenCalledWith(10, undefined);
    expect(fontes[4].start).toHaveBeenCalledWith(12, undefined);
    const sirene = a.acervo.obter('sireneCurta')!;
    sirene(b, destino, 20);
    expect(fontes[5]).toMatchObject({ loop: false });
    expect(fontes[5].start).toHaveBeenCalledWith(20, undefined);
    expect(fontes[5].stop).toHaveBeenCalledWith(21);
    sirene(b, destino, 22);
    expect(fontes[5].stop).toHaveBeenLastCalledWith();
    expect(fontes[6]).toMatchObject({ loop: false });
    a.acervo.dispose();
  });
  it('não repõe buffers quando a decodificação termina depois de sair do jogo', async () => {
    const a = preparar(); await vi.waitFor(() => expect(a.resolver).toHaveLength(17));
    a.acervo.dispose(); a.lote.cancelar();
    for (const resolver of a.resolver) resolver({ duration: 1 } as AudioBuffer);
    await a.acervo.pronto; expect(a.acervo.obter('tiroPistola')).toBeUndefined();
    await expect(a.lote.pronto).rejects.toThrow('cancelado');
  });
  it('sinaliza arquivo ausente ao loading', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const lote = new CarregamentoAssets(), acervo = new AcervoSons(lote); lote.fechar();
    await expect(lote.pronto).rejects.toThrow('arquivos do jogo'); await acervo.pronto; acervo.dispose();
  });
  it('agenda tiro imediato e engatilhamento dentro do cooldown, com cancelamento da recarga', async () => {
    const a = preparar(); await vi.waitFor(() => expect(a.resolver).toHaveLength(17));
    const duracoes = [1.968, .84, 2.686, .6, 1, 1, .81, 2.5, 1, 1, 1, 1, 1.36, 2.13, 6.35, 1.52, 10.056];
    a.resolver.forEach((r, i) => r({ duration: duracoes[i] } as AudioBuffer)); await a.acervo.pronto; await a.lote.pronto;
    const fontes: Array<{ buffer: AudioBuffer | null; playbackRate: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn> }> = [];
    const b = { ctx: { createBufferSource: () => {
      const fonte = { buffer: null, playbackRate: { value: 1 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn() };
      fontes.push(fonte); return fonte;
    } }, coletor: [], ruido: {} as AudioBuffer } as unknown as Bancada;
    const tempo = temposEscopeta();
    const som = a.acervo.obter('tiroEscopeta')!;
    expect(som(b, {} as AudioNode, 10)).toHaveLength(2);
    expect(fontes[0].start).toHaveBeenCalledWith(10, undefined);
    expect(fontes[1].start.mock.calls[0][0]).toBeCloseTo(10.243, 5);
    expect(fontes[1].stop.mock.calls[0][0]).toBeCloseTo(10.828, 5);
    expect(fontes[1].playbackRate.value).toBeCloseTo(.6 / tempo.duracao, 5);
    expect(tempo.atraso + tempo.duracao).toBeLessThan(ARMAS.escopeta.cadencia);
    expect(b.coletor).toHaveLength(2);
    a.acervo.cancelarRecarga();
    expect(fontes[1].stop).toHaveBeenLastCalledWith(); expect(fontes[1].disconnect).toHaveBeenCalledOnce();
    expect(fontes[0].disconnect).not.toHaveBeenCalled();
    a.acervo.dispose();
  });
});
