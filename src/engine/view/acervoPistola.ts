import { Box3, Group, Vector3, type Object3D } from 'three';
import { AcervoArmaJogador } from './acervoArmaJogador';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';

/** Origem na empunhadura, cano para -Z e comprimento compatível com o suporte FPS. */
export function normalizarPistola(modelo: Object3D): Group {
  const raiz = new Group(); raiz.name = 'arma:pistola-neon-warden';
  const comprimento = new Box3().setFromObject(modelo).getSize(new Vector3()).x;
  const eixo = new Group(); eixo.rotation.y = -Math.PI / 2; eixo.scale.setScalar(.30 / Math.max(.001, comprimento));
  const copia = modelo.clone(true); copia.position.set(-.52, .25, .0004875);
  eixo.add(copia); raiz.add(eixo); return raiz;
}

export class AcervoPistola extends AcervoArmaJogador {
  constructor(bank: MaterialBank, anisotropia: number, carregamento: CarregamentoAssets) {
    super({ id: 'pistola', slot: 'pistola-neon', nome: 'Pistola Neon Warden', normalizar: normalizarPistola }, bank, anisotropia, carregamento);
  }
}
