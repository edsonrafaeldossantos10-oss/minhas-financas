Views.metas = {
  titulo: 'Minhas Metas',

  async render() {
    const metas = await Store.listMetas();
    return `
      ${metas.length ? metas.map((m) => {
        const pct = Math.min(100, Math.round((m.valorAtual / (m.valorMeta || 1)) * 100));
        return `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:700; font-size:15.5px;">🎯 ${escapeHTML(m.nome)}</div>
            ${m.prazo ? `<span class="texto-suave">até ${formatDateBR(m.prazo)}</span>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:13.5px;">
            <span class="texto-suave">Guardado: <strong style="color:var(--cor-texto)">${formatBRL(m.valorAtual)}</strong></span>
            <span class="texto-suave">Meta: ${formatBRL(m.valorMeta)}</span>
          </div>
          <div class="progress-bar mt-8"><div class="fill" style="width:${pct}%"></div></div>
          <div class="texto-suave mt-8">${pct}% concluído</div>
          <div style="display:flex; gap:8px;" class="mt-12">
            <button class="btn btn-secundario btn-sm" data-action="adicionar" data-id="${m.id}">➕ Adicionar</button>
            <button class="btn btn-outline btn-sm" data-action="retirar" data-id="${m.id}">➖ Retirar</button>
            <button class="btn btn-outline btn-sm" data-action="editar" data-id="${m.id}">✏️</button>
          </div>
        </div>`;
      }).join('') : vazioMini('🎯', 'Nenhuma meta criada ainda. Que tal começar uma viagem dos sonhos?')}
      <button class="btn btn-secundario mt-16" data-action="nova">➕ Nova meta</button>
    `;
  },

  actions: {
    nova() { Views.metas.abrirForm(); },
    async editar(el) { Views.metas.abrirForm(await DB.get('metas', el.dataset.id)); },
    adicionar(el) { Views.metas.abrirAjuste(el.dataset.id, 1); },
    retirar(el) { Views.metas.abrirAjuste(el.dataset.id, -1); },
  },

  abrirAjuste(metaId, sinal) {
    App.showModal(`
      <div class="folha-topo"><h2>${sinal > 0 ? 'Adicionar à meta' : 'Retirar da meta'}</h2><button type="button" class="fechar" data-close-modal>✕</button></div>
      <div class="campo">
        <label>Valor</label>
        <input type="text" inputmode="decimal" id="valor-ajuste-meta" placeholder="R$ 0,00">
      </div>
      <button class="btn btn-primario mt-8" data-modal-action="confirmarAjusteMeta">Confirmar</button>
    `, { id: 'ajuste-meta-modal', centered: true });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.confirmarAjusteMeta = async () => {
      const valor = parseValorInput(document.getElementById('valor-ajuste-meta').value);
      if (!valor || valor <= 0) { App.toast('Informe um valor válido.'); return; }
      await Store.ajustarMeta(metaId, valor * sinal, sinal > 0 ? 'Depósito' : 'Retirada');
      App.closeModal('ajuste-meta-modal');
      App.toast('Meta atualizada!');
      App.refresh();
    };
  },

  abrirForm(meta) {
    App.showModal(`
      <form data-modal-form="salvarMetaModal" data-editando="${meta ? meta.id : ''}">
        <div class="folha-topo">
          <h2>${meta ? 'Editar meta' : 'Nova meta'}</h2>
          <button type="button" class="fechar" data-close-modal>✕</button>
        </div>
        <div class="campo">
          <label>Nome da meta</label>
          <input type="text" name="nome" required placeholder="Ex: Viagem" value="${meta ? escapeHTML(meta.nome) : ''}">
        </div>
        <div class="campo">
          <label>Valor da meta</label>
          <input type="text" inputmode="decimal" name="valorMeta" required placeholder="R$ 0,00" value="${meta ? Number(meta.valorMeta).toFixed(2).replace('.', ',') : ''}">
        </div>
        ${!meta ? `
        <div class="campo">
          <label>Valor já guardado (opcional)</label>
          <input type="text" inputmode="decimal" name="valorAtual" placeholder="R$ 0,00">
        </div>` : ''}
        <div class="campo">
          <label>Prazo (opcional)</label>
          <input type="date" name="prazo" value="${meta && meta.prazo ? meta.prazo : ''}">
        </div>
        <button type="submit" class="btn btn-primario mt-8">💾 Salvar</button>
        ${meta ? `<button type="button" class="btn btn-perigo mt-8" data-modal-action="excluirMetaModal">🗑️ Excluir meta</button>` : ''}
      </form>
    `, { id: 'form-meta' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarMetaModal = async (form) => {
      const fd = new FormData(form);
      const id = form.dataset.editando || uid();
      const existente = form.dataset.editando ? await DB.get('metas', id) : null;
      await DB.put('metas', {
        id,
        nome: fd.get('nome').trim(),
        valorMeta: parseValorInput(fd.get('valorMeta')),
        valorAtual: existente ? existente.valorAtual : parseValorInput(fd.get('valorAtual') || '0'),
        prazo: fd.get('prazo') || null,
        historico: existente ? existente.historico || [] : [],
        criadoEm: existente ? existente.criadoEm : nowISO(),
      });
      App.closeModal('form-meta');
      App.toast('Meta salva.');
      App.refresh();
    };
    window.__modalHandlers.excluirMetaModal = async () => {
      const ok = await App.confirmar('Excluir esta meta?', { perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('metas', meta.id);
      App.closeModal('form-meta');
      App.refresh();
    };
  },
};
