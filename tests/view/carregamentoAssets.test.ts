import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import { CarregamentoAssets } from '../../src/engine/carregamentoAssets';
import { carregarTextura } from '../../src/engine/carregarTextura';

const pendente = <T>() => {
  let resolver!: (v: T) => void;
  const pronto = new Promise<T>(r => { resolver = r; });
  return { pronto, resolver };
};
afterEach(() => vi.unstubAllGlobals());

describe('carregamento dos assets', () => {
  it('espera pelo cadastro completo e por todos os recursos, inclusive modelos', async () => {
    const lote = new CarregamentoAssets(), textura = pendente<boolean>(), modelo = pendente<void>();
    const progresso = vi.fn(), pronto = vi.fn();
    lote.subscribe(progresso); void lote.pronto.then(pronto);
    lote.acompanhar('textura', textura.pronto); textura.resolver(true);
    await Promise.resolve(); expect(pronto).not.toHaveBeenCalled();
    lote.acompanhar('modelo', modelo.pronto); lote.fechar();
    await Promise.resolve(); expect(pronto).not.toHaveBeenCalled();
    modelo.resolver(); await lote.pronto;
    expect(progresso).toHaveBeenLastCalledWith({ concluidos: 2, total: 2 });
    expect(pronto).toHaveBeenCalledOnce();
  });
  it('não libera o jogo com arquivos ausentes ou tarefas rejeitadas', async () => {
    const lote = new CarregamentoAssets();
    lote.acompanhar('albedo', Promise.resolve(false));
    lote.acompanhar('policial', Promise.reject(new Error('404'))); lote.fechar();
    await expect(lote.pronto).rejects.toMatchObject({ cause: ['albedo', 'policial'] });
  });
  it('cancela sem emitir progresso tardio', async () => {
    const lote = new CarregamentoAssets(), arquivo = pendente<boolean>(), ouvir = vi.fn();
    lote.acompanhar('textura', arquivo.pronto); lote.subscribe(ouvir); lote.fechar();
    lote.cancelar(); await expect(lote.pronto).rejects.toThrow('cancelado');
    arquivo.resolver(true); await Promise.resolve(); expect(ouvir).toHaveBeenCalledTimes(1);
  });
  it('espera pela decodificação da imagem e não ressuscita uma textura descartada', async () => {
    const decode = pendente<void>();
    class Imagem {
      static ultima: Imagem;
      src = ''; onload: (() => Promise<void>) | null = null; onerror: (() => void) | null = null;
      decode = () => decode.pronto;
      constructor() { Imagem.ultima = this; }
    }
    vi.stubGlobal('Image', Imagem);
    const textura = new Texture(), lote = new CarregamentoAssets();
    const pronto = carregarTextura(textura, '/textura.webp', lote); lote.fechar();
    const aoCarregar = Imagem.ultima.onload!();
    expect(textura.userData.estado).toBe('carregando');
    textura.dispose(); decode.resolver(); await aoCarregar;
    expect(await pronto).toBe(false); expect(textura.image).toBeNull();
    expect(textura.userData.estado).toBe('descartada');
    await expect(lote.pronto).rejects.toMatchObject({ cause: ['/textura.webp'] });
  });
});
