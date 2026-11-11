import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarregamentoAssets } from '../../src/engine/carregamentoAssets';
import { EngineStore } from '../../src/components/engineStore';
import type { VisualStyle } from '../../src/looks/types';

const mocks = vi.hoisted(() => ({ engine: vi.fn(), game: vi.fn() }));
vi.mock('../../src/engine/Engine', () => ({ Engine: class { constructor() { return mocks.engine(); } } }));
vi.mock('../../src/engine/Game', () => ({ Game: class { constructor() { return mocks.game(); } } }));
function enginePendente() {
  const carregamento = new CarregamentoAssets();
  let resolver!: (v: boolean) => void;
  carregamento.acompanhar('assets', new Promise<boolean>(r => { resolver = r; })); carregamento.fechar();
  const engine = { carregamento, on: () => vi.fn(), start: vi.fn(), dispose: vi.fn(() => carregamento.cancelar()), filtro: 'teste', world: null };
  return { engine, resolver };
}
const criarStore = () => new EngineStore([{ id: 'teste' }] as VisualStyle[]);
const canvas = {} as HTMLCanvasElement;
beforeEach(() => {
  mocks.engine.mockReset(); mocks.game.mockReset();
  mocks.game.mockReturnValue({ estado: { tela: 'titulo', fase: 0 }, progresso: { desbloqueadas: 1, melhorTempo: {} }, dispose: vi.fn() });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), localStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } });
});
afterEach(() => vi.unstubAllGlobals());
describe('barreira de inicialização do jogo', () => {
  it('não constrói o Game nem inicia a engine antes de todos os assets', async () => {
    const { engine, resolver } = enginePendente(); mocks.engine.mockReturnValue(engine);
    const store = criarStore(), attach = store.attach(canvas);
    expect(store.getSnapshot().pronto).toBe(false); expect(mocks.game).not.toHaveBeenCalled(); expect(engine.start).not.toHaveBeenCalled();
    resolver(true); await attach;
    expect(store.getSnapshot().pronto).toBe(true); expect(engine.start).toHaveBeenCalledOnce(); store.detach();
  });
  it('exibe falha sem iniciar e permite tentar novamente com uma engine nova', async () => {
    const a = enginePendente(), b = enginePendente(); mocks.engine.mockReturnValueOnce(a.engine).mockReturnValueOnce(b.engine);
    const store = criarStore(), primeira = store.attach(canvas); a.resolver(false); await primeira;
    expect(store.getSnapshot().erro).toContain('arquivos do jogo'); expect(a.engine.start).not.toHaveBeenCalled();
    const segunda = store.attach(canvas); expect(store.getSnapshot().erro).toBeNull(); b.resolver(true); await segunda;
    expect(store.getSnapshot().pronto).toBe(true); store.detach();
  });
  it('ignora conclusão de uma montagem cancelada pelo Strict Mode', async () => {
    const a = enginePendente(), b = enginePendente(); mocks.engine.mockReturnValueOnce(a.engine).mockReturnValueOnce(b.engine);
    const store = criarStore(), primeira = store.attach(canvas); store.detach(); const segunda = store.attach(canvas);
    a.resolver(true); await primeira;
    expect(store.getSnapshot().erro).toBeNull(); expect(store.getSnapshot().pronto).toBe(false); expect(a.engine.start).not.toHaveBeenCalled();
    b.resolver(true); await segunda; expect(b.engine.start).toHaveBeenCalledOnce(); store.detach();
  });
});
