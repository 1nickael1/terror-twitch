// Validador: chefe, arena, perigos (comportas e perigos de área) e gatilhos que dependem deles. Lógica pura.
import { iaDeChefe } from '../sim/ai/chefes';
import { TIPOS } from '../sim/ai/tipos';
import type { PerigoArea } from '../sim/fase';
import { alcancar, andavel, areaAlcancavel, celulasDe, condicaoAlcancavel, type Alcance, type Contexto } from './alcance';

/** Aviso mínimo (s) de um perigo de área: a luz piscando / o chiado precisam ser percebidos. */
const AVISO_MINIMO = 0.4;
/** Fração da vida do chefe que um acionamento de perigo de área tira (spec §5). */
const DANO_CHEFE_MIN = 0.2;
const DANO_CHEFE_MAX = 0.35;
/** Folga nas comparações de ponto flutuante (0,35 / 4 × 4 não dá 0,35 exato). */
const FOLGA = 1e-9;

/** Número com vírgula decimal, até 3 casas. */
const decimal = (x: number) => String(Math.round(x * 1000) / 1000).replace('.', ',');

/** Regras próprias do perigo de área (UV, vapor); área, gatilho e porta valem para todo perigo. */
function errosDePerigoArea(p: PerigoArea): string[] {
  const erros: string[] = [];
  const campos = ['aviso', 'duracao', 'recarga', 'danoChefePorSeg', 'danoPorSeg'] as const;
  // `!(x > 0)` também pega NaN
  const ruins = campos.filter((c) => !(p[c] > 0));
  for (const c of ruins) erros.push(`Perigo "${p.id}" tem ${c} não positivo`);
  if (ruins.length > 0) return erros;
  if (p.aviso < AVISO_MINIMO - FOLGA) erros.push(`Perigo "${p.id}" tem aviso menor que ${decimal(AVISO_MINIMO)} s`);
  // com recarga menor, seria reacionável ainda ligado (ou ainda avisando)
  if (p.recarga < p.aviso + p.duracao - FOLGA) erros.push(`Perigo "${p.id}" tem recarga menor que aviso + duração`);
  const fracao = p.danoChefePorSeg * p.duracao;
  if (fracao < DANO_CHEFE_MIN - FOLGA || fracao > DANO_CHEFE_MAX + FOLGA) {
    erros.push(`Perigo "${p.id}" tira ${decimal(fracao)} da vida do chefe por acionamento (precisa ficar entre ${decimal(DANO_CHEFE_MIN)} e ${decimal(DANO_CHEFE_MAX)})`);
  }
  return erros;
}

/**
 * Erros do chefe e dos perigos. `ctx.onde` resolve símbolos (e já registra os erros de símbolo);
 * `a` é o alcance final da fase.
 */
export function errosDeChefe(ctx: Contexto, a: Alcance): string[] {
  const { f, g, onde } = ctx;
  const erros: string[] = [];
  const chefe = f.chefe;
  const perigos = chefe?.perigos ?? [];

  for (const gat of f.gatilhos) {
    const dependeDoChefe = gat.quando.tipo === 'chefe_morto' || gat.quando.tipo === 'chefe_vida' || gat.faz.some((x) => x.acao === 'chefe');
    if (dependeDoChefe && !chefe) erros.push(`Gatilho "${gat.id}" depende do chefe, mas a fase não tem chefe`);
    for (const x of gat.faz) {
      if (x.acao === 'perigo' && !perigos.some((p) => p.id === x.id)) erros.push(`Gatilho "${gat.id}" aciona perigo "${x.id}" inexistente`);
    }
  }
  if (!chefe) return erros;

  // um tipo comum (sem IA de chefe) faz `criarWorld` falhar: também é "desconhecido" como chefe
  if (!Object.prototype.hasOwnProperty.call(TIPOS, chefe.tipo) || !iaDeChefe(chefe.tipo)) {
    erros.push(`Chefe tem tipo desconhecido "${chefe.tipo}"`);
  }
  const em = onde(chefe.em);
  if (em && !andavel(g, em)) erros.push('Chefe fora de célula andável');
  const retomada = onde(chefe.retomada);
  if (retomada && !andavel(g, retomada)) erros.push('Retomada do chefe fora de célula andável');
  // a arena precisa ser alcançável com o chefe vivo: portas abertas por `chefe_*` não contam
  if (!areaAlcancavel(alcancar({ ...ctx, semChefe: true }), chefe.arena)) erros.push('Arena do chefe inalcançável');

  for (const p of perigos) {
    if (celulasDe(p.area).some((c) => !andavel(g, c))) erros.push(`Perigo "${p.id}" tem área fora de célula andável`);
    if (p.tipo === 'comporta') {
      // com recarga menor, a comporta pode ser reacionada ainda fechada e ferir de novo
      if (p.recarga < p.duracao) erros.push(`Perigo "${p.id}" tem recarga menor que a duração`);
    } else {
      erros.push(...errosDePerigoArea(p));
    }
    for (const porta of ctx.portas) {
      const c = porta.coord;
      if (c && celulasDe(p.area).some((x) => x[0] === c[0] && x[1] === c[1])) erros.push(`Perigo "${p.id}" cobre a porta "${porta.def.id}"`);
    }
    const gatilhos = f.gatilhos.filter((gat) => gat.faz.some((x) => x.acao === 'perigo' && x.id === p.id));
    if (gatilhos.length === 0) erros.push(`Perigo "${p.id}" não é acionado por nenhum gatilho`);
    else if (!gatilhos.some((gat) => condicaoAlcancavel(ctx, a, gat.quando))) erros.push(`Perigo "${p.id}" só é acionado por gatilho inalcançável`);
  }
  return erros;
}
