Views.historico = {
  titulo: 'Histórico',

  filtro: { tipo: '', busca: '', periodo: 'mes' },

  async render(params) {
    if (params.foco === 'busca') this.filtro.abrirBusca = true;

    return `
      <div class="card">
        <input type="text" placeholder="🔎 Pesquisar por descrição, categoria…" value="${escapeHTML(this.filtro.busca)}"
          data-oninput="buscar" id="input-busca" style="width:100%; padding:12px 14px; border-radius:12px; border:1.5px solid var(--cor-borda); font-size:14.5px;">
      </div>

      <div class="tabs mt-12">
        ${['mes', 'anterior', '3meses', 'ano', 'tudo'].map((p) => `
          <button class="${this.filtro.periodo === p ? 'ativo' : ''}" data-action="filtrarPeriodo" data-periodo="${p}">${rotuloPeriodo(p)}</button>
        `).join('')}
      </div>
      <div class="tabs mt-8">
        ${[['', 'Todos'], ['receita', '🟢 Receitas'], ['despesa', '🔴 Despesas'], ['transferencia', '🔵 Transferências'], ['investimento', '🟣 Investimentos']].map(([v, l]) => `
          <button class="${this.filtro.tipo === v ? 'ativo' : ''}" data-action="filtrarTipo" data-tipo="${v}">${l}</button>
        `).join('')}
      </div>

      <div class="mt-16" id="lista-resultados">${await this.htmlResultados()}</div>
    `;
  },

  async htmlResultados() {
    const { inicio, fim } = periodoParaIntervalo(this.filtro.periodo);
    const transacoes = await Store.listTransacoes({
      inicio, fim,
      tipo: this.filtro.tipo || undefined,
      busca: this.filtro.busca || undefined,
    });
    const grupos = agruparPorData(transacoes);
    if (transacoes.length === 0) return vazioMini('🧾', 'Nenhum lançamento encontrado com esses filtros.');
    return Object.entries(grupos).map(([data, itens]) => `
      <div class="section-title">${formatDateLongBR(data)}</div>
      <div class="card">${itens.map(itemLancamentoHTML).join('')}</div>
    `).join('');
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
      Views.historico.atualizarResultados();
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
    abrirLancamento(el) {
      App.navigate('lancar', { id: el.dataset.id });
    },
  },
};

function rotuloPeriodo(p) {
  return { mes: 'Este mês', anterior: 'Mês anterior', '3meses': 'Últimos 3 meses', ano: 'Este ano', tudo: 'Tudo' }[p];
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
