Views.dashboard = {
  titulo: 'Minhas Finanças',

  async render() {
    const { year, month } = currentYearMonth();
    const [saldoTotal, comparativo, cartoesResumo, recorrentes, metas, ultimosLancamentos, contas, nome] = await Promise.all([
      Store.saldoTotal(),
      Store.resumoComparativoMes(year, month),
      Store.resumoCartoesConsolidado(),
      Store.listRecorrentesComStatus(),
      Store.listMetas(),
      Store.listTransacoes({}),
      Store.listContas(),
      Store.nomeUsuario(),
    ]);

    const resumo = comparativo.atual;
    const categoriasDespesa = Store.categoriasComPercentual(resumo.transacoes, 'despesa').slice(0, 5);
    const insights = Store.gerarInsights({ comparativo, categoriasDespesa, cartoesResumo, metas });
    const paleta = paletaAtual();

    const proximasContas = recorrentes.filter((r) => r.status !== 'pago').slice(0, 4);
    // "Últimos lançamentos" mostra o que foi lançado por último (criadoEm),
    // senão parcelas futuras empurram para fora o que acabou de ser lançado.
    const recentes = [...ultimosLancamentos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);
    const positivo = resumo.resultado >= 0;
    const ocultando = App.ocultandoValores();

    const comecando = ultimosLancamentos.length === 0;
    const passos = [
      { feito: !!nome, t: 'Diga como quer ser chamada(o)', s: 'Personalize sua tela inicial', acao: 'definirNome' },
      { feito: contas.length > 1 || contas.some((c) => Number(c.saldoInicial) !== 0), t: 'Cadastre suas contas', s: 'Conta corrente, poupança, carteira… com o saldo de hoje', acao: 'irContas' },
      { feito: cartoesResumo.temCartoes, t: 'Adicione seus cartões', s: 'Limite, dia de fechamento e de vencimento', acao: 'verCartoes' },
      { feito: false, t: 'Faça seu primeiro lançamento', s: 'Toque no botão dourado + abaixo', acao: 'lancar' },
    ];

    return `
      <div class="saudacao">
        <div class="ola">${saudacaoDoHorario()}${nome ? ',' : ''}</div>
        <div class="nome">${nome ? escapeHTML(nome) + ' ✨' : 'Bem-vinda(o) 👋'}</div>
        ${nome ? `<div class="ola" style="margin-top:4px;">${comecando ? 'Seja bem-vinda! Vamos organizar as finanças da casa.' : 'Seja bem-vinda de volta.'}</div>` : ''}
      </div>

      <div class="kpi-saldo">
        <div class="topo">
          <div class="rotulo">Saldo total</div>
          <button class="olho" data-action="alternarOcultar" aria-label="${ocultando ? 'Mostrar valores' : 'Ocultar valores'}">${icon(ocultando ? 'olhoFechado' : 'olho', 17)}</button>
        </div>
        <div class="valor sensivel">${formatBRL(saldoTotal)}</div>
        <div class="sub">Em todas as contas · ${monthLabel(year, month)}</div>
        <div class="linha-resumo">
          <div class="bloco receita">
            <span class="bolinha">${icon('receita', 16)}</span>
            <div><div class="r">Receitas</div><div class="v sensivel">${formatBRL(resumo.receitas)}</div></div>
          </div>
          <div class="bloco despesa">
            <span class="bolinha">${icon('despesa', 16)}</span>
            <div><div class="r">Despesas</div><div class="v sensivel">${formatBRL(resumo.despesas)}</div></div>
          </div>
        </div>
      </div>

      <div class="atalhos">
        <button class="atalho" data-action="ir" data-view="contas"><span class="circ icone-tipo transferencia">${icon('banco', 19)}</span>Contas</button>
        <button class="atalho" data-action="ir" data-view="recorrentes"><span class="circ icone-tipo despesa">${icon('repetir', 19)}</span>Fixas</button>
        <button class="atalho" data-action="ir" data-view="metas"><span class="circ icone-tipo ouro">${icon('meta', 19)}</span>Metas</button>
        <button class="atalho" data-action="ir" data-view="calendario"><span class="circ icone-tipo investimento">${icon('calendario', 19)}</span>Agenda</button>
      </div>

      ${comecando ? `
      <div class="section-title">Primeiros passos</div>
      <div class="card card-destaque">
        ${passos.map((p, i) => `
          <div class="passo ${p.feito ? 'feito' : ''}" data-action="${p.acao}">
            <span class="num">${p.feito ? icon('check', 15) : i + 1}</span>
            <div style="flex:1; min-width:0;"><div class="t">${p.t}</div><div class="s">${p.s}</div></div>
            <span class="seta texto-fraco">${icon('direita', 18)}</span>
          </div>`).join('')}
      </div>` : ''}

      ${!comecando ? `
      <div class="section-title">Resultado do mês</div>
      <div class="card">
        <div class="resultado-linha">
          <div>
            <div class="texto-fraco">Receitas − despesas</div>
            <div class="valor-grande sensivel ${positivo ? 'positivo-txt' : 'negativo-txt'}">${formatBRL(resumo.resultado)}</div>
          </div>
          <span class="selo-resultado ${positivo ? 'positivo' : 'negativo'}">${positivo ? 'No azul' : 'No vermelho'}</span>
        </div>
        ${comparativo.anterior.despesas > 0 ? `
        <div class="comparativo-box mt-12 ${comparativo.deltaDespesasPct <= 0 ? 'positivo' : 'negativo'}">
          <span class="selo">${icon(comparativo.deltaDespesasPct <= 0 ? 'receita' : 'despesa', 18)}</span>
          <span class="texto">Você gastou <strong>${Math.abs(comparativo.deltaDespesasPct).toFixed(1)}% ${comparativo.deltaDespesasPct <= 0 ? 'menos' : 'mais'}</strong> que no mês passado (${formatBRL(comparativo.anterior.despesas)}).</span>
        </div>` : ''}
      </div>` : ''}

      ${insights.length ? `
      <div class="section-title">Análise do mês</div>
      <div class="card card-destaque">
        ${insights.map((i) => `<div class="insight-item"><span class="emoji">${i.emoji}</span><span>${i.texto}</span></div>`).join('')}
      </div>` : ''}

      ${cartoesResumo.temCartoes ? `
      <div class="secao-topo">Cartões <button class="link" data-action="verCartoes">Ver cartões ${icon('direita', 14)}</button></div>
      <div class="card">
        <div class="grid-2">
          <div class="kpi-mini"><div class="rotulo">Fatura atual</div><div class="valor sensivel">${formatBRL(cartoesResumo.faturaAtual)}</div></div>
          <div class="kpi-mini"><div class="rotulo">Limite disponível</div><div class="valor sensivel">${formatBRL(cartoesResumo.limiteDisponivel)}</div></div>
        </div>
        <div class="mini-barra-limite"><div class="fill" style="width:${Math.min(100, cartoesResumo.pctUtilizado)}%; background:${cartoesResumo.pctUtilizado > 85 ? 'var(--cor-despesa)' : 'var(--cor-ouro)'}"></div></div>
        <div class="texto-fraco mt-8">${cartoesResumo.pctUtilizado.toFixed(0)}% do limite usado · ${formatBRL(cartoesResumo.limiteUtilizado)} de ${formatBRL(cartoesResumo.limiteTotal)}</div>
        ${cartoesResumo.faturaFechada > 0 ? `<div class="texto-suave mt-8" style="color:var(--cor-alerta)">${icon('alerta', 14, '')} Fatura fechada a pagar: <strong>${formatBRL(cartoesResumo.faturaFechada)}</strong></div>` : ''}
        ${cartoesResumo.proximaFatura ? `<div class="texto-suave mt-8">Próximo vencimento: <strong>${escapeHTML(cartoesResumo.proximaFatura.cartao)}</strong> · ${formatBRL(cartoesResumo.proximaFatura.valor)} em ${formatDateBR(cartoesResumo.proximaFatura.vencimento)}</div>` : ''}
      </div>` : ''}

      ${recorrentes.length ? `
      <div class="secao-topo">Contas a pagar <button class="link" data-action="verRecorrentes">Ver todas ${icon('direita', 14)}</button></div>
      <div class="card">
        ${proximasContas.length ? proximasContas.map((r) => `
          <div class="lista-item" data-action="verRecorrentes">
            <span class="icone-tipo ${r.status === 'vencido' ? 'despesa' : 'neutro'}">${icon('calendario', 18)}</span>
            <div class="info">
              <div class="desc">${escapeHTML(r.descricao)}</div>
              <div class="meta">${formatBRL(r.valor)} · vence ${formatDateBR(r.vencimento)}</div>
            </div>
            <span class="badge ${r.status}">${rotuloStatus(r.status)}</span>
          </div>`).join('') : vazioMini('🎉', 'Tudo pago por aqui. Nenhuma conta pendente.')}
      </div>` : ''}

      ${categoriasDespesa.length ? `
      <div class="section-title">Para onde vai seu dinheiro</div>
      <div class="card">
        ${categoriasDespesa.map((c, i) => `
          <div class="categoria-linha">
            <div class="topo">
              <span class="nome"><span class="emo">${iconeCategoria(c.categoria)}</span>${escapeHTML(c.categoria)}</span>
              <span class="valores"><strong class="sensivel">${formatBRL(c.valor)}</strong> · ${c.pct.toFixed(0)}%</span>
            </div>
            <div class="barra"><div class="fill" style="width:${c.pct}%; background:${paleta[i % paleta.length]}"></div></div>
          </div>
        `).join('')}
      </div>` : ''}

      ${metas.length ? `
      <div class="secao-topo">Metas <button class="link" data-action="verMetas">Ver todas ${icon('direita', 14)}</button></div>
      <div class="card">
        ${metas.slice(0, 3).map((m) => {
          const pct = Math.min(100, (m.valorAtual / (m.valorMeta || 1)) * 100);
          return `
          <div class="categoria-linha">
            <div class="topo">
              <span class="nome">${escapeHTML(m.nome)}</span>
              <span class="valores"><strong class="sensivel">${formatBRL(m.valorAtual)}</strong> de ${formatBRL(m.valorMeta)}</span>
            </div>
            <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <div class="secao-topo">Últimos lançamentos ${recentes.length ? `<button class="link" data-action="verHistorico">Histórico ${icon('direita', 14)}</button>` : ''}</div>
      <div class="card">
        ${recentes.length ? recentes.map(itemLancamentoHTML).join('') : vazioMini('🧾', 'Nenhum lançamento ainda.<br>Toque no botão <strong>+</strong> para registrar o primeiro.')}
      </div>
    `;
  },

  async onMount() {
    const nome = await Store.nomeUsuario();
    const el = document.getElementById('header-titulo');
    if (el && nome) el.textContent = `Finanças da ${nome}`;
  },

  actions: {
    verRecorrentes: () => App.navigate('recorrentes'),
    verMetas: () => App.navigate('metas'),
    verHistorico: () => App.navigate('historico'),
    verCartoes: () => App.navigate('cartoes'),
    irContas: () => App.navigate('contas'),
    lancar: () => App.abrirSeletorLancamento(),
    alternarOcultar: () => { App.alternarOcultarValores(); App.refresh(); },
    async definirNome() {
      const nome = await App.pedirTexto('Como quer ser chamada(o)?', { placeholder: 'Seu nome' });
      if (!nome || !nome.trim()) return;
      await DB.put('configuracoes', { chave: 'nome_usuario', valor: nome.trim() });
      App.refresh();
    },
  },
};

function rotuloStatus(status) {
  return { pago: 'Pago', proximo: 'Vence logo', vencido: 'Vencida', futuro: 'Em dia' }[status] || status;
}

function vazioMini(emoji, texto) {
  return `<div class="vazio"><div class="emoji">${emoji}</div><div>${texto}</div></div>`;
}

const ICONE_TIPO = { receita: 'receita', despesa: 'despesa', transferencia: 'transferencia', investimento: 'investimento' };
const SINAL_TIPO = { receita: '+ ', despesa: '− ', transferencia: '', investimento: '' };

const ICONES_CATEGORIA = {
  'Alimentação': '🍽️', 'Supermercado': '🛒', 'Moradia': '🏠', 'Energia': '💡', 'Água': '💧',
  'Internet': '📶', 'Telefone': '📱', 'Transporte': '🚗', 'Combustível': '⛽', 'Saúde': '🩺',
  'Educação': '📚', 'Lazer': '🎬', 'Compras': '🛍️', 'Assinaturas': '🔁', 'Financiamentos': '🏦',
  'Impostos': '🧾', 'Faturas': '💳', 'Outros': '📦', 'Salário': '💼', 'Renda extra': '✨',
  'Freelance': '💻', 'Reembolso': '↩️', 'Investimentos': '📈', 'Beleza': '💅', 'Pets': '🐾',
  'Vestuário': '👗', 'Filhos': '🧸', 'Presentes': '🎁', 'Viagem': '✈️', 'Farmácia': '💊',
};

function iconeCategoria(categoria) {
  return ICONES_CATEGORIA[categoria] || '🔸';
}

function itemLancamentoHTML(t) {
  const credito = t.tipo === 'despesa' && t.formaPagamento === 'credito';
  return `
    <div class="lista-item" data-action="abrirLancamento" data-id="${t.id}">
      <span class="icone-tipo ${credito ? 'ouro' : t.tipo}">${credito ? icon('cartao', 18) : (t.categoria && ICONES_CATEGORIA[t.categoria] && t.tipo === 'despesa' ? ICONES_CATEGORIA[t.categoria] : icon(ICONE_TIPO[t.tipo], 18))}</span>
      <div class="info">
        <div class="desc">${escapeHTML(t.descricao)}</div>
        <div class="meta">${formatDateBR(t.data)}${t.categoria ? ' · ' + escapeHTML(t.categoria) : ''}${credito ? ' · crédito' : ''}</div>
      </div>
      <span class="valor ${t.tipo} sensivel">${SINAL_TIPO[t.tipo]}${formatBRL(t.valor)}</span>
    </div>`;
}
