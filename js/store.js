// ---------------------------------------------------------------------------
// Regras de negócio: saldos, faturas, status de contas recorrentes, metas.
// Tudo calculado em cima do que está no IndexedDB (via db.js) — nada fica
// "guardado" de forma redundante, então o saldo nunca desincroniza dos
// lançamentos.
// ---------------------------------------------------------------------------

const Store = {
  // ---------------------------------------------------------------- Contas
  async listContas() {
    const contas = await DB.getAll('contas');
    return contas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async saldoDaConta(contaId, transacoes) {
    const all = transacoes || await DB.getAll('transacoes');
    let saldo = 0;
    const conta = await DB.get('contas', contaId);
    if (conta) saldo += Number(conta.saldoInicial) || 0;
    for (const t of all) {
      if (t.tipo === 'receita' && t.contaId === contaId) saldo += t.valor;
      else if (t.tipo === 'despesa' && t.contaId === contaId && t.formaPagamento !== 'credito') saldo -= t.valor;
      else if (t.tipo === 'investimento' && t.contaId === contaId) saldo -= t.valor;
      else if (t.tipo === 'transferencia') {
        if (t.contaId === contaId) saldo -= t.valor;
        if (t.contaDestinoId === contaId) saldo += t.valor;
      }
    }
    return saldo;
  },

  async listContasComSaldo() {
    const [contas, transacoes] = await Promise.all([this.listContas(), DB.getAll('transacoes')]);
    const result = [];
    for (const conta of contas) {
      result.push({ ...conta, saldoAtual: await this.saldoDaConta(conta.id, transacoes) });
    }
    return result;
  },

  async saldoTotal() {
    const contas = await this.listContasComSaldo();
    return contas.reduce((sum, c) => sum + c.saldoAtual, 0);
  },

  // ---------------------------------------------------------------- Cartões
  competenciaDaFatura(dataISO, diaFechamento) {
    const [y, m, d] = dataISO.split('-').map(Number);
    let cy = y, cm = m;
    if (d > diaFechamento) {
      cm += 1;
      if (cm > 12) { cm = 1; cy += 1; }
    }
    return `${cy}-${String(cm).padStart(2, '0')}`;
  },

  competenciaAtual(diaFechamento) {
    return this.competenciaDaFatura(todayISODate(), diaFechamento);
  },

  vencimentoDaCompetencia(competencia, diaVencimento) {
    const [y, m] = competencia.split('-').map(Number);
    return isoDateForYearMonthDay(y, m - 1, Math.min(diaVencimento, daysInMonth(y, m - 1)));
  },

  async listCartoes() {
    const cartoes = await DB.getAll('cartoes');
    return cartoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async resumoCartao(cartao, transacoes) {
    const all = (transacoes || await DB.getAll('transacoes'))
      .filter((t) => t.tipo === 'despesa' && t.cartaoId === cartao.id);
    const faturasPagas = new Set(cartao.faturasPagas || []);
    const competenciaAberta = this.competenciaAtual(cartao.diaFechamento);

    const porCompetencia = {};
    for (const t of all) {
      const comp = this.competenciaDaFatura(t.data, cartao.diaFechamento);
      porCompetencia[comp] = (porCompetencia[comp] || 0) + t.valor;
    }

    const faturaAtual = porCompetencia[competenciaAberta] || 0;
    const limiteUtilizado = Object.entries(porCompetencia)
      .filter(([comp]) => !faturasPagas.has(comp))
      .reduce((sum, [, v]) => sum + v, 0);

    const proximasCompetencias = Object.keys(porCompetencia)
      .filter((c) => c >= competenciaAberta && !faturasPagas.has(c))
      .sort()
      .map((comp) => ({
        competencia: comp,
        valor: porCompetencia[comp],
        vencimento: this.vencimentoDaCompetencia(comp, cartao.diaVencimento),
        aberta: comp === competenciaAberta,
      }));

    return {
      faturaAtual,
      limiteUtilizado,
      limiteDisponivel: Math.max(0, (Number(cartao.limite) || 0) - limiteUtilizado),
      competenciaAberta,
      proximasFaturas: proximasCompetencias,
    };
  },

  async marcarFaturaPaga(cartaoId, competencia, contaId) {
    const cartao = await DB.get('cartoes', cartaoId);
    if (!cartao) throw new Error('Cartão não encontrado.');
    const transacoes = await DB.getAll('transacoes');
    const valor = transacoes
      .filter((t) => t.tipo === 'despesa' && t.cartaoId === cartaoId &&
        this.competenciaDaFatura(t.data, cartao.diaFechamento) === competencia)
      .reduce((sum, t) => sum + t.valor, 0);

    const faturasPagas = new Set(cartao.faturasPagas || []);
    faturasPagas.add(competencia);
    await DB.put('cartoes', { ...cartao, faturasPagas: [...faturasPagas] });

    if (valor > 0 && contaId) {
      await DB.put('transacoes', {
        id: uid(),
        tipo: 'despesa',
        descricao: `Pagamento fatura ${cartao.nome} (${competencia})`,
        valor,
        data: todayISODate(),
        categoria: 'Faturas',
        contaId,
        formaPagamento: 'debito',
        observacao: '',
        criadoEm: nowISO(),
      });
    }
  },

  // ------------------------------------------------------------ Categorias
  async listCategorias(tipo) {
    const categorias = await DB.getAll('categorias');
    const filtradas = tipo ? categorias.filter((c) => c.tipo === tipo) : categorias;
    return filtradas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async criarCategoria(nome, tipo) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) throw new Error('Nome da categoria é obrigatório.');
    const existentes = await this.listCategorias(tipo);
    if (existentes.some((c) => c.nome.toLowerCase() === nomeLimpo.toLowerCase())) {
      return existentes.find((c) => c.nome.toLowerCase() === nomeLimpo.toLowerCase());
    }
    const categoria = { id: uid(), nome: nomeLimpo, tipo, padrao: false };
    await DB.put('categorias', categoria);
    return categoria;
  },

  // ------------------------------------------------------------ Lançamentos
  async criarLancamento(dados) {
    const base = {
      id: uid(),
      tipo: dados.tipo,
      descricao: dados.descricao.trim(),
      valor: Number(dados.valor),
      data: dados.data,
      categoria: dados.categoria || null,
      contaId: dados.contaId || null,
      contaDestinoId: dados.contaDestinoId || null,
      cartaoId: dados.cartaoId || null,
      formaPagamento: dados.formaPagamento || null,
      observacao: dados.observacao || '',
      recorrenteId: dados.recorrenteId || null,
      compraId: null,
      parcela: null,
      criadoEm: nowISO(),
    };

    if (dados.tipo === 'despesa' && dados.parcelas && Number(dados.parcelas) > 1) {
      const total = Number(dados.parcelas);
      const valorParcela = Math.round((base.valor / total) * 100) / 100;
      const compraId = uid();
      const lancamentos = [];
      let somaDistribuida = 0;
      for (let i = 0; i < total; i++) {
        const isUltima = i === total - 1;
        const valor = isUltima ? Math.round((base.valor - somaDistribuida) * 100) / 100 : valorParcela;
        somaDistribuida += valor;
        lancamentos.push({
          ...base,
          id: uid(),
          valor,
          data: addMonthsToISODate(dados.data, i),
          compraId,
          parcela: { numero: i + 1, total },
          descricao: `${base.descricao} (${i + 1}/${total})`,
        });
      }
      await DB.bulkPut('transacoes', lancamentos);
      return lancamentos;
    }

    await DB.put('transacoes', base);
    return [base];
  },

  async atualizarLancamento(id, dados) {
    const atual = await DB.get('transacoes', id);
    if (!atual) throw new Error('Lançamento não encontrado.');
    const atualizado = {
      ...atual,
      descricao: dados.descricao.trim(),
      valor: Number(dados.valor),
      data: dados.data,
      categoria: dados.categoria || null,
      contaId: dados.contaId || null,
      contaDestinoId: dados.contaDestinoId || null,
      cartaoId: dados.cartaoId || null,
      formaPagamento: dados.formaPagamento || null,
      observacao: dados.observacao || '',
    };
    await DB.put('transacoes', atualizado);
    return atualizado;
  },

  async excluirLancamento(id, { todasParcelas } = {}) {
    const t = await DB.get('transacoes', id);
    if (!t) return;
    if (todasParcelas && t.compraId) {
      await DB.deleteWhere('transacoes', (item) => item.compraId === t.compraId);
    } else {
      await DB.delete('transacoes', id);
    }
  },

  async listTransacoes({ inicio, fim, tipo, categoria, contaId, cartaoId, busca } = {}) {
    let all = await DB.getAll('transacoes');
    if (inicio) all = all.filter((t) => t.data >= inicio);
    if (fim) all = all.filter((t) => t.data <= fim);
    if (tipo) all = all.filter((t) => t.tipo === tipo);
    if (categoria) all = all.filter((t) => t.categoria === categoria);
    if (contaId) all = all.filter((t) => t.contaId === contaId || t.contaDestinoId === contaId);
    if (cartaoId) all = all.filter((t) => t.cartaoId === cartaoId);
    if (busca) {
      const q = busca.trim().toLowerCase();
      all = all.filter((t) =>
        t.descricao.toLowerCase().includes(q) ||
        (t.categoria || '').toLowerCase().includes(q) ||
        (t.observacao || '').toLowerCase().includes(q));
    }
    return all.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.criadoEm.localeCompare(a.criadoEm)));
  },

  // ------------------------------------------------------------- Resumo mês
  async resumoMes(year, month) {
    const inicio = isoDateForYearMonthDay(year, month, 1);
    const fim = isoDateForYearMonthDay(year, month, daysInMonth(year, month));
    const transacoes = await this.listTransacoes({ inicio, fim });
    const receitas = transacoes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    const despesasDinheiro = transacoes
      .filter((t) => t.tipo === 'despesa' && t.formaPagamento !== 'credito')
      .reduce((s, t) => s + t.valor, 0);
    const despesasCredito = transacoes
      .filter((t) => t.tipo === 'despesa' && t.formaPagamento === 'credito')
      .reduce((s, t) => s + t.valor, 0);
    const despesas = despesasDinheiro + despesasCredito;
    const investimentos = transacoes.filter((t) => t.tipo === 'investimento').reduce((s, t) => s + t.valor, 0);
    return { receitas, despesas, investimentos, resultado: receitas - despesas, transacoes };
  },

  async totalFaturasAbertas() {
    const cartoes = await this.listCartoes();
    const transacoes = await DB.getAll('transacoes');
    let total = 0;
    for (const cartao of cartoes) {
      const resumo = await this.resumoCartao(cartao, transacoes);
      total += resumo.faturaAtual;
    }
    return total;
  },

  // ------------------------------------------------------------ Recorrentes
  async listRecorrentes() {
    const recorrentes = await DB.getAll('recorrentes');
    return recorrentes.sort((a, b) => a.diaVencimento - b.diaVencimento);
  },

  proximoVencimento(recorrente, refDate = new Date()) {
    const y = refDate.getFullYear(), m = refDate.getMonth(), d = refDate.getDate();
    const hojeISO = isoDateForYearMonthDay(y, m, d);

    if (recorrente.periodicidade === 'anual') {
      const [, mm, dd] = (recorrente.dataBase || `${y}-01-01`).split('-').map(Number);
      let venc = isoDateForYearMonthDay(y, mm - 1, dd);
      if (venc < hojeISO) venc = isoDateForYearMonthDay(y + 1, mm - 1, dd);
      return venc;
    }
    if (recorrente.periodicidade === 'semanal') {
      const diaSemana = Number(recorrente.diaVencimento) % 7;
      const hojeSemana = refDate.getDay();
      let diff = diaSemana - hojeSemana;
      if (diff < 0) diff += 7;
      return isoDateForYearMonthDay(y, m, d + diff);
    }
    const diaEsteMes = Math.min(Number(recorrente.diaVencimento), daysInMonth(y, m));
    const vencEsteMes = isoDateForYearMonthDay(y, m, diaEsteMes);
    if (vencEsteMes >= hojeISO) return vencEsteMes;
    const proxMesData = new Date(y, m + 1, 1);
    const diaProxMes = Math.min(Number(recorrente.diaVencimento), daysInMonth(proxMesData.getFullYear(), proxMesData.getMonth()));
    return isoDateForYearMonthDay(proxMesData.getFullYear(), proxMesData.getMonth(), diaProxMes);
  },

  vencimentoAnterior(recorrente, vencimentoAtual) {
    if (recorrente.periodicidade === 'anual') return addMonthsToISODate(vencimentoAtual, -12);
    if (recorrente.periodicidade === 'semanal') {
      const [y, m, d] = vencimentoAtual.split('-').map(Number);
      const dt = new Date(y, m - 1, d - 7);
      return isoDateForYearMonthDay(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
    return addMonthsToISODate(vencimentoAtual, -1);
  },

  async listRecorrentesComStatus() {
    const [recorrentes, transacoes] = await Promise.all([this.listRecorrentes(), DB.getAll('transacoes')]);
    const hoje = todayISODate();
    return recorrentes.filter((r) => r.ativo !== false).map((r) => {
      const vencimento = this.proximoVencimento(r);
      const anterior = this.vencimentoAnterior(r, vencimento);
      // "pago" = já existe um lançamento vinculado a esta conta fixa feito depois do vencimento anterior
      // (cobre tanto pagar adiantado quanto pagar em atraso, sempre em relação ao ciclo mais recente).
      const pagoNoPeriodo = transacoes.some((t) => t.recorrenteId === r.id && t.data > anterior);
      const diasParaVencer = Math.round((new Date(`${vencimento}T00:00:00`) - new Date(`${hoje}T00:00:00`)) / 86400000);
      let status = 'proximo';
      if (pagoNoPeriodo) status = 'pago';
      else if (diasParaVencer < 0) status = 'vencido';
      else if (diasParaVencer > 5) status = 'futuro';
      return { ...r, vencimento, status, diasParaVencer };
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  },

  async pagarRecorrente(recorrenteId, contaId, data) {
    const r = await DB.get('recorrentes', recorrenteId);
    if (!r) throw new Error('Conta recorrente não encontrada.');
    await this.criarLancamento({
      tipo: 'despesa',
      descricao: r.descricao,
      valor: r.valor,
      data: data || todayISODate(),
      categoria: r.categoria,
      contaId,
      formaPagamento: 'debito',
      recorrenteId: r.id,
    });
  },

  // ----------------------------------------------------------------- Metas
  async listMetas() {
    const metas = await DB.getAll('metas');
    return metas.sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  },

  async ajustarMeta(metaId, valorDelta, descricao) {
    const meta = await DB.get('metas', metaId);
    if (!meta) throw new Error('Meta não encontrada.');
    const historico = meta.historico || [];
    historico.push({ data: nowISO(), valor: valorDelta, descricao: descricao || '' });
    const valorAtual = Math.max(0, (Number(meta.valorAtual) || 0) + valorDelta);
    await DB.put('metas', { ...meta, valorAtual, historico });
  },
};
