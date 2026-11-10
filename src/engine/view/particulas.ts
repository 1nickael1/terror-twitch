// Partículas: um único `Points` com pool de 512 (o emissor reaproveita a mais antiga). Posição,
// cor (RGBA) e tamanho são atributos da geometria; velocidade, vida e chão ficam em arrays da CPU.
// O `PointsMaterial` ganha um atributo de tamanho por partícula (fumaça grande, faísca miúda).
// Emissores por evento: faísca (impacto na parede), respingo escuro (impacto em inimigo), fumaça
// (explosão) e poeira (pouso). Gravidade leve nas faíscas e no respingo; nada atravessa o chão.
import {
  BufferAttribute, BufferGeometry, DynamicDrawUsage, NormalBlending, Points, PointsMaterial, Vector2, type Group, type PerspectiveCamera,
} from 'three';
import type { SimEvent } from '../../sim/eventos';
import { alturaPiso, celula, coordDe, type Vec2 } from '../../sim/grid';
import type { World } from '../../sim/world';
import type { Recursos } from './recursos';
import { texturaBolha } from './texturasEfeitos';

const MAX = 512;
const LONGE = -1e4;
const RECUO = 0.1;

interface Emissao {
  n: number; cor: readonly [number, number, number]; alfa: number; tamanho: number; cresce: number;
  vel: [min: number, max: number]; subida: number; vida: [min: number, max: number];
  gravidade: number; arrasto: number; espalha: number; plano?: boolean;
}

const FAISCA: Emissao = { n: 7, cor: [1, 0.72, 0.3], alfa: 1, tamanho: 0.05, cresce: 0, vel: [1.5, 4], subida: 1.5, vida: [0.18, 0.4], gravidade: 9, arrasto: 1, espalha: 0.02 };
const RESPINGO: Emissao = { n: 9, cor: [0.28, 0.02, 0.02], alfa: 0.95, tamanho: 0.08, cresce: 0, vel: [0.8, 2.4], subida: 1, vida: [0.5, 0.9], gravidade: 9, arrasto: 1.5, espalha: 0.06 };
const FUMACA: Emissao = { n: 40, cor: [0.42, 0.5, 0.38], alfa: 0.45, tamanho: 0.5, cresce: 0.5, vel: [0.1, 0.7], subida: 0.6, vida: [1.4, 2.6], gravidade: -0.15, arrasto: 1.2, espalha: 1.2 };
const POEIRA: Emissao = { n: 14, cor: [0.5, 0.47, 0.42], alfa: 0.45, tamanho: 0.14, cresce: 0.2, vel: [0.6, 1.4], subida: 0.15, vida: [0.35, 0.6], gravidade: 0, arrasto: 3, espalha: 0.2, plano: true };

export class ParticulasView {
  private readonly pontos: Points;
  private readonly posicao: BufferAttribute;
  private readonly cor: BufferAttribute;
  private readonly tamanho: BufferAttribute;
  private readonly cresce = new Float32Array(MAX);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly vida = new Float32Array(MAX);
  private readonly vidaMax = new Float32Array(MAX);
  private readonly alfa = new Float32Array(MAX);
  private readonly chao = new Float32Array(MAX);
  private readonly gravidade = new Float32Array(MAX);
  private readonly arrasto = new Float32Array(MAX);
  private proxima = 0;
  private ativas = 0;

  private readonly recuado = { x: 0, z: 0 };

  constructor(rec: Recursos, grupo: Group, private readonly camera: PerspectiveCamera) {
    const geo = rec.geo(new BufferGeometry());
    const pos = new Float32Array(MAX * 3).fill(LONGE);
    this.posicao = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    this.cor = new BufferAttribute(new Float32Array(MAX * 4), 4).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', this.posicao);
    this.tamanho = new BufferAttribute(new Float32Array(MAX), 1).setUsage(DynamicDrawUsage);
    geo.setAttribute('color', this.cor);
    geo.setAttribute('tamanho', this.tamanho);
    const mat = rec.mat(new PointsMaterial({
      size: 1, map: rec.tex(texturaBolha()), vertexColors: true, transparent: true,
      depthWrite: false, blending: NormalBlending, sizeAttenuation: true,
    }));
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = `attribute float tamanho;\n${sh.vertexShader}`;
      sh.vertexShader = sh.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * tamanho;');
    };
    mat.customProgramCacheKey = () => 'particulas-tamanho';
    this.pontos = new Points(geo, mat);
    // o three mede o ponto pela altura do canvas; o filtro desenha num alvo menor
    const tela = new Vector2();
    this.pontos.onBeforeRender = (renderer) => {
      const alvo = renderer.getRenderTarget();
      renderer.getDrawingBufferSize(tela);
      mat.size = alvo && tela.y > 0 ? alvo.height / tela.y : 1;
    };
    this.pontos.name = 'particulas';
    this.pontos.frustumCulled = false; // espalhadas pela fase
    grupo.add(this.pontos);
  }

  sincronizar(world: World, eventos: readonly SimEvent[], dt: number): void {
    for (const e of eventos) {
      if (e.tipo === 'impacto') this.emitir(world, this.recuar(e.pos), e.y, e.em === 'parede' ? FAISCA : RESPINGO);
      else if (e.tipo === 'explosao') this.emitir(world, e.pos, alturaPiso(world.grid, e.pos) + 0.5, FUMACA);
      else if (e.tipo === 'pouso') this.emitir(world, world.jogador.pos, world.jogador.y + 0.05, POEIRA);
    }
    if (this.ativas === 0) return;
    this.avancar(dt);
  }

  /** Apaga todas (checkpoint). */
  limpar(): void {
    this.vida.fill(0);
    (this.posicao.array as Float32Array).fill(LONGE);
    (this.cor.array as Float32Array).fill(0);
    this.posicao.needsUpdate = true;
    this.cor.needsUpdate = true;
    this.ativas = 0;
  }

  /**
   * O ponto do impacto pode estar dentro da célula da parede: recua RECUO m na direção da câmera
   * (as faíscas nascem do lado de quem atirou e usam o piso dessa célula).
   */
  private recuar(p: Vec2): Vec2 {
    const hx = this.camera.position.x - p.x;
    const hz = this.camera.position.z - p.z;
    const h = Math.hypot(hx, hz) || 1;
    this.recuado.x = p.x + (hx / h) * RECUO;
    this.recuado.z = p.z + (hz / h) * RECUO;
    return this.recuado;
  }

  private emitir(world: World, p: Vec2, y: number, e: Emissao): void {
    const [col, row] = coordDe(p);
    const piso = celula(world.grid, col, row).tipo === 'piso' ? alturaPiso(world.grid, p) : y - 3;
    const pos = this.posicao.array as Float32Array;
    const cor = this.cor.array as Float32Array;
    for (let k = 0; k < e.n; k++) {
      const i = this.proxima;
      this.proxima = (this.proxima + 1) % MAX;
      if (this.vida[i] <= 0) this.ativas++;
      const a = Math.random() * Math.PI * 2;
      const raio = Math.random() * e.espalha;
      pos[i * 3] = p.x + Math.cos(a) * raio;
      pos[i * 3 + 1] = Math.max(piso + 0.02, y + (e.plano ? 0 : (Math.random() - 0.5) * e.espalha * 0.5));
      pos[i * 3 + 2] = p.z + Math.sin(a) * raio;
      // direção aleatória (no plano, para a poeira) com um empurrão para cima
      const v = e.vel[0] + Math.random() * (e.vel[1] - e.vel[0]);
      const b = Math.random() * Math.PI * 2;
      const up = e.plano ? 0 : Math.random() * 2 - 1;
      const h = Math.sqrt(1 - up * up);
      this.vel[i * 3] = Math.cos(b) * h * v;
      this.vel[i * 3 + 1] = up * v + e.subida * Math.random();
      this.vel[i * 3 + 2] = Math.sin(b) * h * v;
      this.vida[i] = this.vidaMax[i] = e.vida[0] + Math.random() * (e.vida[1] - e.vida[0]);
      this.alfa[i] = e.alfa;
      this.chao[i] = piso + 0.02;
      this.gravidade[i] = e.gravidade;
      this.arrasto[i] = e.arrasto;
      const tom = 0.85 + Math.random() * 0.3;
      cor[i * 4] = e.cor[0] * tom;
      cor[i * 4 + 1] = e.cor[1] * tom;
      cor[i * 4 + 2] = e.cor[2] * tom;
      cor[i * 4 + 3] = e.alfa;
      (this.tamanho.array as Float32Array)[i] = e.tamanho * (0.7 + Math.random() * 0.6);
      this.cresce[i] = e.cresce;
    }
    this.posicao.needsUpdate = true;
    this.cor.needsUpdate = true;
    this.tamanho.needsUpdate = true;
  }

  private avancar(dt: number): void {
    const pos = this.posicao.array as Float32Array;
    const cor = this.cor.array as Float32Array;
    const tam = this.tamanho.array as Float32Array;
    let ativas = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.vida[i] <= 0) continue;
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) {
        pos[i * 3 + 1] = LONGE;
        cor[i * 4 + 3] = 0;
        continue;
      }
      ativas++;
      const amortece = Math.exp(-dt * this.arrasto[i]);
      this.vel[i * 3] *= amortece;
      this.vel[i * 3 + 2] *= amortece;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * amortece - this.gravidade[i] * dt;
      pos[i * 3] += this.vel[i * 3] * dt;
      pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < this.chao[i]) {
        // pousa no chão e para
        pos[i * 3 + 1] = this.chao[i];
        this.vel[i * 3] = this.vel[i * 3 + 1] = this.vel[i * 3 + 2] = 0;
      }
      // some no último terço da vida
      cor[i * 4 + 3] = this.alfa[i] * Math.min(1, (this.vida[i] / this.vidaMax[i]) * 3);
      tam[i] += this.cresce[i] * dt;
    }
    this.ativas = ativas;
    this.posicao.needsUpdate = true;
    this.cor.needsUpdate = true;
    this.tamanho.needsUpdate = true;
  }
}
