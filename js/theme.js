// ---------------------------------------------------------------------------
// Modo claro/escuro. Guardado em localStorage (config simples de aparência,
// não é dado financeiro — esses continuam só no IndexedDB, via db.js). A
// aplicação inicial (antes da 1ª pintura) acontece no script inline do
// index.html; este arquivo cuida da troca em tempo real pelo toggle em
// Configurações > Aparência.
// ---------------------------------------------------------------------------

const Theme = {
  CHAVE: 'mf_tema',

  atual() {
    try {
      return localStorage.getItem(this.CHAVE) === 'escuro' ? 'escuro' : 'claro';
    } catch (e) {
      return 'claro';
    }
  },

  aplicar(tema) {
    const escuro = tema === 'escuro';
    document.documentElement.setAttribute('data-theme', escuro ? 'escuro' : 'claro');
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', escuro ? '#10171A' : '#0F766E');
    try {
      localStorage.setItem(this.CHAVE, escuro ? 'escuro' : 'claro');
    } catch (e) {}
  },
};
