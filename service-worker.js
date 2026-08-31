// ---------------------------------------------------------------------------
// Service worker do PWA "Minhas Finanças".
//
// IMPORTANTE sobre atualizações: este arquivo só gerencia o CACHE dos
// arquivos do app (HTML/CSS/JS/ícones). Ele nunca toca no IndexedDB, onde
// ficam os dados financeiros. Trocar de versão aqui atualiza o código do
// app sem apagar nenhum lançamento, conta, cartão ou meta já cadastrados.
//
// Ao publicar uma nova versão do app, troque o valor de CACHE_VERSION
// (ex.: 'v1' -> 'v2') para forçar o Android a baixar os arquivos novos.
// ---------------------------------------------------------------------------

const CACHE_VERSION = 'v1';
const CACHE_NAME = `minhas-financas-${CACHE_VERSION}`;

const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/format.js',
  './js/seed.js',
  './js/store.js',
  './js/pin.js',
  './js/charts.js',
  './js/views-init.js',
  './js/view-dashboard.js',
  './js/view-lancamento.js',
  './js/view-historico.js',
  './js/view-contas.js',
  './js/view-cartoes.js',
  './js/view-recorrentes.js',
  './js/view-metas.js',
  './js/view-relatorios.js',
  './js/view-calendario.js',
  './js/view-config.js',
  './js/view-mais.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((nome) => nome.startsWith('minhas-financas-') && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const buscarRede = fetch(event.request)
        .then((resposta) => {
          if (resposta && resposta.status === 200 && resposta.type === 'basic') {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return resposta;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return cached;
        });
      return cached || buscarRede;
    })
  );
});
