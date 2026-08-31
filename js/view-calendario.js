Views.calendario = {
  titulo: 'Calendário',
  ano: currentYearMonth().year,
  mes: currentYearMonth().month,
  selecionado: todayISODate(),

  async render() {
    const { ano, mes } = this;
    const transacoes = await Store.listTransacoes({
      inicio: isoDateForYearMonthDay(ano, mes, 1),
      fim: isoDateForYearMonthDay(ano, mes, daysInMonth(ano, mes)),
    });
    const recorrentes = await Store.listRecorrentesComStatus();
    const cartoes = await Store.listCartoes();

    const eventosPorDia = {};
    transacoes.forEach((t) => {
      (eventosPorDia[t.data] = eventosPorDia[t.data] || []).push({ cor: corDoTipo(t.tipo), origem: 'lancamento', item: t });
    });
    recorrentes.forEach((r) => {
      if (r.vencimento.slice(0, 7) === `${ano}-${pad2(mes + 1)}`) {
        (eventosPorDia[r.vencimento] = eventosPorDia[r.vencimento] || []).push({ cor: '#D97706', origem: 'recorrente', item: r });
      }
    });
    for (const c of cartoes) {
      const resumo = await Store.resumoCartao(c, await DB.getAll('transacoes'));
      resumo.proximasFaturas.forEach((f) => {
        if (f.vencimento.slice(0, 7) === `${ano}-${pad2(mes + 1)}`) {
          (eventosPorDia[f.vencimento] = eventosPorDia[f.vencimento] || []).push({ cor: '#7C3AED', origem: 'fatura', item: { ...f, cartao: c.nome } });
        }
      });
    }

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = daysInMonth(ano, mes);
    const celulas = [];
    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
    for (let d = 1; d <= totalDias; d++) celulas.push(d);

    const hoje = todayISODate();

    return `
      <div class="linha-mensal">
        <button class="icon-btn" data-action="mesAnterior">←</button>
        <div class="mes-atual">${monthLabel(ano, mes)}</div>
        <button class="icon-btn" data-action="proximoMes">→</button>
      </div>
      <div class="card">
        <div class="calendario-grid">
          ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}
          ${celulas.map((d) => {
            if (!d) return `<div></div>`;
            const iso = isoDateForYearMonthDay(ano, mes, d);
            const eventos = eventosPorDia[iso] || [];
            const cores = [...new Set(eventos.map((e) => e.cor))].slice(0, 3);
            return `<div class="dia ${iso === hoje ? 'hoje' : ''} ${iso === this.selecionado ? 'selecionado' : ''}" data-action="selecionarDia" data-data="${iso}">
              <span>${d}</span>
              <span class="dots">${cores.map((c) => `<span style="background:${c}"></span>`).join('')}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="section-title">${formatDateLongBR(this.selecionado)}</div>
      <div class="card">
        ${(eventosPorDia[this.selecionado] || []).length ? (eventosPorDia[this.selecionado] || []).map((e) => eventoHTML(e)).join('') : vazioMini('📭', 'Nada por aqui neste dia.')}
      </div>
    `;
  },

  actions: {
    mesAnterior() {
      Views.calendario.mes -= 1;
      if (Views.calendario.mes < 0) { Views.calendario.mes = 11; Views.calendario.ano -= 1; }
      App.refresh();
    },
    proximoMes() {
      Views.calendario.mes += 1;
      if (Views.calendario.mes > 11) { Views.calendario.mes = 0; Views.calendario.ano += 1; }
      App.refresh();
    },
    selecionarDia(el) {
      Views.calendario.selecionado = el.dataset.data;
      App.refresh();
    },
    abrirLancamento(el) {
      App.navigate('lancar', { id: el.dataset.id });
    },
  },
};

function corDoTipo(tipo) {
  return { receita: '#16A34A', despesa: '#DC2626', transferencia: '#2563EB', investimento: '#7C3AED' }[tipo];
}

function eventoHTML(e) {
  if (e.origem === 'lancamento') return itemLancamentoHTML(e.item);
  if (e.origem === 'recorrente') {
    return `<div class="lista-item">
      <span class="icone-tipo despesa">📅</span>
      <div class="info"><div class="desc">${escapeHTML(e.item.descricao)}</div><div class="meta">Conta fixa · vence hoje</div></div>
      <span class="badge ${e.item.status}">${{ pago: 'Pago', proximo: 'Próximo', vencido: 'Vencido', futuro: 'Futuro' }[e.item.status]}</span>
    </div>`;
  }
  return `<div class="lista-item">
    <span class="icone-tipo investimento">💳</span>
    <div class="info"><div class="desc">Fatura ${escapeHTML(e.item.cartao)}</div><div class="meta">Vencimento da fatura</div></div>
    <span class="valor investimento">${formatBRL(e.item.valor)}</span>
  </div>`;
}
