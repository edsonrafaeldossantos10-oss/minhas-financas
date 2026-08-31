// ---------------------------------------------------------------------------
// PIN de acesso opcional. Limitação honesta: um PWA não tem acesso ao
// keystore seguro do sistema (como um app nativo teria). O PIN é guardado
// como hash SHA-256 com "salt" aleatório dentro do próprio IndexedDB do
// aparelho — isso impede que alguém veja o PIN em texto puro abrindo os
// dados, mas não é proteção de nível bancário. Serve para impedir uma
// olhada rápida de terceiros no aparelho, não para proteger contra alguém
// com acesso técnico ao dispositivo.
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

  mostrarTela(onSucesso) {
    const overlay = document.createElement('div');
    overlay.className = 'pin-tela';
    overlay.id = 'pin-overlay';
    overlay.innerHTML = `
      <div style="font-size:40px">💰</div>
      <div style="font-weight:800; font-size:16px;">Digite seu PIN</div>
      <div class="pin-dots" id="pin-dots"></div>
      <div id="pin-erro" style="font-size:12.5px; color:#FCA5A5; min-height:16px;"></div>
      <div class="pin-teclado">
        ${[1,2,3,4,5,6,7,8,9].map((n) => `<button data-pin-num="${n}">${n}</button>`).join('')}
        <div></div>
        <button data-pin-num="0">0</button>
        <button data-pin-back>⌫</button>
      </div>
    `;
    document.body.appendChild(overlay);
    this.digitado = '';

    const tamanhoEsperado = { value: 6 };
    DB.get('configuracoes', 'pin_tamanho').then((cfg) => {
      if (cfg) tamanhoEsperado.value = cfg.valor;
      renderDots();
    });

    function renderDots() {
      const dotsEl = overlay.querySelector('#pin-dots');
      dotsEl.innerHTML = Array.from({ length: tamanhoEsperado.value })
        .map((_, i) => `<span class="${i < Pin.digitado.length ? 'preenchido' : ''}"></span>`).join('');
    }

    overlay.addEventListener('click', async (e) => {
      const numBtn = e.target.closest('[data-pin-num]');
      const backBtn = e.target.closest('[data-pin-back]');
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
};
