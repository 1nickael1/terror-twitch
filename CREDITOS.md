# Créditos e licenças — SCP Terror

SCP Terror é um jogo de fã, sem fins comerciais.

## SCP Foundation

O jogo se inspira em artigos da [SCP Foundation](https://scp-wiki.wikidot.com), cujo conteúdo é
licenciado sob [Creative Commons Atribuição-CompartilhaIgual 3.0 (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/).

Cada entidade só entra nesta tabela depois de a autoria ser conferida na página do próprio
artigo na wiki. Nenhum nome é escrito de memória.

| Entidade | Autor(es), conforme a wiki | Página | Licença | Conferido em | Uso no jogo |
|---|---|---|---|---|---|
| SCP-096 | Dr Dan | https://scp-wiki.wikidot.com/scp-096 | CC BY-SA 3.0 | 09/11/2026, no bloco de licença da página do artigo; reconferido em 10/11/2026 | Inspiração do chefe da fase 1 |
| SCP-049 | Gabriel Jade; reescrito por djkaktus e Gabriel Jade | https://scp-wiki.wikidot.com/scp-049 | CC BY-SA 3.0 | 10/11/2026, no bloco de licença da página do artigo | Inspiração do chefe da fase 2 |

As imagens e os áudios listados na página do SCP-049 não são usados.

Entidades previstas para as próximas fases, **ainda sem autoria conferida** e por isso fora da
tabela: SCP-106 (fase 3), SCP-939 (fase 4) e SCP-682 (fase 5). Cada uma entra
aqui e na tela de créditos no checkpoint da sua fase.

## O que é derivado e o que é original

- Os textos e os designs do jogo que derivam de artigos da SCP Foundation ficam sob a mesma
  licença, CC BY-SA 3.0.
- Nenhuma imagem da wiki é usada. Em especial, não se usa a imagem nem a escultura associadas
  ao SCP-173, que não são CC, nem a imagem original associada ao SCP-096.
- As formas dos monstros e dos inimigos, os mapas, as texturas, os shaders, os sons e a
  sinalização da instalação são originais deste projeto, exceto os assets externos listados abaixo. Os shaders, sons procedurais e os demais modelos são feitos em código;
  as texturas de superfícies e itens são geradas com OpenAI Image Gen, com mapas de relevo e
  rugosidade derivados em código. Não há logos nem
  marcas de terceiros.
- "Boomer shooter" descreve só o gênero e as mecânicas. Nenhum asset, mapa, arma, som, HUD ou
  personagem de outro jogo foi recriado.

## Assets externos

Os áudios `freesound_community-single-pistol-gunshot-3-101923.mp3` (tiro da pistola) e `freesound_community-pistol-cock-6014.mp3` (coleta de balas da pistola) foram fornecidos pelo usuário. As cópias preservadas estão em `public/audio/pistola/`, com os nomes de origem registrados em `origem.json`. Os demais efeitos continuam sintetizados com WebAudio.

O disparo e o engatilhamento da shotgun usam `universfield-shotgun-blast-352038.mp3` e `freesound_community-shotgun_rack-82033.mp3`, fornecidos pelo usuário. As versões em `public/audio/escopeta/` removem silêncio inicial e isolam o primeiro ciclo de engatilhamento; os cortes estão registrados em `origem.json`. O engatilhamento é agendado dentro do cooldown de cada tiro.

O modelo animado do médico de jaleco foi fornecido pelo usuário, criado no Meshy e exportado
como FBX com animações Mixamo a 60 fps. A versão usada no jogo, seus quatro mapas PBR e o
inventário das animações estão em `public/models/doutor/`; o arquivo original do usuário foi preservado.

O policial Tactical Revenant também foi fornecido pelo usuário, criado no Meshy com animações Mixamo a 60 fps. O modelo e os quatro mapas PBR estão em `public/models/policial/`. O fuzil Olive Drab Battle Rifle, também fornecido pelo usuário no Meshy, está em `public/models/arma-policial/` e acompanha o osso da mão direita com os três mapas PBR originais convertidos para WebP. Os originais foram preservados.

O clipe adicional de recuo `Walk_Backward_with_Bow_1`, fornecido pelo usuário, foi importado separadamente em `public/models/policial/recuo.json`, sem importar outra malha ou texturas. No jogo os braços foram adaptados para o rifle; as pernas mantêm o ciclo de caminhada para trás. A origem está registrada em `recuo-origem.json`.

A pistola do jogador Neon Warden foi fornecida pelo usuário no Meshy. A versão de baixa contagem de polígonos (`1111013552`) está em `public/models/pistola/`, com seus 9.866 triângulos preservados e três mapas PBR originais convertidos para WebP. O arquivo original foi preservado.

A espingarda Worn Tactical Shotgun (`1111014404`) também foi fornecida pelo usuário no Meshy e substitui o modelo de escopeta do jogador. O asset em `public/models/escopeta/` preserva seus 18.427 triângulos e três mapas PBR, convertidos para WebP. Escala e empunhadura foram ajustadas ao suporte em primeira pessoa.

A submetralhadora Rusted Sentinel SMG (`1111015502`), fornecida pelo usuário no Meshy, substitui a SMG do jogador. O asset em `public/models/smg/` preserva seus 21.550 triângulos e três mapas PBR convertidos para WebP, com escala e empunhadura ajustadas à câmera.

O lança-agente Iron Viper Launcher (`1111015946`), fornecido pelo usuário no Meshy, substitui o lançador do jogador. O asset em `public/models/lancador/` preserva seus 20.791 triângulos e três mapas PBR convertidos para WebP. Empunhadura, orientação e ponto de saída do disparo foram ajustados para primeira pessoa.

As imagens de superfícies e itens em `public/textures/`
foram geradas para este projeto com a ferramenta integrada OpenAI Image Gen. Os prompts e
o catálogo de mapas estão em `public/textures/catalogo.json`. Sinalização legível, decalques e
texturas de contingência continuam em canvas; os modelos usam geometria e o áudio combina síntese WebAudio com os arquivos fornecidos pelo usuário.

## Ferramentas

A fechadura roxa de nível 3 foi criada pelo MCP do Blender a partir da mesma malha e UV, seguindo a referência do usuário. O GLB do jogo reúne seis materiais (três níveis, bloqueados ou liberados) e usa texturas WebP em 2048 px. Os GLBs e o Blender com as três versões estão em `assets/fechadura-nivel3/`.

A variante laranja de nível 2 foi derivada da mesma malha de fechadura pelo MCP do Blender, seguindo a referência fornecida pelo usuário. O GLB do jogo contém uma malha e quatro materiais: níveis 1 e 2, bloqueados ou liberados. As fontes, texturas e o arquivo editável estão em `assets/fechadura-nivel2/`.

A sirene usa `jeremayjimenez-greece-eas-alarm-451404.mp3`, fornecido pelo usuário. O arquivo original está em `public/audio/sirene/alarme.mp3`, sem recortes; toca uma vez por acionamento, sem loop.

As vozes de ataque e morte do médico usam `phatphrogstudio-zombie-voice-growl-477834.mp3` e `phatphrogstudio-zombie-voice-idle-moans-2-no-ai-479321.mp3`. O grito distante do alarme usa `dragon-studio-zombie-scream-324752.mp3`; o impacto explosivo do lança-agente usa `freesound_community-explode3-87806.mp3`. Todos foram fornecidos pelo usuário, com os originais preservados em Downloads. Os recortes estão descritos nos arquivos `origem.json` em `public/audio/`.

A fechadura de acesso nível 1 foi fornecida pelo usuário no arquivo `Meshy_AI_Nivel_1_Bloqueado_1111200926_texture.blend`. A variante liberada foi editada pelo MCP do Blender, mantendo a malha, o UV e os mapas PBR. O GLB único com os dois materiais está em `public/models/fechadura-nivel1/`; os arquivos editáveis estão em `assets/fechadura-nivel1/`.

Os sons de cartões e portas foram fornecidos pelo usuário: `card-payment-machine-1-103738`, `closing-metal-door-44280` (segundo impacto, entre 1,72 e 3,22 s), `htranchant_01-91654` e `door-open-2-518624`. Os arquivos e detalhes dos recortes estão em `public/audio/itens/cartao.mp3` e `public/audio/portas/`. Os originais em Downloads foram preservados.

A submetralhadora usa `freesound_community-submachine-gun-79846.mp3` e o lança-agente usa `magiazzz-cannon_shot_1-1782958714819-560881.mp3`, fornecidos pelo usuário. Os arquivos em `public/audio/smg/` e `public/audio/lancador/` removem silêncio e têm fades curtos; o ganho da SMG foi reduzido para a cadência automática. Os originais em Downloads foram preservados.

As coletas de cura e colete usam os arquivos `recuperar-vida.mp3` e `pegar-colete.mp3`, fornecidos pelo usuário e preservados em `public/audio/itens/`.

Next.js, React, three.js, TypeScript e Vitest, cada um sob a sua própria licença de código
aberto.
