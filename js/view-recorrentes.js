Views.recorrentes = {
  titulo: 'Contas Fixas',

  async render() {
    const lista = await Store.listRecorrentesComStatus();
    return `
      <div class="texto-suave mb-8">Contas que se repetem todo mês, toda semana ou todo ano — ex: internet, energia, streaming.</div>
      ${lista.length ? lista.map((r) => `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; font-size:15px;">${escapeHTML(r.descricao)}</div>
              <div class="texto-suave mt-8">${escapeHTML(r.categoria || '')} · ${rotuloPeriodicidade(r.periodicidade)} · vence dia ${r.diaVencimento}</div>
            </div>
            <span class="badge ${r.status}">${{ pago: 'Pago', proximo: 'Próximo', vencido: 'Vencido', futuro: 'Futuro' }[r.status]}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;" class="mt-12">
            <div style="font-weight:800; font-size:16px;">${formatBRL(r.valor)}</div>
            <div style="display:flex; gap:8px;">
              ${r.status !== 'pago' ? `<button class="btn btn-secundario btn-sm" data-action="pagar" data-id="${r.id}">✅ Pagar</button>` : ''}
              <button class="btn btn-outline btn-sm" data-action="editar" data-id="${r.id}">✏️</button>
            </div>
          </div>
        </div>
      `).join('') : vazioMini('📅', 'Nenhuma conta fixa cadastrada.')}
      <button class="btn btn-secundario mt-16" data-action="nova">➕ Nova conta fixa</button>
    `;
  },

  actions: {
    nova() { Views.recorrentes.abrirForm(); },

    async editar(el) {
      const r = await DB.get('recorrentes', el.dataset.id);
      Views.recorrentes.abrirForm(r);
    },

    async pagar(el) {
      const contas = await Store.listContas();
      App.showModal(`
        <div class="folha-topo"><h2>Marcar como pago</h2><button type="button" class="fechar" data-close-modal>✕</button></div>
        <div class="campo">
          <label>Pagar com qual conta?</label>
          <select id="select-conta-pagar-recorrente">
            ${contas.map((c) => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primario mt-8" data-modal-action="confirmarPagarRecorrente">Confirmar</button>
      `, { id: 'pagar-recorrente-modal', centered: true });

      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.confirmarPagarRecorrente = async () => {
        const contaId = document.getElementById('select-conta-pagar-recorrente').value;
        await Store.pagarRecorrente(el.dataset.id, contaId);
        App.closeModal('pagar-recorrente-modal');
        App.toast('Marcado como pago!');
        App.refresh();
      };
    },
  },

  abrirForm(r) {
    App.showModal(`
      <form data-modal-form="salvarRecorrenteModal" data-editando="${r ? r.id : ''}">
        <div class="folha-topo">
          <h2>${r ? 'Editar conta fixa' : 'Nova conta fixa'}</h2>
          <button type="button" class="fechar" data-close-modal>✕</button>
        </div>
        <div class="campo">
          <label>Descrição</label>
          <input type="text" name="descricao" required placeholder="Ex: Internet" value="${r ? escapeHTML(r.descricao) : ''}">
        </div>
        <div class="campo">
          <label>Valor</label>
          <input type="text" inputmode="decimal" name="valor" required placeholder="R$ 0,00" value="${r ? Number(r.valor).toFixed(2).replace('.', ',') : ''}">
        </div>
        <div class="campo">
          <label>Categoria</label>
          <input type="text" name="categoria" placeholder="Ex: Assinaturas" value="${r ? escapeHTML(r.categoria || '') : ''}">
        </div>
        <div class="linha-campos">
          <div class="campo">
            <label>Dia do vencimento</label>
            <input type="number" name="diaVencimento" min="1" max="31" required value="${r ? r.diaVencimento : ''}">
          </div>
          <div class="campo">
            <label>Periodicidade</label>
            <select name="periodicidade">
              <option value="mensal" ${!r || r.periodicidade === 'mensal' ? 'selected' : ''}>Mensal</option>
              <option value="semanal" ${r && r.periodicidade === 'semanal' ? 'selected' : ''}>Semanal</option>
              <option value="anual" ${r && r.periodicidade === 'anual' ? 'selected' : ''}>Anual</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primario mt-8">💾 Salvar</button>
        ${r ? `<button type="button" class="btn btn-perigo mt-8" data-modal-action="excluirRecorrenteModal">🗑️ Excluir</button>` : ''}
      </form>
    `, { id: 'form-recorrente' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarRecorrenteModal = async (form) => {
      const fd = new FormData(form);
      const id = form.dataset.editando || uid();
      await DB.put('recorrentes', {
        id,
        descricao: fd.get('descricao').trim(),
        valor: parseValorInput(fd.get('valor')),
        categoria: fd.get('categoria').trim(),
        diaVencimento: Number(fd.get('diaVencimento')),
        periodicidade: fd.get('periodicidade'),
        dataBase: todayISODate(),
        ativo: true,
      });
      App.closeModal('form-recorrente');
      App.toast('Conta fixa salva.');
      App.refresh();
    };
    window.__modalHandlers.excluirRecorrenteModal = async () => {
      const ok = await App.confirmar('Excluir esta conta fixa? Lançamentos já feitos não serão apagados.', { perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('recorrentes', r.id);
      App.closeModal('form-recorrente');
      App.refresh();
    };
  },
};

function rotuloPeriodicidade(p) {
  return { mensal: 'Mensal', semanal: 'Semanal', anual: 'Anual' }[p] || p;
}
