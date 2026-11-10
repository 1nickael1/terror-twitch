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
  sinalização da instalação são originais deste projeto. Os shaders, sons e os demais modelos são feitos em código;
  as texturas de superfícies e itens são geradas com OpenAI Image Gen, com mapas de relevo e
  rugosidade derivados em código. Não há logos nem
  marcas de terceiros.
- "Boomer shooter" descreve só o gênero e as mecânicas. Nenhum asset, mapa, arma, som, HUD ou
  personagem de outro jogo foi recriado.

## Assets externos

O modelo animado do médico de jaleco foi fornecido pelo usuário, criado no Meshy e exportado
como FBX com animações Mixamo a 60 fps. A versão usada no jogo, seus quatro mapas PBR e o
inventário das animações estão em `public/models/doutor/`; o arquivo original do usuário foi preservado.

As imagens de superfícies e itens em `public/textures/`
foram geradas para este projeto com a ferramenta integrada OpenAI Image Gen. Os prompts e
o catálogo de mapas estão em `public/textures/catalogo.json`. Sinalização legível, decalques e
texturas de contingência continuam em canvas; os modelos usam geometria e o áudio é sintetizado com WebAudio.

## Ferramentas

Next.js, React, three.js, TypeScript e Vitest, cada um sob a sua própria licença de código
aberto.
