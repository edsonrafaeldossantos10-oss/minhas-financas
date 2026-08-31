Views.mais = {
  titulo: 'Mais',

  async render() {
    const itens = [
      { view: 'historico', emoji: '🧾', label: 'Histórico', sub: 'Todos os lançamentos' },
      { view: 'contas', emoji: '🏦', label: 'Minhas Contas', sub: 'Saldos e movimentações' },
      { view: 'cartoes', emoji: '💳', label: 'Meus Cartões', sub: 'Faturas e limites' },
      { view: 'recorrentes', emoji: '📅', label: 'Contas Fixas', sub: 'Contas recorrentes' },
      { view: 'metas', emoji: '🎯', label: 'Minhas Metas', sub: 'Objetivos financeiros' },
      { view: 'calendario', emoji: '📆', label: 'Calendário', sub: 'Visão por dia' },
      { view: 'configuracoes', emoji: '⚙️', label: 'Configurações', sub: 'Categorias, backup, PIN' },
    ];
    return `
      <div class="card">
        ${itens.map((i) => `
          <div class="lista-item" data-action="ir" data-view="${i.view}" style="cursor:pointer;">
            <span class="icone-tipo transferencia">${i.emoji}</span>
            <div class="info"><div class="desc">${i.label}</div><div class="meta">${i.sub}</div></div>
            <span class="texto-suave">›</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  actions: {
    ir(el) { App.navigate(el.dataset.view); },
  },
};
