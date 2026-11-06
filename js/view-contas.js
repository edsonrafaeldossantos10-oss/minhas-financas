Views.contas = {
  titulo: 'Contas',

  async render() {
    const contas = await Store.listContasComSaldo();
    const total = contas.reduce((s, c) => s + c.saldoAtual, 0);
    return `
      <div class="card card-destaque mb-12">
        <div class="texto-fraco">Saldo somado das contas</div>
        <div class="valor-grande sensivel ${total >= 0 ? '' : 'negativo-txt'}" style="font-size:26px; font-weight:750; letter-spacing:-0.03em;">${formatBRL(total)}</div>
      </div>
      <div class="card">
        ${contas.map((c) => `
          <div class="lista-item" data-action="abrirConta" data-id="${c.id}">
            <span class="icone-tipo neutro">${icon(c.nome.toLowerCase().includes('dinheiro') || c.nome.toLowerCase().includes('carteira') ? 'carteira' : 'banco', 19)}</span>
            <div class="info">
              <div class="desc">${escapeHTML(c.nome)}</div>
              <div class="meta">Saldo inicial ${formatBRL(c.saldoInicial)}</div>
            </div>
            <span class="valor sensivel ${c.saldoAtual >= 0 ? '' : 'negativo-txt'}">${formatBRL(c.saldoAtual)}</span>
          </div>
        `).join('')}
      </div>
      <div class="texto-fraco mt-12" style="padding:0 4px;">Contas são só para organizar seu dinheiro aqui no app — nada é conectado ao banco. Informe o saldo que a conta tem hoje como "saldo inicial".</div>
      <button class="btn btn-secundario mt-16" data-action="novaConta">${icon('mais', 18)} Nova conta</button>
    `;
  },

  actions: {
    novaConta() { Views.contas.abrirForm(); },

    async abrirConta(el) {
      const conta = await DB.get('contas', el.dataset.id);
      Views.contas.abrirForm(conta);
    },

    async excluirConta(el) {
      const id = el.dataset.id;
      const transacoes = await Store.listTransacoes({ contaId: id });
      if (transacoes.length > 0) {
        App.toast('Não é possível excluir: há lançamentos nesta conta.');
        return;
      }
      const todas = await Store.listContas();
      if (todas.length <= 1) { App.toast('Você precisa ter pelo menos uma conta.'); return; }
      const ok = await App.confirmar('Excluir esta conta?', { titulo: 'Excluir conta', perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('contas', id);
      App.closeModal('form-conta');
      App.toast('Conta excluída.');
      App.refresh();
    },

    async salvarConta(form) {
      const fd = new FormData(form);
      const nome = fd.get('nome').trim();
      if (!nome) { App.toast('Informe um nome para a conta.'); return; }
      const id = form.dataset.editando || uid();
      const anterior = form.dataset.editando ? await DB.get('contas', id) : null;
      await DB.put('contas', {
        ...(anterior || {}),
        id,
        nome,
        saldoInicial: parseValorInput(fd.get('saldoInicial')),
        criadoEm: anterior ? anterior.criadoEm : nowISO(),
      });
      App.closeModal('form-conta');
      App.toast('Conta salva.');
      App.refresh();
    },
  },

  abrirForm(conta) {
    const saldo = conta ? Number(conta.saldoInicial) || 0 : 0;
    App.showModal(`
      <form data-modal-form="salvarContaModal" data-editando="${conta ? conta.id : ''}">
        <div class="folha-topo">
          <h2>${conta ? 'Editar conta' : 'Nova conta'}</h2>
          <button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button>
        </div>
        <div class="campo">
          <label>Nome da conta</label>
          <input type="text" name="nome" required placeholder="Ex: Nubank, Itaú, Poupança" value="${conta ? escapeHTML(conta.nome) : ''}">
        </div>
        <div class="campo">
          <label>Saldo de hoje (saldo inicial)</label>
          <input type="text" inputmode="decimal" name="saldoInicial" placeholder="0,00" value="${saldo ? (saldo < 0 ? '-' : '') + valorParaInput(Math.abs(saldo)) : ''}">
          <div class="ajuda">Para saldo negativo, digite "-" antes do valor.</div>
        </div>
        <button type="submit" class="btn btn-primario mt-8">${icon('check', 18)} Salvar conta</button>
        ${conta ? `<button type="button" class="btn btn-perigo mt-8" data-modal-action="excluirContaModal">${icon('lixo', 18)} Excluir conta</button>` : ''}
      </form>
    `, { id: 'form-conta' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarContaModal = Views.contas.actions.salvarConta;
    window.__modalHandlers.excluirContaModal = () => Views.contas.actions.excluirConta({ dataset: { id: conta.id } });
  },
};
