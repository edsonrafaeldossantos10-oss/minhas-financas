// ---------------------------------------------------------------------------
// Casca do app: roteador por hash, navegação inferior, modais e toasts.
// Cada view é um objeto em window.Views com { titulo, render(params), onMount(params), actions:{} }.
// render() devolve uma string HTML; onMount (opcional) roda depois de inserida no DOM.
// Cliques em elementos com data-action="x" dentro de #view chamam actions.x(el, event)
// (se a view não tiver a ação, cai nas ações globais em App.acoesGlobais).
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { view: 'dashboard', icone: 'inicio', label: 'Início' },
  { view: 'relatorios', icone: 'relatorios', label: 'Relatórios' },
  { view: '__lancar__', icone: 'mais', label: 'Lançar', fab: true },
  { view: 'cartoes', icone: 'cartao', label: 'Cartões' },
  { view: 'mais', icone: 'menu', label: 'Menu' },
];

// Telas "de topo" (sem botão voltar no cabeçalho).
const VIEWS_RAIZ = ['dashboard', 'relatorios', 'cartoes', 'mais'];

const App = {
  current: { view: 'dashboard', params: {} },

  async init() {
    await openDB();
    await seedIfNeeded();
    this.aplicarOcultarValores();
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
        <button class="icon-btn voltar" id="btn-voltar" title="Voltar" aria-label="Voltar">${icon('esquerda', 20)}</button>
        <div class="titulo" id="header-titulo">Minhas Finanças</div>
        <button class="icon-btn" id="btn-buscar" title="Pesquisar" aria-label="Pesquisar">${icon('busca', 19)}</button>
      </header>
      <main id="view"></main>
      <nav id="bottom-nav">
        ${NAV_ITEMS.map((item) => `
          <button class="${item.fab ? 'fab' : ''}" data-nav="${item.view}" aria-label="${item.label}">
            ${item.fab ? `<span class="bola">${icon(item.icone, 26)}</span>` : `${icon(item.icone, 22)}<span>${item.label}</span>`}
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
    document.getElementById('btn-voltar').addEventListener('click', () => this.voltar());

    const view = document.getElementById('view');
    view.addEventListener('click', (e) => this.handleViewClick(e));
    view.addEventListener('submit', (e) => this.handleViewSubmit(e));
    view.addEventListener('change', (e) => this.handleViewChange(e));
    view.addEventListener('input', (e) => this.handleViewInput(e));

    // Máscara de valor em reais para TODOS os campos de dinheiro
    // (inputmode="decimal"): a pessoa digita só números e o app formata
    // 1234 → 12,34 → 123,45 … como nos apps de banco.
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches && el.matches('input[inputmode="decimal"]')) mascararMoeda(el);
    });
  },

  voltar() {
    const { view } = this.current;
    const pais = { 'cartao-detalhe': 'cartoes', lancar: 'dashboard' };
    if (history.length > 1) history.back();
    else this.navigate(pais[view] || (VIEWS_RAIZ.includes(view) ? 'dashboard' : 'mais'));
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
    this.fecharModaisAbertos();
    this.current = { view, params };
    if (pushHash) {
      const qs = new URLSearchParams(params).toString();
      const novoHash = `#/${view}${qs ? '?' + qs : ''}`;
      if (location.hash !== novoHash) {
        // hashchange vai chamar routeFromHash → renderView
        location.hash = novoHash;
        return;
      }
    }
    this.renderView();
  },

  // Evita um modal (ex: o seletor "+") ficar preso na tela caso a navegação
  // mude por trás dele — por exemplo o botão "voltar" do Android disparando
  // uma troca de hash enquanto um modal está aberto.
  fecharModaisAbertos() {
    document.querySelectorAll('.overlay').forEach((el) => el.remove());
  },

  async renderView() {
    const { view, params } = this.current;
    const def = Views[view];
    const titulo = typeof def.titulo === 'function' ? def.titulo(params) : def.titulo;
    document.getElementById('header-titulo').textContent = titulo || 'Minhas Finanças';
    document.getElementById('app-header').classList.toggle('com-voltar', !VIEWS_RAIZ.includes(view));
    const html = await def.render(params);
    // se a pessoa navegou para outra tela enquanto esta carregava, descarta
    if (this.current.view !== view || this.current.params !== params) return;
    const viewEl = document.getElementById('view');
    viewEl.innerHTML = html;
    viewEl.style.animation = 'none';
    void viewEl.offsetWidth; // reinicia a animação de entrada
    viewEl.style.animation = '';
    if (def.onMount) await def.onMount(params);

    document.querySelectorAll('#bottom-nav [data-nav]').forEach((btn) => {
      btn.classList.toggle('ativo', btn.dataset.nav === view);
    });
    window.scrollTo(0, 0);
  },

  async refresh() {
    const y = window.scrollY;
    await this.renderView();
    window.scrollTo(0, y);
  },

  acaoDaView(nome) {
    const def = Views[this.current.view];
    return (def.actions && def.actions[nome]) || this.acoesGlobais[nome];
  },

  acoesGlobais: {
    abrirLancamento: (el) => App.navigate('lancar', { id: el.dataset.id }),
    ir: (el) => App.navigate(el.dataset.view, el.dataset.tipo ? { tipo: el.dataset.tipo } : {}),
  },

  handleViewClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = this.acaoDaView(el.dataset.action);
    if (fn) { e.preventDefault(); fn(el, e); }
  },

  handleViewSubmit(e) {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    const fn = this.acaoDaView(form.dataset.form);
    if (fn) { e.preventDefault(); fn(form, e); }
  },

  handleViewChange(e) {
    const el = e.target.closest('[data-onchange]');
    if (!el) return;
    const fn = this.acaoDaView(el.dataset.onchange);
    if (fn) fn(el, e);
  },

  handleViewInput(e) {
    const el = e.target.closest('[data-oninput]');
    if (!el) return;
    const fn = this.acaoDaView(el.dataset.oninput);
    if (fn) fn(el, e);
  },

  // ------------------------------------------------------- ocultar valores
  ocultandoValores() {
    try { return localStorage.getItem('mf_ocultar') === '1'; } catch (e) { return false; }
  },
  aplicarOcultarValores() {
    document.documentElement.classList.toggle('ocultar-valores', this.ocultandoValores());
  },
  alternarOcultarValores() {
    try { localStorage.setItem('mf_ocultar', this.ocultandoValores() ? '0' : '1'); } catch (e) {}
    this.aplicarOcultarValores();
  },

  // ------------------------------------------------------------- modais
  showModal(innerHTML, { centered = false, id = 'modal' } = {}) {
    this.closeModal(id);
    const overlay = document.createElement('div');
    overlay.className = `overlay ${centered ? 'centralizado' : ''}`;
    overlay.id = id;
    overlay.innerHTML = `<div class="folha" role="dialog" aria-modal="true">${innerHTML}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { this.closeModal(id); return; }
      if (e.target.closest('[data-close-modal]')) { this.closeModal(id); return; }
      const el = e.target.closest('[data-modal-action]');
      if (el) {
        const handler = window.__modalHandlers && window.__modalHandlers[el.dataset.modalAction];
        if (handler) handler(el, e);
      }
    });
    overlay.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-modal-form]');
      if (form) {
        e.preventDefault();
        const handler = window.__modalHandlers && window.__modalHandlers[form.dataset.modalForm];
        if (handler) handler(form, e);
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
    setTimeout(() => el.remove(), 2800);
  },

  confirmar(mensagem, { titulo = 'Confirmar', textoBotao = 'Confirmar', perigo = false, textoCancelar = 'Cancelar' } = {}) {
    return new Promise((resolve) => {
      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.__confirmar_ok = () => { this.closeModal('confirm-modal'); resolve(true); };
      window.__modalHandlers.__confirmar_no = () => { this.closeModal('confirm-modal'); resolve(false); };
      const overlay = this.showModal(`
        <h2 style="margin-bottom:8px; font-size:19px; letter-spacing:-0.02em;">${escapeHTML(titulo)}</h2>
        <p class="texto-suave" style="margin-bottom:20px;">${escapeHTML(mensagem)}</p>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline" data-modal-action="__confirmar_no">${escapeHTML(textoCancelar)}</button>
          <button class="btn ${perigo ? 'btn-perigo-cheio' : 'btn-primario'}" data-modal-action="__confirmar_ok">${escapeHTML(textoBotao)}</button>
        </div>
      `, { centered: true, id: 'confirm-modal' });
      // fechar tocando fora = cancelar
      overlay.addEventListener('click', (e) => { if (e.target === overlay) resolve(false); });
    });
  },

  // Pede um texto (substitui o prompt() nativo, que fica feio no celular).
  pedirTexto(titulo, { placeholder = '', textoBotao = 'Salvar' } = {}) {
    return new Promise((resolve) => {
      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.__texto_ok = (form) => {
        const valor = form.querySelector('input').value;
        this.closeModal('texto-modal');
        resolve(valor);
      };
      const overlay = this.showModal(`
        <form data-modal-form="__texto_ok">
          <div class="folha-topo"><h2>${escapeHTML(titulo)}</h2><button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button></div>
          <div class="campo"><input type="text" placeholder="${escapeHTML(placeholder)}" autocomplete="off" required></div>
          <button type="submit" class="btn btn-primario">${escapeHTML(textoBotao)}</button>
        </form>
      `, { centered: true, id: 'texto-modal' });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close-modal]')) resolve(null);
      });
      setTimeout(() => overlay.querySelector('input').focus(), 50);
    });
  },

  abrirSeletorLancamento() {
    const opcao = (acao, tipo, ic, texto, sub) => `
      <button class="opcao-lancamento" data-modal-action="${acao}">
        <span class="icone-tipo ${tipo}">${icon(ic, 21)}</span>
        <span><span class="texto">${texto}</span><br><span class="sub">${sub}</span></span>
        <span class="seta">${icon('direita', 18)}</span>
      </button>`;
    this.showModal(`
      <div class="folha-topo">
        <h2>Novo lançamento</h2>
        <button class="fechar" data-close-modal aria-label="Fechar">${icon('fechar', 16)}</button>
      </div>
      ${opcao('__ir_despesa', 'despesa', 'despesa', 'Despesa', 'Dinheiro que saiu (débito, Pix, dinheiro)')}
      ${opcao('__ir_cartao', 'ouro', 'cartao', 'Compra no cartão', 'No crédito, à vista ou parcelado')}
      ${opcao('__ir_receita', 'receita', 'receita', 'Receita', 'Dinheiro que entrou')}
      ${opcao('__ir_transferencia', 'transferencia', 'transferencia', 'Transferência', 'Entre suas contas')}
      ${opcao('__ir_investimento', 'investimento', 'investimento', 'Investimento', 'Valor guardado ou aplicado')}
    `, { id: 'seletor-modal' });

    window.__modalHandlers = window.__modalHandlers || {};
    ['receita', 'despesa', 'transferencia', 'investimento'].forEach((tipo) => {
      window.__modalHandlers[`__ir_${tipo}`] = () => {
        this.closeModal('seletor-modal');
        this.navigate('lancar', { tipo });
      };
    });
    window.__modalHandlers.__ir_cartao = () => {
      this.closeModal('seletor-modal');
      this.navigate('lancar', { tipo: 'despesa', formaPagamento: 'credito' });
    };
  },

  // ------------------------------------------------- apagar tudo (reset)
  abrirApagarTudo() {
    this.showModal(`
      <div class="folha-topo"><h2>Apagar todos os dados</h2><button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button></div>
      <p class="texto-suave mb-12">Isso apaga <strong>todos</strong> os lançamentos, contas, cartões, contas fixas, metas, categorias criadas e o PIN deste aparelho. O app volta a ficar como novo.</p>
      <p class="texto-suave mb-12">Se quiser guardar uma cópia antes, cancele e use <strong>Exportar backup</strong>.</p>
      <div class="campo">
        <label>Para confirmar, digite <strong>APAGAR</strong></label>
        <input type="text" id="confirma-apagar" autocomplete="off" autocapitalize="characters" placeholder="APAGAR">
      </div>
      <button class="btn btn-perigo-cheio" data-modal-action="__apagar_tudo_ok" id="btn-apagar-tudo" disabled>${icon('lixo', 18)} Apagar tudo e recomeçar</button>
    `, { id: 'apagar-modal', centered: true });
    const input = document.getElementById('confirma-apagar');
    const btn = document.getElementById('btn-apagar-tudo');
    input.addEventListener('input', () => { btn.disabled = input.value.trim().toUpperCase() !== 'APAGAR'; });
    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.__apagar_tudo_ok = async () => {
      if (input.value.trim().toUpperCase() !== 'APAGAR') return;
      await App.apagarTudoERecomecar();
    };
  },

  async apagarTudoERecomecar() {
    await DB.wipeAll();
    location.hash = '#/dashboard';
    location.reload();
  },

  async registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Em testes locais o cache do service worker esconde as alterações
    // recém-feitas — por isso ele só é ativado no link publicado.
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      (await navigator.serviceWorker.getRegistrations()).forEach((r) => r.unregister());
      return;
    }
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

// Formata enquanto digita: só dígitos → centavos. Mantém "-" no início
// (útil para saldo inicial negativo).
function mascararMoeda(el) {
  const negativo = el.value.trim().startsWith('-');
  const digitos = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) { el.value = negativo ? '-' : ''; return; }
  const centavos = Number(digitos);
  const texto = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  el.value = (negativo ? '-' : '') + texto;
}

document.addEventListener('DOMContentLoaded', () => App.init());
