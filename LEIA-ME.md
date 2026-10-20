# Fotos para o telão

Página estática para apresentação vertical, sem conta, servidor de aplicação ou bibliotecas externas. O álbum é escolhido no computador que exibe o telão. Não há integração automática com o Google Drive.

## Como usar

1. Baixe as fotos do Drive como ZIP. Se houver vários ZIPs, selecione todos juntos.
2. Inclua uma imagem chamada **watermark.png**, **watermark.jpg**, **watermark.webp** ou **watermark.avif**, em qualquer pasta do ZIP. O nome não diferencia maiúsculas e minúsculas. Para transparência, use PNG. Se houver mais de uma marca, prevalece a última encontrada.
3. Abra o site e solte o ZIP na área de importação. Você também pode selecionar fotos descompactadas. Novos arquivos são adicionados ao álbum atual, inclusive ao importar ZIPs. Arquivos repetidos são ignorados por conteúdo quando SHA-256 está disponível. A lista “Fotos do álbum” mostra miniaturas e nomes, com exclusão individual e opção para desfazer a última exclusão; os arquivos originais não são alterados. Importar só `watermark` mantém as fotos atuais. Um novo álbum sem `watermark` mantém a marca já carregada, que pode ser removida nos ajustes.
4. Selecione um ou mais tipos de apresentação. A página alterna apenas entre os tipos marcados: 1 foto, 3 fotos, 4 fotos, faixas em movimento e panorama. “Todos” seleciona os cinco; mantenha ao menos um selecionado. Defina o tempo por cena e a ordem.
5. Em Marca d’água e ajustes, defina posição, transparência e largura. “Overlay na tela inteira” mantém a proporção da marca dentro de toda a tela; use uma arte com a mesma proporção do painel para cobri-lo integralmente. A marca fica em uma camada independente acima das fotos e do degradê. Na prévia, arraste a própria marca para posicioná-la; inclusive overlays transparentes de tela inteira podem ser movidos pela área visível da arte. As setas movem a marca selecionada e Shift + seta faz ajustes maiores. “Restaurar posição da marca” remove o deslocamento manual. A posição fica salva neste navegador. A opção “Degradê atrás da marca” permite escolher cor, intensidade, área e posição do fade. “Acompanhar a marca” usa o topo para overlays completos, o rodapé para marcas inferiores e o centro para marcas centrais. Ao carregar uma marca com a mesma proporção da tela, a posição Overlay é selecionada automaticamente.
6. Clique em **Exibir no telão**. Use Espaço para pausar, setas para navegar e Esc para voltar. O cursor e o botão de retorno desaparecem depois de alguns segundos sem movimento. Se o navegador não permitir tela cheia, use sua opção de tela cheia.

## Resolução e aparência

A referência inicial é **336 × 1008 pixels**: altura informada de 1008 e largura estimada pela proporção de 1:3. Confirme a largura no controlador e ajuste na página. A saída de vídeo do computador também precisa estar configurada para o controlador: o site não altera a resolução física do monitor.

Por padrão, a página preserva a proporção e centraliza a apresentação. “Preencher a saída de vídeo” destina-se a controladores que remapeiam uma saída de outra proporção no painel vertical; pode distorcer imagens quando a saída e o painel não correspondem.

O modo de 1 foto preenche a altura do telão e percorre a imagem lateralmente, limitando o movimento às bordas da foto. Os modos de 3 e 4 fotos preservam as imagens sobre fundo branco, com zoom suave. Panorama também preenche o painel e percorre a foto lateralmente; faixas em movimento deslizam imagens na horizontal em um loop contínuo, sem espaços entre as fotos; imagens muito estreitas recebem recorte para preencher a faixa. A configuração de movimento reduzido do sistema é respeitada. Álbuns pequenos reutilizam fotos para completar uma composição.

## Otimização e armazenamento

Fotos são convertidas no navegador para JPEG com lado maior de até 2016 pixels e qualidade 86%. A marca é convertida para PNG para preservar transparência. Os originais não são alterados. Arquivos idênticos são ignorados por conteúdo, inclusive entre importações, quando o navegador oferece SHA-256. HEIC/HEIF são ignorados com aviso: converta-os para JPG antes de importar.

O álbum e os ajustes ficam salvos no armazenamento deste navegador, neste endereço, quando disponível. Não se sincronizam com outros computadores. Limpeza de dados, navegação privada ou falta de espaço podem impedir a retenção. Importe o ZIP em cada computador que for exibir o telão.

**Baixar álbum otimizado** gera um ZIP com as fotos prontas e `watermark.png`, quando carregada. Esse ZIP pode ser levado ao computador do evento e importado normalmente; não contém os ajustes de exibição. Os arquivos não são enviados ao site ou a terceiros. A página permanece funcionando sem rede depois de aberta e com o álbum carregado; para reabrir o site, é necessária conexão ou hospedagem local.

Limites: 600 fotos no total por álbum, 750 MB por ZIP, 2 GB de imagens descompactadas e 80 MB por imagem. Fotos muito grandes ou corrompidas são ignoradas com aviso. ZIP comum sem senha, com compressão padrão deflate ou sem compressão; ZIP64 e volumes divididos não são compatíveis. Não extraímos arquivos para o sistema: tudo ocorre na memória do navegador.

## GitHub Pages

1. Crie um repositório e envie **o conteúdo desta pasta**: `index.html`, `assets/` e `.nojekyll`. Não precisa enviar as fotos.
2. Em **Settings → Pages**, selecione **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
3. Abra o endereço informado pelo GitHub. No computador do telão, importe o ZIP e a marca. As fotos escolhidas não entram no repositório nem ficam públicas por serem importadas no player.

Também funciona em hospedagem estática comum. Para uma prévia local, sirva esta pasta com um servidor HTTP estático; por exemplo, com Python instalado: `python3 -m http.server 8080`. Abra `http://localhost:8080`. Prefira HTTPS ou localhost a abrir `index.html` diretamente, para melhor suporte a armazenamento e funções do navegador.

Use um navegador atualizado com suporte a `DecompressionStream('deflate-raw')`, Canvas e IndexedDB. Se um ZIP não abrir por falta desse recurso, selecione as fotos já descompactadas. A página tenta manter a tela ligada durante a apresentação quando o navegador permite; ajuste também a suspensão do computador para o evento.
