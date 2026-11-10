// Dados dos créditos (a tela é `TelaCreditos.tsx`).

/** Conforme o bloco de licença da página do artigo na SCP Wiki. */
export const AUTOR_096 = 'Dr Dan';
export const AUTOR_049 = 'Gabriel Jade; reescrito por djkaktus e Gabriel Jade';

export interface Link { texto: string; url: string }

export const CREDITOS = {
  titulo: 'Créditos',
  aviso: 'SCP Terror é um jogo de fã, sem fins comerciais.',
  fundacao: { texto: 'SCP Foundation', url: 'https://scp-wiki.wikidot.com' } satisfies Link,
  entidades: [
    { numero: 'SCP-096', autor: AUTOR_096, url: 'https://scp-wiki.wikidot.com/scp-096' },
    { numero: 'SCP-049', autor: AUTOR_049, url: 'https://scp-wiki.wikidot.com/scp-049' },
  ],
  licenca: {
    texto: 'Creative Commons Atribuição-CompartilhaIgual 3.0 (CC BY-SA 3.0)',
    url: 'https://creativecommons.org/licenses/by-sa/3.0/',
  } satisfies Link,
  frases: [
    'O conteúdo da SCP Foundation é licenciado sob CC BY-SA 3.0. Elementos derivados deste projeto seguem a mesma licença.',
    'Os inimigos, os mapas, os shaders e os sons são originais deste projeto. As texturas de superfícies e itens foram geradas com OpenAI Image Gen.',
    'O modelo do médico de jaleco foi criado e fornecido pelo usuário no Meshy, com animações Mixamo a 60 fps.',
  ],
} as const;
