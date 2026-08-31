Views.dashboard = {
  titulo: '💰 Minhas Finanças',

  async render() {
    const { year, month } = currentYearMonth();
    const [saldoTotal, comparativo, cartoesResumo, recorrentes, metas, ultimosLancamentos] = await Promise.all([
      Store.saldoTotal(),
      Store.resumoComparativoMes(year, month),
      Store.resumoCartoesConsolidado(),
      Store.listRecorrentesComStatus(),
      Store.listMetas(),
      Store.listTransacoes({}),
    ]);

    const resumo = comparativo.atual;
    const categoriasDespesa = Store.categoriasComPercentual(resumo.transacoes, 'despesa').slice(0, 5);
    const insights = Store.gerarInsights({ comparativo, categoriasDespesa, cartoesResumo, metas });

    const proximasContas = recorrentes.filter((r) => r.status !== 'pago').slice(0, 4);
    // "Últimos lançamentos" deve mostrar o que a usuária acabou de fazer, não
    // o que está mais próximo por data — senão parcelas futuras de compras
    // parceladas (com data lá na frente) sempre empurram para fora o que foi
    // lançado agora há pouco. Por isso ordena por criadoEm, não por data.
    const recentes = [...ultimosLancamentos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);
    const positivo = resumo.resultado >= 0;

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

      <div class="card mt-12">
        <div class="rotulo texto-suave" style="font-size:12px; font-weight:600;">📊 RESULTADO DO MÊS</div>
        <div class="valor" style="font-size:22px; font-weight:800; margin-top:4px; color:${positivo ? 'var(--cor-receita)' : 'var(--cor-despesa)'}">${formatBRL(resumo.resultado)}</div>
        <span class="selo-resultado ${positivo ? 'positivo' : 'negativo'}">${positivo ? '🟢 Resultado positivo' : '🔴 Resultado negativo'}</span>
      </div>

      <div class="section-title">💳 Cartões</div>
      <div class="card">
        ${cartoesResumo.temCartoes ? `
          <div class="grid-2">
            <div class="kpi-mini"><div class="rotulo">Faturas atuais</div><div class="valor">${formatBRL(cartoesResumo.faturaAtual)}</div></div>
            <div class="kpi-mini"><div class="rotulo">Limite disponível</div><div class="valor">${formatBRL(cartoesResumo.limiteDisponivel)}</div></div>
          </div>
          <div class="mini-barra-limite"><div class="fill" style="width:${Math.min(100, cartoesResumo.pctUtilizado)}%; background:${cartoesResumo.pctUtilizado > 85 ? 'var(--cor-despesa)' : 'var(--cor-primaria)'}"></div></div>
          <div class="texto-suave mt-8">Limite usado: ${formatBRL(cartoesResumo.limiteUtilizado)} de ${formatBRL(cartoesResumo.limiteTotal)}</div>
          ${cartoesResumo.proximaFatura ? `<div class="texto-suave mt-8">Próxima fatura: ${escapeHTML(cartoesResumo.proximaFatura.cartao)} · ${formatBRL(cartoesResumo.proximaFatura.valor)} em ${formatDateBR(cartoesResumo.proximaFatura.vencimento)}</div>` : ''}
        ` : vazioMini('💳', 'Nenhum cartão cadastrado ainda.')}
        <button class="btn btn-texto mt-8" data-action="verCartoes">Ver cartões →</button>
      </div>

      <div class="section-title">📅 Contas próximas</div>
      <div class="card">
        ${proximasContas.length ? proximasContas.map((r) => `
          <div class="lista-item">
            <span class="icone-tipo despesa">📅</span>
            <div class="info">
              <div class="desc">${escapeHTML(r.descricao)}</div>
              <div class="meta">${formatBRL(r.valor)} · Vence em ${formatDateBR(r.vencimento)}</div>
            </div>
            <span class="badge ${r.status}">${rotuloStatus(r.status)}</span>
          </div>`).join('') : vazioMini('🎉', 'Nenhuma conta pendente por aqui.')}
        <button class="btn btn-texto mt-8" data-action="verRecorrentes">Ver todas →</button>
      </div>

      <div class="section-title">🧭 Para onde seu dinheiro está indo</div>
      <div class="card">
        ${categoriasDespesa.length ? categoriasDespesa.map((c, i) => `
          <div class="categoria-linha">
            <div class="topo">
              <span class="nome">${iconeCategoria(c.categoria)} ${escapeHTML(c.categoria)}</span>
              <span class="valores"><strong>${formatBRL(c.valor)}</strong> · ${c.pct.toFixed(0)}%</span>
            </div>
            <div class="barra"><div class="fill" style="width:${c.pct}%; background:${PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length]}"></div></div>
          </div>
        `).join('') : vazioMini('🧭', 'Cadastre despesas para ver para onde seu dinheiro está indo.')}
      </div>

      ${comparativo.anterior.despesas > 0 || resumo.despesas > 0 ? `
      <div class="section-title">📈 Comparação com o mês anterior</div>
      <div class="card">
        <div class="grid-2 mb-8">
          <div class="kpi-mini"><div class="rotulo">Este mês</div><div class="valor">${formatBRL(resumo.despesas)}</div></div>
          <div class="kpi-mini"><div class="rotulo">Mês anterior</div><div class="valor">${formatBRL(comparativo.anterior.despesas)}</div></div>
        </div>
        ${comparativo.anterior.despesas > 0 ? `
        <div class="comparativo-box ${comparativo.deltaDespesasPct <= 0 ? 'positivo' : 'negativo'}">
          <span class="selo">${comparativo.deltaDespesasPct <= 0 ? '🟢' : '🔴'}</span>
          <span class="texto">Você gastou <strong>${Math.abs(comparativo.deltaDespesasPct).toFixed(1)}% ${comparativo.deltaDespesasPct <= 0 ? 'menos' : 'mais'}</strong> que no mês passado.</span>
        </div>` : `<div class="texto-suave">Ainda não há despesas do mês anterior para comparar.</div>`}
      </div>` : ''}

      ${insights.length ? `
      <div class="section-title">💡 Análise do mês</div>
      <div class="card">
        ${insights.map((i) => `<div class="insight-item"><span class="emoji">${i.emoji}</span><span>${i.texto}</span></div>`).join('')}
      </div>` : ''}

      <div class="section-title">🎯 Metas</div>
      <div class="card">
        ${metas.length ? metas.slice(0, 3).map((m) => `
          <div class="mt-8 mb-8">
            <div style="display:flex; justify-content:space-between; font-size:13.5px; font-weight:700; margin-bottom:6px;">
              <span>${escapeHTML(m.nome)}</span>
              <span>${Math.min(100, Math.round((m.valorAtual / (m.valorMeta || 1)) * 100))}%</span>
            </div>
            <div class="texto-suave mb-8">${formatBRL(m.valorAtual)} / ${formatBRL(m.valorMeta)}</div>
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
    verCartoes: () => App.navigate('cartoes'),
    abrirLancamento: (el) => App.navigate('lancar', { id: el.dataset.id }),
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
const PALETA_CATEGORIAS = ['#0F766E', '#F59E0B', '#DC2626', '#2563EB', '#7C3AED'];

const ICONES_CATEGORIA = {
  'Alimentação': '🍔', 'Supermercado': '🛒', 'Moradia': '🏠', 'Energia': '💡', 'Água': '💧',
  'Internet': '📶', 'Telefone': '📱', 'Transporte': '🚗', 'Combustível': '⛽', 'Saúde': '⚕️',
  'Educação': '📚', 'Lazer': '🎉', 'Compras': '🛍️', 'Assinaturas': '📱', 'Financiamentos': '🏦',
  'Impostos': '🧾', 'Faturas': '💳', 'Outros': '📦',
};

function iconeCategoria(categoria) {
  return ICONES_CATEGORIA[categoria] || '🔸';
}

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
