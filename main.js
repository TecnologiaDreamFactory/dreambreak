const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');

/* máscara por palavra, como o título do hero do site: cada palavra vira .w > i */
$$('[data-split]').forEach(el => {
  const wrap = (txt, cls) => txt.split(/\s+/).filter(Boolean)
    .map(w => `<span class="w"><i${cls ? ` class="${cls}"` : ''}>${w}</i></span>`).join(' ');
  el.innerHTML = [...el.childNodes].map(n => wrap(n.textContent, n.nodeType === 1 && n.className)).join(' ');
});

/* ====== painéis com gráfico (slide 2) ======
   center: [número, legenda] mostrado no meio da rosca. unit '%' = valores já são percentuais.
   order = fatias (índices de data) que o passador destaca, em sequência, antes de seguir.
   cores = tokens --chart-* do styles.css (um tom por tema, validados para daltonismo e contraste) */
const CHARTS = {
  'pie-resolucao': { unit: '%', center: [93, 'resolvidos'], order: [2, 1, 0],
    data: [['resolvidos', 93, 'var(--chart-1)'], ['aguardando solicitante', 5, 'var(--chart-2)'], ['aguardando fornecedor', 2, 'var(--chart-3)']] },
  'pie-chamados': { center: [4820, 'chamados resolvidos'], arcLabels: true, order: [0, 1],
    data: [['infra e hardware', 3020, 'var(--chart-1)'], ['sistemas e aplicações', 1800, 'var(--chart-3)']] },
};
const num = (v, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (cfg, v) => cfg.unit === '%' ? `${num(v)}%` : num(v);

Object.entries(CHARTS).forEach(([id, cfg]) => {
  const el = cfg.el = $('#' + id), total = cfg.data.reduce((a, d) => a + d[1], 0);
  cfg.pct = cfg.data.map(d => d[1] / total * 100);
  let acc = 0;
  $('svg', el).innerHTML = '<circle class="pie__track" cx="100" cy="100" r="80"/>' + cfg.data.map(([k, v, c], i) => {
    const p = cfg.pct[i], a = (acc + p / 2) / 50 * Math.PI - Math.PI / 2; // meio da fatia, começando no topo
    const seg = `<circle data-i="${i}" cx="100" cy="100" r="80" pathLength="100" transform="rotate(-90 100 100)" style="stroke:${c}" stroke-dasharray="0 100" stroke-dashoffset="${-acc}"><title>${k}: ${fmt(cfg, v)}</title></circle>`
      + (cfg.arcLabels ? `<text data-i="${i}" x="${100 + 80 * Math.cos(a)}" y="${100 + 80 * Math.sin(a)}">${num(p, 1)}%</text>` : '');
    acc += p;
    return seg;
  }).join('');
  $('.legend', el).innerHTML = cfg.data.map(([k, v, c], i) => `<li data-i="${i}"><i style="background:${c}"></i><span>${k}</span>`
    + `<b>${fmt(cfg, v)}${cfg.unit === '%' ? '' : ` <small>· ${num(cfg.pct[i], 1)}%</small>`}</b></li>`).join('');
  // hover num segmento ou na legenda: destaca a fatia e mostra o valor no centro
  el.addEventListener('mouseover', e => chartFocus(cfg, e.target.closest('[data-i]') ? +e.target.closest('[data-i]').dataset.i : -1));
  el.addEventListener('mouseleave', () => chartFocus(cfg, -1));
});

// i < 0 (hover saiu) volta para a fatia escolhida pelo passador (cfg.sel), se houver
function chartFocus(cfg, i) {
  if (i < 0) i = cfg.sel ?? -1;
  if (i >= 0) cfg.tween?.progress(1);
  const [v, k] = i < 0 ? cfg.center : [cfg.data[i][1], cfg.data[i][0] + (cfg.unit === '%' ? '' : ` · ${num(cfg.pct[i], 1)}%`)];
  // descritivo abaixo do gráfico só com uma fatia acionada (passador ou hover)
  $('.pie__center', cfg.el).innerHTML = `<b>${fmt(cfg, v)}</b><span>${i < 0 ? '' : k}</span>`;
  if (i >= 0) gsap.fromTo($('.pie__center span', cfg.el), { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: 'expo.out' });
  $$('[data-i]', cfg.el).forEach(el => el.classList.toggle('dim', i >= 0 && +el.dataset.i !== i));
}

function drawChart(id) {
  const cfg = CHARTS[id], el = cfg.el;
  cfg.sel = -1;
  chartFocus(cfg, -1);
  $$('circle[data-i]', el).forEach((c, i) => gsap.fromTo(c, { attr: { 'stroke-dasharray': '0 100' } },
    { attr: { 'stroke-dasharray': `${cfg.pct[i] - .6} 100` }, duration: 1.2, ease: 'expo.out', delay: .5 + i * .15 })); // .6 = respiro entre fatias
  gsap.fromTo($$('text', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .6, stagger: .1, delay: 1.1 });
  const o = { v: 0 }, b = $('.pie__center b', el);
  b.textContent = fmt(cfg, 0); // escondido até o contador começar (senão mostra o valor final e depois volta a contar)
  gsap.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: .3, delay: .5 });
  cfg.tween = gsap.to(o, { v: cfg.center[0], duration: 1.4, delay: .5, ease: 'power3.out', onUpdate: () => b.textContent = fmt(cfg, Math.round(o.v)) });
  gsap.fromTo($$('.legend li', el), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, stagger: .08, delay: .6, ease: 'expo.out' });
}

/* ====== navegação ====== */
const slides = $$('.slide');
let cur = -1, tl;

function counters(slide) {
  $$('[data-count]', slide).forEach(el => {
    const o = { v: 0 }, dec = +(el.dataset.dec || 0);
    gsap.to(o, { v: +el.dataset.count, duration: 2, ease: 'power3.out', delay: .5,
      onUpdate: () => el.textContent = (el.dataset.pre || '') + o.v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suf || '') });
  });
}

/* chrome branco sobre slide escuro. o placar (faixa --band) inverte no tema escuro, como no site */
function tone() {
  const s = slides[cur], dark = document.documentElement.dataset.theme === 'dark';
  document.body.classList.toggle('on-dark', s.classList.contains('cta') || (s.classList.contains('score') && !dark));
}

function go(n) {
  n = Math.max(0, Math.min(slides.length - 1, n));
  if (n === cur || live.open) return;
  const dir = n > cur ? 1 : -1, prev = slides[cur], next = slides[n];
  tl?.progress(1).kill();
  gsap.set(next, { autoAlpha: 1, zIndex: 2, yPercent: 0 });
  if (prev) gsap.set(prev, { zIndex: 1 });
  // o slide novo "abre" por clip-path, igual ao menu do site; o antigo desce um pouco por baixo
  tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } })
    .fromTo(next, { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: prev ? 1 : 0 }, 0)
    .fromTo($$('.w > i', next), { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: .035, ease: 'expo.out' }, prev ? .35 : .1)
    .fromTo($$('.r', next), { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .9, stagger: .07, ease: 'expo.out' }, prev ? .45 : .2);
  if (prev) tl.to(prev, { yPercent: -10 * dir, duration: 1 }, 0).set(prev, { autoAlpha: 0, yPercent: 0 }, 1);
  counters(next);
  cur = n;
  if (next.hasAttribute('data-flow')) flowGo(next, dir > 0 ? -1 : $$('.station', next).length - 1, 'enter'); // voltando, chega no fim do fluxo
  if (next.hasAttribute('data-drum')) drumGo(next, dir > 0 ? -1 : XODOS.length - 1, 'enter');
  if (next.hasAttribute('data-reveal')) revealGo(next, dir > 0 ? -1 : $$('.soon', next).length - 1, 'enter');
  tone();
  gsap.to('#progress', { scaleX: (n + 1) / slides.length, duration: .8, ease: 'expo.out' });
  $('#counter').innerHTML = `<b>${pad(n + 1)}</b> / ${pad(slides.length)}`;
  history.replaceState(null, '', '#' + (n + 1));
}

/* ====== fluxo (slide com data-flow): o passador anda pelas estações ======
   i = -1 é a abertura (título + a 1ª estação espiando na borda). cada passo centraliza a estação,
   enche a linha, pulsa o nó e toca a animação da ilustração (FLOW_FX, uma por estação, na ordem do html) */
const flow = { i: -1 };
$$('[data-flow] .sheet path').forEach(p => { p.setAttribute('pathLength', 1); p.style.strokeDasharray = 1; }); // traço de caneta

const typing = n => p => Math.ceil(p * n) / n; // "digitação" em n saltos; o steps() do gsap para no penúltimo e cortava o fim
const FLOW_FX = [
  // 1 ideia: a faísca acende, ondas se espalham, as duas falas aparecem
  v => gsap.timeline()
    .fromTo($('.spark', v), { scale: 0 }, { scale: 1, duration: .9, ease: 'back.out(2.5)' })
    .fromTo($$('.ripple', v), { scale: .6, opacity: .9 }, { scale: 3.4, opacity: 0, duration: 2.4, ease: 'power2.out', stagger: { each: .8, repeat: -1 } }, .2)
    .fromTo($$('.bubble', v), { y: 16, scale: .8, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: .7, stagger: .5, ease: 'back.out(2)' }, .5),
  // 2 papel: a caneta desenha as telas, o post-it cola
  v => gsap.timeline()
    .fromTo($$('path', v), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .45, stagger: .1, ease: 'power1.inOut' })
    .fromTo($('.postit', v), { scale: 1.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .5, ease: 'back.out(2)' }, '-=.2'),
  // 3 banco: digita a busca, varre os repositórios, acende o que dá para reaproveitar
  v => {
    const typed = $('.typed', v), items = $$('.repos li', v);
    items.forEach(li => li.classList.remove('hit'));
    return gsap.timeline()
      .fromTo(items, { x: -12, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .5, stagger: .06, ease: 'expo.out' })
      .fromTo(typed, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: typing(24) }, 0)
      .fromTo($('.scan', v), { yPercent: -100, opacity: 1 }, { yPercent: 340, duration: 1.3, ease: 'power1.inOut' })
      .add(() => items[0].classList.add('hit'), '-=.85')
      .add(() => items[1].classList.add('hit'), '-=.55')
      .to($('.scan', v), { opacity: 0, duration: .2 });
  },
  // 4 editor: as linhas "digitam" uma a uma
  v => gsap.timeline().fromTo($$('.ln', v), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .55, stagger: .32, ease: typing(26) }),
  // 5 mvp: os 20 dias correm no calendário até o mvp
  v => {
    const b = $('.days b', v), cells = $$('.cal li', v), o = { d: 0 };
    return gsap.timeline()
      .to(o, { d: cells.length, duration: 2.2, ease: 'none', onUpdate: () => { const d = Math.round(o.d); b.textContent = d; cells.forEach((c, k) => c.classList.toggle('on', k < d)); } })
      .fromTo($('.badge', v), { scale: .5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .6, ease: 'back.out(2.5)' });
  },
  // 6 no ar: monitor cardíaco. a ponta (p) desenha da esquerda para a direita; com dasharray .8/.2 e offset .8-p
  // fica visível [0,p] e [p+.2,1]: o traço novo e, à frente do vão, o resto da varredura anterior
  v => {
    const path = $('.ekg__pulse', v), dot = $('.ekg__dot', v), svg = $('.ekg', v), len = path.getTotalLength(), o = { p: 0 };
    const draw = () => {
      const pt = path.getPointAtLength(o.p * len), r = svg.getBoundingClientRect(), vr = v.getBoundingClientRect(), k = v.offsetWidth / vr.width;
      path.style.strokeDashoffset = .8 - o.p;
      dot.style.left = (r.left - vr.left + pt.x / 400 * r.width) * k + 'px'; // k desfaz a escala da estação (transição .9 → 1)
      dot.style.top = (r.top - vr.top + pt.y / 120 * r.height) * k + 'px';
    };
    return gsap.timeline()
      .fromTo(o, { p: 0 }, { p: 1, duration: 2.6, ease: 'none', repeat: -1, onUpdate: draw }, 0)
      .fromTo($('.badge', v), { scale: .5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .6, ease: 'back.out(2.5)' }, .4);
  },
];

// mode: undefined = passada animada · 'enter' = chegando no slide (posiciona na hora, toca a animação) · 'resize' = só reposiciona
function flowGo(s, i, mode) {
  const st = $$('.station', s), track = $('.flow__track', s), target = st[Math.max(i, 0)], dur = mode ? 0 : 1.2, prev = flow.i;
  flow.i = i;
  // is-hid: estações à frente ficam escondidas (o número gigante ocupa o lugar); na abertura a 1ª ainda espia
  st.forEach((el, k) => { el.classList.toggle('is-on', k === i); el.classList.toggle('is-done', k < i); el.classList.toggle('is-hid', k > Math.max(i, 0)); });
  const center = target.offsetLeft + target.offsetWidth / 2;
  const intro = $('.flow__intro', s);
  const x = i < 0 ? parseFloat(getComputedStyle(s).paddingLeft) - intro.offsetLeft : s.clientWidth / 2 - center; // abertura: texto alinhado à margem
  gsap.to(track, { x, duration: dur, ease: 'expo.inOut', overwrite: 'auto' });
  gsap.to(intro, { autoAlpha: i < 0 ? 1 : 0, duration: dur * .8, ease: 'power2.inOut', overwrite: 'auto' }); // some enquanto sai pela esquerda
  // linha só na passada: cresce do nó anterior até o novo e o trecho que ficou para trás some
  const line = $('.flow__line', s), from = prev >= 0 && st[prev] ? st[prev].offsetLeft + st[prev].offsetWidth / 2 : -1;
  gsap.killTweensOf(line);
  if (mode || i < 0 || from < 0 || prev === i) gsap.set(line, { width: 0 });
  else if (center > from) gsap.timeline() // avançando: cresce para a direita, depois a cauda alcança o novo nó
    .set(line, { left: from, width: 0 })
    .to(line, { width: center - from, duration: 1, ease: 'expo.inOut' })
    .to(line, { left: center, width: 0, duration: .7, ease: 'power2.inOut' });
  else gsap.timeline() // voltando: o espelho
    .set(line, { left: from, width: 0 })
    .to(line, { left: center, width: from - center, duration: 1, ease: 'expo.inOut' })
    .to(line, { width: 0, duration: .7, ease: 'power2.inOut' });
  if (mode === 'resize') return;
  // número gigante: o atual sai enquanto a próxima estação aparece no lugar dele, depois entra o novo
  const big = $('.flow__big', s);
  gsap.killTweensOf(big);
  if (i < 0) return gsap.to(big, { autoAlpha: 0, duration: .35 });
  gsap.timeline()
    .to(big, { yPercent: -12, autoAlpha: 0, duration: mode ? 0 : .35, ease: 'power2.in' })
    .add(() => big.textContent = pad(i + 1))
    .fromTo(big, { yPercent: 25, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out', immediateRender: false }, dur * .7);
  gsap.fromTo($('.node i', target), { scale: 1, opacity: 1 }, { scale: 3.5, opacity: 0, duration: 1.2, ease: 'expo.out', delay: dur * .7 });
  gsap.fromTo($$('.station__txt > *', target), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, stagger: .08, ease: 'expo.out', delay: dur * .5 });
  target.fx?.kill();
  target.fx = FLOW_FX[i]($('.viz', target)).delay(dur * .6);
}
addEventListener('resize', () => slides[cur]?.hasAttribute('data-flow') && flowGo(slides[cur], flow.i, 'resize'));

/* ====== xodós (slide com data-drum): tambor de revólver ======
   i = -1 é a abertura (tambor parado, janela fechada). cada aplicação é um painel da janela #live
   (data-panel do slide), então o passador segue a regra das janelas: a passada recolhe a janela
   de volta na câmara, o tambor gira (openLive chama drumGo) e a próxima salta da nova câmara.
   group = parte do slide (aplicações / websites).
   embed:false → o sistema bloqueia iframe (x-frame-options): mostra o print com botão de nova aba */
const XODOS = [
  { name: 'stockloc', group: 'aplicações', url: 'https://stockloc.lochub.log.br', img: 'img/stockloc.webp',
    desc: 'estoque e reservas dos eventos, sem planilha: disponibilidade dos ativos, reservas automáticas e controle de estoque.' },
  { name: 'match de blocos', group: 'aplicações', url: 'https://matchdeblocos.dreamfactory.com.br', img: 'img/matchdeblocos.webp', embed: false,
    desc: 'feito para o carnaval de rua do carnabrasil: briefing da marca, base de blocos e o plano que cabe na verba, num lugar só.' },
  { name: 'radar dreamie', group: 'aplicações', url: 'https://radardev.dreamfactory.com.br', img: 'img/radar.webp',
    desc: 'priorização estratégica de eventos: cinco objetivos, sete critérios e uma régua única para decidir onde a marca deve estar.' },
  { name: 'lochub', group: 'websites', url: 'https://lochub.log.br/', img: 'img/lochub.webp',
    desc: 'a vitrine da lochub: soluções de locação e logística para eventos, clientes, catálogo e deck comercial.' },
  { name: 'portal de facilities', group: 'websites', url: 'https://facilities.dreamfactory.com.br/', img: 'img/facilities.webp',
    desc: 'administração e facilities do escritório em um só lugar: boas práticas, serviços e pedidos para a equipe.' },
];
const drum = { i: -1 }, DRUM_STEP = 360 / XODOS.length;
XODOS.forEach((x, k) => x.id = 'app-' + k);
$$('[data-drum]').forEach(s => {
  s.dataset.panel = XODOS.map(x => x.id).join(' ');
  $('.rev__cyl', s).innerHTML = XODOS.map((x, k) => `<button class="rev__ch" data-from="${x.id}" style="--a:${k * DRUM_STEP}deg" aria-label="${x.name}"><img src="${x.img}" alt=""></button>`).join('');
});
$('#live .frame').insertAdjacentHTML('beforeend', XODOS.map(x => `<div class="panel panel--app" id="${x.id}" data-addr="${new URL(x.url).host}" data-url="${x.url}">${x.embed === false
  ? `<img src="${x.img}" alt="tela do ${x.name}"><a class="btn btn--solid" href="${x.url}" target="_blank" rel="noopener">abrir ${x.name} <b>↗</b></a>`
  : `<iframe title="${x.name}" data-src="${x.url}" allow="fullscreen; clipboard-read; clipboard-write"></iframe><div class="loading"><img src="https://df.trestech.com.br/img/logo1.png" alt=""><span class="kicker">carregando</span></div>`}</div>`).join(''));
$$('.panel--app iframe').forEach(f => f.addEventListener('load', () => f.src && f.nextElementSibling.classList.add('done')));

// gira o tambor até a câmara i (-1 = abertura) e troca o texto. then: 'enter' = chegando no slide (sem animação)
// ou função chamada quando o tambor trava (openLive abre a janela da câmara)
function drumGo(s, i, then) {
  const enter = then === 'enter', x = XODOS[i], info = $('.xodo__info', s), turn = !enter && i !== drum.i, dur = turn ? 1.1 : 0;
  drum.i = i;
  if (enter) $$('.panel--app iframe').forEach(f => f.src || (f.src = f.dataset.src)); // pré-carrega ao chegar no slide
  if (typeof then === 'function') live.busy = true; // ninguém passa enquanto gira; openLive assume daqui
  // gira com tranco no fim, como o tambor travando na câmara; o tambor todo dá um coice
  const rot = -Math.max(i, 0) * DRUM_STEP;
  if (enter) { // chegando no slide: as câmaras saem de dentro do logo, girando até a posição
    gsap.fromTo($('.rev__cyl', s), { '--rot': rot - 150 + 'deg' }, { '--rot': rot + 'deg', duration: 1.6, ease: 'expo.out', delay: .4, overwrite: 'auto' });
    gsap.fromTo($$('.rev__ch', s), { '--r': 0, '--s': 0 }, { '--r': .32, '--s': 1, duration: 1.1, stagger: .09, ease: 'back.out(1.6)', delay: .4 });
  } else gsap.to($('.rev__cyl', s), { '--rot': rot + 'deg', duration: dur, ease: 'back.out(1.7)', overwrite: 'auto',
    onComplete: typeof then === 'function' ? then : null });
  if (turn) gsap.fromTo($('.rev', s), { x: -14 }, { x: 0, duration: .7, ease: 'elastic.out(1,.4)', delay: .45 });
  $$('.rev__ch', s).forEach((c, k) => c.classList.toggle('is-on', k === i));
  info.dataset.intro ??= info.innerHTML;
  info.innerHTML = i < 0 ? info.dataset.intro
    : `<small>${x.group} · ${pad(i + 1)}/${pad(XODOS.length)}</small><h3>${x.name}</h3><p>${x.desc}</p>`;
  gsap.fromTo(info.children, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7, stagger: .07, ease: 'expo.out', delay: dur * .3 });
}

/* ====== coming soon (slide com data-reveal): cada passada revela o próximo cartão .soon ======
   i = -1: todos trancados. "anterior" tranca de novo o último revelado. mode 'enter' = chegando no slide */
const reveal = { i: -1 };
function revealGo(s, i, mode) {
  const cards = $$('.soon', s), prev = reveal.i, c = cards[i];
  reveal.i = i;
  cards.forEach((el, k) => { el.classList.toggle('is-open', k <= i); el.classList.toggle('is-on', k === i); });
  if (mode || i < prev) return; // trancar volta pelas transições do css
  // destrava: brilho varre o cartão, o esqueleto se monta e o nome sai do desfoque
  gsap.timeline()
    .fromTo($('.soon__shine', c), { xPercent: -120, opacity: 1 }, { xPercent: 120, duration: 1, ease: 'power2.inOut' })
    .fromTo($$('.sk i', c), { scale: 0 }, { scale: 1, transformOrigin: '0% 100%', duration: .7, stagger: .08, ease: 'expo.out' }, .1)
    .fromTo($$('.soon__txt > *', c), { y: 14 }, { y: 0, duration: .8, stagger: .07, ease: 'expo.out' }, .15)
    .fromTo($('.soon__status', c), { scale: .7 }, { scale: 1, duration: .6, ease: 'back.out(3)' }, .2);
}

/* ====== live preview ====== */
const live = { open: false, from: null, url: '' };
const L = $('#live'), win = $('.win', L), frame = $('iframe', L), loading = $('.loading', L);
frame.addEventListener('load', () => frame.src !== 'about:blank' && loading.classList.add('done'));

function flipFrom(el) { // transform que leva a janela até o retângulo do quadro
  const a = el.getBoundingClientRect(), b = win.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height };
}

// data-panel="a b": painéis em sequência no mesmo slide; i = qual deles abrir
const panelsOf = s => s.dataset.panel?.split(' ') || [];

function openLive(slide, i = 0) {
  if (slide.hasAttribute('data-drum') && drum.i !== i) return drumGo(slide, i, () => openLive(slide, i)); // gira antes de abrir
  const id = panelsOf(slide)[i], panel = id && $('#' + id);
  live.open = true; live.url = panel?.dataset.url || slide.dataset.url; live.slide = slide; live.i = i; live.panel = panel; live.sub = -1;
  live.from = $(`[data-from="${id}"]`, slide);
  $('.addr', L).textContent = panel ? panel.dataset.addr : live.url;
  L.classList.toggle('is-panel', !!panel);
  L.classList.toggle('has-url', !!live.url);
  if (panel) {
    panel.classList.add('on');
    if (CHARTS[id]) drawChart(id);
    else if ($('[data-step]', panel)) { selectStep(panel, -1); gsap.fromTo($$('.plats__head, .plat', panel), { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, stagger: .07, delay: .45, ease: 'expo.out' }); }
  }
  else { loading.classList.remove('done'); frame.src = live.url; }
  gsap.set(L, { autoAlpha: 1 }); L.setAttribute('aria-hidden', 'false');
  gsap.set(win, { transformOrigin: '0 0', x: 0, y: 0, scale: 1 });
  live.busy = true;
  gsap.timeline({ onComplete: () => live.busy = false })
    .to($('.backdrop', L), { opacity: 1, duration: .5 }, 0)
    .fromTo(win, { ...flipFrom(live.from), opacity: .4 }, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: .9, ease: 'expo.out' }, 0);
}

function closeLive(then) {
  if (!live.open || live.busy) return;
  live.busy = true;
  gsap.timeline({ onComplete: () => {
      gsap.set(L, { autoAlpha: 0 }); L.setAttribute('aria-hidden', 'true');
      frame.src = 'about:blank'; win.classList.remove('max'); live.open = live.busy = false; window.focus();
      $$('.panel.on', L).forEach(p => p.classList.remove('on'));
      then?.();
    } })
    .to(win, { ...flipFrom(live.from), opacity: 0, duration: .6, ease: 'expo.inOut' }, 0)
    .to($('.backdrop', L), { opacity: 0, duration: .5 }, .1);
}

/* painel com itens [data-step] (plataformas): o passador percorre os itens antes de seguir.
   i = -1 é a visão geral (texto original do .plat-info__body) */
function selectStep(panel, i) {
  const items = $$('[data-step]', panel), info = $('.plat-info__body', panel), el = items[i];
  info.dataset.intro ??= info.innerHTML;
  items.forEach((it, k) => it.classList.toggle('is-on', k === i));
  panel.classList.toggle('has-sel', i >= 0);
  $$('.plat-info__dots li', panel).forEach((d, k) => d.classList.toggle('on', k === i));
  info.innerHTML = !el ? info.dataset.intro
    : `<span class="tag">${$('.plats__head', el.closest('section')).firstChild.textContent.trim()} · ${i + 1}/${items.length}</span>`
      + `<h3>${$('.plat__name b', el).textContent}</h3><p>${$('.plat__desc', el).innerHTML}</p>`;
  gsap.fromTo(info.children, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .06, ease: 'expo.out' });
}

L.addEventListener('click', e => {
  const st = e.target.closest('[data-step]');
  if (st && live.panel) selectStep(live.panel, live.sub = $$('[data-step]', live.panel).indexOf(st));
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (e.target.classList.contains('backdrop') || act === 'close') closeLive();
  if (act === 'max') win.classList.toggle('max');
  if (act === 'tab') window.open(live.url, '_blank', 'noopener');
  if (act === 'reload') { loading.classList.remove('done'); frame.src = live.url; }
});

document.addEventListener('click', e => {
  const s = e.target.closest('.slide');
  const from = e.target.closest('[data-from]');
  if (from && s?.hasAttribute('data-live')) openLive(s, panelsOf(s).indexOf(from.dataset.from));
  const stn = e.target.closest('.station');
  if (stn) flowGo(slides[cur], $$('.station', slides[cur]).indexOf(stn));
  const ch = e.target.closest('.rev__ch');
  if (ch && !live.busy) openLive(slides[cur], $$('.rev__ch', slides[cur]).indexOf(ch));
  const nav = e.target.closest('[data-nav]');
  if (nav) step(+nav.dataset.nav);
});

/* passada do remote: em slide com janela, "próximo" primeiro abre a janela;
   com vários painéis, o "próximo" recolhe um e abre o seguinte; no último, recolhe e avança.
   painel com itens [data-step]: antes disso, "próximo"/"anterior" andam pelos itens.
   "anterior" com a janela aberta (e sem item para voltar) só recolhe. */
function step(d) {
  if (live.busy) return;
  if (live.open) {
    // itens do painel: fatias do gráfico (CHARTS.order) ou cards [data-step]
    const chart = live.panel && CHARTS[live.panel.id];
    const n = chart ? chart.order.length : live.panel ? $$('[data-step]', live.panel).length : 0;
    const pick = i => chart ? chartFocus(chart, chart.sel = i < 0 ? -1 : chart.order[i]) : selectStep(live.panel, i);
    if (d > 0 && live.sub < n - 1) return pick(++live.sub);
    if (d < 0 && live.sub >= 0) return pick(--live.sub);
    const s = live.slide, nxt = live.i + 1;
    return closeLive(d < 0 ? null : nxt < panelsOf(s).length ? () => openLive(s, nxt) : () => go(cur + 1));
  }
  const s = slides[cur];
  if (s.hasAttribute('data-flow')) {
    const n = $$('.station', s).length;
    if (d > 0 && flow.i < n - 1) return flowGo(s, flow.i + 1);
    if (d < 0 && flow.i >= 0) return flowGo(s, flow.i - 1);
  }
  if (s.hasAttribute('data-reveal')) {
    const n = $$('.soon', s).length;
    if (d > 0 && reveal.i < n - 1) return revealGo(s, reveal.i + 1);
    if (d < 0 && reveal.i >= 0) return revealGo(s, reveal.i - 1);
  }
  // tambor com a janela fechada: "próximo" (re)abre a câmara atual (ou a 1ª); "anterior" gira para trás
  if (s.hasAttribute('data-drum')) {
    if (d > 0) return openLive(s, Math.max(drum.i, 0));
    if (drum.i >= 0) return drumGo(s, drum.i - 1);
  }
  if (d > 0 && s.hasAttribute('data-live')) openLive(s);
  else go(cur + d);
}
$('#restart').addEventListener('click', () => go(0));

/* ====== passador (remote) + teclado ======
   obs: com o foco dentro do iframe, as teclas vão para a aplicação — feche pelo botão. */
const NEXT = ['PageDown', 'ArrowRight', 'ArrowDown', ' ', 'Enter'], PREV = ['PageUp', 'ArrowLeft', 'ArrowUp'];
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return closeLive();
  if (NEXT.includes(e.key)) { e.preventDefault(); return step(1); }
  if (PREV.includes(e.key)) { e.preventDefault(); return step(-1); }
  if (live.open) return;
  const k = e.key.toLowerCase();
  if (k === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  else if (k === 't') { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; tone(); }
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(slides.length - 1);
});

go((parseInt(location.hash.slice(1)) || 1) - 1);
