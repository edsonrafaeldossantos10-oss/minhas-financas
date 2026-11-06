const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

Views.recorrentes = {
  titulo: 'Contas fixas',

  async render() {
    const lista = await Store.listRecorrentesComStatus();
    const totalMensal = lista
      .filter((r) => r.periodicidade === 'mensal')
      .reduce((s, r) => s + (Number(r.valor) || 0), 0);
    return `
      ${lista.length ? `
      <div class="card card-destaque mb-12">
        <div class="texto-fraco">Total das contas fixas mensais</div>
        <div class="resultado-linha"><div class="valor-grande sensivel">${formatBRL(totalMensal)}</div><span class="badge futuro">${lista.length} conta${lista.length > 1 ? 's' : ''}</span></div>
      </div>` : ''}
      ${lista.length ? lista.map((r) => `
        <div class="card">
          <div class="lista-item" style="padding:0; border:none;">
            <span class="icone-tipo ${r.status === 'vencido' ? 'despesa' : r.status === 'pago' ? 'receita' : 'neutro'}">${r.categoria && ICONES_CATEGORIA[r.categoria] ? ICONES_CATEGORIA[r.categoria] : icon('repetir', 18)}</span>
            <div class="info">
              <div class="desc">${escapeHTML(r.descricao)}</div>
              <div class="meta">${descricaoVencimento(r)} · próximo ${formatDateBR(r.vencimento)}</div>
            </div>
            <span class="badge ${r.status}">${rotuloStatus(r.status)}</span>
          </div>
          <div class="resultado-linha mt-12">
            <div style="font-weight:750; font-size:18px; letter-spacing:-0.02em;" class="sensivel">${formatBRL(r.valor)}</div>
            <div class="linha-botoes">
              ${r.status !== 'pago' ? `<button class="btn btn-primario btn-sm" data-action="pagar" data-id="${r.id}">${icon('check', 16)} Pagar</button>` : ''}
              <button class="btn btn-outline btn-sm" data-action="editar" data-id="${r.id}" aria-label="Editar">${icon('editar', 16)}</button>
            </div>
          </div>
        </div>
      `).join('') : `<div class="card">${vazioMini('📅', 'Nenhuma conta fixa ainda.<br>Cadastre contas que se repetem — aluguel, luz, internet, streaming — e o app avisa quando estiverem perto de vencer.')}</div>`}
      <button class="btn btn-secundario mt-16" data-action="nova">${icon('mais', 18)} Nova conta fixa</button>
    `;
  },

  actions: {
    nova() { Views.recorrentes.abrirForm(); },

    async editar(el) {
      const r = await DB.get('recorrentes', el.dataset.id);
      Views.recorrentes.abrirForm(r);
    },

    async pagar(el) {
      const r = await DB.get('recorrentes', el.dataset.id);
      const contas = await Store.listContas();
      App.showModal(`
        <div class="folha-topo"><h2>Pagar ${escapeHTML(r.descricao)}</h2><button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button></div>
        <div class="campo">
          <label>Valor pago</label>
          <input type="text" inputmode="decimal" id="valor-pagar-recorrente" value="${valorParaInput(r.valor)}">
          <div class="ajuda">Ajuste se o valor deste mês veio diferente (ex.: conta de luz).</div>
        </div>
        <div class="linha-campos">
          <div class="campo">
            <label>Data do pagamento</label>
            <input type="date" id="data-pagar-recorrente" value="${todayISODate()}">
          </div>
          <div class="campo">
            <label>Conta</label>
            <select id="select-conta-pagar-recorrente">
              ${contas.map((c) => `<option value="${c.id}">${escapeHTML(c.nome)}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primario mt-8" data-modal-action="confirmarPagarRecorrente">${icon('check', 18)} Confirmar pagamento</button>
      `, { id: 'pagar-recorrente-modal', centered: true });

      window.__modalHandlers = window.__modalHandlers || {};
      window.__modalHandlers.confirmarPagarRecorrente = async () => {
        const contaId = document.getElementById('select-conta-pagar-recorrente').value;
        const valor = parseValorInput(document.getElementById('valor-pagar-recorrente').value);
        const data = document.getElementById('data-pagar-recorrente').value || todayISODate();
        if (!valor || valor <= 0) { App.toast('Informe um valor válido.'); return; }
        await Store.pagarRecorrente(r.id, contaId, data, valor);
        App.closeModal('pagar-recorrente-modal');
        App.toast('Conta marcada como paga!');
        App.refresh();
      };
    },
  },

  async abrirForm(r) {
    const categorias = await Store.listCategorias('despesa');
    const periodicidade = r ? r.periodicidade : 'mensal';
    App.showModal(`
      <form data-modal-form="salvarRecorrenteModal" data-editando="${r ? r.id : ''}">
        <div class="folha-topo">
          <h2>${r ? 'Editar conta fixa' : 'Nova conta fixa'}</h2>
          <button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button>
        </div>
        <div class="campo">
          <label>Descrição</label>
          <input type="text" name="descricao" required placeholder="Ex: Internet" value="${r ? escapeHTML(r.descricao) : ''}">
        </div>
        <div class="linha-campos">
          <div class="campo">
            <label>Valor</label>
            <input type="text" inputmode="decimal" name="valor" required placeholder="0,00" value="${r ? valorParaInput(r.valor) : ''}">
          </div>
          <div class="campo">
            <label>Categoria</label>
            <select name="categoria">
              ${categorias.map((c) => `<option value="${escapeHTML(c.nome)}" ${r && r.categoria === c.nome ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
              ${r && r.categoria && !categorias.some((c) => c.nome === r.categoria) ? `<option selected value="${escapeHTML(r.categoria)}">${escapeHTML(r.categoria)}</option>` : ''}
            </select>
          </div>
        </div>
        <div class="campo">
          <label>Repete</label>
          <div class="segmented" id="seg-periodicidade">
            ${['mensal', 'semanal', 'anual'].map((p) => `<button type="button" data-p="${p}" class="${periodicidade === p ? 'ativo' : ''}">${rotuloPeriodicidade(p)}</button>`).join('')}
          </div>
          <input type="hidden" name="periodicidade" value="${periodicidade}">
        </div>
        <div class="linha-campos">
          <div class="campo" data-para="mensal anual">
            <label>Dia do vencimento</label>
            <input type="number" inputmode="numeric" name="diaVencimento" min="1" max="31" value="${r && r.diaVencimento ? r.diaVencimento : ''}">
          </div>
          <div class="campo" data-para="anual">
            <label>Mês</label>
            <select name="mesVencimento">
              ${MESES.map((m, i) => `<option value="${i + 1}" ${(r && r.mesVencimento ? r.mesVencimento : new Date().getMonth() + 1) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="campo" data-para="semanal">
            <label>Dia da semana</label>
            <select name="diaSemana">
              ${DIAS_SEMANA.map((d, i) => `<option value="${i}" ${r && Number(r.diaSemana) === i ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primario mt-8">${icon('check', 18)} Salvar</button>
        ${r ? `<button type="button" class="btn btn-perigo mt-8" data-modal-action="excluirRecorrenteModal">${icon('lixo', 18)} Excluir conta fixa</button>` : ''}
      </form>
    `, { id: 'form-recorrente' });

    const form = document.querySelector('#form-recorrente form');
    const aplicarPeriodicidade = (p) => {
      form.querySelector('input[name="periodicidade"]').value = p;
      form.querySelectorAll('#seg-periodicidade button').forEach((b) => b.classList.toggle('ativo', b.dataset.p === p));
      form.querySelectorAll('[data-para]').forEach((el) => {
        el.style.display = el.dataset.para.split(' ').includes(p) ? '' : 'none';
      });
    };
    form.querySelector('#seg-periodicidade').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (b) aplicarPeriodicidade(b.dataset.p);
    });
    aplicarPeriodicidade(periodicidade);

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.salvarRecorrenteModal = async (formEl) => {
      const fd = new FormData(formEl);
      const p = fd.get('periodicidade');
      const dia = Number(fd.get('diaVencimento'));
      if (p !== 'semanal' && !(dia >= 1 && dia <= 31)) { App.toast('Informe o dia do vencimento (1 a 31).'); return; }
      const valor = parseValorInput(fd.get('valor'));
      if (!valor || valor <= 0) { App.toast('Informe um valor válido.'); return; }
      const id = formEl.dataset.editando || uid();
      await DB.put('recorrentes', {
        id,
        descricao: fd.get('descricao').trim(),
        valor,
        categoria: fd.get('categoria') || 'Outros',
        periodicidade: p,
        diaVencimento: p === 'semanal' ? null : dia,
        mesVencimento: p === 'anual' ? Number(fd.get('mesVencimento')) : null,
        diaSemana: p === 'semanal' ? Number(fd.get('diaSemana')) : null,
        dataBase: r && r.dataBase ? r.dataBase : todayISODate(),
        ativo: true,
      });
      App.closeModal('form-recorrente');
      App.toast('Conta fixa salva.');
      App.refresh();
    };
    window.__modalHandlers.excluirRecorrenteModal = async () => {
      const ok = await App.confirmar('Excluir esta conta fixa? Os pagamentos já lançados continuam no histórico.', { titulo: 'Excluir conta fixa', perigo: true, textoBotao: 'Excluir' });
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

function descricaoVencimento(r) {
  if (r.periodicidade === 'semanal') {
    const d = r.diaSemana != null ? Number(r.diaSemana) : Number(r.diaVencimento) % 7;
    return `${d === 0 || d === 6 ? 'Todo' : 'Toda'} ${DIAS_SEMANA[d].toLowerCase()}`;
  }
  if (r.periodicidade === 'anual') {
    const mes = r.mesVencimento || Number((r.dataBase || '2000-01-01').split('-')[1]);
    return `Todo ano, ${r.diaVencimento} de ${MESES[mes - 1].toLowerCase()}`;
  }
  return `Todo dia ${r.diaVencimento}`;
}
