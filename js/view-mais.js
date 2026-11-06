Views.mais = {
  titulo: 'Menu',

  async render() {
    const grupos = [
      [
        { view: 'historico', icone: 'historico', cor: 'neutro', label: 'Histórico', sub: 'Todos os lançamentos, com busca' },
        { view: 'contas', icone: 'banco', cor: 'transferencia', label: 'Contas', sub: 'Saldos de cada conta' },
        { view: 'cartoes', icone: 'cartao', cor: 'ouro', label: 'Cartões', sub: 'Faturas e limites' },
      ],
      [
        { view: 'recorrentes', icone: 'repetir', cor: 'despesa', label: 'Contas fixas', sub: 'Aluguel, luz, internet…' },
        { view: 'metas', icone: 'meta', cor: 'ouro', label: 'Metas', sub: 'Objetivos para guardar dinheiro' },
        { view: 'calendario', icone: 'calendario', cor: 'investimento', label: 'Agenda', sub: 'Vencimentos e lançamentos por dia' },
        { view: 'relatorios', icone: 'relatorios', cor: 'receita', label: 'Relatórios', sub: 'Gráficos e comparações' },
      ],
      [
        { view: 'configuracoes', icone: 'ajustes', cor: 'neutro', label: 'Configurações', sub: 'Aparência, PIN, backup, categorias' },
      ],
    ];
    return grupos.map((itens) => `
      <div class="card mb-12">
        ${itens.map((i) => `
          <div class="lista-item" data-action="ir" data-view="${i.view}">
            <span class="icone-tipo ${i.cor}">${icon(i.icone, 19)}</span>
            <div class="info"><div class="desc">${i.label}</div><div class="meta">${i.sub}</div></div>
            <span class="seta">${icon('direita', 18)}</span>
          </div>
        `).join('')}
      </div>`).join('') + `<div class="texto-fraco texto-centro mt-16">Minhas Finanças · versão ${APP_VERSION}</div>`;
  },

  actions: {},
};
