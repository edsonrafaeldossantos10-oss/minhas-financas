Views.configuracoes = {
  titulo: 'Configurações',
  abaCategoria: 'despesa',

  async render() {
    const [pinAtivo, categorias, nome] = await Promise.all([
      Pin.estaAtivo(),
      Store.listCategorias(this.abaCategoria),
      Store.nomeUsuario(),
    ]);

    return `
      <div class="section-title">Perfil</div>
      <div class="card">
        <div class="cfg-item" data-action="mudarNome" style="cursor:pointer;">
          <span class="icone-tipo ouro">${icon('usuario', 19)}</span>
          <div class="info"><div class="desc">${nome ? escapeHTML(nome) : 'Seu nome'}</div><div class="meta">Usado na saudação da tela inicial</div></div>
          <span class="seta texto-fraco">${icon('editar', 17)}</span>
        </div>
      </div>

      <div class="section-title">Aparência</div>
      <div class="card">
        <div class="segmented">
          <button class="${Theme.atual() === 'escuro' ? 'ativo' : ''}" data-action="mudarTema" data-tema="escuro">${icon('lua', 16)} Escuro</button>
          <button class="${Theme.atual() === 'claro' ? 'ativo' : ''}" data-action="mudarTema" data-tema="claro">${icon('sol', 16)} Claro</button>
        </div>
        <div class="cfg-item mt-16">
          <div class="info"><div class="desc">Ocultar valores</div><div class="meta">Embaça os valores na tela (também pelo ícone de olho no Início)</div></div>
          <label class="switch"><input type="checkbox" data-onchange="alternarOcultar" ${App.ocultandoValores() ? 'checked' : ''}><span class="trilho"></span></label>
        </div>
      </div>

      <div class="section-title">Segurança</div>
      <div class="card">
        <div class="cfg-item">
          <span class="icone-tipo neutro">${icon('cadeado', 19)}</span>
          <div class="info"><div class="desc">Proteção por PIN</div><div class="meta">Pede um código ao abrir o app</div></div>
          <label class="switch"><input type="checkbox" id="switch-pin" ${pinAtivo ? 'checked' : ''} data-onchange="alternarPin"><span class="trilho"></span></label>
        </div>
        ${pinAtivo ? `<button class="btn btn-outline btn-sm mt-12" data-action="alterarPin">Alterar PIN</button>` : ''}
        <p class="texto-fraco mt-12">O PIN fica guardado só neste aparelho, criptografado. Evita que alguém abra o app por curiosidade — não é o mesmo nível de segurança de um app de banco.</p>
      </div>

      <div class="section-title">Categorias</div>
      <div class="card">
        <div class="segmented mb-8">
          <button class="${this.abaCategoria === 'despesa' ? 'ativo' : ''}" data-action="abaCategoria" data-tipo="despesa">Despesas</button>
          <button class="${this.abaCategoria === 'receita' ? 'ativo' : ''}" data-action="abaCategoria" data-tipo="receita">Receitas</button>
        </div>
        <div id="lista-categorias">${categorias.map((c) => categoriaItemHTML(c)).join('') || vazioMini('🏷️', 'Nenhuma categoria.')}</div>
        <button class="btn btn-secundario mt-12" data-action="novaCategoria">${icon('mais', 18)} Nova categoria</button>
      </div>

      <div class="section-title">Backup</div>
      <div class="card">
        <p class="texto-suave mb-12">Seus dados ficam salvos <strong>somente neste celular</strong>. Se trocar ou perder o aparelho sem backup, os dados se perdem. Exporte um backup de vez em quando e guarde no Google Drive ou WhatsApp.</p>
        <button class="btn btn-primario" data-action="exportarJson">${icon('baixar', 18)} Exportar backup</button>
        <div class="grid-2 mt-8">
          <button class="btn btn-secundario" data-action="exportarCsv">Planilha (CSV)</button>
          <button class="btn btn-secundario" data-action="importarJson">${icon('enviar', 18)} Importar</button>
        </div>
        <input type="file" id="input-importar" accept="application/json,.json" style="display:none;">
      </div>

      <div class="section-title">Zona de perigo</div>
      <div class="card zona-perigo">
        <div class="cfg-item">
          <span class="icone-tipo despesa">${icon('lixo', 19)}</span>
          <div class="info"><div class="desc">Apagar todos os dados</div><div class="meta">Zera o app e começa do zero neste aparelho</div></div>
        </div>
        <button class="btn btn-perigo mt-12" data-action="apagarTudo">Apagar tudo e recomeçar</button>
      </div>

      <div class="texto-fraco texto-centro mt-20">Minhas Finanças · versão ${APP_VERSION}<br>Tudo fica neste aparelho. Sem conexão com bancos ou servidores.</div>
    `;
  },

  onMount() {
    document.getElementById('input-importar')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await App.confirmar('Importar este backup vai SUBSTITUIR todos os dados atuais do app. Deseja continuar?', { titulo: 'Importar backup', perigo: true, textoBotao: 'Importar' });
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

    alternarOcultar() {
      App.alternarOcultarValores();
    },

    async mudarNome() {
      const nome = await App.pedirTexto('Como quer ser chamada(o)?', { placeholder: 'Seu nome' });
      if (nome == null) return;
      await DB.put('configuracoes', { chave: 'nome_usuario', valor: nome.trim() });
      App.refresh();
    },

    abaCategoria(el) {
      Views.configuracoes.abaCategoria = el.dataset.tipo;
      App.refresh();
    },

    async novaCategoria() {
      const nome = await App.pedirTexto('Nova categoria', { placeholder: 'Ex: Farmácia', textoBotao: 'Criar' });
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
        App.toast('Essa categoria está em uso e não pode ser excluída.');
        return;
      }
      const ok = await App.confirmar(`Excluir a categoria "${categoria.nome}"?`, { titulo: 'Excluir categoria', perigo: true, textoBotao: 'Excluir' });
      if (!ok) return;
      await DB.delete('categorias', id);
      App.refresh();
    },

    async alternarPin(checkbox) {
      if (checkbox.checked) {
        checkbox.checked = false; // só fica ligado depois de definir com sucesso
        Views.configuracoes.abrirDefinirPin();
      } else {
        await Pin.desativar();
        App.toast('Proteção por PIN desativada.');
        App.refresh();
      }
    },

    alterarPin() {
      Views.configuracoes.abrirDefinirPin();
    },

    apagarTudo() {
      App.abrirApagarTudo();
    },

    async exportarJson() {
      const dados = await DB.exportAll();
      baixarArquivo(`minhas-financas-backup-${todayISODate()}.json`, JSON.stringify(dados, null, 2), 'application/json');
      App.toast('Backup exportado. Veja a pasta Downloads.');
    },

    async exportarCsv() {
      const transacoes = await Store.listTransacoes({});
      const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Conta', 'Forma de pagamento', 'Observação']];
      const contas = await Store.listContas();
      transacoes.forEach((t) => {
        const conta = contas.find((c) => c.id === t.contaId);
        linhas.push([formatDateBR(t.data), t.tipo, t.descricao, t.categoria || '', String(t.valor).replace('.', ','), conta ? conta.nome : '', t.formaPagamento || '', t.observacao || '']);
      });
      // BOM no início: faz o Excel abrir os acentos corretamente.
      const csv = '﻿' + linhas.map((l) => l.map(csvEscape).join(';')).join('\n');
      baixarArquivo(`minhas-financas-lancamentos-${todayISODate()}.csv`, csv, 'text/csv;charset=utf-8');
      App.toast('Planilha exportada.');
    },

    importarJson() {
      document.getElementById('input-importar').click();
    },
  },

  abrirDefinirPin() {
    App.showModal(`
      <div class="folha-topo"><h2>Definir PIN</h2><button type="button" class="fechar" data-close-modal>${icon('fechar', 16)}</button></div>
      <div class="campo">
        <label>Tamanho do PIN</label>
        <div class="segmented" id="seg-pin">
          <button type="button" data-t="4">4 dígitos</button>
          <button type="button" data-t="6" class="ativo">6 dígitos</button>
        </div>
      </div>
      <div class="campo">
        <label>Novo PIN</label>
        <input type="password" inputmode="numeric" id="pin-novo" maxlength="6" placeholder="••••••" autocomplete="off">
      </div>
      <div class="campo">
        <label>Confirme o PIN</label>
        <input type="password" inputmode="numeric" id="pin-confirma" maxlength="6" placeholder="••••••" autocomplete="off">
      </div>
      <p class="texto-fraco mb-12">Guarde bem: se esquecer o PIN, a única forma de entrar é apagar os dados do app.</p>
      <button class="btn btn-primario" data-modal-action="confirmarDefinirPin">Salvar PIN</button>
    `, { id: 'form-pin', centered: true });

    let tamanho = 6;
    const ajustar = () => {
      ['pin-novo', 'pin-confirma'].forEach((id) => {
        const el = document.getElementById(id);
        el.maxLength = tamanho;
        el.placeholder = '•'.repeat(tamanho);
        el.value = el.value.slice(0, tamanho);
      });
    };
    document.getElementById('seg-pin').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]');
      if (!b) return;
      tamanho = Number(b.dataset.t);
      document.querySelectorAll('#seg-pin button').forEach((x) => x.classList.toggle('ativo', x === b));
      ajustar();
    });

    window.__modalHandlers = window.__modalHandlers || {};
    window.__modalHandlers.confirmarDefinirPin = async () => {
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

const APP_VERSION = '3.0.0';

function categoriaItemHTML(c) {
  return `
    <div class="lista-item">
      <span class="icone-tipo neutro" style="width:34px;height:34px;font-size:15px;">${iconeCategoria(c.nome)}</span>
      <div class="info"><div class="desc">${escapeHTML(c.nome)}</div></div>
      ${!c.padrao ? `<button class="btn btn-outline btn-sm" data-action="excluirCategoria" data-id="${c.id}" aria-label="Excluir">${icon('lixo', 16)}</button>` : `<span class="texto-fraco">padrão</span>`}
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
