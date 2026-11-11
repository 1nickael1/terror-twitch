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
    'A trilha SCP Terror - Darker Menacing Containment Loop foi fornecida pelo usuário.',
    'O chefão da fase 1 usa o modelo Meshy fornecido pelo usuário, com animações Mixamo a 60 fps.',
    'A pistola Neon Warden foi fornecida pelo usuário no Meshy e otimizada para primeira pessoa.',
    'A espingarda Worn Tactical Shotgun foi fornecida pelo usuário no Meshy e adaptada para primeira pessoa.',
    'A submetralhadora Rusted Sentinel SMG foi fornecida pelo usuário no Meshy e adaptada para primeira pessoa.',
    'O lança-agente Iron Viper Launcher foi fornecido pelo usuário no Meshy e adaptado para primeira pessoa.',
    'O conteúdo da SCP Foundation é licenciado sob CC BY-SA 3.0. Elementos derivados deste projeto seguem a mesma licença.',
    'Os mapas, os shaders e os sons procedurais são originais deste projeto. As texturas de superfícies e itens foram geradas com OpenAI Image Gen.',
    'O tiro e a coleta de balas da pistola usam os arquivos single-pistol-gunshot-3-101923 e pistol-cock-6014, fornecidos pelo usuário.',
    'O tiro e o engatilhamento da escopeta usam shotgun-blast-352038 e shotgun_rack-82033, fornecidos pelo usuário.',
    'As coletas de cura e colete usam recuperar-vida.mp3 e pegar-colete.mp3, fornecidos pelo usuário.',
    'A SMG usa submachine-gun-79846 e o lança-agente usa cannon_shot_1-1782958714819-560881, fornecidos pelo usuário.',
    'Cartões e portas usam card-payment-machine-1-103738, closing-metal-door-44280 (segundo impacto), htranchant_01-91654 e door-open-2-518624, fornecidos pelo usuário.',
    'O modelo do policial foi fornecido pelo usuário no Meshy, com animações Mixamo a 60 fps; o fuzil verde-oliva também foi fornecido pelo usuário no Meshy.',
    'O modelo do médico de jaleco foi criado e fornecido pelo usuário no Meshy, com animações Mixamo a 60 fps.',
    'A fechadura original foi fornecida pelo usuário no Meshy; os níveis 2 e 3 e as variantes LIBERADO, com LED verde, foram adaptados pelo MCP do Blender.',
    'Ataque e morte do médico usam zombie-voice-growl-477834 e zombie-voice-idle-moans-2-no-ai-479321; o grito distante usa zombie-scream-324752 e o impacto do lança-agente usa explode3-87806, fornecidos pelo usuário.',
    'A sirene usa jeremayjimenez-greece-eas-alarm-451404, fornecido pelo usuário, reproduzido uma vez por acionamento.',
  ],
} as const;
