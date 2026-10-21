# BRACIS — fotos para o telão

- **Exibição automática:** https://bracis-telao.web.app/
- **Painel:** https://bracis-telao.web.app/admin
- **Versão local com fotos/ZIP:** https://bracis-telao.web.app/local
- **Código:** https://github.com/FCT-CUVG/bracis-telao

O telão abre diretamente a apresentação publicada. Não exige login, importação ou ajustes no computador de exibição. O painel usa login Google; a autorização de gravação é aplicada no Firestore e no servidor de fotos.

## Uso

1. Adicione JPG, PNG, WEBP ou AVIF à pasta pública do Google Drive. Extraia ZIPs antes de enviá-los ao Drive. HEIC/HEIF precisam ser convertidos para JPG.
2. Para a marca, adicione um arquivo chamado `watermark.png` à mesma pasta. A marca não precisa estar neste repositório.
3. Entre no painel com a conta Google autorizada. Selecione os tipos de apresentação e ajuste a marca arrastando-a na prévia. O degradê fica atrás dela.
4. Clique em **Publicar no telão**. As alterações ficam compartilhadas; fotos novas e mudanças no Drive são verificadas a cada minuto.
5. Abra o endereço de exibição no telão. Um duplo clique tenta ativar a tela cheia; também é possível usar a opção do navegador.

A lista do painel tem busca, páginas de 100 itens, visualização individual e exclusão da apresentação. O original permanece no Drive. A exclusão pode ser desfeita ou restaurada antes de publicar.

A referência é **336 × 1008**, proporção vertical 1:3. A largura ainda deve ser confirmada no controlador físico do telão.

## Fotos e memória

O servidor consulta somente a pasta publicada. A prévia de outra pasta exige autenticação de administrador. Cada imagem precisa pertencer à pasta permitida; o servidor não funciona como proxy para URLs ou arquivos arbitrários.

A apresentação prepara lotes de até 60 imagens e percorre os demais automaticamente. As fotos são otimizadas no navegador para a altura configurada do telão (1008 pixels por padrão), com largura proporcional e limite adicional de 2016 pixels no lado maior. Isso preserva a largura necessária ao movimento lateral. Retratos de 4000 × 6000 ficam em 672 × 1008; paisagens de 6000 × 4000 ficam em 1512 × 1008. A redução do número de pixels diminui a memória de decodificação, mas não representa uma medição da RAM total do navegador. O cache anterior é convertido localmente uma vez, sem baixar todas as fotos novamente. O cache local guarda até 300 imagens otimizadas. Fotos já preparadas continuam passando durante falhas temporárias de conexão; a primeira carga e novas fotos precisam de internet. Depois de recarregar, a recuperação do cache é uma ajuda, não uma garantia de funcionamento completamente offline.

Para reduzir o tráfego, o servidor tenta obter do Drive uma versão de exibição com 2016 pixels no lado maior. O formato atual do endereço de prévia do Google é ajustado para esse tamanho; se o formato mudar, a prévia expirar ou falhar, o servidor usa o original. A marca d’água sempre mantém o arquivo original para preservar a transparência. URLs temporárias das prévias ficam somente no servidor.

A espera pela decodificação de uma foto tem limite de 15 segundos. Erros na troca de cena geram nova tentativa; uma checagem a cada 5 segundos recupera uma troca atrasada mais de 10 segundos, preservando pausas manuais. Isso não consegue recuperar um processo encerrado pelo sistema ou um navegador completamente congelado. A última recuperação é registrada apenas neste navegador e aparece no relatório do diagnóstico.

A pasta aceita até 5.000 arquivos diretos, sem buscar subpastas. Para coleções maiores, separe por dia/evento. ZIPs no Drive não são extraídos pelo servidor.

## Hospedagem sem plano pago

- **Firebase Spark:** site, login Google e configuração compartilhada.
- **Cloudflare Workers Free:** consultas e imagens do Drive, com a chave armazenada como **Secret** `DRIVE_API_KEY`.
- **Google Drive:** originais em pasta pública.

Não há Cloud Functions, Cloud Run, Cloud Storage ou serviços que exijam Blaze. Não vincule faturamento nem troque os planos gratuitos se quiser manter bloqueio por cota em vez de cobrança de excedentes. O Workers Free tem limite de 100 mil requisições/dia; o Spark também tem cotas. Ao atingir os limites gratuitos, os serviços podem parar até a renovação da cota.

A chave do Drive não está no código do navegador nem neste repositório. A configuração pública do Firebase identifica o aplicativo; não é uma credencial de administrador. A proteção depende das regras e da verificação do login, e não de esconder o HTML do painel.

## Manutenção

- Projeto Firebase: `bracis-telao`.
- Worker: `bracis-drive`, código em `worker/src/index.js`.
- Configuração do Worker: `worker/wrangler.jsonc`.
- Configuração publicada: documento Firestore `events/bracis`.
- Administrador: definido em `assets/cloud-config.js`, `firestore.rules` e nas variáveis do Worker. Mantenha os três alinhados ao mudar responsáveis.
- SDK Firebase web: CDN oficial 13.0.0.
- Wrangler: 4.151.2, com dependências fixadas no lockfile do Worker.

Instale as dependências com `pnpm --dir worker install --frozen-lockfile`; se o pnpm solicitar aprovação de builds, revise apenas `esbuild` e `workerd`. Autentique o Wrangler na conta correta antes de comandos remotos.

```sh
pnpm --dir worker test
pnpm --dir worker exec wrangler deploy --dry-run
pnpm --dir worker exec wrangler deploy
firebase deploy --only firestore,hosting --project bracis-telao
```

Cadastre segredos pelo mecanismo protegido do Wrangler (`wrangler secret put DRIVE_API_KEY` ou `wrangler secret bulk` com arquivo protegido fora do repositório). Não coloque valores em argumentos de comandos, arquivos versionados ou logs. Use uma chave do Google restrita exclusivamente à API Drive, própria para o servidor. Não reutilize a chave pública de identificação do Firebase.

O Hosting publica apenas os arquivos estáticos. A pasta `worker/`, arquivos de configuração, credenciais e dependências ficam fora do site estático.

## Verificações

Os testes do Worker cobrem álbum público, exclusões, bloqueio de arquivos externos à apresentação, acesso de administrador, sessões expiradas, CORS, métodos HTTP e proteção da chave nas respostas. A validação final também usa o Worker publicado e o navegador, pois o ambiente de Workers tem diferenças em relação ao Node.js.

## Navegadores de controladores LED

Abra https://bracis-telao.web.app/diagnostico no navegador do próprio controlador. A página testa módulos do player, leitura real da configuração, álbum público, download de uma foto, animação CSS, canvas e cache local. O diagnóstico cabe em um quadro vertical 1:3, com referência de 336 × 1008 pixels, ajustado à janela sem rolagem. O relatório completo fica no botão Copiar relatório e não é enviado automaticamente. Um resultado aprovado não substitui um teste de pelo menos 30 minutos na exibição real, com reinício do equipamento. Sem conhecer o modelo e a versão do navegador, não há garantia universal de compatibilidade.

O player mantém o movimento escolhido mesmo quando o sistema informa movimento reduzido, e usa alternativas para `Image.decode`, `AbortSignal.timeout`, `structuredClone`, unidades de container, `aspect-ratio` e altura dinâmica da janela. Ainda requer JavaScript moderno, módulos, fetch, canvas e CSS Grid.

## Movimento e orientação

Os modos são Retrato (uma foto vertical em movimento), Retrato + 2 (retrato maior acima de duas paisagens), Motion (faixas) e Panorama (paisagem em tela inteira). Os antigos modos empilhados são migrados para Retrato + 2. A orientação usa largura/altura e rotação da câmera do Drive, com verificação pelas dimensões da imagem preparada quando necessário. Apenas largura e altura são expostas; outros metadados de imagem não são publicados pela API.

Todas as áreas usam preenchimento proporcional, com pequeno excesso nas bordas para manter cobertura durante o movimento. O deslocamento horizontal ou vertical usa transformações CSS, sem animar object-position. O padrão é movimento lento (0,5×); Normal e Muito lento também estão disponíveis. A duração efetiva da cena é o tempo base dividido pela velocidade. O painel mostra a estimativa do ciclo conforme as orientações, os modos e o lote preparado. O próximo lote só substitui o atual depois que as fotos compatíveis terminam suas cenas.

Depois das primeiras fotos, o preparo fica em uma fila para reduzir concorrência com a animação. Repetir a busca de arquivos indisponíveis não reinicia um lote que não mudou.

Para medir a apresentação real, abra https://bracis-telao.web.app/?medir=1 e mantenha-a visível por 90 segundos. A amostra mede callbacks requestAnimationFrame, intervalos acima de 50 ms e maior intervalo; não mede quadros efetivamente pintados nem a frequência física do LED. O resultado fica apenas no navegador e entra no relatório do diagnóstico. Para isolar uma composição sem alterar o evento publicado, acrescente &modo=mixed, &modo=single, &modo=motion ou &modo=pan ao endereço de teste. A exibição normal não mostra medição.
