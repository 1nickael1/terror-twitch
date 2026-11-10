// Fase 1 (C2.4): regras de conteúdo além do validador e do robô de `fases.test.ts`.
import { describe, expect, it } from 'vitest';
import { celulasDe } from '../../src/levels/alcance';
import { fase1 } from '../../src/levels/fase1';
import { FASES } from '../../src/levels/indice';
import { percorrer } from '../../src/levels/robo';
import { validarFase } from '../../src/levels/validar';
import { tipoDe } from '../../src/sim/ai/tipos';
import { IA, JOGADOR, PORTA } from '../../src/sim/balance';
import { solidoDe } from '../../src/sim/doors';
import { alturaPiso, celula, centro, criarGrid, passavel, SALTO, visivel, type Coord } from '../../src/sim/grid';
import { resolverOnde } from '../../src/sim/onde';
import { PASSO, step } from '../../src/sim/step';
import { criarWorld, INPUT_VAZIO } from '../../src/sim/world';
import { correrPerseguicao } from './perseguicaoRoteiro';

const g = criarGrid(fase1.planta, fase1.legenda);
const piso = (c: Coord) => celula(g, c[0], c[1]).tipo === 'piso';
const VIZINHO = { n: [0, -1], s: [0, 1], l: [1, 0], o: [-1, 0] } as const;

/** Células alcançáveis a partir de `de` sem passar pelas células `barradas`. */
function alcance(de: Coord, barradas: readonly Coord[]): Set<string> {
  const chave = (c: Coord) => `${c[0]},${c[1]}`;
  const bloqueia = new Set(barradas.map(chave));
  const visto = new Set([chave(de)]);
  const fila: Coord[] = [de];
  for (let k = 0; k < fila.length; k++) {
    for (const [dc, dr] of Object.values(VIZINHO)) {
      const v: Coord = [fila[k][0] + dc, fila[k][1] + dr];
      if (visto.has(chave(v)) || bloqueia.has(chave(v)) || !passavel(g, fila[k], v, SALTO)) continue;
      visto.add(chave(v));
      fila.push(v);
    }
  }
  return visto;
}

describe('fase 1', () => {
  it('está no índice e sozinha', () => {
    expect(FASES).toEqual([fase1]);
  });

  it('passa no validador com os mínimos do adendo', () => {
    expect(validarFase(fase1)).toEqual([]);
    expect(fase1.segredos.length).toBeGreaterThanOrEqual(2);
    expect(fase1.documentos.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fase1.pickups.filter((p) => p.tipo === 'cartao').map((p) => p.nivel))).toEqual(new Set([1, 2]));
  });

  it('o robô conclui entre 70 e 180 s simulados', () => {
    const r = percorrer(fase1, 600);
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    const segundos = r.passos * PASSO;
    expect(segundos).toBeGreaterThanOrEqual(70);
    expect(segundos).toBeLessThanOrEqual(180);
  });

  it('tem entre 12 e 20 inimigos comuns, contando a sala de combate', () => {
    const spawn = fase1.gatilhos.flatMap((gat) => gat.faz.flatMap((a) => (a.acao === 'spawn' ? a.inimigos : [])));
    const total = fase1.inimigos.length + spawn.length;
    expect(total).toBeGreaterThanOrEqual(12);
    expect(total).toBeLessThanOrEqual(20);
  });

  it('documentos têm de 60 a 120 palavras', () => {
    for (const d of fase1.documentos) {
      const n = d.texto.split(/\s+/).filter(Boolean).length;
      expect(n, d.id).toBeGreaterThanOrEqual(60);
      expect(n, d.id).toBeLessThanOrEqual(120);
    }
  });

  it('o chefe fica a mais de 8 m de toda célula alcançável antes da porta do isolamento', () => {
    const chefe = centro(resolverOnde(g, fase1.chefe!.em));
    const isolamento = resolverOnde(g, 'N');
    const antes = alcance(resolverOnde(g, 'P'), [isolamento]);
    for (const k of antes) {
      const [col, row] = k.split(',').map(Number);
      // a célula inteira: o ponto mais próximo dela ao chefe
      const dx = Math.max(col * 2 - chefe.x, 0, chefe.x - (col + 1) * 2);
      const dz = Math.max(row * 2 - chefe.z, 0, chefe.z - (row + 1) * 2);
      expect(Math.hypot(dx, dz), k).toBeGreaterThan(8);
    }
  });

  it('da antecâmara não se vê o chefe (sem janela para a cela: a mira não o acorda antes da perseguição)', () => {
    const w = criarWorld(fase1);
    const chefe = centro(resolverOnde(g, fase1.chefe!.em));
    const cabeca = alturaPiso(g, chefe) + tipoDe('entidade096').altura * IA.olhos;
    for (const c of celulasDe([42, 28, 6, 6])) {
      if (!piso(c)) continue;
      const p = centro(c);
      expect(visivel(g, p, chefe, solidoDe(w), alturaPiso(g, p) + JOGADOR.olhos, cabeca), `[${c}]`).toBe(false);
    }
  });

  it('a antecâmara também fica a mais de 8 m do chefe (o checkpoint grava o chefe inerte)', () => {
    const chefe = centro(resolverOnde(g, fase1.chefe!.em));
    for (const c of celulasDe([42, 28, 6, 6])) {
      const p = centro(c);
      expect(Math.hypot(p.x - chefe.x, p.z - chefe.z) - Math.SQRT2).toBeGreaterThan(8);
    }
  });

  it('placas e móveis ficam em piso; placas encostam numa parede', () => {
    const ruins = fase1.props.flatMap((p, i) => {
      if (!piso(p.em)) return [`prop #${i} (${p.tipo}) fora do piso`];
      if (p.tipo !== 'placa') return [];
      if (!p.parede) return [`placa #${i} sem parede`];
      const [dc, dr] = VIZINHO[p.parede];
      return celula(g, p.em[0] + dc, p.em[1] + dr).tipo !== 'parede' ? [`placa #${i} "${p.texto}" sem parede atrás`] : [];
    });
    expect(ruins).toEqual([]);
  });

  it('decalques de parede encostam numa parede e os de chão ficam em piso', () => {
    const ruins = fase1.decals.flatMap((d, i) => {
      if (!piso(d.em)) return [`decal #${i} fora do piso`];
      if (!d.parede) return [];
      const [dc, dr] = VIZINHO[d.parede];
      return celula(g, d.em[0] + dc, d.em[1] + dr).tipo === 'piso' ? [`decal #${i} sem parede atrás`] : [];
    });
    expect(ruins).toEqual([]);
  });

  it('comportas fecham o túnel inteiro do vão (3 × 3), com os números do adendo, longe de portas e terminais', () => {
    const terminais = fase1.terminais.map((t) => centro(resolverOnde(g, t.em)));
    for (const p of fase1.chefe!.perigos) {
      expect(p.area.slice(2)).toEqual([3, 3]);
      expect(p.area[0]).toBe(11);   // as 3 colunas da parede divisória (11–13)
      expect(p).toMatchObject({ duracao: 1.2, recarga: 7, danoChefe: 0.3, danoComum: 60 });
      const gat = fase1.gatilhos.find((x) => x.faz.some((a) => a.acao === 'perigo' && a.id === p.id))!;
      expect(gat.quando.tipo).toBe('terminal');
      expect(gat.umaVez).toBe(false);
      for (const c of celulasDe(p.area)) {
        expect(piso(c)).toBe(true);
        expect(fase1.portas.some((porta) => { const pc = resolverOnde(g, porta.em); return pc[0] === c[0] && pc[1] === c[1]; })).toBe(false);
        // nenhuma célula do vão fica ao alcance de uso (2,2 m) de um terminal
        const pc = centro(c);
        for (const t of terminais) expect(Math.hypot(pc.x - t.x, pc.z - t.z)).toBeGreaterThan(2.2 + 1);
      }
    }
  });

  describe.each([
    ['comporta-a', 'terminal-a', [4, 29] as Coord, 0],             // terminal na parede norte da cabine
    ['comporta-b', 'terminal-b', [4, 33] as Coord, Math.PI],       // terminal na parede sul
  ])('%s', (perigo, terminal, posto, yaw) => {
    const t = centro(resolverOnde(g, fase1.terminais.find((x) => x.id === terminal)!.em));
    const area = fase1.chefe!.perigos.find((x) => x.id === perigo)!.area;
    const centroVao = { x: (area[0] + area[2] / 2) * 2, z: (area[1] + area[3] / 2) * 2 };

    it('de toda posição de uso do terminal, o vão dele aparece pela janela (visível com alturas)', () => {
      const usos: Coord[] = [];
      for (let row = 0; row < g.rows; row++) {
        for (let col = 0; col < g.cols; col++) {
          const p = centro([col, row]);
          if (piso([col, row]) && Math.hypot(p.x - t.x, p.z - t.z) <= PORTA.alcanceUso) usos.push([col, row]);
        }
      }
      expect(usos).toContainEqual(posto);
      for (const u of usos) {
        const p = centro(u);
        const olho = alturaPiso(g, p) + JOGADOR.olhos;
        const cabeca = alturaPiso(g, centroVao) + tipoDe('entidade096').altura * IA.olhos;
        expect(visivel(g, p, centroVao, undefined, olho, cabeca), `uso ${u}`).toBe(true);
      }
    });

    it('nenhuma célula andável fora da cabine fica ao alcance de uso do terminal', () => {
      for (let row = 0; row < g.rows; row++) {
        for (let col = 0; col < g.cols; col++) {
          const c = celula(g, col, row);
          if (c.tipo !== 'piso' || c.piso === 1.5) continue;   // a cabine é a única área a 1,5 m
          // ponto da célula mais próximo do terminal
          const dx = Math.max(col * 2 - t.x, 0, t.x - (col + 1) * 2);
          const dz = Math.max(row * 2 - t.z, 0, t.z - (row + 1) * 2);
          expect(Math.hypot(dx, dz), `[${col}, ${row}]`).toBeGreaterThan(PORTA.alcanceUso);
        }
      }
    });

    it(`usar o ${terminal} da cabine tira 30% da vida do chefe parado no centro do vão`, () => {
      const w = criarWorld(fase1);
      const p = fase1.chefe!.perigos.find((x) => x.id === perigo)!;
      const chefe = w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
      chefe.pos = centro([p.area[0] + 1, p.area[1] + 1]);
      chefe.y = alturaPiso(w.grid, chefe.pos);
      Object.assign(w.chefe!, { fase: 'pausa', timer: 2, naArena: true });
      const j = w.jogador;
      j.pos = centro(posto);
      j.y = alturaPiso(w.grid, j.pos);
      j.yaw = yaw;   // de frente para o terminal
      const eventos = step(w, { ...INPUT_VAZIO, usar: true }, PASSO);
      expect(eventos).toContainEqual({ tipo: 'terminal', id: terminal });
      expect(eventos).toContainEqual({ tipo: 'perigo', id: perigo, estado: 'fecha' });
      expect(chefe.vida).toBeCloseTo(tipoDe('entidade096').vida * 0.7);
    });
  });

  it('da cabine, a linha de visão (com alturas) até o chefe na arena passa pelo vidro da janela', () => {
    const w = criarWorld(fase1);
    const olhoPos = centro([3, 31]);
    const olhoY = alturaPiso(g, olhoPos) + JOGADOR.olhos;
    const chefePos = centro([9, 31]);
    const cabecaY = alturaPiso(g, chefePos) + tipoDe('entidade096').altura * IA.olhos;
    expect(visivel(g, olhoPos, chefePos, solidoDe(w), olhoY, cabecaY)).toBe(true);
    // no plano da janela (x = 11 m, meio da coluna 5), o raio fica entre a mureta e o topo do vidro
    // (faseMesh: mureta até 1,0 m e vidro até 2,2 m acima do piso da célula da janela)
    const janela = celula(g, 5, 31);
    expect(janela.tipo).toBe('janela');
    const t = (5.5 * 2 - olhoPos.x) / (chefePos.x - olhoPos.x);
    const yNoVidro = olhoY + (cabecaY - olhoY) * t;
    expect(yNoVidro).toBeGreaterThan(janela.piso + 1.0);
    expect(yNoVidro).toBeLessThan(janela.piso + 2.2);
  });

  it('da entrada da triagem, a cabine de controle só se alcança passando por um vão de comporta', () => {
    const entrada: Coord = [14, 39];
    const cabine = '3,31';
    expect(alcance(entrada, []).has(cabine)).toBe(true);
    const paineis = fase1.chefe!.perigos.flatMap((p) => celulasDe(p.area));
    expect(alcance(entrada, paineis).has(cabine)).toBe(false);
    expect(fase1.checkpoints).toContainEqual(entrada);
  });

  it('terminais ficam longe das portas (o botão de usar prefere porta)', () => {
    for (const t of fase1.terminais) {
      const pt = centro(resolverOnde(g, t.em));
      for (const porta of fase1.portas) {
        const pp = centro(resolverOnde(g, porta.em));
        expect(Math.hypot(pt.x - pp.x, pt.z - pp.z), `${t.id} x ${porta.id}`).toBeGreaterThan(4.4);
      }
    }
  });
});

describe('perseguição (roteiro a 9 m/s da entrada da cela até a triagem)', () => {
  it('sem fechar portas, o chefe alcança o jogador antes da triagem', () => {
    const r = correrPerseguicao(false);
    expect(r.alcancou).not.toBeNull();
    expect(r.alcancou!).toBeLessThan(r.chegadaJogador);
  });

  it('fechando E, F e G logo depois de atravessar, o jogador chega à triagem com o chefe a pelo menos 3 s', () => {
    const r = correrPerseguicao(true);
    expect(r.alcancou).toBeNull();
    expect(r.chegadaChefe).not.toBeNull();
    const folga = r.chegadaChefe! - r.chegadaJogador;
    expect(folga).toBeGreaterThanOrEqual(3);
    // medido em 10/11/2026: 7,7 s (jogador chega aos 18,2 s; chefe aos 25,9 s)
    expect(folga).toBeLessThanOrEqual(9);
  });
});
