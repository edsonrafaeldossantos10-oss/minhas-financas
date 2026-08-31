# 💰 Minhas Finanças

App de controle financeiro pessoal, manual, 100% offline. Todos os dados
ficam salvos **só no celular** (IndexedDB do navegador) — não há conexão
com bancos, cartões, Pix ou Open Finance, e nenhum dado é enviado para
nenhum servidor.

## 🔗 Link público (já publicado)

**https://edsonrafaeldossantos10-oss.github.io/minhas-financas/**

Publicado via GitHub Pages a partir deste repositório
(`edsonrafaeldossantos10-oss/minhas-financas`, branch `main`). Sempre que a
branch `main` for atualizada, o GitHub republica automaticamente o app
neste mesmo link em 1-2 minutos.

---

## 1. Publicar uma cópia própria em outra plataforma (opcional)

O app já está publicado (link acima) e se atualiza sozinho a cada `git
push` (veja a seção 7). Isso aqui só é necessário se você quiser publicar
uma cópia separada em outro lugar, usando o **Netlify Drop**
(arrastar-e-soltar, sem precisar criar conta para o primeiro teste):

1. Acesse **https://app.netlify.com/drop** no computador.
2. Abra a pasta `minhas-financas` (esta pasta) no seu explorador de
   arquivos.
3. Arraste a pasta inteira `minhas-financas` para dentro da página do
   Netlify Drop.
4. Em alguns segundos, o Netlify gera um link público, algo como
   `https://nome-aleatorio-123.netlify.app`.
5. (Opcional, recomendado) Crie uma conta gratuita no Netlify para que o
   link não expire e para poder **atualizar o app no futuro** sem perder
   o mesmo link — veja a seção 6.

> Alternativa: se preferir Vercel, crie uma conta em vercel.com e use
> "Add New… → Project → Deploy" apontando para esta pasta, ou publique
> via GitHub (suba esta pasta para um repositório e conecte ao Vercel).

Depois de publicado, **anote o link** — é ele que sua esposa vai abrir no
celular para instalar o app.

---

## 2. Como instalar no Android

1. No celular, abra o **Google Chrome**.
2. Acesse o link público gerado no passo 1.
3. Toque no menu (⋮) no canto superior direito.
4. Toque em **"Adicionar à tela inicial"** (ou o Chrome pode mostrar um
   banner automático "Instalar aplicativo" — nesse caso, toque nele).
5. Confirme o nome **"Minhas Finanças"** e toque em **Adicionar**.
6. Pronto! Vai aparecer um ícone 💰 **Minhas Finanças** na tela inicial,
   igual a um aplicativo nativo (abre em tela cheia, sem a barra do
   Chrome).

---

## 3. Como usar

- **Início**: mostra o saldo total, receitas/despesas do mês, faturas
  abertas, contas próximas do vencimento e progresso das metas.
- **Botão "+" (Lançar)**: o jeito mais rápido de registrar qualquer
  movimentação — escolha Receita, Despesa, Transferência ou
  Investimento, preencha valor e descrição, e salve.
- **Despesa no cartão**: ao lançar uma despesa, escolha "Cartão de
  crédito" como forma de pagamento e selecione o cartão. Se for uma
  compra parcelada, escolha o número de parcelas — o app cria todas as
  parcelas automaticamente, uma por mês.
- **Cartões**: veja fatura atual, limite usado/disponível e marque a
  fatura como paga quando ela vencer (isso lança automaticamente uma
  despesa de pagamento na conta escolhida).
- **Contas Fixas**: cadastre contas que se repetem (internet, energia,
  assinaturas…) e marque como pagas conforme forem vencendo.
- **Metas**: crie uma meta com valor-alvo e vá adicionando ou retirando
  valores guardados.
- **Relatórios / Calendário / Histórico**: nas abas "Relatórios" e
  "Mais", veja gráficos, o calendário de vencimentos e o histórico
  completo com busca e filtros.
- **PIN de acesso** (opcional): em **Mais → Configurações → Segurança**,
  ative a proteção por PIN de 4 ou 6 dígitos. Importante: isso protege
  contra alguém abrir o app por curiosidade, mas **não é o mesmo nível
  de segurança de um app de banco** (é uma limitação de qualquer PWA,
  explicada na própria tela de Configurações).

O app funciona **inteiramente offline** depois da primeira abertura —
pode desligar o Wi-Fi/dados e continuar lançando e consultando tudo
normalmente.

---

## 4. Backup (MUITO IMPORTANTE)

Os dados ficam salvos **só neste celular**. Se o aparelho for perdido,
formatado ou trocado sem backup, **os dados são perdidos** — não há
nuvem nem servidor por trás.

**Faça backup com frequência** (sugestão: uma vez por semana, ou sempre
depois de vários lançamentos):

1. Vá em **Mais → Configurações → Backup**.
2. Toque em **"Exportar backup (JSON)"** — um arquivo é baixado no
   celular (normalmente vai para a pasta "Download").
3. Envie esse arquivo para um lugar seguro: e-mail para você mesma,
   Google Drive, WhatsApp para outro celular, etc.

Também é possível exportar só os lançamentos em **CSV** (para abrir no
Excel/Planilhas Google), em "Exportar lançamentos (CSV)".

## 5. Como restaurar um backup

1. Vá em **Mais → Configurações → Backup → "Importar backup"**.
2. Selecione o arquivo `.json` exportado anteriormente.
3. Confirme — **atenção**: isso substitui todos os dados atuais do app
   pelos dados do backup. Use isso ao trocar de celular ou se precisar
   recuperar dados perdidos.

---

## 6. Onde os dados ficam armazenados

Tudo fica no **IndexedDB do navegador**, dentro do próprio celular, na
origem do link público (ex: `nome.netlify.app`). Não existe banco de
dados externo, não existe login, não existe envio de dados para nenhum
servidor — o app funciona 100% no aparelho.

Isso também significa: se sua esposa limpar os dados do site pelo Chrome
(Configurações → Privacidade → Limpar dados de navegação, escolhendo
"Cookies e dados de sites" para esse site específico) ou desinstalar o
app da tela inicial **e depois limpar os dados do Chrome**, os dados
locais são apagados. Isso é raro de acontecer sem querer, mas é por
isso que o backup regular (seção 4) é essencial.

## 7. Atualizações futuras sem perder dados

Quando você quiser publicar uma nova versão do app (correção, nova
funcionalidade):

1. Edite os arquivos necessários.
2. Abra `service-worker.js` e troque o valor de `CACHE_VERSION` para o
   próximo (ex.: `'v2'` → `'v3'`) a cada nova publicação.
3. Rode `git add -A && git commit -m "..." && git push` nesta pasta — o
   GitHub Pages republica automaticamente no mesmo link em 1-2 minutos.

Isso garante que o celular baixe os arquivos novos do app, mas **os
dados financeiros (IndexedDB) nunca são apagados nesse processo** — eles
são completamente independentes do código do app.

---

## Novidades da V2.1

Nova identidade visual: **preto + amarelo** passou a ser o tema padrão do
app (antes era um teal claro). O tema original (teal + branco) continua
disponível em Configurações → Aparência → ☀️ Claro, para quem preferir.

- Fundo grafite/preto, cards em grafite, amarelo como cor de destaque
  (botão "+", itens ativos do menu, barras de progresso, abas
  selecionadas, gráficos, ícone do PIN).
- O botão "+" e outros elementos com fundo amarelo usam texto/ícone
  **preto** (não branco) para manter contraste e elegância.
- Card de saldo redesenhado: grafite com borda e brilho amarelo sutil,
  em vez de pintar o card inteiro de amarelo.
- Card "Análise do mês" ganhou uma borda de destaque amarela.
- Ícone do app (tela inicial do Android) atualizado para fundo
  grafite/preto com as moedas douradas.
- Correção real encontrada nessa atualização: a aba selecionada em
  Relatórios/Histórico usava uma combinação de cores que ficava quase
  ilegível no tema escuro anterior — corrigido para usar a cor de
  destaque do tema.
- Nenhuma mudança na estrutura de dados: só CSS, ícones e pequenos
  ajustes de JS para os gráficos acompanharem a cor do tema atual.

## Novidades da V2.0

- Dashboard: card de Resultado do mês com selo positivo/negativo, resumo
  consolidado de cartões (fatura, limite, próxima fatura), seção "Para
  onde seu dinheiro está indo" (categorias com % e barra), comparação com
  o mês anterior e "Análise do mês" com insights automáticos — tudo
  calculado só a partir dos dados já cadastrados, sem inventar nada.
- Atalho "💳 Compra no cartão" no lançamento rápido (abre a despesa já
  com forma de pagamento = crédito).
- Modo claro/escuro (Configurações → Aparência), com os gráficos dos
  relatórios se adaptando ao tema automaticamente.
- Relatórios: filtros de Trimestre e Semestre, lista de maiores despesas
  do período, comparação mensal.
- Correções: um lançamento recente clicado no Dashboard agora abre para
  edição (antes não fazia nada); "Últimos lançamentos" agora mostra o
  que foi lançado mais recentemente, em vez de ordenar por data da
  parcela (o que fazia parcelas futuras de compras parceladas
  esconderem lançamentos de hoje); um modal aberto (ex: o seletor "+")
  agora fecha sozinho se a navegação mudar por trás dele.
- Nenhuma store do banco local foi removida nem teve a versão alterada —
  todos os dados cadastrados antes da V2.0 continuam intactos.

## Testes realizados durante o desenvolvimento

Todos os testes abaixo foram executados manualmente no navegador antes
da entrega, incluindo verificação ao vivo no link público já publicado:

- ✅ Cadastro de receita → saldo, Dashboard e relatórios atualizados
- ✅ Cadastro de despesa → saldo, Dashboard, categoria e histórico
  atualizados
- ✅ Compra parcelada no cartão (6x) → 6 parcelas geradas automaticamente
  nos meses corretos, limite do cartão calculado certo
- ✅ Conta recorrente → status Pago/Próximo/Vencido calculado
  corretamente, inclusive pagando antes do vencimento
- ✅ Meta → criação, adicionar valor, progresso (%) calculado certo,
  refletido no insight "Você está a X% de atingir sua meta"
- ✅ Fechar e reabrir o app → dados continuam salvos (IndexedDB)
- ✅ Exportar backup → apagar dados → importar backup → dados restaurados
  com sucesso (testado antes e depois da atualização para V2.0)
- ✅ PIN de acesso → bloqueio, rejeição de PIN incorreto, desbloqueio com
  PIN correto
- ✅ Relatórios, calendário, histórico com busca e filtros
- ✅ Modo claro/escuro, inclusive contraste dos gráficos
- ✅ **Atualização de V1 para V2 sem perda de dados** — testado de fato:
  os mesmos dados cadastrados antes da atualização continuaram intactos
  e corretos depois de todo o código ser trocado
- ✅ Service Worker confirmado ativo e cache atualizado (`v1` → `v2`) no
  link público real, servido via HTTPS pelo GitHub Pages

O app funciona sem internet: nenhuma parte do código faz chamadas de
rede além de carregar os próprios arquivos do app (cacheados pelo
Service Worker) — todos os dados são lidos e gravados localmente no
IndexedDB, que não depende de conexão.
