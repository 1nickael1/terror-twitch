// Comportas (perigos `comporta` do chefe): um painel grosso de aço que cobre a `area` do chão ao
// teto, escondido no teto quando aberto; desce em 0,15 s quando `ativo > 0` e sobe em 0,6 s.
// Uma luz de aviso âmbar de cada lado (malha emissiva do banco, sem PointLight: o pool de luzes fica
// fixo) pisca lenta enquanto a recarga corre; com "reduzir flashes", pulsa suave. As lâmpadas são
// slots do `MaterialBank` (seguem o emissivo do filtro); o brilho muda por `Recursos.brilho`.
// O terminal que aciona um perigo (gatilho `terminal` → ação `perigo`) ganha uma barra de luz
// emissiva no topo do painel: branco-azulado pronta, âmbar fixo enquanto recarrega (nunca pisca).
// Só os perigos `comporta`: os de área (`ultravioleta`, `vapor`) são de `perigosArea.ts`. O índice
// de cada vista casa com `world.perigos` (mesma ordem de `fase.chefe.perigos`).
import { BoxGeometry, Group, Mesh } from 'three';
import type { LevelDef } from '../../sim/fase';
import { CELL, celula, type Grid } from '../../sim/grid';
import { resolverOnde } from '../../sim/onde';
import { perigoDoTerminal } from '../../sim/perigos';
import type { World } from '../../sim/world';
import { avancarFechamento, brilhoAviso, COR_INDICADOR, estadoIndicador, type EstadoIndicador } from './comportasLogica';
import { colocacao } from './objetos';
import { indicesDoTipo } from './perigosLogica';
import type { Recursos } from './recursos';
import { texturaComporta } from './texturasCenario';

/** folga do painel para dentro da área (não encosta nas paredes vizinhas) */
const FOLGA = 0.03;
const ACESA = 0xffa224;
const APAGADA = 0x2e1c08;

/** Slot do banco de cada estado da luz do terminal (definido uma vez por fase). */
function slotIndicador(rec: Recursos, e: EstadoIndicador): string {
  const cor = COR_INDICADOR[e];
  return rec.slot(`perigo-terminal:${e}`, { color: cor, emissive: cor, emissiveIntensity: 1.1 });
}

/** Barras de luz dos terminais que acionam um perigo; troca de slot quando o estado muda. */
export class IndicadoresTerminal {
  private estado: EstadoIndicador = 'pronta';

  private constructor(
    private readonly rec: Recursos, private readonly barras: Mesh[],
    /** nome do slot de cada estado (definidos uma vez, na criação) */
    private readonly slots: Readonly<Record<EstadoIndicador, string>>,
  ) {}

  /** Uma barra no topo de cada terminal do perigo `id` (null se nenhum terminal o aciona). */
  static criar(fase: LevelDef, g: Grid, rec: Recursos, grupo: Group, id: string): IndicadoresTerminal | null {
    const terminais = fase.terminais.filter((t) => perigoDoTerminal(fase, t.id) === id);
    if (terminais.length === 0) return null;
    const geo = rec.geo(new BoxGeometry(0.6, 0.08, 0.02));
    const slots = { pronta: slotIndicador(rec, 'pronta'), recarregando: slotIndicador(rec, 'recarregando') };
    const slot = slots.pronta;
    const barras = terminais.map((t) => {
      const { m, naParede } = colocacao(g, resolverOnde(g, t.em));
      const barra = rec.usar(new Mesh(geo), slot);
      // painel de parede: acima da tela; console de pé: na borda de cima da frente (mesma colocação de `objetos.ts`)
      barra.position.set(0, naParede ? 1.675 : 0.95, naParede ? 0.125 : 0.26);
      barra.applyMatrix4(m);
      barra.name = `indicador:${t.id}`;
      grupo.add(barra);
      return barra;
    });
    return new IndicadoresTerminal(rec, barras, slots);
  }

  atualizar(recarga: number): void {
    const e = estadoIndicador(recarga);
    if (e === this.estado) return;
    this.estado = e;
    const slot = this.slots[e];
    for (const b of this.barras) {
      this.rec.soltarMalha(b);
      this.rec.usar(b, slot);
    }
  }
}

interface VistaComporta {
  painel: Mesh; piso: number; altura: number; lampada: string; f: number;
  indicador: IndicadoresTerminal | null;
}

export class ComportasView {
  /** por índice de `world.perigos`; null nos perigos que não são comporta */
  private readonly vistas: (VistaComporta | null)[] = [];
  private reduzirFlashes = false;
  private ultimoT = -1;

  constructor(fase: LevelDef, g: Grid, private readonly rec: Recursos, grupo: Group) {
    const defs = fase.chefe?.perigos ?? [];
    const indices = indicesDoTipo(defs, 'comporta');
    this.vistas = defs.map(() => null);
    if (indices.length === 0) return;
    const slot = rec.slot('comporta', { map: rec.tex(texturaComporta()), roughness: 0.45, metalness: 0.55 });
    const lampadaGeo = rec.geo(new BoxGeometry(0.22, 0.1, 0.1));

    for (const indice of indices) {
      const d = defs[indice];
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
      const lampada = rec.slot(`comporta-luz:${d.id}`, { color: APAGADA, emissive: ACESA, emissiveIntensity: 1.6 });
      rec.brilho(lampada, 0);
      const lados = x1 - x0 >= z1 - z0
        ? [[cx, z0 - 0.08], [cx, z1 + 0.08]]
        : [[x0 - 0.08, cz], [x1 + 0.08, cz]];
      for (const [x, z] of lados) {
        const m = rec.usar(new Mesh(lampadaGeo), lampada);
        m.position.set(x, teto - 0.12, z);
        if (x1 - x0 < z1 - z0) m.rotation.y = Math.PI / 2;
        grupo.add(m);
      }
      const indicador = IndicadoresTerminal.criar(fase, g, rec, grupo, d.id);
      this.vistas[indice] = { painel, piso, altura, lampada, f: 0, indicador };
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
    for (let i = 0; i < world.perigos.length; i++) {
      const e = world.perigos[i];
      const v = this.vistas[i];
      if (!v) continue;
      // ao aparecer (carga ou checkpoint), já na posição do estado
      v.f = primeiro ? (e.ativo > 0 ? 1 : 0) : avancarFechamento(v.f, e.ativo > 0, dt);
      v.painel.visible = v.f > 0;
      v.painel.position.y = v.piso + v.altura / 2 + (1 - v.f) * (v.altura + 0.05);
      this.rec.brilho(v.lampada, brilhoAviso(world.t, e.recarga, this.reduzirFlashes));
      v.indicador?.atualizar(e.recarga);
    }
  }

  /** Depois do checkpoint: a próxima sincronização coloca os painéis direto no estado. */
  reiniciar(): void {
    this.ultimoT = -1;
  }
}
