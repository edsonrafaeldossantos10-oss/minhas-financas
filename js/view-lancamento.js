const TIPOS_LANCAMENTO = {
  receita: { label: 'Receita', emoji: '🟢' },
  despesa: { label: 'Despesa', emoji: '🔴' },
  transferencia: { label: 'Transferência', emoji: '🔵' },
  investimento: { label: 'Investimento', emoji: '🟣' },
};

const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'debito', label: 'Débito / Pix' },
  { valor: 'credito', label: 'Cartão de crédito' },
  { valor: 'transferencia', label: 'Transferência bancária' },
];

Views.lancar = {
  titulo: 'Lançamento',

  async render(params) {
    let transacao = null;
    if (params.id) transacao = await DB.get('transacoes', params.id);
    const tipo = (transacao && transacao.tipo) || params.tipo || 'despesa';

    const [categorias, contas, cartoes] = await Promise.all([
      Store.listCategorias(tipo === 'investimento' ? 'despesa' : tipo),
      Store.listContas(),
      Store.listCartoes(),
    ]);

    const editando = !!transacao;
    const hoje = todayISODate();

    return `
      <form data-form="salvarLancamento" data-editando="${editando ? transacao.id : ''}">
        <div class="toggle-tipo mb-8">
          ${Object.entries(TIPOS_LANCAMENTO).map(([key, t]) => `
            <button type="button" class="${tipo === key ? 'ativo ' + key : ''}" data-action="trocarTipo" data-tipo="${key}">${t.emoji} ${t.label}</button>
          `).join('')}
        </div>

        <div class="card mt-12">
          <div class="campo valor-grande">
            <label>Valor</label>
            <input type="text" inputmode="decimal" name="valor" placeholder="R$ 0,00" required
              value="${transacao ? Number(transacao.valor).toFixed(2).replace('.', ',') : ''}">
          </div>

          <div class="campo">
            <label>Descrição</label>
            <input type="text" name="descricao" placeholder="Ex: ${placeholderDescricao(tipo)}" required
              value="${escapeHTML(transacao ? baseDescricao(transacao) : '')}">
          </div>

          <div class="linha-campos">
            <div class="campo">
              <label>Data</label>
              <input type="date" name="data" required value="${transacao ? transacao.data : hoje}">
            </div>
            ${tipo !== 'transferencia' ? `
            <div class="campo">
              <label>Categoria</label>
              <select name="categoria" data-onchange="mudarCategoria">
                ${categorias.map((c) => `<option value="${escapeHTML(c.nome)}" ${transacao && transacao.categoria === c.nome ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
                <option value="__nova__">+ Nova categoria…</option>
              </select>
            </div>` : ''}
          </div>

          <div class="campo">
            <label>${tipo === 'transferencia' ? 'Conta de origem' : tipo === 'receita' ? 'Recebido na conta' : 'Conta'}</label>
            <select name="contaId" required>
              ${contas.map((c) => `<option value="${c.id}" ${transacao && transacao.contaId === c.id ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
            </select>
          </div>

          ${tipo === 'transferencia' ? `
          <div class="campo">
            <label>Conta de destino</label>
            <select name="contaDestinoId" required>
              ${contas.map((c) => `<option value="${c.id}" ${transacao && transacao.contaDestinoId === c.id ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
            </select>
          </div>` : ''}

          ${tipo === 'despesa' ? `
          <div class="campo">
            <label>Forma de pagamento</label>
            <select name="formaPagamento" data-onchange="mudarFormaPagamento">
              ${FORMAS_PAGAMENTO.map((f) => `<option value="${f.valor}" ${(transacao ? transacao.formaPagamento : 'dinheiro') === f.valor ? 'selected' : ''}>${f.label}</option>`).join('')}
            </select>
          </div>
          <div id="campo-cartao" style="display:${(transacao && transacao.formaPagamento === 'credito') ? 'block' : 'none'}">
            <div class="campo">
              <label>Cartão</label>
              <select name="cartaoId">
                <option value="">Selecione…</option>
                ${cartoes.map((c) => `<option value="${c.id}" ${transacao && transacao.cartaoId === c.id ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
              </select>
            </div>
            ${!editando ? `
            <div class="campo">
              <label>Parcelas</label>
              <select name="parcelas">
                ${Array.from({ length: 24 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === 1 ? 'selected' : ''}>${n}x${n > 1 ? ' de ' : ' (à vista)'}</option>`).join('')}
              </select>
            </div>` : ''}
          </div>` : ''}

          <div class="campo">
            <label>Observação (opcional)</label>
            <textarea name="observacao" rows="2">${escapeHTML(transacao ? transacao.observacao || '' : '')}</textarea>
          </div>
        </div>

        <button type="submit" class="btn btn-primario mt-16">💾 Salvar</button>
        ${editando ? `<button type="button" class="btn btn-perigo mt-8" data-action="excluir">🗑️ Excluir</button>` : ''}
        <button type="button" class="btn btn-texto mt-8" data-action="cancelar">Cancelar</button>
      </form>
    `;
  },

  onMount() {
    const valorInput = document.querySelector('input[name="valor"]');
    if (valorInput) {
      valorInput.addEventListener('focus', () => valorInput.select());
    }
  },

  actions: {
    trocarTipo(el, params) {
      App.navigate('lancar', { tipo: el.dataset.tipo }, { pushHash: false });
    },

    cancelar() {
      history.back();
    },

    async mudarCategoria(select) {
      if (select.value !== '__nova__') return;
      const nome = prompt('Nome da nova categoria:');
      select.value = select.querySelector('option:not([value="__nova__"])')?.value || '';
      if (!nome || !nome.trim()) return;
      const tipoAtual = App.current.params.tipo || 'despesa';
      const categoria = await Store.criarCategoria(nome, tipoAtual === 'investimento' ? 'despesa' : tipoAtual);
      const opt = document.createElement('option');
      opt.value = categoria.nome;
      opt.textContent = categoria.nome;
      select.insertBefore(opt, select.querySelector('option[value="__nova__"]'));
      select.value = categoria.nome;
    },

    mudarFormaPagamento(select) {
      const campoCartao = document.getElementById('campo-cartao');
      if (campoCartao) campoCartao.style.display = select.value === 'credito' ? 'block' : 'none';
    },

    async excluir(el) {
      const form = el.closest('form');
      const id = form.dataset.editando;
      const transacao = await DB.get('transacoes', id);
      let todasParcelas = false;
      if (transacao.compraId) {
        const excluirTodas = await App.confirmar(
          'Esta é uma parcela de uma compra parcelada. Toque em "Excluir todas" para remover a compra inteira, ou em "Cancelar" para escolher excluir só esta parcela.',
          { titulo: 'Excluir parcela', textoBotao: 'Excluir todas', perigo: true });
        if (excluirTodas) {
          todasParcelas = true;
        } else {
          const excluirSomenteEsta = await App.confirmar(
            'Excluir somente esta parcela?', { titulo: 'Confirmar', textoBotao: 'Excluir só esta', perigo: true });
          if (!excluirSomenteEsta) return;
        }
      } else {
        const ok = await App.confirmar('Tem certeza que deseja excluir este lançamento?', { perigo: true, textoBotao: 'Excluir' });
        if (!ok) return;
      }
      await Store.excluirLancamento(id, { todasParcelas });
      App.toast('Lançamento excluído.');
      App.navigate('dashboard');
    },

    async salvarLancamento(form) {
      const fd = new FormData(form);
      const tipo = document.querySelector('.toggle-tipo button.ativo')?.dataset.tipo || App.current.params.tipo;
      const dados = {
        tipo,
        descricao: fd.get('descricao'),
        valor: parseValorInput(fd.get('valor')),
        data: fd.get('data'),
        categoria: fd.get('categoria') || null,
        contaId: fd.get('contaId') || null,
        contaDestinoId: fd.get('contaDestinoId') || null,
        formaPagamento: fd.get('formaPagamento') || null,
        cartaoId: fd.get('cartaoId') || null,
        parcelas: fd.get('parcelas') || 1,
        observacao: fd.get('observacao'),
      };

      if (!dados.descricao || !dados.valor || dados.valor <= 0) {
        App.toast('Preencha descrição e um valor válido.');
        return;
      }
      if (tipo === 'transferencia' && dados.contaId === dados.contaDestinoId) {
        App.toast('Escolha contas diferentes para a transferência.');
        return;
      }
      if (tipo === 'despesa' && dados.formaPagamento === 'credito' && !dados.cartaoId) {
        App.toast('Selecione o cartão usado.');
        return;
      }

      const editandoId = form.dataset.editando;
      if (editandoId) {
        await Store.atualizarLancamento(editandoId, dados);
        App.toast('Lançamento atualizado.');
      } else {
        await Store.criarLancamento(dados);
        App.toast('Lançamento salvo com sucesso!');
      }
      App.navigate('dashboard');
    },
  },
};

function placeholderDescricao(tipo) {
  return { receita: 'Salário', despesa: 'Supermercado', transferencia: 'Poupança mensal', investimento: 'Aporte CDB' }[tipo] || '';
}

function baseDescricao(t) {
  if (t.parcela) return t.descricao.replace(/\s*\(\d+\/\d+\)$/, '');
  return t.descricao;
}
