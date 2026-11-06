Views.metas = {
  titulo: 'Metas',

  async render() {
    const metas = await Store.listMetas();
    return `
      ${metas.length ? metas.map((m) => {
        const pct = Math.min(100, Math.round((m.valorAtual / (m.valorMeta || 1)) * 100));
        const falta = Math.max(0, (m.valorMeta || 0) - (m.valorAtual || 0));
        let porMes = '';
        if (m.prazo && falta > 0) {
          const hoje = new Date();
          const [py, pm] = m.prazo.split('-').map(Number);
          const meses = (py - hoje.getFullYear()) * 12 + (pm - 1 - hoje.getMonth()) + 1;
          if (meses > 0) porMes = `Guardando <strong>${formatBRL(falta / meses)}</strong> por mês você chega lá.`;
          else porMes = 'O prazo desta meta já passou.';
        }
        return `
        <div class="card">
          <div class="lista-item" style="padding:0; border:none;">
            <span class="icone-tipo ouro">${icon('meta', 19)}</span>
            <div class="info">
              <div class="desc">${escapeHTML(m.nome)}</div>
              <div class="meta">${m.prazo ? `Até ${formatDateBR(m.prazo)}` : 'Sem prazo definido'}</div>
            </div>
            <span class="badge ${pct >= 100 ? 'pago' : 'futuro'}">${pct >= 100 ? 'Concluída 🎉' : pct + '%'}</span>
          </div>
          <div class="resultado-linha mt-12">
            <div><span class="sensivel" style="font-weight:750; font-size:20px; letter-spacing:-0.02em;">${formatBRL(m.valorAtual)}</span> <span class="texto-fraco">de ${formatBRL(m.valorMeta)}</span></div>
          </div>
          <div class="progress-bar mt-8"><div class="fill" style="width:${pct}%"></div></div>
          ${porMes ? `<div class="texto-suave mt-8">${porMes}</div>` : ''}
          <div class="linha-botoes mt-12">
            <button class="btn btn-primario btn-sm" data-action="adicionar" data-id="${m.id}">${icon('mais', 16)} Guardar</button>
            <button class="btn btn-outline btn-sm" data-action="retirar" data-id="${m.id}">Retirar</button>
            <button class="btn btn-outline btn-sm" data-action="editar" data-id="${m.id}" aria-label="Editar">${icon('editar', 16)}</button>
          </div>
        </div>`;
      }).join('') : `<div class="card">${vazioMini('🎯', 'Nenhuma meta ainda.<br>Que tal começar pela reserva de emergência ou aquela viagem dos sonhos?')}</div>`}
      <button class="btn btn-secundario mt-16" data-action="nova">${icon('mais', 18)} Nova meta</button>
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
      <form data-modal-form="confirmarAjusteMeta">
        <div class="folha-topo"><h2>${sinal > 0 ? 'Guardar na meta' : 'Retirar da meta'}</h2><button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button></div>
        <div class="campo valor-grande">
          <label>Valor</label>
          <input type="text" inputmode="decimal" id="valor-ajuste-meta" placeholder="0,00" autocomplete="off">
        </div>
        <button type="submit" class="btn btn-primario mt-8">Confirmar</button>
      </form>
    `, { id: 'ajuste-meta-modal', centered: true });
    setTimeout(() => document.getElementById('valor-ajuste-meta')?.focus(), 60);

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
          <button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button>
        </div>
        <div class="campo">
          <label>Nome da meta</label>
          <input type="text" name="nome" required placeholder="Ex: Reserva de emergência" value="${meta ? escapeHTML(meta.nome) : ''}">
        </div>
        <div class="linha-campos">
          <div class="campo">
            <label>Quanto quer juntar?</label>
            <input type="text" inputmode="decimal" name="valorMeta" required placeholder="0,00" value="${meta ? valorParaInput(meta.valorMeta) : ''}">
          </div>
          ${!meta ? `
          <div class="campo">
            <label>Já tem guardado</label>
            <input type="text" inputmode="decimal" name="valorAtual" placeholder="0,00">
          </div>` : ''}
        </div>
        <div class="campo">
          <label>Prazo (opcional)</label>
          <input type="date" name="prazo" value="${meta && meta.prazo ? meta.prazo : ''}">
        </div>
        <button type="submit" class="btn btn-primario mt-8">${icon('check', 18)} Salvar meta</button>
        ${meta ? `<button type="button" class="btn btn-perigo mt-8" data-modal-action="excluirMetaModal">${icon('lixo', 18)} Excluir meta</button>` : ''}
      </form>
    `, { id: 'form-meta' });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarMetaModal = async (form) => {
      const fd = new FormData(form);
      const valorMeta = parseValorInput(fd.get('valorMeta'));
      if (!valorMeta || valorMeta <= 0) { App.toast('Informe o valor da meta.'); return; }
      const id = form.dataset.editando || uid();
      const existente = form.dataset.editando ? await DB.get('metas', id) : null;
      await DB.put('metas', {
        id,
        nome: fd.get('nome').trim(),
        valorMeta,
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
      const ok = await App.confirmar('Excluir esta meta?', { titulo: 'Excluir meta', perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('metas', meta.id);
      App.closeModal('form-meta');
      App.refresh();
    };
  },
};
