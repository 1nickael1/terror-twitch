// Portas: uma folha por porta que sobe conforme `abertura`, faixa na cor do cartão exigido,
// indicador de tranca (vermelho trancada, verde livre) e batente fixo (unido à malha estática).
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { celula, centro } from '../../sim/grid';
import type { World } from '../../sim/world';
import { eixoAndavel } from './faseMesh';
import type { Coletor } from './geometria';
import type { Recursos } from './recursos';

const LARGURA_FOLHA = 1.9;
const ESPESSURA_FOLHA = 0.2;
/** a folha não some inteira no teto: sobra um palmo visível sob a verga */
const SUBIDA = 0.97;

interface VistaPorta { folha: Group; base: number; altura: number; indicadores: Mesh[] }

export class PortasView {
  private readonly vistas: VistaPorta[] = [];
  private readonly verde: MeshBasicMaterial;
  private readonly vermelho: MeshBasicMaterial;

  constructor(world: World, rec: Recursos, co: Coletor, grupo: Group) {
    this.verde = rec.mat(new MeshBasicMaterial({ color: 0x30ff60 }));
    this.vermelho = rec.mat(new MeshBasicMaterial({ color: 0xff2020 }));
    const indicadorGeo = rec.geo(new BoxGeometry(0.1, 0.1, 0.1));

    for (const p of world.portas) {
      const [col, row] = p.coord;
      const c = celula(world.grid, col, row);
      const altura = c.teto - c.piso;
      const { x: cx, z: cz } = centro(p.coord);
      // corredor em x: a folha fica no plano yz (fina em x)
      const emX = eixoAndavel(world.grid, col, row) === 'x';
      const caixa = (ao: number, prof: number, alt: number) =>
        emX ? new BoxGeometry(prof, alt, ao) : new BoxGeometry(ao, alt, prof);

      const folha = new Group();
      folha.position.set(cx, c.piso + altura / 2, cz);
      const placa = rec.usar(new Mesh(rec.geo(caixa(LARGURA_FOLHA, ESPESSURA_FOLHA, altura))), 'porta');
      const faixa = rec.usar(new Mesh(rec.geo(caixa(LARGURA_FOLHA, ESPESSURA_FOLHA + 0.02, 0.22))), `nivel-${p.exige ?? 0}`);
      faixa.position.y = 1.15 - altura / 2;
      for (const m of [placa, faixa]) {
        m.castShadow = true;
        m.receiveShadow = true;
        folha.add(m);
      }
      grupo.add(folha);

      // batente: dois montantes e a verga, fixos
      for (const lado of [-1, 1]) {
        const montante = caixa(0.08, 0.34, altura);
        montante.translate(emX ? cx : cx + lado * 0.96, c.piso + altura / 2, emX ? cz + lado * 0.96 : cz);
        co.add('metal', montante);
      }
      const verga = caixa(2, 0.34, 0.16);
      verga.translate(cx, c.teto - 0.08, cz);
      co.add('metal', verga);

      // indicador nos dois lados da porta, junto ao montante
      const indicadores: Mesh[] = [];
      for (const face of [-1, 1]) {
        const m = new Mesh(indicadorGeo, this.vermelho);
        const ao = 0.96; // no montante, saltado da face
        const fora = face * 0.2;
        m.position.set(emX ? cx + fora : cx + ao, c.piso + 1.45, emX ? cz + ao : cz + fora);
        grupo.add(m);
        indicadores.push(m);
      }
      this.vistas.push({ folha, base: c.piso + altura / 2, altura, indicadores });
    }
  }

  /** Casa por índice: as portas da fase têm ordem estável (inclusive depois do checkpoint). */
  sincronizar(world: World): void {
    world.portas.forEach((p, i) => {
      const v = this.vistas[i];
      if (!v) return;
      v.folha.position.y = v.base + p.abertura * v.altura * SUBIDA;
      const mat = p.estado === 'trancada' ? this.vermelho : this.verde;
      for (const m of v.indicadores) m.material = mat;
    });
  }
}
