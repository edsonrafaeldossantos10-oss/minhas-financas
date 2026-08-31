// ---------------------------------------------------------------------------
// Casca do app: roteador por hash, navegação inferior, modais e toasts.
// Cada view é um objeto em window.Views com { titulo, render(params), onMount(params), actions:{} }.
// render() devolve uma string HTML; onMount (opcional) roda depois de inserida no DOM.
// Cliques em elementos com data-action="x" dentro de #view chamam actions.x(el, event).
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { view: 'dashboard', emoji: '🏠', label: 'Início' },
  { view: 'relatorios', emoji: '📊', label: 'Relatórios' },
  { view: '__lancar__', emoji: '➕', label: 'Lançar', fab: true },
  { view: 'cartoes', emoji: '💳', label: 'Cartões' },
  { view: 'mais', emoji: '⋯', label: 'Mais' },
];

const App = {
  current: { view: 'dashboard', params: {} },

  async init() {
    await openDB();
    await seedIfNeeded();
    this.renderShell();

    const pinAtivo = await Pin.estaAtivo();
    if (pinAtivo) {
      Pin.mostrarTela(() => this.boot());
    } else {
      await this.boot();
    }
  },

  async boot() {
    window.addEventListener('hashchange', () => this.routeFromHash());
    this.routeFromHash();
    this.registrarServiceWorker();
    this.configurarInstalacao();
  },

  renderShell() {
    document.body.innerHTML = `
      <header id="app-header">
        <div class="titulo" id="header-titulo">💰 Minhas Finanças</div>
        <button class="icon-btn" id="btn-buscar" title="Pesquisar">🔎</button>
      </header>
      <main id="view"></main>
      <nav id="bottom-nav">
        ${NAV_ITEMS.map((item) => `
          <button class="${item.fab ? 'fab' : ''}" data-nav="${item.view}">
            <span class="emoji">${item.emoji}</span>
            <span>${item.label}</span>
          </button>`).join('')}
      </nav>
    `;

    document.getElementById('bottom-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nav]');
      if (!btn) return;
      const view = btn.dataset.nav;
      if (view === '__lancar__') this.abrirSeletorLancamento();
      else this.navigate(view);
    });

    document.getElementById('btn-buscar').addEventListener('click', () => this.navigate('historico', { foco: 'busca' }));

    document.getElementById('view').addEventListener('click', (e) => this.handleViewClick(e));
    document.getElementById('view').addEventListener('submit', (e) => this.handleViewSubmit(e));
    document.getElementById('view').addEventListener('change', (e) => this.handleViewChange(e));
    document.getElementById('view').addEventListener('input', (e) => this.handleViewInput(e));
  },

  routeFromHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [view, paramStr] = hash.split('?');
    const params = {};
    if (paramStr) new URLSearchParams(paramStr).forEach((v, k) => (params[k] = v));
    this.navigate(view || 'dashboard', params, { pushHash: false });
  },

  navigate(view, params = {}, { pushHash = true } = {}) {
    if (!Views[view]) view = 'dashboard';
    this.current = { view, params };
    if (pushHash) {
      const qs = new URLSearchParams(params).toString();
      location.hash = `#/${view}${qs ? '?' + qs : ''}`;
    }
    this.renderView();
  },

  async renderView() {
    const { view, params } = this.current;
    const def = Views[view];
    document.getElementById('header-titulo').textContent = def.titulo || '💰 Minhas Finanças';
    document.getElementById('view').innerHTML = '<div class="texto-suave texto-centro mt-20">Carregando…</div>';
    const html = await def.render(params);
    const viewEl = document.getElementById('view');
    viewEl.innerHTML = html;
    if (def.onMount) await def.onMount(params);

    document.querySelectorAll('#bottom-nav [data-nav]').forEach((btn) => {
      btn.classList.toggle('ativo', btn.dataset.nav === view);
    });
    window.scrollTo(0, 0);
  },

  async refresh() {
    await this.renderView();
  },

  handleViewClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const def = Views[this.current.view];
    const fn = def.actions && def.actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  },

  handleViewSubmit(e) {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    const def = Views[this.current.view];
    const fn = def.actions && def.actions[form.dataset.form];
    if (fn) { e.preventDefault(); fn(form, e); }
  },

  handleViewChange(e) {
    const el = e.target.closest('[data-onchange]');
    if (!el) return;
    const def = Views[this.current.view];
    const fn = def.actions && def.actions[el.dataset.onchange];
    if (fn) fn(el, e);
  },

  handleViewInput(e) {
    const el = e.target.closest('[data-oninput]');
    if (!el) return;
    const def = Views[this.current.view];
    const fn = def.actions && def.actions[el.dataset.oninput];
    if (fn) fn(el, e);
  },

  // ------------------------------------------------------------- modais
  showModal(innerHTML, { centered = false, id = 'modal' } = {}) {
    this.closeModal(id);
    const overlay = document.createElement('div');
    overlay.className = `overlay ${centered ? 'centralizado' : ''}`;
    overlay.id = id;
    overlay.innerHTML = `<div class="folha">${innerHTML}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal(id);
    });
    overlay.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) this.closeModal(id);
    });
    overlay.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-modal-form]');
      if (form) {
        e.preventDefault();
        const handler = window.__modalHandlers && window.__modalHandlers[form.dataset.modalForm];
        if (handler) handler(form, e);
      }
    });
    overlay.addEventListener('click', (e) => {
      const el = e.target.closest('[data-modal-action]');
      if (el) {
        const handler = window.__modalHandlers && window.__modalHandlers[el.dataset.modalAction];
        if (handler) handler(el, e);
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  },

  closeModal(id = 'modal') {
    const el = document.getElementById(id);
    if (el) el.remove();
  },

  toast(msg) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },

  confirmar(mensagem, { titulo = 'Confirmar', textoBotao = 'Confirmar', perigo = false } = {}) {
    return new Promise((resolve) => {
      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.__confirmar_ok = () => { this.closeModal('confirm-modal'); resolve(true); };
      window.__modalHandlers.__confirmar_no = () => { this.closeModal('confirm-modal'); resolve(false); };
      this.showModal(`
        <h2 style="margin-bottom:10px;">${escapeHTML(titulo)}</h2>
        <p class="texto-suave" style="margin-bottom:20px;">${escapeHTML(mensagem)}</p>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline" data-modal-action="__confirmar_no">Cancelar</button>
          <button class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-modal-action="__confirmar_ok">${escapeHTML(textoBotao)}</button>
        </div>
      `, { centered: true, id: 'confirm-modal' });
    });
  },

  abrirSeletorLancamento() {
    this.showModal(`
      <div class="folha-topo">
        <h2>O que deseja lançar?</h2>
        <button class="fechar" data-close-modal>✕</button>
      </div>
      <button class="opcao-lancamento" data-modal-action="__ir_receita">
        <span class="icone-tipo receita">🟢</span>
        <span><span class="texto">Receita</span><br><span class="sub">Dinheiro que entrou</span></span>
      </button>
      <button class="opcao-lancamento" data-modal-action="__ir_despesa">
        <span class="icone-tipo despesa">🔴</span>
        <span><span class="texto">Despesa</span><br><span class="sub">Dinheiro que saiu</span></span>
      </button>
      <button class="opcao-lancamento" data-modal-action="__ir_transferencia">
        <span class="icone-tipo transferencia">🔵</span>
        <span><span class="texto">Transferência</span><br><span class="sub">Entre suas contas</span></span>
      </button>
      <button class="opcao-lancamento" data-modal-action="__ir_investimento">
        <span class="icone-tipo investimento">🟣</span>
        <span><span class="texto">Investimento</span><br><span class="sub">Valor guardado/investido</span></span>
      </button>
    `, { id: 'seletor-modal' });

    window.__modalHandlers = window.__modalHandlers || {};
    ['receita', 'despesa', 'transferencia', 'investimento'].forEach((tipo) => {
      window.__modalHandlers[`__ir_${tipo}`] = () => {
        this.closeModal('seletor-modal');
        this.navigate('lancar', { tipo });
      };
    });
  },

  async registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('service-worker.js');
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) {
            this.toast('Nova versão disponível. Feche e abra o app para atualizar.');
          }
        });
      });
    } catch (err) {
      console.warn('Falha ao registrar service worker', err);
    }
  },

  deferredInstallPrompt: null,
  configurarInstalacao() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
