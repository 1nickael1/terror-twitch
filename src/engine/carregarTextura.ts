import type { Texture } from 'three';

/** Mantém o fallback até a imagem estar pronta; nunca ressuscita uma textura já descartada. */
export function carregarTextura(textura: Texture, url: string): void {
  if (typeof Image === 'undefined') return;
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
  };
  textura.addEventListener('dispose', aoDescartar);
  imagem.onload = () => {
    if (!descartada) {
      textura.image = imagem;
      textura.needsUpdate = true;
      textura.userData.estado = 'pronta';
    }
    limpar();
  };
  imagem.onerror = () => {
    if (!descartada) textura.userData.estado = 'fallback';
    limpar();
  };
  imagem.src = url;
}
