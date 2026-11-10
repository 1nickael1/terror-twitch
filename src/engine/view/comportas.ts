// Comportas (perigos `comporta` do chefe): um painel grosso de aço que cobre a `area` do chão ao
// teto, escondido no teto quando aberto; desce em 0,15 s quando `ativo > 0` e sobe em 0,6 s.
// Uma luz de aviso âmbar (malha emissiva, sem PointLight: o pool de luzes fica fixo) de cada
// lado pisca lenta enquanto a recarga corre; com "reduzir flashes", pulsa suave.
// Casa os estados por índice (`world.perigos` tem a ordem de `fase.chefe.perigos`).
import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial } from 'three';
import type { LevelDef } from '../../sim/fase';
import { CELL, celula, type Grid } from '../../sim/grid';
import type { World } from '../../sim/world';
import { avancarFechamento, brilhoAviso } from './comportasLogica';
import type { Recursos } from './recursos';
import { texturaComporta } from './texturasCenario';

/** folga do painel para dentro da área (não encosta nas paredes vizinhas) */
const FOLGA = 0.03;
const ACESA = new Color(0xffa224);
const APAGADA = new Color(0x2e1c08);

interface VistaComporta { painel: Mesh; piso: number; altura: number; lampada: MeshBasicMaterial; f: number }

export class ComportasView {
  private readonly vistas: VistaComporta[] = [];
  private reduzirFlashes = false;
  private ultimoT = -1;

  constructor(fase: LevelDef, g: Grid, rec: Recursos, grupo: Group) {
    const defs = fase.chefe?.perigos ?? [];
    if (defs.length === 0) return;
    const slot = rec.slot('comporta', { map: rec.tex(texturaComporta()), roughness: 0.45, metalness: 0.55 });
    const lampadaGeo = rec.geo(new BoxGeometry(0.22, 0.1, 0.1));

    for (const d of defs) {
      const [c0, r0, larg, alt] = d.area;
      let piso = Infinity;
      let teto = -Infinity;
      for (let r = r0; r < r0 + alt; r++) {
        for (let c = c0; c < c0 + larg; c++) {
          const cel = celula(g, c, r);
          piso = Math.min(piso, cel.piso);
          teto = Math.max(teto, cel.teto);
        }
      }
      const altura = Math.max(0.5, teto - piso);
      const x0 = c0 * CELL;
      const z0 = r0 * CELL;
      const x1 = (c0 + larg) * CELL;
      const z1 = (r0 + alt) * CELL;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;

      const painel = rec.usar(new Mesh(rec.geo(new BoxGeometry(x1 - x0 - FOLGA * 2, altura, z1 - z0 - FOLGA * 2))), slot);
      painel.name = `comporta:${d.id}`;
      painel.position.set(cx, piso + altura * 1.5, cz);
      painel.castShadow = true;
      painel.receiveShadow = true;
      painel.visible = false;
      grupo.add(painel);

      // calha no teto: mostra onde a comporta desce
      const calha = rec.usar(new Mesh(rec.geo(new BoxGeometry(x1 - x0, 0.04, z1 - z0))), 'metal');
      calha.position.set(cx, teto - 0.02, cz);
      grupo.add(calha);

      // luzes de aviso nos dois lados da passagem (o painel corta o eixo mais curto da área)
      const lampada = rec.mat(new MeshBasicMaterial({ color: APAGADA }));
      const lados = x1 - x0 >= z1 - z0
        ? [[cx, z0 - 0.08], [cx, z1 + 0.08]]
        : [[x0 - 0.08, cz], [x1 + 0.08, cz]];
      for (const [x, z] of lados) {
        const m = new Mesh(lampadaGeo, lampada);
        m.position.set(x, teto - 0.12, z);
        if (x1 - x0 < z1 - z0) m.rotation.y = Math.PI / 2;
        grupo.add(m);
      }
      this.vistas.push({ painel, piso, altura, lampada, f: 0 });
    }
  }

  configurar(reduzirFlashes: boolean): void {
    this.reduzirFlashes = reduzirFlashes;
  }

  sincronizar(world: World): void {
    // tempo de simulação: com o jogo parado, nada se mexe
    const dt = this.ultimoT < 0 ? 0 : Math.max(0, Math.min(0.1, world.t - this.ultimoT));
    const primeiro = this.ultimoT < 0;
    this.ultimoT = world.t;
    world.perigos.forEach((e, i) => {
      const v = this.vistas[i];
      if (!v) return;
      // ao aparecer (carga ou checkpoint), já na posição do estado
      v.f = primeiro ? (e.ativo > 0 ? 1 : 0) : avancarFechamento(v.f, e.ativo > 0, dt);
      v.painel.visible = v.f > 0;
      v.painel.position.y = v.piso + v.altura / 2 + (1 - v.f) * (v.altura + 0.05);
      const b = brilhoAviso(world.t, e.recarga, this.reduzirFlashes);
      v.lampada.color.copy(APAGADA).lerp(ACESA, b);
    });
  }

  /** Depois do checkpoint: a próxima sincronização coloca os painéis direto no estado. */
  reiniciar(): void {
    this.ultimoT = -1;
  }
}
