Views.contas = {
  titulo: 'Minhas Contas',

  async render() {
    const contas = await Store.listContasComSaldo();
    return `
      <div class="texto-suave mb-8">Contas cadastradas só para você controlar o dinheiro aqui dentro do app — nada é conectado a bancos de verdade.</div>
      ${contas.map((c) => `
        <div class="card" data-action="abrirConta" data-id="${c.id}" style="cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; font-size:15px;">🏦 ${escapeHTML(c.nome)}</div>
              <div class="texto-suave mt-8">Saldo inicial: ${formatBRL(c.saldoInicial)}</div>
            </div>
            <div style="font-weight:800; font-size:18px; color:${c.saldoAtual >= 0 ? 'var(--cor-receita)' : 'var(--cor-despesa)'}">
              ${formatBRL(c.saldoAtual)}
            </div>
          </div>
        </div>
      `).join('')}
      <button class="btn btn-secundario mt-16" data-action="novaConta">➕ Nova conta</button>
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
        App.toast('Não é possível excluir: existem lançamentos nessa conta. Exclua-os primeiro.');
        return;
      }
      const ok = await App.confirmar('Excluir esta conta?', { perigo: true, textoBotao: 'Excluir' });
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
      await DB.put('contas', {
        id,
        nome,
        saldoInicial: parseValorInput(fd.get('saldoInicial')),
        criadoEm: form.dataset.editando ? (await DB.get('contas', id)).criadoEm : nowISO(),
      });
      App.closeModal('form-conta');
      App.toast('Conta salva.');
      App.refresh();
    },
  },

  abrirForm(conta) {
    App.showModal(`
      <form data-modal-form="salvarContaModal" data-editando="${conta ? conta.id : ''}">
        <div class="folha-topo">
          <h2>${conta ? 'Editar conta' : 'Nova conta'}</h2>
          <button type="button" class="fechar" data-close-modal>✕</button>
        </div>
        <div class="campo">
          <label>Nome da conta</label>
          <input type="text" name="nome" required placeholder="Ex: Conta principal" value="${conta ? escapeHTML(conta.nome) : ''}">
        </div>
        <div class="campo">
          <label>Saldo inicial</label>
          <input type="text" inputmode="decimal" name="saldoInicial" placeholder="R$ 0,00" value="${conta ? Number(conta.saldoInicial).toFixed(2).replace('.', ',') : ''}">
        </div>
        <button type="submit" class="btn btn-primario mt-8">💾 Salvar</button>
        ${conta ? `<button type="button" class="btn btn-perigo mt-8" data-modal-action="excluirContaModal">🗑️ Excluir conta</button>` : ''}
      </form>
    `, { id: 'form-conta' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarContaModal = Views.contas.actions.salvarConta;
    window.__modalHandlers.excluirContaModal = () => Views.contas.actions.excluirConta({ dataset: { id: conta.id } });
  },
};
