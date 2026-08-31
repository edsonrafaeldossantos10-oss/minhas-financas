Views.cartoes = {
  titulo: 'Meus Cartões',

  async render() {
    const cartoes = await Store.listCartoes();
    const transacoes = await DB.getAll('transacoes');
    if (!cartoes.length) {
      return `${vazioMini('💳', 'Nenhum cartão cadastrado ainda.')}
        <button class="btn btn-secundario mt-16" data-action="novoCartao">➕ Novo cartão</button>`;
    }
    const linhas = await Promise.all(cartoes.map(async (c) => {
      const r = await Store.resumoCartao(c, transacoes);
      const pct = c.limite > 0 ? Math.min(100, (r.limiteUtilizado / c.limite) * 100) : 0;
      return `
        <div class="card" data-action="abrirCartao" data-id="${c.id}" style="cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:700; font-size:15px;">💳 ${escapeHTML(c.nome)}</div>
              <div class="texto-suave mt-8">${escapeHTML(c.banco || '')}</div>
            </div>
            <div style="text-align:right;">
              <div class="texto-suave">Fatura atual</div>
              <div style="font-weight:800; font-size:17px;">${formatBRL(r.faturaAtual)}</div>
            </div>
          </div>
          <div class="progress-bar mt-12"><div class="fill" style="width:${pct}%; background:${pct > 85 ? 'var(--cor-despesa)' : 'var(--cor-primaria)'}"></div></div>
          <div class="texto-suave mt-8">Limite usado ${formatBRL(r.limiteUtilizado)} de ${formatBRL(c.limite)} · Disponível ${formatBRL(r.limiteDisponivel)}</div>
        </div>`;
    }));
    return linhas.join('') + `<button class="btn btn-secundario mt-16" data-action="novoCartao">➕ Novo cartão</button>`;
  },

  actions: {
    novoCartao() { Views.cartoes.abrirForm(); },
    abrirCartao(el) { App.navigate('cartao-detalhe', { id: el.dataset.id }); },
  },

  abrirForm(cartao) {
    App.showModal(`
      <form data-modal-form="salvarCartaoModal" data-editando="${cartao ? cartao.id : ''}">
        <div class="folha-topo">
          <h2>${cartao ? 'Editar cartão' : 'Novo cartão'}</h2>
          <button type="button" class="fechar" data-close-modal>✕</button>
        </div>
        <div class="campo">
          <label>Nome do cartão</label>
          <input type="text" name="nome" required placeholder="Ex: Nubank" value="${cartao ? escapeHTML(cartao.nome) : ''}">
        </div>
        <div class="campo">
          <label>Banco</label>
          <input type="text" name="banco" placeholder="Ex: Nubank" value="${cartao ? escapeHTML(cartao.banco || '') : ''}">
        </div>
        <div class="campo">
          <label>Limite total</label>
          <input type="text" inputmode="decimal" name="limite" required placeholder="R$ 0,00" value="${cartao ? Number(cartao.limite).toFixed(2).replace('.', ',') : ''}">
        </div>
        <div class="linha-campos">
          <div class="campo">
            <label>Dia de fechamento</label>
            <input type="number" name="diaFechamento" min="1" max="31" required value="${cartao ? cartao.diaFechamento : ''}">
          </div>
          <div class="campo">
            <label>Dia de vencimento</label>
            <input type="number" name="diaVencimento" min="1" max="31" required value="${cartao ? cartao.diaVencimento : ''}">
          </div>
        </div>
        <button type="submit" class="btn btn-primario mt-8">💾 Salvar</button>
      </form>
    `, { id: 'form-cartao' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarCartaoModal = async (form) => {
      const fd = new FormData(form);
      const id = form.dataset.editando || uid();
      const anterior = form.dataset.editando ? await DB.get('cartoes', id) : null;
      await DB.put('cartoes', {
        id,
        nome: fd.get('nome').trim(),
        banco: fd.get('banco').trim(),
        limite: parseValorInput(fd.get('limite')),
        diaFechamento: Number(fd.get('diaFechamento')),
        diaVencimento: Number(fd.get('diaVencimento')),
        faturasPagas: anterior ? anterior.faturasPagas || [] : [],
        criadoEm: anterior ? anterior.criadoEm : nowISO(),
      });
      App.closeModal('form-cartao');
      App.toast('Cartão salvo.');
      App.refresh();
    };
  },
};

Views['cartao-detalhe'] = {
  titulo: 'Cartão',

  async render(params) {
    const cartao = await DB.get('cartoes', params.id);
    if (!cartao) { App.navigate('cartoes'); return ''; }
    const transacoes = await DB.getAll('transacoes');
    const resumo = await Store.resumoCartao(cartao, transacoes);
    const despesasFaturaAtual = transacoes
      .filter((t) => t.tipo === 'despesa' && t.cartaoId === cartao.id &&
        Store.competenciaDaFatura(t.data, cartao.diaFechamento) === resumo.competenciaAberta)
      .sort((a, b) => b.data.localeCompare(a.data));
    const contas = await Store.listContas();

    return `
      <div class="card">
        <div style="font-weight:800; font-size:17px;">💳 ${escapeHTML(cartao.nome)}</div>
        <div class="texto-suave mt-8">${escapeHTML(cartao.banco || '')} · Fecha dia ${cartao.diaFechamento} · Vence dia ${cartao.diaVencimento}</div>
        <div class="grid-2 mt-16">
          <div class="kpi-mini"><div class="rotulo">Limite total</div><div class="valor">${formatBRL(cartao.limite)}</div></div>
          <div class="kpi-mini"><div class="rotulo">Disponível</div><div class="valor">${formatBRL(resumo.limiteDisponivel)}</div></div>
        </div>
        <div class="progress-bar mt-12"><div class="fill" style="width:${cartao.limite > 0 ? Math.min(100, (resumo.limiteUtilizado / cartao.limite) * 100) : 0}%"></div></div>
        <div class="texto-suave mt-8">Usado: ${formatBRL(resumo.limiteUtilizado)}</div>
        <div style="display:flex; gap:8px;" class="mt-16">
          <button class="btn btn-outline btn-sm" data-action="editar">✏️ Editar</button>
          <button class="btn btn-perigo btn-sm" data-action="excluir">🗑️ Excluir</button>
        </div>
      </div>

      <div class="section-title">Próximas faturas</div>
      <div class="card">
        ${resumo.proximasFaturas.length ? resumo.proximasFaturas.map((f) => `
          <div class="lista-item">
            <span class="icone-tipo despesa">🧾</span>
            <div class="info">
              <div class="desc">${f.aberta ? 'Fatura atual (aberta)' : 'Fatura ' + f.competencia}</div>
              <div class="meta">Vence em ${formatDateBR(f.vencimento)}</div>
            </div>
            <span class="valor despesa">${formatBRL(f.valor)}</span>
          </div>
        `).join('') + `<button class="btn btn-secundario mt-12" data-action="pagarFatura">✅ Marcar fatura atual como paga</button>` : vazioMini('✨', 'Nenhuma fatura em aberto.')}
      </div>

      <div class="section-title">Compras da fatura atual</div>
      <div class="card">
        ${despesasFaturaAtual.length ? despesasFaturaAtual.map(itemLancamentoHTML).join('') : vazioMini('🧾', 'Nenhuma compra nesta fatura ainda.')}
      </div>
    `;
  },

  actions: {
    editar() { DB.get('cartoes', App.current.params.id).then((c) => Views.cartoes.abrirForm(c)); },

    async excluir() {
      const id = App.current.params.id;
      const transacoes = await Store.listTransacoes({ cartaoId: id });
      if (transacoes.length > 0) {
        App.toast('Não é possível excluir: existem compras vinculadas a este cartão.');
        return;
      }
      const ok = await App.confirmar('Excluir este cartão?', { perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('cartoes', id);
      App.navigate('cartoes');
    },

    async pagarFatura() {
      const cartaoId = App.current.params.id;
      const cartao = await DB.get('cartoes', cartaoId);
      const resumo = await Store.resumoCartao(cartao, await DB.getAll('transacoes'));
      if (resumo.faturaAtual <= 0) { App.toast('Não há valor em aberto nesta fatura.'); return; }
      const contas = await Store.listContas();
      App.showModal(`
        <div class="folha-topo"><h2>Pagar fatura</h2><button type="button" class="fechar" data-close-modal>✕</button></div>
        <p class="texto-suave mb-8">Valor da fatura atual: <strong>${formatBRL(resumo.faturaAtual)}</strong></p>
        <div class="campo">
          <label>Pagar com qual conta?</label>
          <select id="select-conta-pagamento">
            ${contas.map((c) => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primario mt-8" data-modal-action="confirmarPagamentoFatura">Confirmar pagamento</button>
      `, { id: 'pagar-fatura-modal', centered: true });

      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.confirmarPagamentoFatura = async () => {
        const contaId = document.getElementById('select-conta-pagamento').value;
        await Store.marcarFaturaPaga(cartaoId, resumo.competenciaAberta, contaId);
        App.closeModal('pagar-fatura-modal');
        App.toast('Fatura marcada como paga.');
        App.refresh();
      };
    },
  },
};
