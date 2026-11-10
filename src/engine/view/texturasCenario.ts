// Texturas procedurais (canvas) do cenário: azulejo das paredes (revestimento `azulejo`), chapa das comportas com faixas de perigo e as placas
// de sinalização. Sinalização institucional inventada: fundo claro, faixa superior escura com um
// símbolo geométrico nosso (hexágono vazado atravessado por uma barra horizontal), texto em caixa alta.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { origemNoAtlas, type LayoutAtlas } from './placasLogica';
import { AZULEJO } from './revestimento';

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

/** Sorteio determinístico (a textura sai igual a cada carga). */
function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Azulejo verde-hospital (C3.5, correção 1): 2 m × 2 m de parede (uma repetição da textura), `AZULEJO.ladrilhos`
 * ladrilhos por lado com rejunte claro, tom variando de peça a peça, brilho do esmalte no canto, lascas,
 * fissuras e manchas leves de umidade. Emenda nas bordas (manchas desenhadas também do outro lado).
 */
export function texturaAzulejo(): CanvasTexture {
  const s = AZULEJO.px;
  const n = AZULEJO.ladrilhos;
  const t = s / n;
  const r = sorteio(49);
  const { c, g } = criarCanvas(s, s);
  g.fillStyle = '#cdd3c6';   // rejunte
  g.fillRect(0, 0, s, s);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const x0 = x * t + 1;
      const y0 = y * t + 1;
      const l = t - 2;
      const k = r() * 14 - 7;
      g.fillStyle = `rgb(${Math.round(104 + k)},${Math.round(150 + k * 1.2)},${Math.round(126 + k)})`;
      g.fillRect(x0, y0, l, l);
      // esmalte: canto de cima mais claro, base levemente escura
      const brilho = g.createLinearGradient(x0, y0, x0 + l, y0 + l);
      brilho.addColorStop(0, 'rgba(235,250,240,0.22)');
      brilho.addColorStop(0.45, 'rgba(235,250,240,0)');
      brilho.addColorStop(1, 'rgba(10,30,20,0.12)');
      g.fillStyle = brilho;
      g.fillRect(x0, y0, l, l);
      // pontinhos do esmalte
      for (let i = 0; i < 18; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(220,240,228,0.18)' : 'rgba(30,60,45,0.18)';
        g.fillRect(x0 + r() * l, y0 + r() * l, 1, 1);
      }
      // lasca num canto (às vezes): aparece o biscoito claro
      if (r() < 0.12) {
        const cx = r() < 0.5 ? x0 : x0 + l;
        const cy = r() < 0.5 ? y0 : y0 + l;
        const tam = 3 + r() * 4;
        g.fillStyle = '#d9d2bf';
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + (cx === x0 ? tam : -tam), cy);
        g.lineTo(cx, cy + (cy === y0 ? tam : -tam));
        g.closePath();
        g.fill();
      }
      // fissura fina (rara)
      if (r() < 0.06) {
        g.strokeStyle = 'rgba(40,55,45,0.45)';
        g.lineWidth = 0.8;
        g.beginPath();
        let px = x0 + r() * l;
        let py = y0;
        g.moveTo(px, py);
        while (py < y0 + l) {
          px = Math.min(x0 + l, Math.max(x0, px + (r() - 0.5) * 6));
          py += 3 + r() * 4;
          g.lineTo(px, Math.min(py, y0 + l));
        }
        g.stroke();
      }
    }
  }
  // manchas de umidade e sujeira, repetidas do outro lado da borda para emendar
  for (let i = 0; i < 12; i++) {
    const x = r() * s;
    const y = r() * s;
    const rad = 14 + r() * 40;
    const amarela = r() < 0.6;
    for (const dx of [-s, 0, s]) {
      for (const dy of [-s, 0, s]) {
        const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        grd.addColorStop(0, amarela ? 'rgba(120,105,50,0.16)' : 'rgba(25,30,25,0.16)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
    }
  }
  // escorridos verticais finos (o rejunte escurece embaixo deles)
  for (let i = 0; i < 8; i++) {
    g.fillStyle = 'rgba(40,45,35,0.12)';
    g.fillRect(r() * s, r() * s * 0.5, 1 + r() * 1.5, s * (0.2 + r() * 0.4));
  }
  const tex = textura(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
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
