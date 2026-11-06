Views.cartoes = {
  titulo: 'Cartões',

  async render() {
    const cartoes = await Store.listCartoes();
    const transacoes = await DB.getAll('transacoes');
    if (!cartoes.length) {
      return `
        <div class="card">${vazioMini('💳', 'Nenhum cartão cadastrado ainda.<br>Cadastre seus cartões para controlar faturas, limite e compras parceladas.')}</div>
        <button class="btn btn-primario mt-16" data-action="novoCartao">${icon('mais', 18)} Adicionar cartão</button>`;
    }
    const linhas = await Promise.all(cartoes.map(async (c) => {
      const r = await Store.resumoCartao(c, transacoes);
      const pct = c.limite > 0 ? Math.min(100, (r.limiteUtilizado / c.limite) * 100) : 0;
      return `
        <div class="cc clicavel" data-action="abrirCartao" data-id="${c.id}" style="cursor:pointer;">
          <div class="cc-topo">
            <div>
              <div class="cc-nome">${escapeHTML(c.nome)}</div>
              <div class="cc-banco">${escapeHTML(c.banco || 'Cartão de crédito')} · fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}</div>
            </div>
            <span class="chip-cc"></span>
          </div>
          <div class="cc-rotulo">Fatura atual</div>
          <div class="cc-valor sensivel">${formatBRL(r.faturaAtual)}</div>
          <div class="cc-barra"><div class="fill" style="width:${pct}%; ${pct > 85 ? 'background:#FF6B81' : ''}"></div></div>
          <div class="cc-rodape"><span>Disponível <strong class="sensivel">${formatBRL(r.limiteDisponivel)}</strong></span><span>Limite ${formatBRL(c.limite)}</span></div>
          ${r.faturaFechada > 0 ? `<div class="cc-rodape" style="color:#FFB547; margin-top:10px;"><span>Fatura fechada a pagar</span><strong>${formatBRL(r.faturaFechada)}</strong></div>` : ''}
        </div>`;
    }));
    return linhas.join('') + `<button class="btn btn-secundario mt-16" data-action="novoCartao">${icon('mais', 18)} Adicionar cartão</button>`;
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
          <button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button>
        </div>
        <div class="campo">
          <label>Nome do cartão</label>
          <input type="text" name="nome" required placeholder="Ex: Nubank Roxinho" value="${cartao ? escapeHTML(cartao.nome) : ''}">
        </div>
        <div class="campo">
          <label>Banco (opcional)</label>
          <input type="text" name="banco" placeholder="Ex: Nubank" value="${cartao ? escapeHTML(cartao.banco || '') : ''}">
        </div>
        <div class="campo">
          <label>Limite total</label>
          <input type="text" inputmode="decimal" name="limite" required placeholder="0,00" value="${cartao ? valorParaInput(cartao.limite) : ''}">
        </div>
        <div class="linha-campos">
          <div class="campo">
            <label>Dia que fecha</label>
            <input type="number" inputmode="numeric" name="diaFechamento" min="1" max="31" required value="${cartao ? cartao.diaFechamento : ''}">
          </div>
          <div class="campo">
            <label>Dia que vence</label>
            <input type="number" inputmode="numeric" name="diaVencimento" min="1" max="31" required value="${cartao ? cartao.diaVencimento : ''}">
          </div>
        </div>
        <div class="texto-fraco mb-12">Compras feitas depois do dia de fechamento entram na fatura do mês seguinte.</div>
        <button type="submit" class="btn btn-primario">${icon('check', 18)} Salvar cartão</button>
      </form>
    `, { id: 'form-cartao' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarCartaoModal = async (form) => {
      const fd = new FormData(form);
      const diaF = Number(fd.get('diaFechamento'));
      const diaV = Number(fd.get('diaVencimento'));
      if (!(diaF >= 1 && diaF <= 31) || !(diaV >= 1 && diaV <= 31)) { App.toast('Dias devem estar entre 1 e 31.'); return; }
      const id = form.dataset.editando || uid();
      const anterior = form.dataset.editando ? await DB.get('cartoes', id) : null;
      await DB.put('cartoes', {
        id,
        nome: fd.get('nome').trim(),
        banco: fd.get('banco').trim(),
        limite: parseValorInput(fd.get('limite')),
        diaFechamento: diaF,
        diaVencimento: diaV,
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
  competenciaVista: null,

  async render(params) {
    const cartao = await DB.get('cartoes', params.id);
    if (!cartao) { setTimeout(() => App.navigate('cartoes'), 0); return ''; }
    const transacoes = await DB.getAll('transacoes');
    const resumo = await Store.resumoCartao(cartao, transacoes);
    if (this.cartaoVisto !== cartao.id) { this.competenciaVista = null; this.cartaoVisto = cartao.id; }
    const competencia = this.competenciaVista || resumo.competenciaAberta;
    const despesasDaFatura = transacoes
      .filter((t) => t.tipo === 'despesa' && t.cartaoId === cartao.id &&
        Store.competenciaDaFatura(t.data, cartao.diaFechamento) === competencia)
      .sort((a, b) => b.data.localeCompare(a.data));
    const totalFatura = despesasDaFatura.reduce((s, t) => s + t.valor, 0);
    const pct = cartao.limite > 0 ? Math.min(100, (resumo.limiteUtilizado / cartao.limite) * 100) : 0;
    const paga = (cartao.faturasPagas || []).includes(competencia);

    return `
      <div class="cc">
        <div class="cc-topo">
          <div>
            <div class="cc-nome">${escapeHTML(cartao.nome)}</div>
            <div class="cc-banco">${escapeHTML(cartao.banco || 'Cartão de crédito')} · fecha dia ${cartao.diaFechamento} · vence dia ${cartao.diaVencimento}</div>
          </div>
          <span class="chip-cc"></span>
        </div>
        <div class="cc-rotulo">Limite disponível</div>
        <div class="cc-valor sensivel">${formatBRL(resumo.limiteDisponivel)}</div>
        <div class="cc-barra"><div class="fill" style="width:${pct}%; ${pct > 85 ? 'background:#FF6B81' : ''}"></div></div>
        <div class="cc-rodape"><span>Usado ${formatBRL(resumo.limiteUtilizado)}</span><span>Limite ${formatBRL(cartao.limite)}</span></div>
      </div>
      <div class="linha-botoes mt-12">
        <button class="btn btn-secundario btn-sm" data-action="editar">${icon('editar', 16)} Editar</button>
        <button class="btn btn-perigo btn-sm" data-action="excluir">${icon('lixo', 16)} Excluir</button>
      </div>

      <div class="section-title">Faturas em aberto</div>
      <div class="card">
        ${resumo.proximasFaturas.length ? resumo.proximasFaturas.map((f) => `
          <div class="lista-item" data-action="verFatura" data-comp="${f.competencia}">
            <span class="icone-tipo ${f.fechada ? 'despesa' : 'neutro'}">${icon('recibo', 18)}</span>
            <div class="info">
              <div class="desc">${Store.rotuloCompetencia(f.competencia)}</div>
              <div class="meta">Vence ${formatDateBR(f.vencimento)}</div>
            </div>
            <div style="text-align:right;">
              <div class="valor despesa sensivel">${formatBRL(f.valor)}</div>
              <span class="badge ${f.status}" style="margin-top:4px;">${{ fechada: 'Fechada', aberta: 'Aberta', futura: 'Futura' }[f.status]}</span>
            </div>
          </div>
        `).join('') : vazioMini('✨', 'Nenhuma fatura em aberto.')}
      </div>

      <div class="secao-topo">Fatura de ${Store.rotuloCompetencia(competencia)}
        ${competencia !== resumo.competenciaAberta ? `<button class="link" data-action="verFatura" data-comp="${resumo.competenciaAberta}">Ver atual</button>` : ''}
      </div>
      <div class="card">
        <div class="resultado-linha mb-8">
          <div>
            <div class="texto-fraco">Total da fatura · vence ${formatDateBR(Store.vencimentoDaCompetencia(competencia, cartao.diaVencimento, cartao.diaFechamento))}</div>
            <div class="valor-grande sensivel">${formatBRL(totalFatura)}</div>
          </div>
          ${paga ? `<span class="badge pago">Paga</span>` : ''}
        </div>
        ${totalFatura > 0 && !paga ? `<button class="btn btn-primario mb-12" data-action="pagarFatura" data-comp="${competencia}">${icon('check', 18)} Marcar esta fatura como paga</button>` : ''}
        ${paga ? `<button class="btn btn-outline btn-sm mb-12" data-action="desfazerPagamento" data-comp="${competencia}">Desfazer pagamento</button>` : ''}
        ${despesasDaFatura.length ? despesasDaFatura.map(itemLancamentoHTML).join('') : vazioMini('🧾', 'Nenhuma compra nesta fatura.')}
      </div>
    `;
  },

  actions: {
    editar() { DB.get('cartoes', App.current.params.id).then((c) => Views.cartoes.abrirForm(c)); },

    verFatura(el) {
      Views['cartao-detalhe'].competenciaVista = el.dataset.comp;
      App.refresh();
    },

    async excluir() {
      const id = App.current.params.id;
      const transacoes = await Store.listTransacoes({ cartaoId: id });
      if (transacoes.length > 0) {
        App.toast('Não é possível excluir: existem compras neste cartão.');
        return;
      }
      const ok = await App.confirmar('Excluir este cartão?', { titulo: 'Excluir cartão', perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('cartoes', id);
      App.navigate('cartoes');
    },

    async desfazerPagamento(el) {
      const ok = await App.confirmar('A fatura volta a ficar em aberto e o lançamento de pagamento é removido da conta.', { titulo: 'Desfazer pagamento', textoBotao: 'Desfazer' });
      if (!ok) return;
      await Store.desmarcarFaturaPaga(App.current.params.id, el.dataset.comp);
      App.toast('Pagamento desfeito.');
      App.refresh();
    },

    async pagarFatura(el) {
      const cartaoId = App.current.params.id;
      const competencia = el.dataset.comp;
      const cartao = await DB.get('cartoes', cartaoId);
      const valor = (await DB.getAll('transacoes'))
        .filter((t) => t.tipo === 'despesa' && t.cartaoId === cartaoId && Store.competenciaDaFatura(t.data, cartao.diaFechamento) === competencia)
        .reduce((s, t) => s + t.valor, 0);
      if (valor <= 0) { App.toast('Não há valor nesta fatura.'); return; }
      const contas = await Store.listContas();
      App.showModal(`
        <div class="folha-topo"><h2>Pagar fatura</h2><button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button></div>
        <p class="texto-suave mb-12">Fatura de <strong>${Store.rotuloCompetencia(competencia)}</strong>: <strong>${formatBRL(valor)}</strong></p>
        <div class="campo">
          <label>Pago com qual conta?</label>
          <select id="select-conta-pagamento">
            ${contas.map((c) => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`).join('')}
          </select>
          <div class="ajuda">O valor sai do saldo dessa conta. Não conta de novo como despesa do mês — as compras já foram contadas.</div>
        </div>
        <button class="btn btn-primario mt-8" data-modal-action="confirmarPagamentoFatura">Confirmar pagamento</button>
      `, { id: 'pagar-fatura-modal', centered: true });

      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.confirmarPagamentoFatura = async () => {
        const contaId = document.getElementById('select-conta-pagamento').value;
        await Store.marcarFaturaPaga(cartaoId, competencia, contaId);
        App.closeModal('pagar-fatura-modal');
        App.toast('Fatura marcada como paga.');
        App.refresh();
      };
    },
  },
};
