Views.calendario = {
  titulo: 'Agenda',
  ano: currentYearMonth().year,
  mes: currentYearMonth().month,
  selecionado: todayISODate(),

  async render() {
    const { ano, mes } = this;
    const prefixoMes = `${ano}-${pad2(mes + 1)}`;
    const [transacoes, recorrentes, cartoes, todas] = await Promise.all([
      Store.listTransacoes({
        inicio: isoDateForYearMonthDay(ano, mes, 1),
        fim: isoDateForYearMonthDay(ano, mes, daysInMonth(ano, mes)),
      }),
      Store.listRecorrentesComStatus(),
      Store.listCartoes(),
      DB.getAll('transacoes'),
    ]);

    const eventosPorDia = {};
    const add = (data, ev) => { (eventosPorDia[data] = eventosPorDia[data] || []).push(ev); };
    transacoes.forEach((t) => add(t.data, { cor: corDoTipo(t.tipo), origem: 'lancamento', item: t }));
    recorrentes.forEach((r) => {
      if (r.vencimento.slice(0, 7) === prefixoMes) add(r.vencimento, { cor: 'var(--cor-alerta)', origem: 'recorrente', item: r });
    });
    for (const c of cartoes) {
      const resumo = await Store.resumoCartao(c, todas);
      resumo.proximasFaturas.forEach((f) => {
        if (f.vencimento.slice(0, 7) === prefixoMes) add(f.vencimento, { cor: 'var(--cor-ouro)', origem: 'fatura', item: { ...f, cartao: c.nome } });
      });
    }

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = daysInMonth(ano, mes);
    const celulas = [];
    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
    for (let d = 1; d <= totalDias; d++) celulas.push(d);

    const hoje = todayISODate();
    const eventosSel = eventosPorDia[this.selecionado] || [];

    return `
      <div class="linha-mensal">
        <button class="icon-btn" data-action="mesAnterior" aria-label="Mês anterior">${icon('esquerda', 18)}</button>
        <div class="mes-atual">${monthLabel(ano, mes)}</div>
        <button class="icon-btn" data-action="proximoMes" aria-label="Próximo mês">${icon('direita', 18)}</button>
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
        <div class="linha-botoes mt-12 texto-fraco" style="gap:14px;">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cor-alerta)"></span> Conta fixa</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cor-ouro)"></span> Fatura</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cor-despesa)"></span> Despesa</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cor-receita)"></span> Receita</span>
        </div>
      </div>

      <div class="section-title">${rotuloDia(this.selecionado)}</div>
      <div class="card">
        ${eventosSel.length ? eventosSel.map((e) => eventoHTML(e)).join('') : vazioMini('📭', 'Nada marcado neste dia.')}
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
    abrirRecorrentes() { App.navigate('recorrentes'); },
    abrirCartoes() { App.navigate('cartoes'); },
  },
};

function corDoTipo(tipo) {
  return { receita: 'var(--cor-receita)', despesa: 'var(--cor-despesa)', transferencia: 'var(--cor-transferencia)', investimento: 'var(--cor-investimento)' }[tipo];
}

function eventoHTML(e) {
  if (e.origem === 'lancamento') return itemLancamentoHTML(e.item);
  if (e.origem === 'recorrente') {
    return `<div class="lista-item" data-action="abrirRecorrentes">
      <span class="icone-tipo despesa">${icon('repetir', 18)}</span>
      <div class="info"><div class="desc">${escapeHTML(e.item.descricao)}</div><div class="meta">Conta fixa · ${formatBRL(e.item.valor)}</div></div>
      <span class="badge ${e.item.status}">${rotuloStatus(e.item.status)}</span>
    </div>`;
  }
  return `<div class="lista-item" data-action="abrirCartoes">
    <span class="icone-tipo ouro">${icon('cartao', 18)}</span>
    <div class="info"><div class="desc">Fatura ${escapeHTML(e.item.cartao)}</div><div class="meta">Vencimento da fatura</div></div>
    <span class="valor despesa sensivel">${formatBRL(e.item.valor)}</span>
  </div>`;
}
