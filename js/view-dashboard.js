Views.dashboard = {
  titulo: '💰 Minhas Finanças',

  async render() {
    const { year, month } = currentYearMonth();
    const [saldoTotal, resumo, faturas, recorrentes, metas, ultimosLancamentos] = await Promise.all([
      Store.saldoTotal(),
      Store.resumoMes(year, month),
      Store.totalFaturasAbertas(),
      Store.listRecorrentesComStatus(),
      Store.listMetas(),
      Store.listTransacoes({}),
    ]);

    const proximasContas = recorrentes.filter((r) => r.status !== 'pago').slice(0, 4);
    const recentes = ultimosLancamentos.slice(0, 6);

    return `
      <div class="kpi-saldo">
        <div class="rotulo">💰 SALDO TOTAL</div>
        <div class="valor">${formatBRL(saldoTotal)}</div>
        <div class="sub">${monthLabel(year, month)}</div>
      </div>

      <div class="grid-2 mt-12">
        <div class="kpi-mini receita">
          <div class="rotulo">📥 Receitas do mês</div>
          <div class="valor">${formatBRL(resumo.receitas)}</div>
        </div>
        <div class="kpi-mini despesa">
          <div class="rotulo">📤 Despesas do mês</div>
          <div class="valor">${formatBRL(resumo.despesas)}</div>
        </div>
      </div>

      <div class="grid-2 mt-12">
        <div class="kpi-mini">
          <div class="rotulo">📊 Resultado</div>
          <div class="valor" style="color:${resumo.resultado >= 0 ? 'var(--cor-receita)' : 'var(--cor-despesa)'}">${formatBRL(resumo.resultado)}</div>
        </div>
        <div class="kpi-mini">
          <div class="rotulo">💳 Faturas abertas</div>
          <div class="valor">${formatBRL(faturas)}</div>
        </div>
      </div>

      <div class="section-title">📅 Contas próximas</div>
      <div class="card">
        ${proximasContas.length ? proximasContas.map((r) => `
          <div class="lista-item">
            <span class="icone-tipo despesa">📅</span>
            <div class="info">
              <div class="desc">${escapeHTML(r.descricao)}</div>
              <div class="meta">Vence em ${formatDateBR(r.vencimento)}</div>
            </div>
            <span class="badge ${r.status}">${rotuloStatus(r.status)}</span>
          </div>`).join('') : vazioMini('🎉', 'Nenhuma conta pendente por aqui.')}
        <button class="btn btn-texto mt-8" data-action="verRecorrentes">Ver todas →</button>
      </div>

      <div class="section-title">🎯 Metas</div>
      <div class="card">
        ${metas.length ? metas.slice(0, 3).map((m) => `
          <div class="mt-8 mb-8">
            <div style="display:flex; justify-content:space-between; font-size:13.5px; font-weight:700; margin-bottom:6px;">
              <span>${escapeHTML(m.nome)}</span>
              <span>${Math.min(100, Math.round((m.valorAtual / (m.valorMeta || 1)) * 100))}%</span>
            </div>
            <div class="progress-bar"><div class="fill" style="width:${Math.min(100, (m.valorAtual / (m.valorMeta || 1)) * 100)}%"></div></div>
          </div>`).join('') : vazioMini('🎯', 'Crie uma meta para começar a guardar dinheiro.')}
        <button class="btn btn-texto mt-8" data-action="verMetas">Ver todas →</button>
      </div>

      <div class="section-title">🧾 Últimos lançamentos</div>
      <div class="card">
        ${recentes.length ? recentes.map(itemLancamentoHTML).join('') : vazioMini('🧾', 'Nenhum lançamento ainda. Toque em + para começar.')}
        <button class="btn btn-texto mt-8" data-action="verHistorico">Ver histórico completo →</button>
      </div>
    `;
  },

  actions: {
    verRecorrentes: () => App.navigate('recorrentes'),
    verMetas: () => App.navigate('metas'),
    verHistorico: () => App.navigate('historico'),
  },
};

function rotuloStatus(status) {
  return { pago: 'Pago', proximo: 'Próximo', vencido: 'Vencido', futuro: 'Futuro' }[status] || status;
}

function vazioMini(emoji, texto) {
  return `<div class="vazio" style="padding:18px 8px;"><div class="emoji">${emoji}</div><div>${texto}</div></div>`;
}

const ICONE_TIPO = { receita: '💵', despesa: '💸', transferencia: '🔁', investimento: '📈' };
const SINAL_TIPO = { receita: '+', despesa: '-', transferencia: '↔', investimento: '↑' };

function itemLancamentoHTML(t) {
  return `
    <div class="lista-item" data-action="abrirLancamento" data-id="${t.id}">
      <span class="icone-tipo ${t.tipo}">${ICONE_TIPO[t.tipo]}</span>
      <div class="info">
        <div class="desc">${escapeHTML(t.descricao)}</div>
        <div class="meta">${formatDateBR(t.data)}${t.categoria ? ' · ' + escapeHTML(t.categoria) : ''}</div>
      </div>
      <span class="valor ${t.tipo}">${SINAL_TIPO[t.tipo]} ${formatBRL(t.valor)}</span>
    </div>`;
}
