// Dados iniciais criados apenas no primeiro uso (categorias padrão + conta
// "Dinheiro"). Nunca roda de novo depois que já existe algo salvo.

const CATEGORIAS_RECEITA_PADRAO = [
  'Salário', 'Renda extra', 'Freelance', 'Reembolso', 'Investimentos', 'Outros',
];

const CATEGORIAS_DESPESA_PADRAO = [
  'Alimentação', 'Supermercado', 'Moradia', 'Energia', 'Água', 'Internet',
  'Telefone', 'Transporte', 'Combustível', 'Saúde', 'Educação', 'Lazer',
  'Compras', 'Assinaturas', 'Financiamentos', 'Impostos', 'Outros',
];

async function seedIfNeeded() {
  const jaTemCategorias = await DB.getAll('categorias');
  if (jaTemCategorias.length > 0) return;

  const categorias = [
    ...CATEGORIAS_RECEITA_PADRAO.map((nome) => ({ id: uid(), nome, tipo: 'receita', padrao: true })),
    ...CATEGORIAS_DESPESA_PADRAO.map((nome) => ({ id: uid(), nome, tipo: 'despesa', padrao: true })),
  ];
  await DB.bulkPut('categorias', categorias);

  const jaTemContas = await DB.getAll('contas');
  if (jaTemContas.length === 0) {
    await DB.put('contas', {
      id: uid(),
      nome: 'Dinheiro',
      saldoInicial: 0,
      criadoEm: nowISO(),
    });
  }
}
