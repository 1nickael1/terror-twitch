import { Box3, Group, Vector3, type Object3D } from 'three';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';
import { AcervoArmaJogador } from './acervoArmaJogador';

/** Empunhadura junto ao gatilho; guarda-mão e cano apontam para -Z. */
export function normalizarSMG(modelo: Object3D): Group {
  const raiz = new Group(); raiz.name = 'arma:smg-rusted-sentinel';
  const comprimento = new Box3().setFromObject(modelo).getSize(new Vector3()).x;
  const eixo = new Group(); eixo.rotation.y = -Math.PI / 2; eixo.scale.setScalar(.54 / Math.max(.001, comprimento));
  const copia = modelo.clone(true); copia.position.set(-.18, .08, -.000284);
  eixo.add(copia); raiz.add(eixo); return raiz;
}
export class AcervoSMG extends AcervoArmaJogador {
  constructor(bank: MaterialBank, anisotropia: number, carregamento: CarregamentoAssets) {
    super({ id: 'smg', slot: 'smg-sentinel', nome: 'Submetralhadora Rusted Sentinel', normalizar: normalizarSMG }, bank, anisotropia, carregamento);
  }
}
