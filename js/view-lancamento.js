const TIPOS_LANCAMENTO = {
  despesa: { label: 'Despesa', icone: 'despesa' },
  receita: { label: 'Receita', icone: 'receita' },
  transferencia: { label: 'Transf.', icone: 'transferencia' },
  investimento: { label: 'Investir', icone: 'investimento' },
};

const FORMAS_PAGAMENTO = [
  { valor: 'debito', label: 'Débito / Pix' },
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'credito', label: 'Cartão de crédito' },
  { valor: 'transferencia', label: 'Transferência / boleto' },
];

Views.lancar = {
  titulo: (params) => (params && params.id ? 'Editar lançamento' : 'Novo lançamento'),

  async render(params) {
    let transacao = null;
    if (params.id) transacao = await DB.get('transacoes', params.id);
    if (params.id && !transacao) { setTimeout(() => App.navigate('dashboard'), 0); return ''; }
    const tipo = (transacao && transacao.tipo) || params.tipo || 'despesa';
    this.tipoAtual = tipo;

    const [categorias, contas, cartoes] = await Promise.all([
      Store.listCategorias(tipoCategoriaPara(tipo)),
      Store.listContas(),
      Store.listCartoes(),
    ]);

    const editando = !!transacao;
    const hoje = todayISODate();
    const formaPagamentoPadrao = transacao ? (transacao.formaPagamento || 'debito') : (params.formaPagamento || 'debito');
    const ehCredito = tipo === 'despesa' && formaPagamentoPadrao === 'credito';
    const catPadrao = transacao ? transacao.categoria : (tipo === 'receita' ? 'Salário' : tipo === 'investimento' ? 'Investimentos' : 'Alimentação');

    return `
      <form data-form="salvarLancamento" data-editando="${editando ? transacao.id : ''}" data-tipo="${tipo}">
        <div class="toggle-tipo">
          ${Object.entries(TIPOS_LANCAMENTO).map(([key, t]) => `
            <button type="button" class="${tipo === key ? 'ativo ' + key : ''}" data-action="trocarTipo" data-tipo="${key}" ${editando && tipo !== key ? 'disabled' : ''}>${icon(t.icone, 18)}${t.label}</button>
          `).join('')}
        </div>
        ${transacao && transacao.parcela ? `<div class="texto-fraco texto-centro mt-8">Parcela ${transacao.parcela.numero} de ${transacao.parcela.total} — alterações valem só para esta parcela.</div>` : ''}

        <div class="card mt-12">
          <div class="campo valor-grande">
            <label>${tipo === 'receita' ? 'Quanto entrou?' : tipo === 'transferencia' ? 'Quanto vai transferir?' : tipo === 'investimento' ? 'Quanto vai investir?' : 'Quanto gastou?'}</label>
            <input type="text" inputmode="decimal" name="valor" placeholder="0,00" required autocomplete="off"
              value="${transacao ? valorParaInput(transacao.valor) : ''}"
              style="color:var(--cor-${tipo === 'transferencia' ? 'transferencia' : tipo === 'investimento' ? 'investimento' : tipo === 'receita' ? 'receita' : 'texto'})">
          </div>
        </div>

        <div class="card mt-12">
          <div class="campo">
            <label>Descrição</label>
            <input type="text" name="descricao" placeholder="Ex: ${placeholderDescricao(tipo)}" required autocomplete="off"
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
                ${categorias.map((c) => `<option value="${escapeHTML(c.nome)}" ${catPadrao === c.nome ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
                ${transacao && transacao.categoria && !categorias.some((c) => c.nome === transacao.categoria) ? `<option value="${escapeHTML(transacao.categoria)}" selected>${escapeHTML(transacao.categoria)}</option>` : ''}
                <option value="__nova__">+ Nova categoria…</option>
              </select>
            </div>` : ''}
          </div>

          ${tipo === 'despesa' ? `
          <div class="campo">
            <label>Forma de pagamento</label>
            <select name="formaPagamento" data-onchange="mudarFormaPagamento">
              ${FORMAS_PAGAMENTO.map((f) => `<option value="${f.valor}" ${formaPagamentoPadrao === f.valor ? 'selected' : ''}>${f.label}</option>`).join('')}
            </select>
          </div>
          <div id="campo-cartao" style="display:${ehCredito ? 'block' : 'none'}">
            ${cartoes.length ? `
            <div class="linha-campos">
              <div class="campo">
                <label>Cartão</label>
                <select name="cartaoId">
                  ${cartoes.length > 1 ? '<option value="">Selecione…</option>' : ''}
                  ${cartoes.map((c) => `<option value="${c.id}" ${transacao && transacao.cartaoId === c.id ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
                </select>
              </div>
              ${!editando ? `
              <div class="campo">
                <label>Parcelas</label>
                <select name="parcelas">
                  ${Array.from({ length: 24 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === 1 ? 'selected' : ''}>${n === 1 ? 'À vista' : n + 'x'}</option>`).join('')}
                </select>
              </div>` : ''}
            </div>
            ${!editando ? `<div class="texto-fraco" style="margin:-6px 0 12px;">No parcelado, informe o valor <strong>total</strong> da compra — o app divide nas parcelas.</div>` : ''}
            ` : `
            <div class="kpi-mini mb-12" style="display:flex; align-items:center; gap:10px;">
              <span class="icone-tipo ouro">${icon('cartao', 18)}</span>
              <div style="flex:1;"><div style="font-weight:600; font-size:14px;">Nenhum cartão cadastrado</div><div class="texto-fraco">Cadastre um cartão para lançar no crédito.</div></div>
              <button type="button" class="btn btn-secundario btn-sm" data-action="irCartoes">Cadastrar</button>
            </div>`}
          </div>` : ''}

          <div class="campo" id="campo-conta" style="display:${ehCredito ? 'none' : 'block'}">
            <label>${tipo === 'transferencia' ? 'Sai da conta' : tipo === 'receita' ? 'Entrou na conta' : 'Sai da conta'}</label>
            <select name="contaId" required>
              ${contas.map((c) => `<option value="${c.id}" ${transacao && transacao.contaId === c.id ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
            </select>
          </div>

          ${tipo === 'transferencia' ? `
          <div class="campo">
            <label>Vai para a conta</label>
            <select name="contaDestinoId" required>
              ${contas.map((c, i) => `<option value="${c.id}" ${(transacao ? transacao.contaDestinoId === c.id : i === 1) ? 'selected' : ''}>${escapeHTML(c.nome)}</option>`).join('')}
            </select>
            ${contas.length < 2 ? `<div class="ajuda">Você precisa de pelo menos 2 contas para transferir. <a class="link-suave" href="#/contas">Cadastrar conta</a></div>` : ''}
          </div>` : ''}

          <div class="campo" style="margin-bottom:0;">
            <label>Observação (opcional)</label>
            <textarea name="observacao" rows="2">${escapeHTML(transacao ? transacao.observacao || '' : '')}</textarea>
          </div>
        </div>

        <button type="submit" class="btn btn-primario mt-16">${icon('check', 18)} ${editando ? 'Salvar alterações' : 'Salvar lançamento'}</button>
        ${editando ? `<button type="button" class="btn btn-perigo mt-8" data-action="excluir">${icon('lixo', 18)} Excluir</button>` : ''}
      </form>
    `;
  },

  onMount(params) {
    const valorInput = document.querySelector('input[name="valor"]');
    if (valorInput && !params.id) setTimeout(() => valorInput.focus(), 120);
  },

  actions: {
    trocarTipo(el) {
      if (el.disabled) return;
      const params = { tipo: el.dataset.tipo };
      App.navigate('lancar', params, { pushHash: false });
    },

    irCartoes() { App.navigate('cartoes'); },

    async mudarCategoria(select) {
      if (select.value !== '__nova__') return;
      const primeira = select.querySelector('option:not([value="__nova__"])');
      select.value = primeira ? primeira.value : '';
      const nome = await App.pedirTexto('Nova categoria', { placeholder: 'Ex: Farmácia', textoBotao: 'Criar categoria' });
      if (!nome || !nome.trim()) return;
      // V3 (correção): usa o tipo do formulário (antes, ao editar, a
      // categoria nova era sempre criada como "despesa").
      const tipoAtual = select.closest('form').dataset.tipo || 'despesa';
      const categoria = await Store.criarCategoria(nome, tipoCategoriaPara(tipoAtual));
      if (!select.querySelector(`option[value="${CSS.escape(categoria.nome)}"]`)) {
        const opt = document.createElement('option');
        opt.value = categoria.nome;
        opt.textContent = categoria.nome;
        select.insertBefore(opt, select.querySelector('option[value="__nova__"]'));
      }
      select.value = categoria.nome;
    },

    mudarFormaPagamento(select) {
      const credito = select.value === 'credito';
      const campoCartao = document.getElementById('campo-cartao');
      const campoConta = document.getElementById('campo-conta');
      if (campoCartao) campoCartao.style.display = credito ? 'block' : 'none';
      if (campoConta) campoConta.style.display = credito ? 'none' : 'block';
    },

    async excluir(el) {
      const form = el.closest('form');
      const id = form.dataset.editando;
      const transacao = await DB.get('transacoes', id);
      let todasParcelas = false;
      if (transacao.compraId) {
        const excluirTodas = await App.confirmar(
          `Esta é a parcela ${transacao.parcela.numero} de ${transacao.parcela.total}. Deseja excluir a compra inteira (todas as parcelas)?`,
          { titulo: 'Excluir compra parcelada', textoBotao: 'Excluir todas', textoCancelar: 'Não', perigo: true });
        if (excluirTodas) {
          todasParcelas = true;
        } else {
          const excluirSomenteEsta = await App.confirmar(
            'Excluir somente esta parcela?', { titulo: 'Excluir parcela', textoBotao: 'Excluir só esta', perigo: true });
          if (!excluirSomenteEsta) return;
        }
      } else {
        const ok = await App.confirmar('Tem certeza que deseja excluir este lançamento?', { titulo: 'Excluir lançamento', perigo: true, textoBotao: 'Excluir' });
        if (!ok) return;
      }
      await Store.excluirLancamento(id, { todasParcelas });
      App.toast('Lançamento excluído.');
      App.navigate('dashboard');
    },

    async salvarLancamento(form) {
      if (form.dataset.salvando) return;
      const fd = new FormData(form);
      const tipo = form.dataset.tipo;
      const formaPagamento = fd.get('formaPagamento') || null;
      const dados = {
        tipo,
        descricao: (fd.get('descricao') || '').trim(),
        valor: parseValorInput(fd.get('valor')),
        data: fd.get('data'),
        categoria: fd.get('categoria') && fd.get('categoria') !== '__nova__' ? fd.get('categoria') : null,
        contaId: fd.get('contaId') || null,
        contaDestinoId: fd.get('contaDestinoId') || null,
        formaPagamento,
        cartaoId: formaPagamento === 'credito' ? (fd.get('cartaoId') || null) : null,
        parcelas: formaPagamento === 'credito' ? (fd.get('parcelas') || 1) : 1,
        observacao: fd.get('observacao'),
      };

      if (!dados.valor || dados.valor <= 0) { App.toast('Informe um valor maior que zero.'); return; }
      if (!dados.descricao) { App.toast('Escreva uma descrição.'); return; }
      if (!dados.data) { App.toast('Informe a data.'); return; }
      if (tipo === 'transferencia' && dados.contaId === dados.contaDestinoId) {
        App.toast('Escolha contas diferentes para a transferência.');
        return;
      }
      if (tipo === 'despesa' && formaPagamento === 'credito' && !dados.cartaoId) {
        App.toast('Selecione o cartão usado.');
        return;
      }

      form.dataset.salvando = '1';
      try {
        const editandoId = form.dataset.editando;
        if (editandoId) {
          await Store.atualizarLancamento(editandoId, dados);
          App.toast('Lançamento atualizado.');
        } else {
          const criados = await Store.criarLancamento(dados);
          App.toast(criados.length > 1 ? `Compra lançada em ${criados.length} parcelas.` : 'Lançamento salvo!');
        }
        App.navigate('dashboard');
      } finally {
        delete form.dataset.salvando;
      }
    },
  },
};

function tipoCategoriaPara(tipo) {
  return tipo === 'receita' ? 'receita' : 'despesa';
}

function placeholderDescricao(tipo) {
  return { receita: 'Salário', despesa: 'Mercado', transferencia: 'Guardar na poupança', investimento: 'Aporte CDB' }[tipo] || '';
}

function baseDescricao(t) {
  if (t.parcela) return t.descricao.replace(/\s*\(\d+\/\d+\)$/, '');
  return t.descricao;
}
