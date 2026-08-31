// ---------------------------------------------------------------------------
// Modo claro/escuro. Guardado em localStorage (config simples de aparência,
// não é dado financeiro — esses continuam só no IndexedDB, via db.js). A
// aplicação inicial (antes da 1ª pintura) acontece no script inline do
// index.html; este arquivo cuida da troca em tempo real pelo toggle em
// Configurações > Aparência.
//
// V2.1: a identidade PRETO+AMARELO (escuro) é o padrão do app — por isso
// "sem preferência salva" conta como 'escuro' aqui, e só o tema 'claro'
// precisa de um atributo explícito no <html> (ver index.html).
// ---------------------------------------------------------------------------

const Theme = {
  CHAVE: 'mf_tema',

  atual() {
    try {
      return localStorage.getItem(this.CHAVE) === 'claro' ? 'claro' : 'escuro';
    } catch (e) {
      return 'escuro';
    }
  },

  aplicar(tema) {
    const claro = tema === 'claro';
    if (claro) {
      document.documentElement.setAttribute('data-theme', 'claro');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', claro ? '#0F766E' : '#0F0F0F');
    try {
      localStorage.setItem(this.CHAVE, claro ? 'claro' : 'escuro');
    } catch (e) {}
  },
};
