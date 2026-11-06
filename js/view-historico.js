Views.historico = {
  titulo: 'Histórico',

  filtro: { tipo: '', busca: '', periodo: 'mes' },

  async render(params) {
    if (params.foco === 'busca') this.filtro.abrirBusca = true;

    return `
      <div class="busca-wrap">
        ${icon('busca', 18)}
        <input type="search" class="input" placeholder="Buscar por descrição, categoria…" value="${escapeHTML(this.filtro.busca)}"
          data-oninput="buscar" id="input-busca" autocomplete="off">
      </div>

      <div class="tabs mt-12">
        ${['mes', 'anterior', '3meses', 'ano', 'tudo'].map((p) => `
          <button class="${this.filtro.periodo === p ? 'ativo' : ''}" data-action="filtrarPeriodo" data-periodo="${p}">${rotuloPeriodo(p)}</button>
        `).join('')}
      </div>
      <div class="tabs mt-8">
        ${[['', 'Todos'], ['despesa', 'Despesas'], ['receita', 'Receitas'], ['transferencia', 'Transferências'], ['investimento', 'Investimentos']].map(([v, l]) => `
          <button class="${this.filtro.tipo === v ? 'ativo' : ''}" data-action="filtrarTipo" data-tipo="${v}">${l}</button>
        `).join('')}
      </div>

      <div class="mt-8" id="lista-resultados">${await this.htmlResultados()}</div>
    `;
  },

  async htmlResultados() {
    const { inicio, fim } = periodoParaIntervalo(this.filtro.periodo);
    const transacoes = await Store.listTransacoes({
      inicio, fim,
      tipo: this.filtro.tipo || undefined,
      busca: this.filtro.busca || undefined,
    });
    if (transacoes.length === 0) return `<div class="card mt-12">${vazioMini('🔎', 'Nenhum lançamento encontrado com esses filtros.')}</div>`;
    const entradas = transacoes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const saidas = transacoes.filter(ehDespesaReal).reduce((s, t) => s + t.valor, 0);
    const grupos = agruparPorData(transacoes);
    return `
      <div class="grid-2 mt-12">
        <div class="kpi-mini receita"><div class="rotulo">Entradas</div><div class="valor sensivel">${formatBRL(entradas)}</div></div>
        <div class="kpi-mini despesa"><div class="rotulo">Saídas</div><div class="valor sensivel">${formatBRL(saidas)}</div></div>
      </div>
      ${Object.entries(grupos).map(([data, itens]) => `
        <div class="section-title">${rotuloDia(data)}</div>
        <div class="card">${itens.map(itemLancamentoHTML).join('')}</div>
      `).join('')}`;
  },

  async atualizarResultados() {
    const container = document.getElementById('lista-resultados');
    if (container) container.innerHTML = await this.htmlResultados();
  },

  onMount() {
    if (this.filtro.abrirBusca) {
      const input = document.getElementById('input-busca');
      if (input) input.focus();
      this.filtro.abrirBusca = false;
    }
  },

  actions: {
    buscar(input) {
      Views.historico.filtro.busca = input.value;
      clearTimeout(Views.historico._t);
      Views.historico._t = setTimeout(() => Views.historico.atualizarResultados(), 150);
    },
    filtrarPeriodo(el) {
      Views.historico.filtro.periodo = el.dataset.periodo;
      el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b === el));
      Views.historico.atualizarResultados();
    },
    filtrarTipo(el) {
      Views.historico.filtro.tipo = el.dataset.tipo;
      el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b === el));
      Views.historico.atualizarResultados();
    },
  },
};

function rotuloDia(iso) {
  const hoje = todayISODate();
  const d = new Date(`${hoje}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const ontem = isoDateForYearMonthDay(d.getFullYear(), d.getMonth(), d.getDate());
  if (iso === hoje) return 'Hoje';
  if (iso === ontem) return 'Ontem';
  return formatDateLongBR(iso);
}

function rotuloPeriodo(p) {
  return { mes: 'Este mês', anterior: 'Mês anterior', '3meses': '3 meses', ano: 'Este ano', tudo: 'Tudo' }[p];
}

function periodoParaIntervalo(periodo) {
  const { year, month } = currentYearMonth();
  if (periodo === 'mes') return { inicio: isoDateForYearMonthDay(year, month, 1), fim: isoDateForYearMonthDay(year, month, daysInMonth(year, month)) };
  if (periodo === 'anterior') {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    return { inicio: isoDateForYearMonthDay(y, m, 1), fim: isoDateForYearMonthDay(y, m, daysInMonth(y, m)) };
  }
  if (periodo === '3meses') {
    const d = new Date(year, month - 2, 1);
    return { inicio: isoDateForYearMonthDay(d.getFullYear(), d.getMonth(), 1), fim: isoDateForYearMonthDay(year, month, daysInMonth(year, month)) };
  }
  if (periodo === 'ano') return { inicio: `${year}-01-01`, fim: `${year}-12-31` };
  return { inicio: null, fim: null };
}

function agruparPorData(transacoes) {
  const grupos = {};
  transacoes.forEach((t) => {
    (grupos[t.data] = grupos[t.data] || []).push(t);
  });
  return grupos;
}
