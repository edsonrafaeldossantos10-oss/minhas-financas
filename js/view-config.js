Views.configuracoes = {
  titulo: 'Configurações',
  abaCategoria: 'despesa',

  async render() {
    const pinAtivo = await Pin.estaAtivo();
    const categorias = await Store.listCategorias(this.abaCategoria);

    return `
      <div class="section-title">🏷️ Categorias</div>
      <div class="card">
        <div class="tabs mb-8">
          <button class="${this.abaCategoria === 'receita' ? 'ativo' : ''}" data-action="abaCategoria" data-tipo="receita">🟢 Receita</button>
          <button class="${this.abaCategoria === 'despesa' ? 'ativo' : ''}" data-action="abaCategoria" data-tipo="despesa">🔴 Despesa</button>
        </div>
        <div id="lista-categorias">${categorias.map((c) => categoriaItemHTML(c)).join('') || vazioMini('🏷️', 'Nenhuma categoria.')}</div>
        <button class="btn btn-secundario mt-12" data-action="novaCategoria">➕ Nova categoria</button>
      </div>

      <div class="section-title">🎨 Aparência</div>
      <div class="card">
        <div class="segmented">
          <button class="${Theme.atual() === 'claro' ? 'ativo' : ''}" data-action="mudarTema" data-tema="claro">☀️ Claro</button>
          <button class="${Theme.atual() === 'escuro' ? 'ativo' : ''}" data-action="mudarTema" data-tema="escuro">🌙 Escuro</button>
        </div>
      </div>

      <div class="section-title">🔐 Segurança</div>
      <div class="card">
        <div class="lista-item" style="border:none; padding:4px 0;">
          <div class="info">
            <div class="desc">Proteção por PIN</div>
            <div class="meta">Pede um código para abrir o app</div>
          </div>
          <label style="position:relative; display:inline-block; width:46px; height:26px;">
            <input type="checkbox" id="switch-pin" ${pinAtivo ? 'checked' : ''} style="opacity:0; width:0; height:0;" data-onchange="alternarPin">
            <span style="position:absolute; inset:0; background:${pinAtivo ? 'var(--cor-primaria)' : '#D8DEDC'}; border-radius:999px; transition:0.2s;"></span>
            <span style="position:absolute; top:3px; left:${pinAtivo ? '23px' : '3px'}; width:20px; height:20px; background:white; border-radius:50%; transition:0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>
          </label>
        </div>
        ${pinAtivo ? `<button class="btn btn-outline btn-sm mt-12" data-action="alterarPin">Alterar PIN</button>` : ''}
        <p class="texto-suave mt-12">O PIN fica guardado só neste aparelho, protegido por um código criptográfico (hash). Não é o mesmo nível de segurança de um app de banco, mas evita que alguém abra o app de curiosidade.</p>
      </div>

      <div class="section-title">💾 Backup</div>
      <div class="card">
        <p class="texto-suave mb-8">Seus dados ficam salvos <strong>somente neste celular</strong>. Se você perder ou trocar de aparelho sem fazer backup, os dados são perdidos. Faça backups com frequência!</p>
        <button class="btn btn-primario" data-action="exportarJson">⬇️ Exportar backup (JSON)</button>
        <button class="btn btn-secundario mt-8" data-action="exportarCsv">⬇️ Exportar lançamentos (CSV)</button>
        <button class="btn btn-outline mt-8" data-action="importarJson">⬆️ Importar backup</button>
        <input type="file" id="input-importar" accept="application/json" style="display:none;">
      </div>

      <div class="section-title">ℹ️ Sobre</div>
      <div class="card">
        <div style="font-weight:700;">💰 Minhas Finanças</div>
        <div class="texto-suave mt-8">Versão do app: ${APP_VERSION}</div>
        <div class="texto-suave mt-8">Todos os dados ficam armazenados neste aparelho (IndexedDB do navegador), sem envio para nenhum servidor. Não há conexão com bancos, cartões ou Open Finance.</div>
      </div>
    `;
  },

  onMount() {
    document.getElementById('input-importar')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await App.confirmar('Importar este backup vai SUBSTITUIR todos os dados atuais do app. Deseja continuar?', { perigo: true, textoBotao: 'Importar e substituir' });
      if (!ok) { e.target.value = ''; return; }
      try {
        const texto = await file.text();
        const payload = JSON.parse(texto);
        await DB.importAll(payload);
        App.toast('Backup importado com sucesso!');
        App.navigate('dashboard');
      } catch (err) {
        App.toast('Não foi possível importar: ' + err.message);
      }
      e.target.value = '';
    });
  },

  actions: {
    mudarTema(el) {
      Theme.aplicar(el.dataset.tema);
      App.refresh();
    },

    abaCategoria(el) {
      Views.configuracoes.abaCategoria = el.dataset.tipo;
      App.refresh();
    },

    async novaCategoria() {
      const nome = prompt('Nome da nova categoria:');
      if (!nome || !nome.trim()) return;
      await Store.criarCategoria(nome, Views.configuracoes.abaCategoria);
      App.toast('Categoria criada.');
      App.refresh();
    },

    async excluirCategoria(el) {
      const id = el.dataset.id;
      const categoria = await DB.get('categorias', id);
      const emUso = await Store.listTransacoes({ categoria: categoria.nome });
      if (emUso.length > 0) {
        App.toast('Essa categoria está em uso em lançamentos e não pode ser excluída.');
        return;
      }
      const ok = await App.confirmar(`Excluir a categoria "${categoria.nome}"?`, { perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('categorias', id);
      App.refresh();
    },

    async alternarPin(checkbox) {
      if (checkbox.checked) {
        Views.configuracoes.abrirDefinirPin();
        checkbox.checked = false; // só confirma visualmente depois de definir com sucesso
      } else {
        await Pin.desativar();
        App.toast('Proteção por PIN desativada.');
        App.refresh();
      }
    },

    alterarPin() {
      Views.configuracoes.abrirDefinirPin();
    },

    async exportarJson() {
      const dados = await DB.exportAll();
      baixarArquivo(`minhas-financas-backup-${todayISODate()}.json`, JSON.stringify(dados, null, 2), 'application/json');
      App.toast('Backup exportado. Verifique a pasta de downloads.');
    },

    async exportarCsv() {
      const transacoes = await Store.listTransacoes({});
      const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Conta', 'Observação']];
      const contas = await Store.listContas();
      transacoes.forEach((t) => {
        const conta = contas.find((c) => c.id === t.contaId);
        linhas.push([t.data, t.tipo, t.descricao, t.categoria || '', String(t.valor).replace('.', ','), conta ? conta.nome : '', t.observacao || '']);
      });
      const csv = linhas.map((l) => l.map(csvEscape).join(';')).join('\n');
      baixarArquivo(`minhas-financas-lancamentos-${todayISODate()}.csv`, csv, 'text/csv');
      App.toast('CSV exportado.');
    },

    importarJson() {
      document.getElementById('input-importar').click();
    },
  },

  abrirDefinirPin() {
    App.showModal(`
      <div class="folha-topo"><h2>Definir PIN</h2><button type="button" class="fechar" data-close-modal>✕</button></div>
      <div class="campo">
        <label>Tamanho do PIN</label>
        <select id="pin-tamanho">
          <option value="4">4 dígitos</option>
          <option value="6" selected>6 dígitos</option>
        </select>
      </div>
      <div class="campo">
        <label>Novo PIN</label>
        <input type="password" inputmode="numeric" id="pin-novo" maxlength="6" placeholder="••••••">
      </div>
      <div class="campo">
        <label>Confirme o PIN</label>
        <input type="password" inputmode="numeric" id="pin-confirma" maxlength="6" placeholder="••••••">
      </div>
      <button class="btn btn-primario mt-8" data-modal-action="confirmarDefinirPin">Salvar PIN</button>
    `, { id: 'form-pin', centered: true });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.confirmarDefinirPin = async () => {
      const tamanho = Number(document.getElementById('pin-tamanho').value);
      const novo = document.getElementById('pin-novo').value;
      const confirma = document.getElementById('pin-confirma').value;
      if (!/^\d+$/.test(novo) || novo.length !== tamanho) { App.toast(`O PIN deve ter ${tamanho} números.`); return; }
      if (novo !== confirma) { App.toast('Os PINs não coincidem.'); return; }
      await Pin.definir(novo);
      await DB.put('configuracoes', { chave: 'pin_tamanho', valor: tamanho });
      App.closeModal('form-pin');
      App.toast('PIN definido com sucesso!');
      App.refresh();
    };
  },
};

const APP_VERSION = '2.0.0';

function categoriaItemHTML(c) {
  return `
    <div class="lista-item">
      <div class="info"><div class="desc">${escapeHTML(c.nome)}</div></div>
      ${!c.padrao ? `<button class="btn btn-outline btn-sm" data-action="excluirCategoria" data-id="${c.id}">🗑️</button>` : `<span class="texto-suave" style="font-size:11.5px;">padrão</span>`}
    </div>`;
}

function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvEscape(valor) {
  const str = String(valor ?? '');
  if (/[;"\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}
