import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { texturaAzulejo } from './view/texturasCenario';

export interface Textures {
  concreto: CanvasTexture;
  /** paredes de revestimento `azulejo` (fase 2; C3.5, correção 1) */
  azulejo: CanvasTexture;
  piso: CanvasTexture;
  teto: CanvasTexture;
  porta: CanvasTexture;
  placa(texto: string): CanvasTexture;
}

type Draw = (g: CanvasRenderingContext2D, s: number) => void;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function make(size: number, draw: Draw, width = size): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível');
  draw(g, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

function speckle(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, light: string, dark: string): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? light : dark;
    g.globalAlpha = 0.08 + r() * 0.12;
    const sz = 1 + r() * 2;
    g.fillRect(r() * s, r() * s, sz, sz);
  }
  g.globalAlpha = 1;
}

export function createTextures(): Textures {
  const concreto = make(128, (g, s) => {
    const r = rng(1);
    g.fillStyle = '#6d6b66';
    g.fillRect(0, 0, s, s);
    speckle(g, s, r, 1400, '#8a8882', '#3e3c39');
    for (let i = 0; i < 6; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 10 + r() * 28;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(40,34,28,0.35)');
      grd.addColorStop(1, 'rgba(40,34,28,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = 'rgba(30,26,22,0.25)';
      g.fillRect(r() * s, s * 0.55, 1 + r() * 2, s * 0.45 * r());
    }
    const grime = g.createLinearGradient(0, s * 0.7, 0, s);
    grime.addColorStop(0, 'rgba(20,18,15,0)');
    grime.addColorStop(1, 'rgba(20,18,15,0.55)');
    g.fillStyle = grime;
    g.fillRect(0, s * 0.7, s, s * 0.3);
    g.fillStyle = 'rgba(25,25,25,0.6)';
    g.fillRect(0, s * 0.35, s, 1);
  });

  const piso = make(128, (g, s) => {
    const r = rng(2);
    g.fillStyle = '#2b2d30';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = 70 + Math.floor(r() * 18);
        g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
        g.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
      }
    }
    speckle(g, s, r, 700, '#7c7f84', '#1d1f22');
  });

  const teto = make(128, (g, s) => {
    const r = rng(3);
    g.fillStyle = '#3a3b3a';
    g.fillRect(0, 0, s, s);
    const t = s / 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const v = 128 + Math.floor(r() * 14);
        g.fillStyle = `rgb(${v},${v},${v - 6})`;
        g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
      }
    }
    speckle(g, s, r, 500, '#a0a09a', '#55554f');
  });

  const porta = make(128, (g, s) => {
    const r = rng(4);
    g.fillStyle = '#4f555c';
    g.fillRect(0, 0, s, s);
    speckle(g, s, r, 600, '#79808a', '#2c3035');
    g.strokeStyle = '#2a2e33';
    g.lineWidth = 6;
    g.strokeRect(8, 8, s - 16, s - 16);
    g.fillStyle = '#0b0d0f';
    g.fillRect(s * 0.38, s * 0.18, s * 0.24, s * 0.16);
    g.fillStyle = '#9aa1a8';
    for (const [x, y] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14]]) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#d9b01c';
    g.fillRect(8, s - 26, s - 16, 8);
  });

  const placa = (texto: string) =>
    make(
      64,
      (g, s) => {
        g.fillStyle = '#d8d6cc';
        g.fillRect(0, 0, s * 2, s);
        g.strokeStyle = '#1a1a1a';
        g.lineWidth = 4;
        g.strokeRect(3, 3, s * 2 - 6, s - 6);
        g.fillStyle = '#1a1a1a';
        g.font = 'bold 26px monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(texto, s, s / 2 + 1);
      },
      128,
    );

  return { concreto, azulejo: texturaAzulejo(), piso, teto, porta, placa };
}
