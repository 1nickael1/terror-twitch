'use client';

import { useId, useState } from 'react';
import type { Comando } from '../sim/tela';
import type { Stats } from '../sim/world';
import { Creditos } from './TelaCreditos';
import { formatarTempo } from './formato';
import css from './menus.module.css';
import { useNavegacaoMenu } from './navegacao';

export interface FimDeFaseProps {
  nomeFase: string;
  stats: Stats | null;
  totais: { inimigos: number; segredos: number; documentos: number } | null;
  ultima: boolean;
  comando: (c: Comando) => void;
}

/** o foco inicial do relatório espera isto: uma tecla segurada na conclusão não ativa o botão */
const ATRASO_FOCO_MS = 300;

export function FimDeFase({ nomeFase, stats, totais, ultima, comando }: FimDeFaseProps) {
  const ref = useNavegacaoMenu<HTMLDivElement>(undefined, { atrasoFocoMs: ATRASO_FOCO_MS });
  const titulo = useId();
  const linhas: [string, string][] = stats && totais ? [
    ['Tempo', formatarTempo(stats.tempo)],
    ['Inimigos eliminados', `${stats.mortos} de ${totais.inimigos}`],
    ['Segredos', `${stats.segredos.length} de ${totais.segredos}`],
    ['Documentos', `${stats.documentos.length} de ${totais.documentos}`],
  ] : [];
  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div ref={ref} className={css.painel}>
        <p className={css.rotulo}>Relatório de setor · concluído</p>
        <h2 id={titulo} className={css.h2}>{nomeFase}</h2>
        <table className={css.tabela}>
          <tbody>
            {linhas.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}
          </tbody>
        </table>
        <div className={css.botoes}>
          <button type="button" className={`${css.botao} ${css.primario}`} onClick={() => comando({ c: 'proxima' })}>
            {ultima ? 'Concluir' : 'Próxima fase'}
          </button>
          <button type="button" className={css.botao} onClick={() => comando({ c: 'sair' })}>Sair ao menu</button>
        </div>
      </div>
    </div>
  );
}

function TextoFinal({ comando, verCreditos }: { comando: FimDeFaseProps['comando']; verCreditos: () => void }) {
  const ref = useNavegacaoMenu<HTMLDivElement>();
  const titulo = useId();
  return (
    <div className={`${css.tela} ${css.veu}`} role="dialog" aria-modal="true" aria-labelledby={titulo}>
      <div ref={ref} className={css.painel}>
        <p className={css.rotulo}>Fim da transmissão</p>
        <h2 id={titulo} className={css.h2}>Fim da demo</h2>
        <p className={css.texto}>
          O último setor foi isolado e o registro desta operação foi arquivado. O restante da instalação
          continua sem resposta.
        </p>
        <p className={`${css.texto} ${css.apagado}`}>Obrigado por jogar esta demonstração.</p>
        <div className={css.botoes}>
          <button type="button" className={`${css.botao} ${css.primario}`} onClick={verCreditos}>Créditos</button>
          <button type="button" className={css.botao} onClick={() => comando({ c: 'sair' })}>Voltar ao menu</button>
        </div>
      </div>
    </div>
  );
}

/** Tela final da demo (depois da última fase), com acesso aos créditos e ao menu. */
export function Final({ comando }: { comando: FimDeFaseProps['comando'] }) {
  const [creditos, setCreditos] = useState(false);
  if (creditos) return <Creditos voltar={() => setCreditos(false)} />;
  return <TextoFinal comando={comando} verCreditos={() => setCreditos(true)} />;
}
