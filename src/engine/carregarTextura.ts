import type { Texture } from 'three';
import type { CarregamentoAssets } from './carregamentoAssets';

/** Mantém o fallback até a imagem estar pronta; nunca ressuscita uma textura já descartada. */
export function carregarTextura(textura: Texture, url: string, carregamento?: CarregamentoAssets): Promise<boolean> {
  if (typeof Image === 'undefined') {
    const pronto = Promise.resolve(false); carregamento?.acompanhar(url, pronto); return pronto;
  }
  let concluir!: (sucesso: boolean) => void;
  const pronto = new Promise<boolean>(resolve => { concluir = resolve; });
  carregamento?.acompanhar(url, pronto);
  const imagem = new Image();
  let descartada = false;
  textura.userData.url = url;
  textura.userData.estado = 'carregando';
  const limpar = () => {
    imagem.onload = null;
    imagem.onerror = null;
    textura.removeEventListener('dispose', aoDescartar);
  };
  const aoDescartar = () => {
    descartada = true;
    textura.userData.estado = 'descartada';
    limpar();
    concluir(false);
  };
  textura.addEventListener('dispose', aoDescartar);
  imagem.onload = async () => {
    try { if (imagem.decode) await imagem.decode(); } catch {
      if (!descartada) textura.userData.estado = 'fallback';
      limpar(); concluir(false); return;
    }
    if (!descartada) {
      textura.image = imagem;
      textura.needsUpdate = true;
      textura.userData.estado = 'pronta';
    }
    limpar();
    concluir(!descartada);
  };
  imagem.onerror = () => {
    if (!descartada) textura.userData.estado = 'fallback';
    limpar();
    concluir(false);
  };
  imagem.src = url;
  return pronto;
}
