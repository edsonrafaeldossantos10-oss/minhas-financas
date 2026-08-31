// Gráficos simples desenhados em <canvas>, sem bibliotecas externas — assim
// os relatórios continuam funcionando 100% offline, sem depender de CDN.

// Paleta "de apoio" para diferenciar categorias num gráfico (precisa de
// várias cores distintas, não dá pra usar só amarelo em tudo). A primeira
// cor muda com o tema (amarelo no escuro, teal no claro) — as demais são
// fixas, escolhidas pra não brigar visualmente com a identidade
// preto+amarelo nem com o teal do tema claro.
const PALETA_APOIO = ['#F59E0B', '#60A5FA', '#F87171', '#A78BFA', '#34D399', '#F472B6', '#38BDF8', '#FBBF24'];

// Lê as cores atuais do tema (claro/escuro) direto do CSS, para o texto e as
// cores dos gráficos continuarem coerentes e legíveis com o tema ativo.
function corTema(variavel, fallback) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variavel).trim();
  return valor || fallback;
}

function paletaAtual() {
  return [corTema('--cor-primaria', '#FFC400'), ...PALETA_APOIO];
}

function hexParaRgba(hex, alpha) {
  const limpo = hex.replace('#', '');
  const bignum = parseInt(limpo.length === 3
    ? limpo.split('').map((c) => c + c).join('')
    : limpo, 16);
  const r = (bignum >> 16) & 255, g = (bignum >> 8) & 255, b = bignum & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function prepararCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  let rect = canvas.getBoundingClientRect();
  // Salvaguarda: se o navegador ainda não terminou o layout do canvas recém
  // inserido (raro, mas pode acontecer logo após innerHTML), usa o tamanho
  // do elemento pai como aproximação em vez de desenhar num canvas 0x0.
  if (rect.width < 1 || rect.height < 1) {
    const pai = canvas.parentElement;
    const paiRect = pai ? pai.getBoundingClientRect() : null;
    rect = { width: (paiRect && paiRect.width) || 300, height: rect.height || 150 };
  }
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

function desenharBarras(canvas, dados) {
  // dados: [{label, valor, cor}]
  if (!canvas) return;
  const { ctx, w, h } = prepararCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!dados.length) return;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const padTop = 10, padBottom = 34, padSide = 8;
  const larguraDisponivel = w - padSide * 2;
  const n = dados.length;
  const gap = 10;
  const barW = Math.max(14, (larguraDisponivel - gap * (n - 1)) / n);
  const areaH = h - padTop - padBottom;
  const corTexto = corTema('--cor-texto', '#1B2422');
  const corTextoSuave = corTema('--cor-texto-suave', '#61706C');

  dados.forEach((d, i) => {
    const x = padSide + i * (barW + gap);
    const barH = Math.max(3, (d.valor / max) * areaH);
    const y = padTop + (areaH - barH);
    ctx.fillStyle = d.cor || corTema('--cor-primaria', '#0F766E');
    roundRectPath(ctx, x, y, barW, barH, 6);
    ctx.fill();

    ctx.fillStyle = corTexto;
    ctx.font = '700 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatCompacto(d.valor), x + barW / 2, y - 6);

    ctx.fillStyle = corTextoSuave;
    ctx.font = '600 10.5px -apple-system, sans-serif';
    const label = d.label.length > 9 ? d.label.slice(0, 8) + '…' : d.label;
    ctx.fillText(label, x + barW / 2, h - padBottom + 16);
  });
}

function desenharDonut(canvas, dados) {
  if (!canvas) return;
  const { ctx, w, h } = prepararCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const cx = w / 2, cy = h / 2;
  const raio = Math.max(4, Math.min(w, h) / 2 - 6);
  const raioInterno = raio * 0.62;
  if (total <= 0) {
    ctx.strokeStyle = corTema('--cor-borda', '#E4E9E8');
    ctx.lineWidth = raio - raioInterno;
    ctx.beginPath();
    ctx.arc(cx, cy, (raio + raioInterno) / 2, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  let anguloAtual = -Math.PI / 2;
  dados.forEach((d) => {
    const fatia = (d.valor / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, raio, anguloAtual, anguloAtual + fatia);
    ctx.closePath();
    ctx.fillStyle = d.cor;
    ctx.fill();
    anguloAtual += fatia;
  });
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, raioInterno, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = corTema('--cor-texto', '#1B2422');
  ctx.textAlign = 'center';
  ctx.font = '800 15px -apple-system, sans-serif';
  ctx.fillText(formatCompacto(total), cx, cy + 5);
}

function desenharLinha(canvas, pontos) {
  // pontos: [{label, valor}]
  if (!canvas || !pontos.length) return;
  const { ctx, w, h } = prepararCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const padTop = 16, padBottom = 26, padSide = 10;
  const max = Math.max(...pontos.map((p) => p.valor), 1);
  const min = Math.min(...pontos.map((p) => p.valor), 0);
  const range = max - min || 1;
  const areaW = w - padSide * 2;
  const areaH = h - padTop - padBottom;
  const stepX = pontos.length > 1 ? areaW / (pontos.length - 1) : 0;

  const coords = pontos.map((p, i) => ({
    x: padSide + i * stepX,
    y: padTop + areaH - ((p.valor - min) / range) * areaH,
  }));

  const corPrimaria = corTema('--cor-primaria', '#0F766E');

  ctx.beginPath();
  coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.lineTo(coords[coords.length - 1].x, padTop + areaH);
  ctx.lineTo(coords[0].x, padTop + areaH);
  ctx.closePath();
  ctx.fillStyle = hexParaRgba(corPrimaria, 0.14);
  ctx.fill();

  ctx.beginPath();
  coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.strokeStyle = corPrimaria;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  const corTextoSuave = corTema('--cor-texto-suave', '#61706C');
  coords.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = corPrimaria;
    ctx.fill();
    ctx.fillStyle = corTextoSuave;
    ctx.font = '600 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pontos[i].label, c.x, h - 8);
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatCompacto(valor) {
  if (Math.abs(valor) >= 1000) return `${(valor / 1000).toFixed(valor >= 10000 ? 0 : 1)}k`;
  return valor.toFixed(0);
}
