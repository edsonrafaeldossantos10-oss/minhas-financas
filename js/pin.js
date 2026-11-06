// ---------------------------------------------------------------------------
// PIN de acesso opcional. Limitação honesta: um PWA não tem acesso ao
// keystore seguro do sistema (como um app nativo teria). O PIN é guardado
// como hash SHA-256 com "salt" aleatório dentro do próprio IndexedDB do
// aparelho — isso impede que alguém veja o PIN em texto puro abrindo os
// dados, mas não é proteção de nível bancário. Serve para impedir uma
// olhada rápida de terceiros no aparelho, não para proteger contra alguém
// com acesso técnico ao dispositivo.
//
// V3: "Esqueci meu PIN" na tela de bloqueio. Como o PIN não pode ser
// recuperado, a única saída é apagar os dados e começar do zero (com
// confirmação digitada).
// ---------------------------------------------------------------------------

const Pin = {
  async estaAtivo() {
    const cfg = await DB.get('configuracoes', 'pin_ativo');
    return !!(cfg && cfg.valor);
  },

  async hash(pin, saltHex) {
    const enc = new TextEncoder();
    const data = enc.encode(saltHex + ':' + pin);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  gerarSalt() {
    const arr = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async definir(pin) {
    const salt = this.gerarSalt();
    const hash = await this.hash(pin, salt);
    await DB.put('configuracoes', { chave: 'pin_salt', valor: salt });
    await DB.put('configuracoes', { chave: 'pin_hash', valor: hash });
    await DB.put('configuracoes', { chave: 'pin_ativo', valor: true });
  },

  async desativar() {
    await DB.put('configuracoes', { chave: 'pin_ativo', valor: false });
  },

  async verificar(pin) {
    const saltCfg = await DB.get('configuracoes', 'pin_salt');
    const hashCfg = await DB.get('configuracoes', 'pin_hash');
    if (!saltCfg || !hashCfg) return false;
    const tentativa = await this.hash(pin, saltCfg.valor);
    return tentativa === hashCfg.valor;
  },

  digitado: '',

  async mostrarTela(onSucesso) {
    const nome = await Store.nomeUsuario();
    const overlay = document.createElement('div');
    overlay.className = 'pin-tela';
    overlay.id = 'pin-overlay';
    overlay.innerHTML = `
      <div class="logo">${icon('cadeado', 28)}</div>
      <div class="texto-centro">
        <div class="titulo-pin">${nome ? `Olá, ${escapeHTML(nome)}` : 'Minhas Finanças'}</div>
        <div style="font-size:13.5px; color:rgba(244,244,245,0.6); margin-top:4px;">Digite seu PIN para entrar</div>
      </div>
      <div class="pin-dots" id="pin-dots"></div>
      <div id="pin-erro" style="font-size:12.5px; color:#FF8A9B; min-height:16px;"></div>
      <div class="pin-teclado">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-pin-num="${n}">${n}</button>`).join('')}
        <div></div>
        <button data-pin-num="0">0</button>
        <button data-pin-back aria-label="Apagar">⌫</button>
      </div>
      <button class="pin-esqueci" data-pin-esqueci>Esqueci meu PIN</button>
    `;
    document.body.appendChild(overlay);
    this.digitado = '';

    const tamanhoEsperado = { value: 6 };
    const cfg = await DB.get('configuracoes', 'pin_tamanho');
    if (cfg) tamanhoEsperado.value = cfg.valor;

    function renderDots() {
      const dotsEl = overlay.querySelector('#pin-dots');
      dotsEl.innerHTML = Array.from({ length: tamanhoEsperado.value })
        .map((_, i) => `<span class="${i < Pin.digitado.length ? 'preenchido' : ''}"></span>`).join('');
    }
    renderDots();

    overlay.addEventListener('click', async (e) => {
      const numBtn = e.target.closest('[data-pin-num]');
      const backBtn = e.target.closest('[data-pin-back]');
      if (e.target.closest('[data-pin-esqueci]')) { Pin.mostrarEsqueci(); return; }
      if (numBtn) {
        if (Pin.digitado.length >= tamanhoEsperado.value) return;
        Pin.digitado += numBtn.dataset.pinNum;
        renderDots();
        if (Pin.digitado.length === tamanhoEsperado.value) {
          const ok = await Pin.verificar(Pin.digitado);
          if (ok) {
            overlay.remove();
            onSucesso();
          } else {
            overlay.querySelector('#pin-erro').textContent = 'PIN incorreto. Tente novamente.';
            overlay.classList.remove('tremer');
            void overlay.offsetWidth;
            overlay.classList.add('tremer');
            Pin.digitado = '';
            renderDots();
          }
        }
      } else if (backBtn) {
        Pin.digitado = Pin.digitado.slice(0, -1);
        overlay.querySelector('#pin-erro').textContent = '';
        renderDots();
      }
    });
  },

  mostrarEsqueci() {
    const caixa = document.createElement('div');
    caixa.className = 'pin-reset';
    caixa.innerHTML = `
      <div class="folha">
        <div class="folha-topo"><h2>Esqueceu o PIN?</h2><button type="button" class="fechar" data-fechar>${icon('fechar', 16)}</button></div>
        <p class="texto-suave mb-12">Por segurança, o PIN não pode ser recuperado. A única forma de voltar a usar o app é <strong>apagar todos os dados deste aparelho</strong> e começar do zero.</p>
        <div class="campo">
          <label>Para confirmar, digite <strong>APAGAR</strong></label>
          <input type="text" id="pin-confirma-apagar" autocomplete="off" autocapitalize="characters" placeholder="APAGAR">
        </div>
        <button class="btn btn-perigo-cheio" id="pin-btn-apagar" disabled>Apagar tudo e recomeçar</button>
        <button class="btn btn-texto mt-8" data-fechar>Voltar e tentar de novo</button>
      </div>`;
    document.body.appendChild(caixa);
    const input = caixa.querySelector('#pin-confirma-apagar');
    const btn = caixa.querySelector('#pin-btn-apagar');
    input.addEventListener('input', () => { btn.disabled = input.value.trim().toUpperCase() !== 'APAGAR'; });
    btn.addEventListener('click', () => App.apagarTudoERecomecar());
    caixa.addEventListener('click', (e) => {
      if (e.target === caixa || e.target.closest('[data-fechar]')) caixa.remove();
    });
  },
};
