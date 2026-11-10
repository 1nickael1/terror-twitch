// Fase 2 (C3.5): regras de conteúdo além do validador e do robô de `fases.test.ts`.
import { describe, expect, it } from 'vitest';
import { celulasDe } from '../../src/levels/alcance';
import { fase1 } from '../../src/levels/fase1';
import { CHEGADA_ELEVADOR, fase2, PERIGOS, VIAGEM_ELEVADOR } from '../../src/levels/fase2';
import { MENSAGENS, mensagemContagem, mensagemNecroterio } from '../../src/levels/fase2/textos';
import { FASES } from '../../src/levels/indice';
import { percorrer } from '../../src/levels/robo';
import { validarFase } from '../../src/levels/validar';
import { tipoDe } from '../../src/sim/ai/tipos';
import { IA, JOGADOR, PORTA } from '../../src/sim/balance';
import { solidoDe } from '../../src/sim/doors';
import type { PerigoArea } from '../../src/sim/fase';
import { alcanceTiro, alturaPiso, celula, centro, coordDe, criarGrid, type Coord, visivel } from '../../src/sim/grid';
import { resolverOnde } from '../../src/sim/onde';
import { avancarPerigos } from '../../src/sim/perigos';
import { PASSO, step } from '../../src/sim/step';
import { avancarGatilhos } from '../../src/sim/triggers';
import { criarWorld, INPUT_VAZIO, type World } from '../../src/sim/world';

const g = criarGrid(fase2.planta, fase2.legenda);
const piso = (c: Coord) => celula(g, c[0], c[1]).tipo === 'piso';
const VIZINHO = { n: [0, -1], s: [0, 1], l: [1, 0], o: [-1, 0] } as const;
const mesma = (a: Coord, b: Coord) => a[0] === b[0] && a[1] === b[1];
const dentro = (c: Coord, a: readonly [number, number, number, number]) =>
  c[0] >= a[0] && c[0] < a[0] + a[2] && c[1] >= a[1] && c[1] < a[1] + a[3];
/** Menor distância (m, em planta) de um ponto à célula inteira. */
function distCelula(p: { x: number; z: number }, c: Coord): number {
  const dx = Math.max(c[0] * 2 - p.x, 0, p.x - (c[0] + 1) * 2);
  const dz = Math.max(c[1] * 2 - p.z, 0, p.z - (c[1] + 1) * 2);
  return Math.hypot(dx, dz);
}
const porta = (w: World, id: string) => w.portas.find((p) => p.id === id)!;
/** Avança `segundos` com o jogador parado, matando todo inimigo a cada passo; devolve os eventos. */
function esperar(w: World, segundos: number, aCada?: (t: number) => void) {
  const eventos = [];
  for (let k = 0; k < Math.round(segundos / PASSO); k++) {
    eventos.push(...step(w, INPUT_VAZIO, PASSO));
    for (const i of w.inimigos) i.modo = 'morto';
    aCada?.(w.relogio);
  }
  return eventos;
}

describe('fase 2', () => {
  it('vem depois da fase 1 no índice', () => {
    expect(FASES).toEqual([fase1, fase2]);
  });

  it('passa no validador com os mínimos do adendo (≥ 2 segredos, ≥ 2 documentos, cartões 1 e 2 com portas)', () => {
    expect(validarFase(fase2)).toEqual([]);
    expect(fase2.segredos.length).toBeGreaterThanOrEqual(2);
    expect(fase2.documentos.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fase2.pickups.filter((p) => p.tipo === 'cartao').map((p) => p.nivel))).toEqual(new Set([1, 2]));
    expect(new Set(fase2.portas.filter((p) => p.exige).map((p) => p.exige))).toEqual(new Set([1, 2]));
    expect(fase2.ambiente.somDeFundo).toBe('hospital');
  });

  it('o robô (sem inimigos) conclui entre 90 e 240 s simulados, com a espera do elevador', () => {
    const r = percorrer(fase2, 600);
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    const segundos = r.passos * PASSO;
    expect(segundos).toBeGreaterThanOrEqual(90);
    expect(segundos).toBeLessThanOrEqual(240);
  });

  it('documentos têm de 60 a 120 palavras e não repetem os da fase 1', () => {
    for (const d of fase2.documentos) {
      const n = d.texto.split(/\s+/).filter(Boolean).length;
      expect(n, d.id).toBeGreaterThanOrEqual(60);
      expect(n, d.id).toBeLessThanOrEqual(120);
      expect(fase1.documentos.some((x) => x.id === d.id || x.titulo === d.titulo)).toBe(false);
    }
  });

  it('arsenal: pistola e escopeta com pouca munição; a submetralhadora logo depois da triagem', () => {
    expect(fase2.arsenal.armas).toEqual(['pistola', 'escopeta']);
    expect(fase2.arsenal.municao.balas ?? 0).toBeLessThanOrEqual(30);
    expect(fase2.arsenal.municao.cartuchos ?? 0).toBeLessThanOrEqual(8);
    const smg = fase2.pickups.find((p) => p.tipo === 'arma' && p.arma === 'smg')!;
    expect(dentro(smg.em as Coord, [18, 2, 7, 7])).toBe(true);   // posto de enfermagem, depois da porta da triagem
    const leves = fase2.pickups.filter((p) => p.tipo === 'municao' && p.municao === 'leves');
    expect(leves.length).toBeGreaterThanOrEqual(6);
  });

  it('corpos de verdade e cirúrgicos deitados dividem a enfermaria', () => {
    const naEnfermaria = fase2.inimigos.filter((i) => dentro(i.em as Coord, [2, 14, 28, 8]));
    expect(naEnfermaria.filter((i) => i.corpo && i.tipo === 'reanimado').length).toBeGreaterThanOrEqual(4);
    expect(naEnfermaria.filter((i) => !i.corpo && i.tipo === 'reanimado_cirurgico').length).toBeGreaterThanOrEqual(3);
    // cortinas sob teto de pelo menos 2,8 m (trilho a 2,32 m)
    for (const p of fase2.props.filter((x) => x.tipo === 'cortina' || x.tipo === 'lampada_uv')) {
      const c = celula(g, p.em[0], p.em[1]);
      expect(c.teto - c.piso, `${p.tipo} [${p.em}]`).toBeGreaterThanOrEqual(2.8);
    }
  });

  it('enfermeiros ficam sob teto de pelo menos 4 m e veem o corredor pela janela, que barra o frasco', () => {
    const enfermeiros = fase2.inimigos.filter((i) => i.tipo === 'enfermeiro');
    expect(enfermeiros.length).toBeGreaterThanOrEqual(2);
    for (const e of enfermeiros) {
      const c = celula(g, (e.em as Coord)[0], (e.em as Coord)[1]);
      expect(c.teto - c.piso).toBeGreaterThanOrEqual(4);
    }
    const w = criarWorld(fase2);
    const e = centro([40, 5]);
    const corredor = centro([34, 5]);
    const olhos = alturaPiso(g, e) + tipoDe('enfermeiro').altura * IA.olhos;
    expect(celula(g, 35, 5).tipo).toBe('janela');
    expect(visivel(g, e, corredor, solidoDe(w), olhos, JOGADOR.olhos)).toBe(true);
    const d = Math.hypot(corredor.x - e.x, corredor.z - e.z);
    expect(alcanceTiro(g, e, { x: corredor.x - e.x, z: corredor.z - e.z }, d, solidoDe(w))).toBeLessThan(d);
  });

  it('placas e móveis ficam em piso; placas encostam numa parede', () => {
    const ruins = fase2.props.flatMap((p, i) => {
      if (!piso(p.em)) return [`prop #${i} (${p.tipo}) fora do piso`];
      if (p.tipo !== 'placa') return [];
      if (!p.parede) return [`placa #${i} sem parede`];
      const [dc, dr] = VIZINHO[p.parede];
      return celula(g, p.em[0] + dc, p.em[1] + dr).tipo !== 'parede' ? [`placa #${i} "${p.texto}" sem parede atrás`] : [];
    });
    expect(ruins).toEqual([]);
  });

  it('decalques de parede encostam numa parede e os de chão ficam em piso', () => {
    const ruins = fase2.decals.flatMap((d, i) => {
      if (!piso(d.em)) return [`decal #${i} fora do piso`];
      if (!d.parede) return [];
      const [dc, dr] = VIZINHO[d.parede];
      return celula(g, d.em[0] + dc, d.em[1] + dr).tipo === 'piso' ? [`decal #${i} sem parede atrás`] : [];
    });
    expect(ruins).toEqual([]);
  });

  it('terminais ficam longe das portas (o botão de usar prefere porta)', () => {
    for (const t of fase2.terminais) {
      const pt = centro(resolverOnde(g, t.em));
      for (const p of fase2.portas) {
        const pp = centro(resolverOnde(g, p.em));
        expect(Math.hypot(pt.x - pp.x, pt.z - pp.z), `${t.id} x ${p.id}`).toBeGreaterThan(4.4);
      }
    }
  });
});

describe('fase 2: necrotério e elevador', () => {
  const gatilho = (id: string) => fase2.gatilhos.find((x) => x.id === id)!;

  it('há checkpoint na antecâmara, a até 3 células da porta do necrotério', () => {
    const g0 = resolverOnde(g, 'G');
    expect(fase2.checkpoints.some((c) => Math.abs(c[0] - g0[0]) + Math.abs(c[1] - g0[1]) <= 3 && c[1] < g0[1])).toBe(true);
  });

  it('o elevador abre de 40 a 50 s depois do travamento, e não antes', () => {
    expect(CHEGADA_ELEVADOR).toBeGreaterThanOrEqual(40);
    expect(CHEGADA_ELEVADOR).toBeLessThanOrEqual(50);
    const w = criarWorld(fase2);
    w.jogador.pos = centro([48, 20]);
    w.jogador.y = alturaPiso(w.grid, w.jogador.pos);
    let abriu: number | null = null;
    let inicio = NaN;
    const eventos = esperar(w, 1, () => { if (Number.isNaN(inicio) && 'necroterio' in w.gatilhosQuando) inicio = w.gatilhosQuando.necroterio; });
    expect(porta(w, 'necroterio').estado).toBe('trancada');
    expect(eventos).toContainEqual({ tipo: 'mensagem', texto: mensagemNecroterio(CHEGADA_ELEVADOR) });
    eventos.push(...esperar(w, 55, (t) => {
      if (abriu === null && porta(w, 'elevador').estado !== 'trancada') abriu = t - inicio;
    }));
    expect(abriu).not.toBeNull();
    expect(abriu!).toBeGreaterThanOrEqual(40);
    expect(abriu!).toBeLessThanOrEqual(50);
    expect(porta(w, 'elevador').estado).toBe('aberta');
    expect(eventos).toContainEqual({ tipo: 'som', id: 'elevador' });
    // as gavetas abriram (som e reanimados) e a contagem foi avisada, tudo antes da porta
    expect(eventos.filter((e) => e.tipo === 'som' && e.id === 'gaveta').length).toBeGreaterThanOrEqual(4);
    for (const s of [30, 15, 5]) expect(eventos).toContainEqual({ tipo: 'mensagem', texto: mensagemContagem(s) });
    expect(eventos).toContainEqual({ tipo: 'mensagem', texto: MENSAGENS.elevadorAberto });
  });

  it('cada gaveta que abre põe um reanimado na frente de uma parede de gavetas, antes do elevador', () => {
    const gavetas = fase2.props.filter((p) => p.tipo === 'gavetas');
    const gats = fase2.gatilhos.filter((x) => x.id.startsWith('gaveta-'));
    expect(gats.length).toBeGreaterThanOrEqual(4);
    for (const gat of gats) {
      expect(gat.quando).toMatchObject({ tipo: 'tempo', desde: 'necroterio' });
      if (gat.quando.tipo === 'tempo') expect(gat.quando.apos).toBeLessThan(CHEGADA_ELEVADOR);
      expect(gat.faz).toContainEqual({ acao: 'som', id: 'gaveta' });
      const spawn = gat.faz.find((a) => a.acao === 'spawn');
      expect(spawn?.acao === 'spawn' && spawn.inimigos.length > 0).toBe(true);
      if (spawn?.acao !== 'spawn') continue;
      for (const ini of spawn.inimigos) {
        expect(ini.tipo).toBe('reanimado');
        const em = ini.em as Coord;
        // a célula da frente de alguma parede de gavetas (a vizinha para dentro da sala)
        const naFrente = gavetas.some((p) => {
          const [dc, dr] = VIZINHO[p.parede!];
          return mesma(em, [p.em[0] - dc, p.em[1] - dr]) || mesma(em, p.em);
        });
        expect(naFrente, `[${em}]`).toBe(true);
      }
    }
  });

  it('entrar na cabine tranca a porta da frente e abre a do fundo depois da viagem', () => {
    expect(gatilho('elevador-chega').quando).toEqual({ tipo: 'tempo', apos: VIAGEM_ELEVADOR, desde: 'elevador-entra' });
    const w = criarWorld(fase2);
    for (const id of ['elevador']) Object.assign(porta(w, id), { estado: 'aberta', abertura: 1 });
    w.jogador.pos = centro([48, 28]);
    w.jogador.y = alturaPiso(w.grid, w.jogador.pos);
    esperar(w, 1);
    expect(porta(w, 'elevador').estado).toBe('trancada');
    expect(porta(w, 'elevador-fundo').estado).toBe('trancada');
    esperar(w, VIAGEM_ELEVADOR);
    expect(porta(w, 'elevador-fundo').estado).toBe('aberta');
  });
});

describe('fase 2: anfiteatro e o chefe 049', () => {
  const chefe = fase2.chefe!;

  it('o 049 fica inerte no centro do piso, com retomada andável e corpos espalhados', () => {
    expect(chefe).toMatchObject({ tipo: 'entidade049', nome: 'SCP-049' });
    const em = resolverOnde(g, chefe.em);
    expect(piso(em) && piso(resolverOnde(g, chefe.retomada))).toBe(true);
    expect(dentro(em, [33, 34, 8, 8])).toBe(true);   // entre as duas áreas UV
    const w = criarWorld(fase2);
    expect(w.chefe).toMatchObject({ tipo: 'entidade049', fase: 'inerte' });
    const corpos = fase2.inimigos.filter((i) => i.corpo && dentro(i.em as Coord, chefe.arena));
    expect(corpos.length).toBeGreaterThanOrEqual(5);
  });

  it('o piso central é cercado por degraus de observação (DEGRAU de 0,5 m) até a galeria', () => {
    const alturas = [31, 32, 33, 34, 41, 42, 43, 44].map((row) => celula(g, 36, row).piso);
    expect(alturas).toEqual([1.5, 1, 0.5, 0, 0, 0.5, 1, 1.5]);
  });

  it('entrar no anfiteatro tranca a porta de trás, desperta o chefe e liga o alarme; o chefe morto abre a saída', () => {
    const entrada = fase2.gatilhos.find((x) => x.id === 'anfiteatro')!;
    expect(entrada.faz).toEqual(expect.arrayContaining([
      { acao: 'porta', id: 'anfiteatro', estado: 'trancar' }, { acao: 'chefe' }, { acao: 'alarme', ligado: true },
    ]));
    const w = criarWorld(fase2);
    w.jogador.pos = centro([30, 31]);
    w.jogador.y = alturaPiso(w.grid, w.jogador.pos);
    const ev = avancarGatilhos(w, []);
    expect(ev).toContainEqual({ tipo: 'chefe_desperta' });
    expect(w.alarme).toBe(true);
    w.chefe!.fase = 'morto';
    const fim = avancarGatilhos(w, []);
    expect(w.alarme).toBe(false);
    expect(fim).toContainEqual({ tipo: 'mensagem', texto: MENSAGENS.fim });
    expect(['abrindo', 'aberta']).toContain(porta(w, 'anfiteatro-saida').estado);
  });

  it('duas áreas UV grandes e duas linhas de vapor, cada uma acionada pelo seu terminal (várias vezes)', () => {
    const uv = chefe.perigos.filter((p) => p.tipo === 'ultravioleta') as PerigoArea[];
    const vapor = chefe.perigos.filter((p) => p.tipo === 'vapor') as PerigoArea[];
    expect(uv.length).toBe(2);
    expect(vapor.length).toBe(2);
    for (const p of uv) expect(p.area[2] * p.area[3]).toBeGreaterThanOrEqual(30);
    for (const p of vapor) expect(Math.min(p.area[2], p.area[3])).toBe(1);
    const terminais = new Set<string>();
    for (const p of chefe.perigos) {
      const gat = fase2.gatilhos.filter((x) => x.faz.some((a) => a.acao === 'perigo' && a.id === p.id));
      expect(gat.length).toBe(1);
      expect(gat[0].quando.tipo).toBe('terminal');
      expect(gat[0].umaVez).toBe(false);
      if (gat[0].quando.tipo === 'terminal') terminais.add(gat[0].quando.id);
    }
    expect(terminais.size).toBe(4);
  });

  describe.each(PERIGOS.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    const gat = fase2.gatilhos.find((x) => x.faz.some((a) => a.acao === 'perigo' && a.id === p.id))!;
    const termId = gat.quando.tipo === 'terminal' ? gat.quando.id : '';
    const tc = resolverOnde(g, fase2.terminais.find((t) => t.id === termId)!.em);
    const t = centro(tc);
    // a célula de uso: vizinha do terminal para dentro da sala
    const uso: Coord = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dc, dr]): Coord => [tc[0] + dc, tc[1] + dr]).find((c) => piso(c))!;

    it('números do perigo de área dentro das regras (recarga, fração do chefe) e teto alto', () => {
      expect(p.recarga).toBeGreaterThanOrEqual(p.aviso + p.duracao);
      expect(p.danoChefePorSeg * p.duracao).toBeGreaterThanOrEqual(0.2);
      expect(p.danoChefePorSeg * p.duracao).toBeLessThanOrEqual(0.35);
      for (const c of celulasDe(p.area)) {
        const cel = celula(g, c[0], c[1]);
        expect(cel.teto - cel.piso).toBeGreaterThanOrEqual(2.8);
      }
    });

    it('de dentro da área o terminal fica fora de alcance; a área começa logo depois da célula de uso', () => {
      for (const c of celulasDe(p.area)) expect(distCelula(t, c), `[${c}]`).toBeGreaterThan(PORTA.alcanceUso);
      expect(dentro(uso, p.area)).toBe(false);
      // o chefe que vem tocar o jogador na célula de uso para na vizinha de dentro: na área
      const frente: Coord = [uso[0] + (uso[0] - tc[0]), uso[1] + (uso[1] - tc[1])];
      expect(dentro(frente, p.area)).toBe(true);
      // a placa do perigo fica a até 2 células do terminal
      const placa = fase2.props.find((x) => x.tipo === 'placa' && Math.abs(x.em[0] - uso[0]) + Math.abs(x.em[1] - uso[1]) <= 2
        && /UV|VAPOR/.test(x.texto ?? ''));
      expect(placa).toBeDefined();
    });

    it('acordado, o chefe vem tocar o jogador parado na célula de uso e para dentro da área', () => {
      const w = criarWorld(fase2);
      for (const i of w.inimigos) if (i.id !== w.chefe!.inimigoId) Object.assign(i, { modo: 'morto', vida: 0 });
      const j = w.jogador;
      j.pos = centro([30, 31]);   // a entrada: tranca a porta e acorda o chefe
      j.y = alturaPiso(w.grid, j.pos);
      avancarGatilhos(w, []);
      j.pos = centro(uso);
      j.y = alturaPiso(w.grid, j.pos);
      const boss = w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
      let entrou: number | null = null;
      for (let k = 0; k < 15 / PASSO; k++) {
        step(w, INPUT_VAZIO, PASSO);
        j.vida = JOGADOR.vidaMax;   // o toque não interessa aqui
        if (entrou === null && dentro(coordDe(boss.pos), p.area)) entrou = k * PASSO;
      }
      expect(entrou).not.toBeNull();
      expect(entrou!).toBeLessThan(12);
      expect(dentro(coordDe(boss.pos), p.area)).toBe(true);
    });

    it('usar o terminal da célula de uso tira a fração configurada do chefe parado na área, sem ferir o jogador', () => {
      const w = criarWorld(fase2);
      const boss = w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
      const alvo: Coord = [p.area[0] + Math.floor(p.area[2] / 2), p.area[1] + Math.floor(p.area[3] / 2)];
      boss.pos = centro(alvo);
      boss.y = alturaPiso(w.grid, boss.pos);
      const j = w.jogador;
      j.pos = centro(uso);
      j.y = alturaPiso(w.grid, j.pos);
      j.yaw = Math.atan2(-(t.x - j.pos.x), -(t.z - j.pos.z));   // de frente para o terminal
      const ev = step(w, { ...INPUT_VAZIO, usar: true }, PASSO);
      expect(ev).toContainEqual({ tipo: 'terminal', id: termId });
      expect(ev).toContainEqual({ tipo: 'perigo', id: p.id, estado: 'aviso' });
      // só os perigos (o chefe não anda): aviso + duração inteiros
      for (let k = 0; k < Math.ceil((p.aviso + p.duracao + 0.5) / PASSO); k++) avancarPerigos(w, PASSO);
      const vida = tipoDe('entidade049').vida;
      expect(boss.vida).toBeCloseTo(vida * (1 - p.danoChefePorSeg * p.duracao), 0);
      expect(j.vida).toBe(JOGADOR.vidaMax);
    });
  });
});

describe('fase 2: lote final do CP3', () => {
  /**
   * Entra andando (devagar ou não) até o gatilho que tranca a porta, segue `atraso` quadros e dá ré por 4 s.
   * Devolve se terminou do lado de fora com a porta trancada (o softlock da revisão final, A1).
   */
  function entraERecua(de: Coord, yaw: number, gatilho: string, porta: string, foraAte: number, atraso: number, devagar: boolean): boolean {
    const w = criarWorld(fase2);
    for (const i of w.inimigos) if (i.id !== w.chefe!.inimigoId) Object.assign(i, { modo: 'morto', vida: 0 });
    Object.assign(w.portas.find((p) => p.id === porta)!, { estado: 'aberta', abertura: 1 });
    const j = w.jogador;
    j.pos = centro(de);
    j.y = alturaPiso(w.grid, j.pos);
    j.yaw = yaw;
    for (let k = 0; k < 10 / PASSO && !w.gatilhosFeitos.has(gatilho); k++) step(w, { ...INPUT_VAZIO, frente: 1, devagar }, PASSO);
    expect(w.gatilhosFeitos.has(gatilho)).toBe(true);
    for (let k = 0; k < atraso; k++) step(w, { ...INPUT_VAZIO, frente: 1, devagar }, PASSO);
    for (let k = 0; k < 4 / PASSO; k++) {
      step(w, { ...INPUT_VAZIO, frente: -1, devagar }, PASSO);
      j.vida = JOGADOR.vidaMax;
    }
    const p = w.portas.find((x) => x.id === porta)!;
    return p.estado === 'trancada' && coordDe(j.pos)[1] <= foraAte;
  }

  it.each([0, 1, 2, 3, 4, 5, 6])('dar ré %i quadros depois do gatilho nunca deixa o jogador trancado fora do anfiteatro nem da cabine', (atraso) => {
    for (const devagar of [true, false]) {
      expect(entraERecua([30, 28], Math.PI, 'anfiteatro', 'anfiteatro', 29, atraso, devagar), `anfiteatro, devagar ${devagar}`).toBe(false);
      expect(entraERecua([48, 24], Math.PI, 'elevador-entra', 'elevador', 26, atraso, devagar), `cabine, devagar ${devagar}`).toBe(false);
    }
  });

  it('as áreas que trancam porta deixam uma célula livre entre elas e a porta', () => {
    for (const [gat, porta] of [['anfiteatro', 'J'], ['elevador-entra', 'H'], ['necroterio', 'G']] as const) {
      const g0 = fase2.gatilhos.find((x) => x.id === gat)!;
      const p = resolverOnde(g, porta);
      if (g0.quando.tipo !== 'area') throw new Error(gat);
      for (const c of celulasDe(g0.quando.area)) {
        expect(Math.max(Math.abs(c[0] - p[0]), Math.abs(c[1] - p[1])), `${gat} [${c}]`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('a área de entrada do anfiteatro cobre toda a largura da galeria (não dá para entrar sem passar por ela)', () => {
    const g0 = fase2.gatilhos.find((x) => x.id === 'anfiteatro')!;
    expect(g0.quando).toMatchObject({ tipo: 'area', area: [27, 31, 20, 2] });
    expect(g0.faz).toEqual(expect.arrayContaining([{ acao: 'porta', id: 'anfiteatro', estado: 'trancar' }, { acao: 'chefe' }]));
  });

  it('foco branco-quente forte sobre o chefe, abaixo do alcance das luzes; luzes do anfiteatro perto do que iluminam', () => {
    const em = resolverOnde(g, fase2.chefe!.em);
    const foco = fase2.luzes.find((l) => Math.abs(l.em[0] - em[0]) <= 1 && Math.abs(l.em[1] - em[1]) <= 1 && !l.grupo)!;
    expect(foco).toBeDefined();
    expect(foco.intensidade).toBeGreaterThanOrEqual(2.5);
    const [r, gr, b] = [(foco.cor >> 16) & 255, (foco.cor >> 8) & 255, foco.cor & 255];
    expect(r >= gr && gr >= b && r > 240).toBe(true);
    const piso = celula(g, foco.em[0], foco.em[1]).piso;
    expect(foco.altura! - piso).toBeGreaterThan(tipoDe('entidade049').altura + 0.5);
    expect(foco.altura! - piso).toBeLessThanOrEqual(4.5);
    for (const l of fase2.luzes.filter((x) => !x.grupo && dentro(x.em, fase2.chefe!.arena))) {
      const c = celula(g, l.em[0], l.em[1]);
      expect((l.altura ?? c.teto - 0.3) - c.piso, `luz [${l.em}]`).toBeLessThanOrEqual(4.5);
    }
  });

  it('as gavetas não soltam reanimado nas linhas do gatilho do necrotério (onde o jogador está)', () => {
    const area = fase2.gatilhos.find((x) => x.id === 'necroterio')!.quando;
    if (area.tipo !== 'area') throw new Error('necroterio');
    for (const gat of fase2.gatilhos.filter((x) => x.id.startsWith('gaveta-'))) {
      for (const a of gat.faz) if (a.acao === 'spawn') for (const i of a.inimigos) expect(dentro(i.em as Coord, area.area)).toBe(false);
    }
  });

  it('os textos da fase não fixam tecla', () => {
    const textos = [...Object.values(MENSAGENS), ...fase2.documentos.map((d) => d.texto)];
    for (const t of textos) expect(t).not.toMatch(/\([A-Z]\)/);
  });

  it('o robô segue com folga sobre o piso do aceite (≥ 95 s)', () => {
    expect(percorrer(fase2, 600).passos * PASSO).toBeGreaterThanOrEqual(95);
  });
});
