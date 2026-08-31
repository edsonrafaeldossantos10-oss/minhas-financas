Views.relatorios = {
  titulo: 'Relatórios',
  periodo: 'mes',
  personalizado: { inicio: todayISODate(), fim: todayISODate() },

  async render() {
    return `
      <div class="tabs">
        ${['hoje', 'mes', 'anterior', 'trimestre', 'semestre', 'ano', 'personalizado'].map((p) => `
          <button class="${this.periodo === p ? 'ativo' : ''}" data-action="mudarPeriodo" data-periodo="${p}">${rotuloPeriodoRelatorio(p)}</button>
        `).join('')}
      </div>

      ${this.periodo === 'personalizado' ? `
      <div class="linha-campos mt-12">
        <div class="campo"><label>De</label><input type="date" id="rel-inicio" value="${this.personalizado.inicio}"></div>
        <div class="campo"><label>Até</label><input type="date" id="rel-fim" value="${this.personalizado.fim}"></div>
      </div>
      <button class="btn btn-secundario" data-action="aplicarPersonalizado">Aplicar</button>
      ` : ''}

      <div id="conteudo-relatorio" class="mt-16">Carregando…</div>
    `;
  },

  async onMount() {
    await this.desenharConteudo();
  },

  async desenharConteudo() {
    const { inicio, fim } = this.intervaloAtual();
    const transacoes = await Store.listTransacoes({ inicio, fim });
    const receitas = transacoes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);

    const porCategoria = {};
    transacoes.filter((t) => t.tipo === 'despesa').forEach((t) => {
      const cat = t.categoria || 'Outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + t.valor;
    });
    const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

    const cartoes = await Store.listCartoes();
    const porCartao = {};
    transacoes.filter((t) => t.tipo === 'despesa' && t.cartaoId).forEach((t) => {
      const c = cartoes.find((c) => c.id === t.cartaoId);
      const nome = c ? c.nome : 'Cartão';
      porCartao[nome] = (porCartao[nome] || 0) + t.valor;
    });

    const meses = await this.ultimosMeses(6);
    const maioresDespesas = Store.maioresDespesas(transacoes, 5);
    const { year, month } = currentYearMonth();
    const comparativo = await Store.resumoComparativoMes(year, month);

    const container = document.getElementById('conteudo-relatorio');
    if (!container) return;
    container.innerHTML = `
      <div class="section-title">Receitas x Despesas</div>
      <div class="card">
        <canvas id="chart-receitas-despesas" height="150" style="width:100%; height:150px;"></canvas>
        <div class="grid-2 mt-12">
          <div class="kpi-mini receita"><div class="rotulo">Receitas</div><div class="valor">${formatBRL(receitas)}</div></div>
          <div class="kpi-mini despesa"><div class="rotulo">Despesas</div><div class="valor">${formatBRL(despesas)}</div></div>
        </div>
      </div>

      <div class="section-title">Despesas por categoria</div>
      <div class="card">
        ${categoriasOrdenadas.length ? `
        <canvas id="chart-categorias" height="180" style="width:100%; height:180px;"></canvas>
        <div class="mt-12">
          ${categoriasOrdenadas.map(([cat, valor], i) => `
            <div class="lista-item">
              <span style="width:12px; height:12px; border-radius:4px; background:${PALETA[i % PALETA.length]}; flex-shrink:0;"></span>
              <div class="info"><div class="desc">${escapeHTML(cat)}</div></div>
              <span class="valor despesa">${formatBRL(valor)}</span>
            </div>`).join('')}
        </div>` : vazioMini('📊', 'Sem despesas neste período.')}
      </div>

      <div class="section-title">Gastos por cartão</div>
      <div class="card">
        ${Object.keys(porCartao).length ? `<canvas id="chart-cartoes" height="150" style="width:100%; height:150px;"></canvas>` : vazioMini('💳', 'Nenhum gasto no cartão neste período.')}
      </div>

      <div class="section-title">Evolução do saldo (6 meses)</div>
      <div class="card">
        <canvas id="chart-evolucao" height="150" style="width:100%; height:150px;"></canvas>
      </div>

      <div class="section-title">Gastos mensais (6 meses)</div>
      <div class="card">
        <canvas id="chart-gastos-mensais" height="150" style="width:100%; height:150px;"></canvas>
      </div>

      <div class="section-title">Maiores categorias de despesa</div>
      <div class="card">
        ${categoriasOrdenadas.slice(0, 5).map(([cat, valor], i) => `
          <div class="lista-item">
            <span class="icone-tipo despesa">${i + 1}º</span>
            <div class="info"><div class="desc">${escapeHTML(cat)}</div></div>
            <span class="valor despesa">${formatBRL(valor)}</span>
          </div>`).join('') || vazioMini('🏆', 'Sem dados suficientes ainda.')}
      </div>

      <div class="section-title">Maiores despesas do período</div>
      <div class="card">
        ${maioresDespesas.length ? maioresDespesas.map((t, i) => `
          <div class="lista-item">
            <span class="icone-tipo despesa">${i + 1}º</span>
            <div class="info"><div class="desc">${escapeHTML(t.descricao)}</div><div class="meta">${formatDateBR(t.data)}${t.categoria ? ' · ' + escapeHTML(t.categoria) : ''}</div></div>
            <span class="valor despesa">${formatBRL(t.valor)}</span>
          </div>`).join('') : vazioMini('🏆', 'Sem despesas neste período.')}
      </div>

      <div class="section-title">Comparação mensal</div>
      <div class="card">
        <div class="texto-suave mb-8">Mês atual comparado ao anterior, independente do período filtrado acima.</div>
        <div class="grid-2 mb-8">
          <div class="kpi-mini receita"><div class="rotulo">Receitas este mês</div><div class="valor">${formatBRL(comparativo.atual.receitas)}</div></div>
          <div class="kpi-mini"><div class="rotulo">Receitas mês anterior</div><div class="valor">${formatBRL(comparativo.anterior.receitas)}</div></div>
        </div>
        <div class="grid-2 mb-8">
          <div class="kpi-mini despesa"><div class="rotulo">Despesas este mês</div><div class="valor">${formatBRL(comparativo.atual.despesas)}</div></div>
          <div class="kpi-mini"><div class="rotulo">Despesas mês anterior</div><div class="valor">${formatBRL(comparativo.anterior.despesas)}</div></div>
        </div>
        ${comparativo.anterior.despesas > 0 ? `
        <div class="comparativo-box ${comparativo.deltaDespesasPct <= 0 ? 'positivo' : 'negativo'}">
          <span class="selo">${comparativo.deltaDespesasPct <= 0 ? '🟢' : '🔴'}</span>
          <span class="texto">Você gastou <strong>${Math.abs(comparativo.deltaDespesasPct).toFixed(1)}% ${comparativo.deltaDespesasPct <= 0 ? 'menos' : 'mais'}</strong> que no mês passado.</span>
        </div>` : ''}
      </div>
    `;

    // requestAnimationFrame garante que o navegador já terminou o layout dos
    // canvases recém-inseridos antes de medirmos o tamanho deles para desenhar.
    requestAnimationFrame(() => {
      desenharBarras(document.getElementById('chart-receitas-despesas'), [
        { label: 'Receitas', valor: receitas, cor: '#16A34A' },
        { label: 'Despesas', valor: despesas, cor: '#DC2626' },
      ]);
      if (categoriasOrdenadas.length) {
        desenharDonut(document.getElementById('chart-categorias'), categoriasOrdenadas.map(([cat, valor], i) => ({ label: cat, valor, cor: PALETA[i % PALETA.length] })));
      }
      if (Object.keys(porCartao).length) {
        desenharBarras(document.getElementById('chart-cartoes'), Object.entries(porCartao).map(([label, valor], i) => ({ label, valor, cor: PALETA[i % PALETA.length] })));
      }
      desenharLinha(document.getElementById('chart-evolucao'), meses.map((m) => ({ label: m.label, valor: m.saldoAcumulado })));
      desenharBarras(document.getElementById('chart-gastos-mensais'), meses.map((m) => ({ label: m.label, valor: m.despesas, cor: '#DC2626' })));
    });
  },

  async ultimosMeses(n) {
    const { year, month } = currentYearMonth();
    const resultado = [];
    let saldoAcumulado = await Store.saldoTotal();
    const parciais = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(year, month - i, 1);
      const r = await Store.resumoMes(d.getFullYear(), d.getMonth());
      parciais.unshift({ label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), receitas: r.receitas, despesas: r.despesas, resultado: r.resultado });
    }
    // aproxima evolução: parte do saldo atual e desfaz os resultados dos meses mais recentes para trás
    let saldo = saldoAcumulado;
    const comSaldo = [];
    for (let i = parciais.length - 1; i >= 0; i--) {
      comSaldo.unshift({ ...parciais[i], saldoAcumulado: saldo });
      saldo -= parciais[i].resultado;
    }
    return comSaldo;
  },

  intervaloAtual() {
    const { year, month } = currentYearMonth();
    const hoje = todayISODate();
    switch (this.periodo) {
      case 'hoje': return { inicio: hoje, fim: hoje };
      case 'mes': return { inicio: isoDateForYearMonthDay(year, month, 1), fim: isoDateForYearMonthDay(year, month, daysInMonth(year, month)) };
      case 'anterior': {
        const m = month === 0 ? 11 : month - 1;
        const y = month === 0 ? year - 1 : year;
        return { inicio: isoDateForYearMonthDay(y, m, 1), fim: isoDateForYearMonthDay(y, m, daysInMonth(y, m)) };
      }
      case 'trimestre': {
        const d = new Date(year, month - 2, 1);
        return { inicio: isoDateForYearMonthDay(d.getFullYear(), d.getMonth(), 1), fim: isoDateForYearMonthDay(year, month, daysInMonth(year, month)) };
      }
      case 'semestre': {
        const d = new Date(year, month - 5, 1);
        return { inicio: isoDateForYearMonthDay(d.getFullYear(), d.getMonth(), 1), fim: isoDateForYearMonthDay(year, month, daysInMonth(year, month)) };
      }
      case 'ano': return { inicio: `${year}-01-01`, fim: `${year}-12-31` };
      case 'personalizado': return this.personalizado;
      default: return { inicio: null, fim: null };
    }
  },

  actions: {
    mudarPeriodo(el) {
      Views.relatorios.periodo = el.dataset.periodo;
      App.refresh();
    },
    aplicarPersonalizado() {
      Views.relatorios.personalizado = {
        inicio: document.getElementById('rel-inicio').value,
        fim: document.getElementById('rel-fim').value,
      };
      Views.relatorios.desenharConteudo();
    },
  },
};

function rotuloPeriodoRelatorio(p) {
  return { hoje: 'Hoje', mes: 'Este mês', anterior: 'Mês anterior', trimestre: 'Trimestre', semestre: 'Semestre', ano: 'Este ano', personalizado: 'Personalizado' }[p];
}
