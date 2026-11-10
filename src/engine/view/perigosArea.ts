// Perigos de área do chefe (`ultravioleta`, `vapor`): o que fere sem bloquear.
// Ultravioleta: luminárias com tubos sobre a área (tubos = slot emissivo do banco, seguem o filtro);
// no aviso o reator falha e pega (pisca, ou sobe suave com "reduzir flashes"), no ativo fica aceso,
// e uma PointLight violeta (no máximo MAX_LUZES_UV por fase, criadas uma vez: número de luzes fixo)
// banha a área. Vapor: um cano no teto ao longo do eixo comprido da área com um bico por célula e uma
// lâmpada vermelha na válvula; no aviso, fiapos de vapor crescendo; no ativo, jato forte (partículas).
// Os terminais que acionam cada perigo ganham a barra de luz de `IndicadoresTerminal`.
// Lote final do CP3: marca translúcida no piso de cada área (violeta da UV: pisca no aviso, firme no ativo; névoa
// clara do vapor crescendo no aviso), porque com teto alto a luz do alto não chegava ao chão; a luz UV desce
// para perto do piso.
// Casa os estados por índice (`world.perigos` tem a ordem de `fase.chefe.perigos`).
import {
  AdditiveBlending, BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, TorusGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LevelDef, PerigoArea } from '../../sim/fase';
import { CELL, celula, type Grid } from '../../sim/grid';
import type { World } from '../../sim/world';
import { IndicadoresTerminal } from './comportas';
import { unir } from './inimigosModelos';
import type { ParticulasView } from './particulas';
import {
  bicosDaArea, brilhoUV, brilhoValvula, emitirPorTaxa, indicesDoTipo, MAX_BICOS_FASE, MAX_BICOS_LINHA, pisoPerigo, taxaVapor,
  tubosDaArea, UV_APAGADA,
} from './perigosLogica';
import type { Recursos } from './recursos';

const MAX_LUZES_UV = 2;
/** candela da luz UV acesa (com o multiplicador do filtro em 1) */
const LUZ_UV = 14;
const COR_UV = 0x8a3cff;
const COMPRIMENTO_TUBO = 1.3;
/** opacidade máxima da marca no piso (aditiva): violeta da UV e névoa clara do vapor */
const PISO_UV = { cor: 0x9a52ff, opacidade: 0.38 };
const PISO_VAPOR = { cor: 0xd4e0e4, opacidade: 0.3 };
/** acima do piso (fica por cima dos decalques de faixa) */
const ALTURA_PISO = 0.04;
/** com a UV acesa, a luz desce para perto do piso (com teto de 7 m, do alto ela não chegava ao chão) */
const LUZ_UV_ALTURA = 2.4;

interface MarcaPiso { malha: Mesh; mat: MeshBasicMaterial; maximo: number }
interface VistaUV { tipo: 'ultravioleta'; def: PerigoArea; slot: string; luz: PointLight | null; piso: MarcaPiso }
interface VistaVapor {
  tipo: 'vapor'; def: PerigoArea; slot: string;
  bicos: { x: number; z: number }[]; y: number; acumulado: number[]; piso: MarcaPiso;
}
type Vista = (VistaUV | VistaVapor) & { indicador: IndicadoresTerminal | null };

/** Piso mais baixo e teto mais alto das células da área. */
function pisoTeto(g: Grid, area: PerigoArea['area']): { piso: number; teto: number } {
  const [c0, r0, larg, alt] = area;
  let piso = Infinity;
  let teto = -Infinity;
  for (let r = r0; r < r0 + alt; r++) {
    for (let c = c0; c < c0 + larg; c++) {
      const cel = celula(g, c, r);
      piso = Math.min(piso, cel.piso);
      teto = Math.max(teto, cel.teto);
    }
  }
  return { piso, teto };
}

export class PerigosAreaView {
  /** por índice de `world.perigos`; null nos que não são de área */
  private readonly vistas: (Vista | null)[];
  private reduzirFlashes = false;
  private multiplicador = 1;
  private ultimoT = -1;
  /** índices dos perigos de área (o resto é das comportas) */
  private readonly indices: number[] = [];
  /** bicos de vapor já postos (no máximo MAX_BICOS_FASE na fase) */
  private bicosUsados = 0;

  constructor(
    fase: LevelDef, g: Grid, private readonly rec: Recursos, grupo: Group,
    private readonly particulas: Pick<ParticulasView, 'emitirVapor'>,
  ) {
    const defs = fase.chefe?.perigos ?? [];
    this.vistas = defs.map(() => null);
    this.indices = [...indicesDoTipo(defs, 'ultravioleta'), ...indicesDoTipo(defs, 'vapor')].sort((a, b) => a - b);
    let luzes = 0;
    for (const indice of indicesDoTipo(defs, 'ultravioleta')) {
      const d = defs[indice] as PerigoArea;
      const v = this.criarUV(d, g, grupo, luzes < MAX_LUZES_UV);
      if (v.luz) luzes++;
      this.vistas[indice] = { ...v, indicador: IndicadoresTerminal.criar(fase, g, rec, grupo, d.id) };
    }
    for (const indice of indicesDoTipo(defs, 'vapor')) {
      const d = defs[indice] as PerigoArea;
      this.vistas[indice] = { ...this.criarVapor(d, g, grupo), indicador: IndicadoresTerminal.criar(fase, g, rec, grupo, d.id) };
    }
  }

  configurar(reduzirFlashes: boolean, multiplicador: number): void {
    this.reduzirFlashes = reduzirFlashes;
    this.multiplicador = multiplicador;
  }

  sincronizar(world: World): void {
    // tempo de simulação: com o jogo parado, nada se mexe nem solta vapor
    const dt = this.ultimoT < 0 ? 0 : Math.max(0, Math.min(0.1, world.t - this.ultimoT));
    this.ultimoT = world.t;
    // só os índices de área (pré-calculados na carga); laços indexados: nada alocado por quadro
    for (const i of this.indices) {
      const e = world.perigos[i];
      const v = this.vistas[i];
      if (!e || !v) continue;
      v.indicador?.atualizar(e.recarga);
      const k = pisoPerigo(v.tipo, e, v.def.aviso, world.t, this.reduzirFlashes);
      v.piso.malha.visible = k > 0.01;
      v.piso.mat.opacity = v.piso.maximo * k * Math.min(1, this.multiplicador);
      if (v.tipo === 'ultravioleta') {
        const b = brilhoUV(e, v.def.aviso, world.t, this.reduzirFlashes);
        this.rec.brilho(v.slot, b);
        if (v.luz) v.luz.intensity = b <= UV_APAGADA ? 0 : LUZ_UV * this.multiplicador * b;
        continue;
      }
      this.rec.brilho(v.slot, brilhoValvula(e, world.t, this.reduzirFlashes));
      // jato forte no ativo; fiapos crescendo no aviso (o chiado subindo); nada fora disso
      const taxa = taxaVapor(e, v.def.aviso);
      for (let k = 0; k < v.bicos.length; k++) {
        const n = emitirPorTaxa(v.acumulado, k, taxa, dt);
        if (n > 0) this.particulas.emitirVapor(world, v.bicos[k].x, v.y, v.bicos[k].z, n, e.ativo > 0);
      }
    }
  }

  /** Depois do checkpoint: o estado volta do snapshot; nada a refazer além do relógio. */
  reiniciar(): void {
    this.ultimoT = -1;
  }

  private criarUV(d: PerigoArea, g: Grid, grupo: Group, comLuz: boolean): VistaUV {
    const { piso, teto } = pisoTeto(g, d.area);
    const { eixoX, tubos } = tubosDaArea(d.area, CELL);
    const y = teto - 0.12;
    const giro = (geo: BufferGeometry): BufferGeometry => (eixoX ? geo.rotateZ(Math.PI / 2) : geo.rotateX(Math.PI / 2));
    // carcaças (metal) e tubos (emissivos), cada grupo numa malha só
    const carcacas = tubos.map((t) => new BoxGeometry(eixoX ? COMPRIMENTO_TUBO + 0.1 : 0.22, 0.06, eixoX ? 0.22 : COMPRIMENTO_TUBO + 0.1).translate(t.x, teto - 0.03, t.z));
    const tubosGeo = tubos.flatMap((t) => [-0.05, 0.05].map((o) =>
      giro(new CylinderGeometry(0.022, 0.022, COMPRIMENTO_TUBO, 8)).translate(t.x + (eixoX ? 0 : o), y, t.z + (eixoX ? o : 0))));
    const carcaca = this.rec.usar(new Mesh(this.rec.geo(unir(carcacas))), 'metal');
    carcaca.name = `uv-carcaca:${d.id}`;
    grupo.add(carcaca);
    const slot = this.rec.slot(`uv-tubo:${d.id}`, { color: 0x251838, emissive: 0xb27aff, emissiveIntensity: 2.2 });
    this.rec.brilho(slot, UV_APAGADA);
    const malha = this.rec.usar(new Mesh(this.rec.geo(unir(tubosGeo))), slot);
    malha.name = `uv-tubos:${d.id}`;
    grupo.add(malha);
    let luz: PointLight | null = null;
    if (comLuz) {
      const [c0, r0, larg, alt] = d.area;
      // alcance cobre a área inteira e um pouco além (o jogador vê a borda do perigo)
      const alcance = Math.max(5, Math.hypot(larg, alt) * CELL * 0.75 + 2);
      luz = this.rec.obj(new PointLight(COR_UV, 0, alcance, 2));
      luz.position.set((c0 + larg / 2) * CELL, Math.min(piso + LUZ_UV_ALTURA, teto - 0.5), (r0 + alt / 2) * CELL);
      luz.name = `uv-luz:${d.id}`;
      grupo.add(luz);
    }
    return { tipo: 'ultravioleta', def: d, slot, luz, piso: this.marcaPiso(d, g, grupo, PISO_UV) };
  }

  private criarVapor(d: PerigoArea, g: Grid, grupo: Group): VistaVapor {
    const { teto } = pisoTeto(g, d.area);
    // até MAX_BICOS_LINHA por linha e MAX_BICOS_FASE na fase (o pool de partículas é dividido com o resto)
    const { eixoX, bicos } = bicosDaArea(d.area, CELL, Math.min(MAX_BICOS_LINHA, MAX_BICOS_FASE - this.bicosUsados));
    this.bicosUsados += bicos.length;
    const y = teto - 0.28;
    const [c0, r0, larg, alt] = d.area;
    const comp = (eixoX ? larg : alt) * CELL;
    const cx = (c0 + larg / 2) * CELL;
    const cz = (r0 + alt / 2) * CELL;
    const pecas: BufferGeometry[] = [];
    // cano principal ao longo da área, com flanges nas pontas
    const cano = new CylinderGeometry(0.09, 0.09, comp, 10);
    pecas.push((eixoX ? cano.rotateZ(Math.PI / 2) : cano.rotateX(Math.PI / 2)).translate(cx, y, cz));
    for (const s of [-1, 1]) {
      const f = new CylinderGeometry(0.13, 0.13, 0.05, 10);
      const px = eixoX ? cx + s * (comp / 2 - 0.05) : cx;
      const pz = eixoX ? cz : cz + s * (comp / 2 - 0.05);
      pecas.push((eixoX ? f.rotateZ(Math.PI / 2) : f.rotateX(Math.PI / 2)).translate(px, y, pz));
    }
    // suportes até o teto e um bico virado para baixo em cada célula
    for (const b of bicos) {
      pecas.push(new BoxGeometry(0.05, teto - y, 0.05).translate(b.x, (teto + y) / 2, b.z));
      pecas.push(new CylinderGeometry(0.035, 0.06, 0.14, 8).translate(b.x, y - 0.13, b.z));
    }
    // volante da válvula numa ponta
    const ponta = { x: eixoX ? cx - comp / 2 + 0.3 : cx, z: eixoX ? cz : cz - comp / 2 + 0.3 };
    const volante = new TorusGeometry(0.13, 0.02, 6, 14);
    // volante pendurado sob o cano (o cano corre rente ao teto)
    pecas.push(volante.rotateX(Math.PI / 2).translate(ponta.x, y - 0.26, ponta.z));
    pecas.push(new CylinderGeometry(0.02, 0.02, 0.26, 6).translate(ponta.x, y - 0.13, ponta.z));
    const malha = this.rec.usar(new Mesh(this.rec.geo(unir(pecas))), 'tubo');
    malha.name = `vapor-cano:${d.id}`;
    malha.castShadow = true;
    grupo.add(malha);
    // lâmpada da válvula
    const slot = this.rec.slot(`vapor-luz:${d.id}`, { color: 0x2a0806, emissive: 0xff3a1a, emissiveIntensity: 1.8 });
    this.rec.brilho(slot, 0);
    const lampada = this.rec.usar(new Mesh(this.rec.geo(new BoxGeometry(0.1, 0.08, 0.1))), slot);
    // ao lado do volante, no eixo curto: visível de baixo
    lampada.position.set(ponta.x + (eixoX ? 0 : 0.14), y - 0.02, ponta.z + (eixoX ? 0.14 : 0));
    lampada.name = `vapor-lampada:${d.id}`;
    grupo.add(lampada);
    return { tipo: 'vapor', def: d, slot, bicos, y: y - 0.2, acumulado: bicos.map(() => 0), piso: this.marcaPiso(d, g, grupo, PISO_VAPOR) };
  }

  /** Plano translúcido aditivo sobre o piso de cada célula da área (uma malha por perigo), invisível parado. */
  private marcaPiso(d: PerigoArea, g: Grid, grupo: Group, estilo: { cor: number; opacidade: number }): MarcaPiso {
    const [c0, r0, larg, alt] = d.area;
    const placas: BufferGeometry[] = [];
    for (let r = r0; r < r0 + alt; r++) {
      for (let c = c0; c < c0 + larg; c++) {
        placas.push(new PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2).translate((c + 0.5) * CELL, celula(g, c, r).piso + ALTURA_PISO, (r + 0.5) * CELL));
      }
    }
    const unida = mergeGeometries(placas, false);
    for (const p of placas) p.dispose();
    if (!unida) throw new Error(`Falha ao unir a marca de piso do perigo "${d.id}"`);
    const mat = this.rec.mat(new MeshBasicMaterial({
      color: estilo.cor, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    const malha = this.rec.obj(new Mesh(this.rec.geo(unida), mat));
    malha.visible = false;
    malha.renderOrder = 2;
    malha.name = `perigo-piso:${d.id}`;
    grupo.add(malha);
    return { malha, mat, maximo: estilo.opacidade };
  }
}
