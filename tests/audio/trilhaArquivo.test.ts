import { afterEach, expect, it, vi } from 'vitest';
import { AcervoTrilha, ARQUIVO_TRILHA } from '../../src/audio/AcervoTrilha';
import { CarregamentoAssets } from '../../src/engine/carregamentoAssets';
import type { Bancada } from '../../src/audio/sintese';

afterEach(() => vi.unstubAllGlobals());

it('aguarda a decodificação no loading e reproduz a faixa em loop no barramento de música', async () => {
  const buffer = { duration: 120 } as AudioBuffer;
  let resolver!: (b: AudioBuffer) => void;
  vi.stubGlobal('window', { OfflineAudioContext: class { decodeAudioData() { return new Promise<AudioBuffer>(r => { resolver = r; }); } } });
  const fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })); vi.stubGlobal('fetch', fetch);
  const lote = new CarregamentoAssets(), acervo = new AcervoTrilha(lote); lote.fechar();
  const pronto = vi.fn(); void lote.pronto.then(pronto);
  await vi.waitFor(() => expect(resolver).toBeTypeOf('function'));
  expect(pronto).not.toHaveBeenCalled(); resolver(buffer);
  await lote.pronto; expect(fetch).toHaveBeenCalledWith(ARQUIVO_TRILHA, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  const fonte = { buffer: null, loop: false, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn() };
  const saida = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: .3, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() } };
  const b = { ctx: { currentTime: 2, createBufferSource: () => fonte, createGain: () => saida } } as unknown as Bancada;
  const musica = {} as AudioNode, loop = acervo.criar(b, musica)!;
  expect(fonte.buffer).toBe(buffer); expect(fonte.loop).toBe(true);
  expect(fonte.start).toHaveBeenCalledOnce(); expect(saida.connect).toHaveBeenCalledWith(musica);
  loop.parar(5, .4); loop.parar(6);
  expect(fonte.stop).toHaveBeenCalledExactlyOnceWith(5.42);
  acervo.dispose(); expect(acervo.criar(b, musica)).toBeNull();
});

it('informa ao loading quando a trilha não pode ser baixada', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const lote = new CarregamentoAssets(), acervo = new AcervoTrilha(lote); lote.fechar();
  await expect(lote.pronto).rejects.toThrow('arquivos do jogo');
  await expect(acervo.pronto).rejects.toThrow('Trilha sonora'); acervo.dispose();
});
