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

A apresentação prepara lotes de até 60 imagens e percorre os demais automaticamente. As fotos são otimizadas no navegador com lado maior de até 2016 pixels. O cache local guarda até 300 imagens otimizadas. Fotos já preparadas continuam passando durante falhas temporárias de conexão; a primeira carga e novas fotos precisam de internet. Depois de recarregar, a recuperação do cache é uma ajuda, não uma garantia de funcionamento completamente offline.

Para reduzir o tráfego, o servidor tenta obter do Drive uma versão de exibição com 2016 pixels no lado maior. O formato atual do endereço de prévia do Google é ajustado para esse tamanho; se o formato mudar, a prévia expirar ou falhar, o servidor usa o original. A marca d’água sempre mantém o arquivo original para preservar a transparência. URLs temporárias das prévias ficam somente no servidor.

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
