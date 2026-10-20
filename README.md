# Fotos para o telão — BRACIS

Apresentação de fotos para painel vertical, com referência inicial de 336 × 1008 pixels.

- Adiciona fotos individuais ou ZIPs ao álbum atual e otimiza as imagens no navegador.
- Lista as fotos com miniaturas, exclusão individual e opção para desfazer.
- Alterna entre os tipos selecionados: 1, 3 ou 4 fotos, motion e panorama.
- O modo de 1 foto preenche a altura do painel e percorre a imagem lateralmente.
- Aceita uma marca chamada `watermark.png` dentro do ZIP, com posição ajustável ao arrastar na prévia. O degradê de cor e intensidade ajustáveis fica atrás da marca.
- Salva o álbum e os ajustes neste navegador quando o armazenamento local está disponível.

## Uso

Abra o site, carregue o ZIP, selecione os tipos de apresentação e clique em **Exibir no telão**. Espaço pausa, as setas navegam e Esc retorna aos ajustes. As fotos selecionadas são processadas localmente e não são enviadas ao GitHub.

A largura de 336 pixels é uma estimativa pela proporção física do painel. Confirme a resolução do controlador e ajuste na página.

## Marca d’água

Forneça sua própria imagem pelo painel **Marca d’água e ajustes**, ou inclua um arquivo chamado `watermark.png` dentro do ZIP. Não há imagens da marca incluídas no repositório.

As imagens HEIC/HEIF devem ser convertidas para JPG antes da importação.

[Instruções completas](LEIA-ME.md).

## Desenvolvimento local

Site estático sem dependências. Sirva a pasta com qualquer servidor HTTP estático; por exemplo:

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080`.

## Publicação

No GitHub Pages, use a branch `main` e a pasta `/ (root)` como origem. O arquivo `.nojekyll` mantém a publicação como site estático.
