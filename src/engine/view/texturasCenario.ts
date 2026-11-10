// Texturas procedurais (canvas) do cenário: chapa das comportas com faixas de perigo e as placas
// de sinalização. Sinalização institucional inventada: fundo claro, faixa superior escura com um
// símbolo geométrico nosso (hexágono vazado atravessado por uma barra horizontal), texto em caixa alta.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { origemNoAtlas, type LayoutAtlas } from './placasLogica';

function criarCanvas(larg: number, alt: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = larg;
  c.height = alt;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível');
  return { c, g };
}

function textura(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Faixa de diagonais pretas e laranja entre `y0` e `y1`. */
function faixasPerigo(g: CanvasRenderingContext2D, larg: number, y0: number, y1: number, passo: number): void {
  g.save();
  g.beginPath();
  g.rect(0, y0, larg, y1 - y0);
  g.clip();
  g.fillStyle = '#d9761c';
  g.fillRect(0, y0, larg, y1 - y0);
  g.fillStyle = '#141210';
  const h = y1 - y0;
  for (let x = -h; x < larg + h; x += passo * 2) {
    g.beginPath();
    g.moveTo(x, y1);
    g.lineTo(x + passo, y1);
    g.lineTo(x + passo + h, y0);
    g.lineTo(x + h, y0);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Chapa grossa de aço: painéis, rebites, sujeira e faixas de perigo na borda de baixo e no topo. */
export function texturaComporta(): CanvasTexture {
  const s = 256;
  const { c, g } = criarCanvas(s, s);
  g.fillStyle = '#4a4d50';
  g.fillRect(0, 0, s, s);
  // painéis com junta escura e leve degradê
  for (let k = 0; k < 4; k++) {
    const x = (k * s) / 4;
    const grd = g.createLinearGradient(x, 0, x + s / 4, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = grd;
    g.fillRect(x, 0, s / 4, s);
    g.fillStyle = 'rgba(10,10,10,0.7)';
    g.fillRect(x, 0, 2, s);
  }
  // rebites
  g.fillStyle = 'rgba(200,200,195,0.45)';
  for (let k = 0; k < 4; k++) {
    for (const y of [42, 128, 196]) {
      g.beginPath();
      g.arc((k * s) / 4 + 9, y, 2.5, 0, Math.PI * 2);
      g.arc(((k + 1) * s) / 4 - 7, y, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // escorridos de sujeira
  for (let k = 0; k < 18; k++) {
    const x = (k * 53) % s;
    g.fillStyle = `rgba(20,16,12,${0.08 + (k % 3) * 0.04})`;
    g.fillRect(x, 0, 3 + (k % 4), s * (0.3 + ((k * 7) % 10) / 20));
  }
  faixasPerigo(g, s, s * 0.8, s, 18);
  faixasPerigo(g, s, 0, s * 0.06, 18);
  return textura(c);
}

/**
 * Símbolo da faixa: um hexágono vazado (de topo chato) atravessado por uma barra horizontal que
 * passa das duas laterais. Desenho nosso, sem simetria de três e sem lembrar ícones conhecidos.
 */
function simbolo(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, cor: string): void {
  g.strokeStyle = cor;
  g.fillStyle = cor;
  g.lineJoin = 'miter';
  g.lineWidth = r * 0.18;
  const rh = r * 0.78;
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const x = cx + rh * Math.cos(a);
    const y = cy + rh * Math.sin(a);
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();
  const meia = r * 0.11;
  g.fillRect(cx - r * 1.08, cy - meia, r * 2.16, meia * 2);
}

const FONTE = "'Arial Narrow', 'Segoe UI', Arial, Helvetica, sans-serif";

/** Desenha uma placa de sinalização (512 × 256 lógicos) no retângulo dado do canvas, com as linhas já quebradas (`linhasDaPlaca`). */
function desenharPlaca(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, linhas: readonly string[]): void {
  const larg = 512;
  const alt = 256;
  const faixa = 64;
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.translate(x0, y0);
  g.scale(w / larg, h / alt);
  // fundo claro, um pouco gasto, e borda
  g.fillStyle = '#e6e2d6';
  g.fillRect(0, 0, larg, alt);
  g.fillStyle = 'rgba(90,80,60,0.08)';
  for (let k = 0; k < 40; k++) g.fillRect((k * 97) % larg, (k * 41) % alt, 18 + (k % 5) * 6, 3);
  g.strokeStyle = '#2b2b2a';
  g.lineWidth = 6;
  g.strokeRect(3, 3, larg - 6, alt - 6);
  // faixa superior com o símbolo e um traço de código
  g.fillStyle = '#1f3b3d';
  g.fillRect(6, 6, larg - 12, faixa);
  simbolo(g, 52, 38, 24, '#e6e2d6');
  g.fillStyle = '#e6e2d6';
  g.fillRect(96, 30, 6, 22);
  g.fillRect(110, 30, larg - 140, 4);
  g.fillRect(110, 48, (larg - 140) * 0.55, 4);
  // texto: o maior tamanho que cabe na largura e na altura livres
  const area = { x: 24, y: faixa + 14, w: larg - 48, h: alt - faixa - 30 };
  let tam = 64;
  const caber = () => {
    g.font = `700 ${tam}px ${FONTE}`;
    const largOk = linhas.every((l) => g.measureText(l).width <= area.w);
    return largOk && linhas.length * tam * 1.1 <= area.h;
  };
  while (tam > 14 && !caber()) tam -= 2;
  g.fillStyle = '#1a1a19';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const total = linhas.length * tam * 1.1;
  linhas.forEach((l, k) => {
    g.fillText(l, larg / 2, area.y + (area.h - total) / 2 + tam * 1.1 * (k + 0.5));
  });
  g.restore();
}

/** Placa de sinalização (512 × 256) com as linhas já quebradas (`linhasDaPlaca`). */
export function texturaPlaca(linhas: readonly string[]): CanvasTexture {
  const { c, g } = criarCanvas(512, 256);
  desenharPlaca(g, 0, 0, 512, 256, linhas);
  return textura(c);
}

/** Atlas com todas as placas da fase (uma textura, uma malha); posições pelo `layoutAtlas`. */
export function texturaAtlasPlacas(placas: readonly (readonly string[])[], layout: LayoutAtlas): CanvasTexture {
  const { c, g } = criarCanvas(layout.largTotal, layout.altTotal);
  placas.forEach((linhas, i) => {
    const { x, y } = origemNoAtlas(i, layout);
    desenharPlaca(g, x, y, layout.larg, layout.alt, linhas);
  });
  return textura(c);
}
