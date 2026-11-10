// Validador: chefe, arena, perigos (comportas) e gatilhos que dependem deles. Lógica pura.
import { avancadorDeChefe } from '../sim/ai/chefes';
import { TIPOS } from '../sim/ai/tipos';
import { alcancar, andavel, areaAlcancavel, celulasDe, condicaoAlcancavel, type Alcance, type Contexto } from './alcance';

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
  if (!Object.prototype.hasOwnProperty.call(TIPOS, chefe.tipo) || !avancadorDeChefe(chefe.tipo)) {
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
    // com recarga menor, a comporta pode ser reacionada ainda fechada e ferir de novo
    if (p.recarga < p.duracao) erros.push(`Perigo "${p.id}" tem recarga menor que a duração`);
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
