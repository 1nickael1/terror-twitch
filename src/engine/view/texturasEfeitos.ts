// Texturas procedurais (canvas) dos efeitos: clarão de cano, bolha macia (partículas e nuvem) e
// os decalques (sangue, queimado, marca, furo de tiro). Cada view registra as suas em `Recursos`.
import { CanvasTexture, SRGBColorSpace } from 'three';

type Desenho = (g: CanvasRenderingContext2D, s: number, r: () => number) => void;

function aleatorio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(tamanho: number, semente: number, desenho: Desenho): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = tamanho;
  c.height = tamanho;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível');
  desenho(g, tamanho, aleatorio(semente));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function mancha(g: CanvasRenderingContext2D, x: number, y: number, raio: number, cor: string, alfa: number): void {
  const grd = g.createRadialGradient(x, y, 0, x, y, raio);
  grd.addColorStop(0, `rgba(${cor},${alfa})`);
  grd.addColorStop(0.6, `rgba(${cor},${alfa * 0.8})`);
  grd.addColorStop(1, `rgba(${cor},0)`);
  g.fillStyle = grd;
  g.fillRect(x - raio, y - raio, raio * 2, raio * 2);
}

/** Estrela de quatro pontas com miolo branco (aditiva: preto = transparente). */
export function texturaClarao(): CanvasTexture {
  return canvas(64, 7, (g, s, r) => {
    const c = s / 2;
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r() * 0.4;
      const comp = c * (0.6 + r() * 0.4);
      g.strokeStyle = 'rgba(255,200,120,0.55)';
      g.lineWidth = 2 + r() * 3;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a) * comp, c + Math.sin(a) * comp);
      g.stroke();
    }
    const grd = g.createRadialGradient(c, c, 0, c, c, c * 0.6);
    grd.addColorStop(0, 'rgba(255,255,240,1)');
    grd.addColorStop(0.35, 'rgba(255,190,90,0.7)');
    grd.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

/** Ponto macio, branco no centro e transparente na borda. */
export function texturaBolha(): CanvasTexture {
  return canvas(32, 3, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

/** Respingo de sangue escuro: mancha central, gotas e escorridos. */
export function texturaSangue(): CanvasTexture {
  return canvas(128, 11, (g, s, r) => {
    const c = s / 2;
    mancha(g, c, c, s * 0.3, '70,6,6', 0.95);
    for (let k = 0; k < 14; k++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.15 + r() * 0.3);
      mancha(g, c + Math.cos(a) * d, c + Math.sin(a) * d, s * (0.03 + r() * 0.06), '80,8,8', 0.9);
    }
    g.strokeStyle = 'rgba(60,4,4,0.85)';
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2;
      g.lineWidth = 2 + r() * 3;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a) * s * 0.42, c + Math.sin(a) * s * 0.42);
      g.stroke();
    }
  });
}

/** Respingo do frasco: poça amarelo-esverdeada irregular com gotas e cacos de vidro claros. */
export function texturaRespingoQuimico(): CanvasTexture {
  return canvas(128, 53, (g, s, r) => {
    const c = s / 2;
    mancha(g, c, c, s * 0.26, '120,130,34', 0.8);
    for (let k = 0; k < 18; k++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.08 + r() * 0.34);
      mancha(g, c + Math.cos(a) * d, c + Math.sin(a) * d, s * (0.02 + r() * 0.05), '105,118,30', 0.75);
    }
    // cacos: lascas claras e finas
    for (let k = 0; k < 16; k++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.05 + r() * 0.38);
      g.fillStyle = `rgba(210,230,225,${0.55 + r() * 0.35})`;
      g.save();
      g.translate(c + Math.cos(a) * d, c + Math.sin(a) * d);
      g.rotate(r() * Math.PI);
      g.fillRect(-1, -3 - r() * 3, 2, 6 + r() * 4);
      g.restore();
    }
  });
}

/** Marca de queimado: fuligem radial irregular. */
export function texturaQueimado(): CanvasTexture {
  return canvas(128, 23, (g, s, r) => {
    const c = s / 2;
    mancha(g, c, c, s * 0.48, '12,10,8', 0.9);
    for (let k = 0; k < 10; k++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.1 + r() * 0.25);
      mancha(g, c + Math.cos(a) * d, c + Math.sin(a) * d, s * (0.08 + r() * 0.1), '5,4,3', 0.6);
    }
    for (let k = 0; k < 300; k++) {
      g.fillStyle = `rgba(30,24,18,${0.2 + r() * 0.3})`;
      const a = r() * Math.PI * 2;
      const d = r() * s * 0.45;
      g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 2, 2);
    }
  });
}

/** Marca genérica: arranhões paralelos escuros sobre uma mancha suja. */
export function texturaMarca(): CanvasTexture {
  return canvas(128, 41, (g, s, r) => {
    mancha(g, s / 2, s / 2, s * 0.4, '30,26,22', 0.35);
    g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const x = s * (0.28 + k * 0.14 + r() * 0.03);
      g.strokeStyle = 'rgba(14,10,8,0.9)';
      g.lineWidth = 3 + r() * 2;
      g.beginPath();
      g.moveTo(x, s * (0.15 + r() * 0.08));
      g.quadraticCurveTo(x + s * 0.06, s * 0.5, x - s * 0.02, s * (0.8 + r() * 0.08));
      g.stroke();
    }
  });
}

/** Furo de tiro: miolo preto, anel lascado claro. */
export function texturaFuro(): CanvasTexture {
  return canvas(32, 5, (g, s, r) => {
    const c = s / 2;
    mancha(g, c, c, c, '20,18,16', 0.55);
    g.fillStyle = 'rgba(150,140,125,0.6)';
    for (let k = 0; k < 10; k++) {
      const a = r() * Math.PI * 2;
      g.fillRect(c + Math.cos(a) * c * 0.45, c + Math.sin(a) * c * 0.45, 2, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.95)';
    g.beginPath();
    g.arc(c, c, c * 0.28, 0, Math.PI * 2);
    g.fill();
  });
}

/**
 * Faixa de perigo do chão: listras diagonais âmbar e pretas, gastas. As listras têm período que
 * divide o lado, então células vizinhas emendam sem degrau.
 */
export function texturaFaixa(): CanvasTexture {
  return canvas(128, 59, (g, s, r) => {
    const periodo = s / 4;
    g.fillStyle = 'rgba(20,18,14,0.92)';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(214,160,38,0.95)';
    // faixas a 45°: x + y entre k·p e k·p + p/2 (desenhadas além das bordas para cobrir os cantos)
    for (let k = -4; k < 8; k++) {
      const a = k * periodo;
      g.beginPath();
      g.moveTo(a, 0);
      g.lineTo(a + periodo / 2, 0);
      g.lineTo(a + periodo / 2 - s, s);
      g.lineTo(a - s, s);
      g.closePath();
      g.fill();
    }
    // desgaste: pontos e riscos escuros por cima
    for (let k = 0; k < 260; k++) {
      g.fillStyle = `rgba(30,26,20,${0.15 + r() * 0.35})`;
      g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2);
    }
  });
}
