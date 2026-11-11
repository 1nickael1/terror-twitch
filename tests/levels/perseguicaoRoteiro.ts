// Roteiro da perseguição da fase 1 para os testes: o jogador anda na velocidade atual da entrada da cela até a
// entrada da triagem seguindo `caminho`, abrindo as portas no caminho (e, se pedido, fechando cada uma
// logo depois de atravessá-la), enquanto o `step` real move o chefe.
import { fase1 } from '../../src/levels/fase1';
import { comandarPorta } from '../../src/sim/doors';
import { JOGADOR, PORTA } from '../../src/sim/balance';
import { alturaPiso, caminho, centro, coordDe, SALTO, type Coord, type Vec2 } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { criarWorld, INPUT_VAZIO } from '../../src/sim/world';

export const ENTRADA_CELA: Coord = [49, 31];
export const ENTRADA_TRIAGEM: Coord = [14, 39];
/** a esta distância (m) do jogador, o chefe o alcançou */
export const ALCANCE = 1.5;

export interface ResultadoPerseguicao {
  /** s do despertar até o jogador chegar à entrada da triagem */
  chegadaJogador: number;
  /** s do despertar até o chefe alcançar o jogador no caminho (null: não alcançou antes da triagem) */
  alcancou: number | null;
  /** s do despertar até o chefe chegar a ALCANCE m da entrada da triagem (null: não chegou no limite) */
  chegadaChefe: number | null;
  procurou: boolean;
  portasArrombadas: number;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

export function correrPerseguicao(fecharPortas: boolean, limite = 40): ResultadoPerseguicao {
  const w = criarWorld(fase1);
  const chefe = w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
  for (const i of w.inimigos) if (i !== chefe) i.modo = 'morto';
  const j = w.jogador;
  j.pos = centro(ENTRADA_CELA);
  j.y = alturaPiso(w.grid, j.pos);
  const alvo = centro(ENTRADA_TRIAGEM);
  const rota = caminho(w.grid, j.pos, alvo, SALTO);
  if (!rota) throw new Error('sem caminho da cela à triagem');
  const passadas = new Set<string>();
  const res: ResultadoPerseguicao = { chegadaJogador: NaN, alcancou: null, chegadaChefe: null, procurou: false, portasArrombadas: 0 };
  let t = 0;
  let chegou = false;
  for (let k = 0; k < limite / PASSO; k++) {
    // jogador: anda até 9 m/s pela rota, esperando portas que ainda não deixam passar
    let resta = JOGADOR.velocidade * PASSO;
    while (!chegou && resta > 0 && rota.length > 0) {
      const prox = rota[0];
      const [col, row] = coordDe(prox);
      const porta = w.portas.find((p) => p.coord[0] === col && p.coord[1] === row);
      if (porta && porta.abertura < PORTA.livreEm) {
        if (porta.estado === 'fechada' && dist(j.pos, prox) < 2.2) comandarPorta(w, porta.id, 'abrir');
        if (dist(j.pos, prox) < 1.4) break;   // encostado na folha: espera abrir
      }
      const d = dist(j.pos, prox);
      if (d <= resta) {
        j.pos = { x: prox.x, z: prox.z };
        resta -= d;
        rota.shift();
      } else {
        j.pos = { x: j.pos.x + ((prox.x - j.pos.x) / d) * resta, z: j.pos.z + ((prox.z - j.pos.z) / d) * resta };
        resta = 0;
      }
    }
    j.y = alturaPiso(w.grid, j.pos);
    j.vy = 0;
    j.vel = { x: 0, z: 0 };
    j.vida = 1e6;
    if (fecharPortas) {
      // fecha cada porta já atravessada assim que o jogador sai do vão
      const aqui = coordDe(j.pos);
      for (const p of w.portas) {
        if (passadas.has(p.id) || p.estado !== 'aberta' || !['fuga-1', 'fuga-2', 'fuga-3'].includes(p.id)) continue;
        const naRotaAinda = rota.some((r) => { const c = coordDe(r); return c[0] === p.coord[0] && c[1] === p.coord[1]; });
        const noVao = aqui[0] === p.coord[0] && aqui[1] === p.coord[1];
        if (!naRotaAinda && !noVao) {
          comandarPorta(w, p.id, 'fechar');
          passadas.add(p.id);
        }
      }
    }
    const eventos = step(w, INPUT_VAZIO, PASSO);
    res.procurou ||= w.chefe?.fase === 'procurando';
    res.portasArrombadas += eventos.filter(e => e.tipo === 'chefe_arromba').length;
    t += PASSO;
    if (!chegou && rota.length === 0) {
      chegou = true;
      res.chegadaJogador = t;
    }
    if (!chegou && res.alcancou === null && dist(chefe.pos, j.pos) < ALCANCE && Math.abs(chefe.y - j.y) < 1.2) res.alcancou = t;
    if (res.chegadaChefe === null && dist(chefe.pos, alvo) < ALCANCE) res.chegadaChefe = t;
    if (chegou && res.chegadaChefe !== null) break;
  }
  return res;
}
