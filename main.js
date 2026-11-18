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
   cores = tokens --chart-* do styles.css (um tom por tema, validados para daltonismo e contraste); a cor segue a área
   (infra = --chart-1, sistemas/desenvolvimento = --chart-3) em todos os gráficos.
   bars: true = barras verticais em vez de rosca (crescimento: são dois aumentos, não partes de um todo); pre = prefixo do valor */
const CHARTS = {
  'pie-resolucao': { unit: '%', center: [93, 'resolvidos'], order: [2, 1, 0],
    data: [['resolvidos', 93, 'var(--chart-1)'], ['aguardando solicitante', 5, 'var(--chart-2)'], ['aguardando fornecedor', 2, 'var(--chart-3)']] },
  'pie-chamados': { center: [4820, 'chamados resolvidos'], arcLabels: true, order: [0, 1],
    data: [['infra e hardware', 3020, 'var(--chart-1)'], ['sistemas e aplicações', 1800, 'var(--chart-3)']] },
  crescimento: { bars: true, unit: '%', pre: '+', center: [37, 'desenvolvimento'], order: [0, 1],
    data: [['desenvolvimento', 37, 'var(--chart-3)'], ['infra', 10, 'var(--chart-1)']] },
};
const num = (v, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
// barra com o topo arredondado (r 4), apoiada na base y 176
const VAL_GAP = 16; // valor flutua este tanto acima do topo da barra (com folga para o topo 3d do fx3d)
const barD = (x, y, w, r = Math.min(4, 176 - y)) => `M${x} 176V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V176Z`;
const fmt = (cfg, v) => (cfg.pre || '') + (cfg.unit === '%' ? `${num(v)}%` : num(v));

Object.entries(CHARTS).forEach(([id, cfg]) => {
  const el = cfg.el = $('#' + id), total = cfg.data.reduce((a, d) => a + d[1], 0);
  cfg.pct = cfg.data.map(d => d[1] / total * 100);
  let acc = 0;
  if (cfg.bars) { // barras: base em y 176, a maior vai até y 44; topo arredondado (4), valor em cima e nome embaixo
    const max = Math.max(...cfg.data.map(d => d[1])), n = cfg.data.length, bw = 52, step = 200 / n;
    $('svg', el).innerHTML = '<line class="bars__base" x1="8" x2="192" y1="176" y2="176"/>' + cfg.data.map(([k, v, c], i) => {
      const x = step * i + (step - bw) / 2, y = 176 - v / max * 132;
      return `<path data-i="${i}" data-x="${x}" data-y="${y}" data-w="${bw}" style="fill:${c}" d="${barD(x, y, bw)}"><title>${k}: ${fmt(cfg, v)}</title></path>`
        + `<text data-i="${i}" class="bars__val" x="${x + bw / 2}" y="${y - VAL_GAP}">${fmt(cfg, v)}</text><text data-i="${i}" class="bars__name" x="${x + bw / 2}" y="192">${k}</text>`;
    }).join('');
  } else $('svg', el).innerHTML = '<circle class="pie__track" cx="100" cy="100" r="80"/>' + cfg.data.map(([k, v, c], i) => {
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
  // descritivo abaixo do gráfico só com uma fatia acionada (passador ou hover).
  // enquanto o contador da abertura roda (cfg.tween), ele é o dono do número: o hover (mouse parado sobre a janela) não pode
  // reescrever o valor final, senão a contagem some. b e span são criados uma vez (o contador guarda o b)
  const c = $('.pie__center', cfg.el);
  if (!$('b', c)) c.innerHTML = '<b></b><span></span>';
  if (i >= 0 || !(cfg.tween?.progress() < 1)) $('b', c).textContent = fmt(cfg, v);
  $('span', c).textContent = i < 0 ? '' : k;
  if (i >= 0) gsap.fromTo($('.pie__center span', cfg.el), { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: 'expo.out' });
  $$('[data-i]', cfg.el).forEach(el => el.classList.toggle('dim', i >= 0 && +el.dataset.i !== i));
}

function drawChart(id) {
  const cfg = CHARTS[id], el = cfg.el;
  cfg.sel = -1;
  chartFocus(cfg, -1);
  // barras sobem da base: redesenha o caminho (scaleY do gsap em svg erra a origem com o painel ainda escondido)
  // valor em cima da barra sobe e conta junto; mesma duração/curva do contador do número grande (sincronia)
  $$('path[data-i]', el).forEach((b, i) => { const o = { p: 0 }, { x, y, w } = b.dataset, t = b.nextElementSibling, v = cfg.data[i][1];
    const draw = () => { const top = 176 - (176 - y) * o.p; b.dataset.top = top; b.setAttribute('d', barD(+x, top, +w)); t.setAttribute('y', top - VAL_GAP); t.textContent = fmt(cfg, Math.round(v * o.p)); };
    draw(); // já na base: com o delay o gsap só desenhava o 0 ao começar → a barra aparecia cheia, caía e subia
    gsap.to(o, { p: 1, duration: 1.4, ease: 'power3.out', delay: .5 + i * .15, onUpdate: draw }); });
  gsap.fromTo($$('.bars__val', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .3, stagger: .15, delay: .5 });
  $$('circle[data-i]', el).forEach((c, i) => gsap.fromTo(c, { attr: { 'stroke-dasharray': '0 100' } },
    { attr: { 'stroke-dasharray': `${cfg.pct[i] - .6} 100` }, duration: 1.2, ease: 'expo.out', delay: .5 + i * .15 })); // .6 = respiro entre fatias
  gsap.fromTo($$('text:not(.bars__val)', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .6, stagger: .1, delay: 1.1 });
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

/* chrome branco sobre slide escuro. o placar (faixa --band) inverte no tema escuro, como no site:
   aí ele fica claro e o chrome precisa ser escuro (on-light), senão botões, contador e logo somem */
function tone() {
  const s = slides[cur], dark = document.documentElement.dataset.theme === 'dark', score = s.classList.contains('score');
  document.body.classList.toggle('on-dark', s.classList.contains('cta') || (score && !dark));
  document.body.classList.toggle('on-light', score && dark);
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
  if (next.hasAttribute('data-drum')) { drumGo(next, dir > 0 ? 0 : XODOS.length - 1, 'enter'); drum.seen = dir < 0; } // voltando: último cartão, já visto
  if (next.hasAttribute('data-reveal')) revealGo(next, dir > 0 ? -1 : $$('[data-rv]', next).length - 1, 'enter');
  tone();
  gsap.to('#progress', { scaleX: (n + 1) / slides.length, duration: .8, ease: 'expo.out' });
  $('#counter').innerHTML = `<b>${pad(n + 1)}</b> / ${pad(slides.length)}`;
  $('[data-nav="-1"]').style.visibility = n ? '' : 'hidden'; // na capa não há para onde voltar: some (e guarda o lugar, o → não pula)
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
  // 2 project owner: o andré da hq sobe no quadro e acena (os 2 quadros do sprite dele alternam), o selo carimba, as falas aparecem.
  // recorte do sprite: x 50–118, y 6–66 da cena 150×100 (cabeça, mão levantada e tronco)
  v => {
    const c = $('.po__cv', v), x = c.getContext('2d'), img = v.po ||= sprite(andre), w = { k: 0 };
    const draw = k => { x.clearRect(0, 0, c.width, c.height); x.drawImage(img[k], 50 * S, 6 * S, c.width, c.height, 0, 0, c.width, c.height); };
    draw(0);
    return gsap.timeline()
      .fromTo(c, { yPercent: 30, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .8, ease: 'expo.out' })
      .to(w, { duration: .45, repeat: -1, onRepeat: () => draw(w.k ^= 1) }, .4)
      .fromTo($('.badge', v), { scale: 1.8, rotation: -12, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: .5, ease: 'back.out(2.5)' }, .6)
      .fromTo($$('.bubble', v), { y: 16, scale: .8, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: .7, stagger: .5, ease: 'back.out(2)' }, .9);
  },
  // 3 papel: a caneta desenha as telas, o post-it cola
  v => gsap.timeline()
    .fromTo($$('path', v), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .45, stagger: .1, ease: 'power1.inOut' })
    .fromTo($('.postit', v), { scale: 1.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .5, ease: 'back.out(2)' }, '-=.2'),
  // 4 banco: digita a busca, varre os repositórios, acende o que dá para reaproveitar
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
  // 5 editor: as linhas "digitam" uma a uma
  v => gsap.timeline().fromTo($$('.ln', v), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .55, stagger: .32, ease: typing(26) }),
  // 6 mvp funcional e clicável: a aplicação abre, o cursor troca de aba (o gráfico muda) e clica em salvar
  v => {
    const cur = $('.cursor', v), tap = $('.tap', v), tabs = $$('.app__tabs span', v), bars = $$('.app__chart i', v), btn = $('.app__btn', v);
    const H1 = [.45, .7, .55, .9, .65], H2 = [.85, .4, .95, .5, .75];
    tabs.forEach((t, k) => t.classList.toggle('on', !k)); btn.classList.remove('ok'); btn.textContent = 'salvar';
    // centro do alvo em px do cartão; k desfaz a escala da estação (transição .9 → 1). lido quando o tween começa
    const at = (el, a) => { const r = el.getBoundingClientRect(), vr = v.getBoundingClientRect(), k = v.offsetWidth / vr.width;
      return a === 'x' ? (r.left - vr.left + r.width * .85) * k : (r.top - vr.top + r.height * .7) * k; }; // canto de baixo/direita: a seta não cobre o texto
    const click = el => gsap.timeline()
      .to(cur, { x: () => at(el, 'x'), y: () => at(el, 'y'), duration: .9, ease: 'power3.inOut' })
      .to(cur, { scale: .8, duration: .1, yoyo: true, repeat: 1, transformOrigin: '0 0' })
      .fromTo(tap, { x: () => at(el, 'x'), y: () => at(el, 'y'), scale: .2, opacity: 1 }, { scale: 1.4, opacity: 0, duration: .55, ease: 'expo.out', immediateRender: false }, '<');
    gsap.set(cur, { x: v.offsetWidth * .9, y: v.offsetHeight * 1.1, scale: 1 }); // já fora, por baixo (a passada tem atraso)
    return gsap.timeline()
      .fromTo($('.app', v), { y: 24, scale: .94, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: .7, ease: 'expo.out' })
      .fromTo(bars, { scaleY: 0 }, { scaleY: k => H1[k], duration: .8, stagger: .06, ease: 'expo.out' }, .3)
      .add(click(tabs[1]), .6)
      .add(() => tabs.forEach((t, k) => t.classList.toggle('on', k === 1)), '-=.4')
      .to(bars, { scaleY: k => H2[k], duration: .6, stagger: .04, ease: 'expo.out' }, '<')
      .add(click(btn), '+=.1')
      .add(() => { btn.classList.add('ok'); btn.textContent = 'salvo ✓'; }, '-=.4')
      .fromTo($('.badge', v), { scale: 1.8, rotation: -12, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: .5, ease: 'back.out(2.5)' }, '+=.3');
  },
  // 7 no ar: monitor cardíaco. a ponta (p) desenha da esquerda para a direita; com dasharray .8/.2 e offset .8-p
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

/* ====== xodós (slide com data-drum): carrossel 3d (era um tambor de revólver; o nome "drum" ficou) ======
   cartões com os prints em volta de um cilindro; o da frente é o da vez. cabe bem mais que as câmaras do tambor:
   o raio cresce com a quantidade (--k). i = -1 é a abertura (janela fechada). cada aplicação é um painel da janela #live
   (data-panel do slide). passador alternado (pedido do usuário em 2026-11-14, para dar tempo de ler a descrição):
   chega no 1º cartão com a descrição → passada abre a janela → passada recolhe e gira para o próximo (só a descrição)
   → passada abre... drum.seen = a janela do cartão da frente já foi aberta.
   group = parte do slide (aplicações / websites).
   embed:false → sem iframe: só o print (o "nova aba" fica na barra da janela) (regra do usuário: aplicações só print; vídeo só em websites).
   video → no lugar do print, um vídeo do sistema funcionando (mudo, em loop, recomeça a cada abertura da janela).
   vstyle → css do vídeo (padrão: preenche a janela e corta embaixo quando ela é mais larga que o vídeo) */
const XODOS = [
  { name: 'tiverso', group: 'websites', url: 'https://tiverso.dreamfactory.com.br/', img: 'img/tiverso.webp', embed: false, video: 'video/tiverso.mp4', vstyle: 'object-fit:contain;background:#000', // vídeo inteiro (a galáxia do canto não pode ser cortada); as faixas pretas somem no espaço
    desc: 'o guia de serviços da ti num universo 3d: cada planeta abre um serviço, de chamados e segurança a equipamentos e acessos.' },
  { name: 'lochub', group: 'websites', url: 'https://lochub.log.br/', img: 'img/lochub.webp', embed: false, video: 'video/lochub.mp4',
    desc: 'a vitrine da lochub: soluções de locação e logística para eventos, clientes, catálogo e deck comercial.' },
  { name: 'stockloc', group: 'aplicações', url: 'https://stockloc.lochub.log.br', img: 'img/stockloc.webp', embed: false,
    desc: 'estoque e reservas dos eventos, sem planilha: disponibilidade dos ativos, reservas automáticas e controle de estoque.' },
  { name: 'match de blocos', group: 'aplicações', url: 'https://matchdeblocos.dreamfactory.com.br', img: 'img/matchdeblocos.webp', embed: false,
    desc: 'feito para o carnaval de rua do carnabrasil: briefing da marca, base de blocos e o plano que cabe na verba, num lugar só.' },
  { name: 'radar dreamie', group: 'aplicações', url: 'https://radardev.dreamfactory.com.br', img: 'img/radar.webp', embed: false,
    desc: 'priorização estratégica de eventos: cinco objetivos, sete critérios e uma régua única para decidir onde a marca deve estar.' },
  { name: 'mapa', group: 'aplicações', url: 'https://mapa.trestech.com.br/', img: 'img/mapa.webp', embed: false,
    desc: 'mapeamento · atividades · processos · ações: as tarefas da equipe com scrum no quadro kanban. o famoso scrumban.' },
  { name: 'portal de facilities', group: 'websites', url: 'https://facilities.dreamfactory.com.br/', img: 'img/facilities.webp', embed: false, video: 'video/facilities.mp4',
    desc: 'administração e facilities do escritório em um só lugar: boas práticas, serviços e pedidos para a equipe.' },
  { name: 'suprimentos dream', group: 'aplicações', url: 'https://suprimentos-dream-production.up.railway.app/', img: 'img/suprimentos.webp', embed: false,
    desc: 'comparador de cotações com ia: envie de 2 a 10 propostas de fornecedores (excel, word ou pdf) e a comparação sai pronta.' },
];
const drum = { i: -1, seen: false }, DRUM_STEP = 360 / XODOS.length;
XODOS.forEach((x, k) => x.id = 'app-' + k);
$$('[data-drum]').forEach(s => {
  s.dataset.panel = XODOS.map(x => x.id).join(' ');
  $('.car__ring', s).innerHTML = XODOS.map((x, k) => `<button class="car__card" data-from="${x.id}" style="--a:${k * DRUM_STEP}deg" aria-label="${x.name}"><img src="${x.img}" alt=""></button>`).join('');
  $('.car', s).style.setProperty('--k', 1.15 / (2 * Math.tan(Math.PI / XODOS.length))); // raio do cilindro em larguras de cartão (com folga entre eles)
});
$('#live .frame').insertAdjacentHTML('beforeend', XODOS.map(x => `<div class="panel panel--app" id="${x.id}" data-addr="${x.url ? new URL(x.url).host : x.name}" data-url="${x.url || ''}">${x.embed === false
  ? `${x.video ? `<video src="${x.video}" poster="${x.img}"${x.vstyle ? ` style="${x.vstyle}"` : ''} muted loop playsinline preload="${matchMedia('(pointer:coarse)').matches ? 'metadata' : 'auto'}" aria-label="${x.name} funcionando"></video>` // sem o botão: cobriria o vídeo; o "nova aba" da barra abre o sistema
    : `<img src="${x.img}" alt="tela do ${x.name}">`}`
  : `<iframe title="${x.name}" data-src="${x.url}" allow="fullscreen; clipboard-read; clipboard-write"></iframe><div class="loading"><img src="vendor/logo1.png" alt=""><span class="kicker">carregando</span></div>`}</div>`).join(''));
$$('.panel--app iframe').forEach(f => f.addEventListener('load', () => f.src && f.nextElementSibling.classList.add('done')));

// gira o carrossel até o cartão i (-1 = abertura) e troca o texto. then: 'enter' = chegando no slide (sem animação)
// ou função chamada quando o carrossel trava (openLive abre a janela do cartão)
function drumGo(s, i, then) {
  const enter = then === 'enter', x = XODOS[i], info = $('.xodo__info', s), turn = !enter && i !== drum.i, dur = turn ? 1.1 : 0;
  drum.i = i; drum.seen = false;
  if (enter) $$('.panel--app iframe').forEach(f => f.src || (f.src = f.dataset.src)); // pré-carrega ao chegar no slide
  if (typeof then === 'function') live.busy = true; // ninguém passa enquanto gira; openLive assume daqui
  // gira com um tranco no fim, travando no cartão
  const rot = -Math.max(i, 0) * DRUM_STEP;
  if (enter) { // chegando no slide: o carrossel entra girando meia volta e os cartões crescem um a um
    gsap.fromTo($('.car__ring', s), { '--rot': rot + 180 + 'deg' }, { '--rot': rot + 'deg', duration: 1.8, ease: 'expo.out', delay: .4, overwrite: 'auto' });
    gsap.fromTo($$('.car__card', s), { '--s': 0 }, { '--s': 1, duration: 1.1, stagger: .08, ease: 'back.out(1.6)', delay: .4 });
  } else gsap.to($('.car__ring', s), { '--rot': rot + 'deg', duration: dur, ease: 'back.out(1.4)', overwrite: 'auto',
    onComplete: typeof then === 'function' ? then : null });
  $$('.car__card', s).forEach((c, k) => c.classList.toggle('is-on', k === i));
  info.dataset.intro ??= info.innerHTML;
  info.innerHTML = i < 0 ? info.dataset.intro
    : `<small>${x.group} · ${pad(i + 1)}/${pad(XODOS.length)}</small><h3>${x.name}</h3><p>${x.desc}</p>`;
  gsap.fromTo(info.children, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7, stagger: .07, ease: 'expo.out', delay: dur * .3 });
}

/* ====== slides com data-reveal (hq e coming soon): cada passada revela o próximo item [data-rv] ======
   i = -1: nada revelado. "anterior" esconde de novo o último (pelas transições do css). mode 'enter' = chegando no slide.
   data-rv escolhe a animação de revelar em REVEAL_FX */
const reveal = { i: -1 };
const REVEAL_FX = {
  // coming soon: brilho varre o cartão, o esqueleto se monta e o nome sai do desfoque
  soon: c => gsap.timeline()
    .fromTo($('.soon__shine', c), { xPercent: -120, opacity: 1 }, { xPercent: 120, duration: 1, ease: 'power2.inOut' })
    .fromTo($$('.sk i', c), { scale: 0 }, { scale: 1, transformOrigin: '0% 100%', duration: .7, stagger: .08, ease: 'expo.out' }, .1)
    .fromTo($$('.soon__txt > *', c), { y: 14 }, { y: 0, duration: .8, stagger: .07, ease: 'expo.out' }, .15)
    .fromTo($('.soon__status', c), { scale: .7 }, { scale: 1, duration: .6, ease: 'back.out(3)' }, .2),
  // quadro da hq: entra girando, balão estoura (o texto da historinha, na coluna da direita, entra por css: .hq__story)
  hq: c => gsap.timeline()
    .fromTo($('.hq__panel', c), { scale: .4, rotation: -10 }, { scale: 1, rotation: 0, duration: .8, ease: 'back.out(1.8)', clearProps: 'transform' })
    .fromTo($$('.hq__bal', c), { scale: 0 }, { scale: 1, transformOrigin: '20% 130%', duration: .5, ease: 'back.out(3)', clearProps: 'transform' }, .6),
  // faixa larga da página 1: entra deslizando pelo lado de data-dir (1 = vem da direita, -1 = da esquerda)
  strip: c => gsap.timeline()
    .fromTo($('.hq__panel', c), { xPercent: 100 * c.dataset.dir, rotation: 1.5 * c.dataset.dir }, { xPercent: 0, rotation: 0, duration: .9, ease: 'expo.out', clearProps: 'transform' })
    .fromTo($$('.hq__bal', c), { scale: 0 }, { scale: 1, transformOrigin: '20% 130%', duration: .5, ease: 'back.out(3)', clearProps: 'transform' }, .55),
  // level up: quadro quica, estouro gira, barra de xp enche em saltos
  burst: c => gsap.timeline()
    .fromTo($('.hq__panel', c), { scale: .3, rotation: 15 }, { scale: 1, rotation: 0, duration: 1, ease: 'elastic.out(1,.5)', clearProps: 'transform' })
    // a barra carrega primeiro; cheia, o level up explode na ponta dela (estoura grande e assenta)
    .fromTo($('.hq__xp i', c), { width: '0%' }, { width: '100%', duration: 1.4, ease: typing(12) }, .5)
    .fromTo($('.hq__boom', c), { scale: 0, rotation: -40 }, { scale: 1, rotation: -6, duration: .8, ease: 'back.out(4)' }, 1.95),
  // custos: as barras crescem pelo css (.is-open); aqui só o selo da economia carimba depois delas
  cost: c => gsap.fromTo($('.cost__off', c), { scale: 2.4, rotation: -25 }, { scale: 1, rotation: -6, duration: .6, ease: 'back.out(2.5)', delay: 1.3 }),
};
/* custos: barras na escala do maior cotado; valores contam (o total conta a partir do que mostra, inclusive para trás) */
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
function money(el, v, anim, delay = 0) {
  const o = el._o ??= { v: 0 };
  gsap.killTweensOf(o);
  if (v == null) { o.v = 0; return el.textContent = 'R$ ···'; }
  if (!anim) { o.v = v; return el.textContent = brl(v); }
  gsap.to(o, { v, duration: 1.4, delay, ease: 'power3.out', onUpdate: () => el.textContent = brl(Math.round(o.v)) });
}
function cost(s, i, mode) {
  const rows = $$('.cost', s), max = Math.max(...rows.map(r => +r.dataset.cot)), sum = { cot: 0, gas: 0 };
  rows.forEach((r, k) => {
    const cot = +r.dataset.cot, gas = +r.dataset.gas, on = k <= i, anim = k === i && !mode;
    r.style.setProperty('--cot', cot / max); r.style.setProperty('--gas', gas / max);
    money($('.cost__cot b', r), on ? cot : null, anim, .2);
    money($('.cost__gas b', r), on ? gas : null, anim, .7);
    $('.cost__off', r).textContent = '−' + Math.round((1 - gas / cot) * 100) + '%';
    if (on) { sum.cot += cot; sum.gas += gas; }
  });
  const d = mode ? 0 : 1; // o total sobe depois das barras
  money($('.cost__total b', s), sum.cot - sum.gas, !mode, d);
  $$('.cost__total [data-sum]', s).forEach(el => money(el, sum[el.dataset.sum], !mode, d));
  $('.cost__total', s).classList.toggle('is-end', i === rows.length - 1);
}
function revealGo(s, i, mode) {
  const items = $$('[data-rv]', s), prev = reveal.i, head = $('.hq__head', s);
  const wait = head && i === 0 && prev < 0 && !mode; // hq: o 1º quadro espera o título sair de cima dele
  reveal.i = i;
  // hq: páginas de quadros (.hq__page) — fica à mostra a página do quadro da vez; cada texto da historinha (.hq__story p[data-at])
  // segue o estado do quadro data-at e só aparece enquanto a página dele estiver à mostra
  const story = () => {
    const pg = items[Math.max(reveal.i, 0)].closest('.hq__page');
    $$('.hq__page', s).forEach(p => p.classList.toggle('is-cur', p === pg));
    $$('.hq__story [data-at]', s).forEach(p => { // inclui os marcadores dentro da placa (.hq__mark)
      const it = items[p.dataset.at];
      p.hidden = it.closest('.hq__page') !== pg;
      ['is-open', 'is-on'].forEach(c => p.classList.toggle(c, it.classList.contains(c)));
    });
  };
  items.forEach((el, k) => { el.classList.toggle('is-open', k <= i && !(wait && k === 0)); el.classList.toggle('is-on', k === i && !wait); });
  story();
  if (head) hqHead(s, head, i, mode);
  if ($('.cost__total', s)) cost(s, i, mode);
  if (mode || i < prev) return;
  if (!wait) return REVEAL_FX[items[i].dataset.rv](items[i]);
  // a cada frame: as linhas de texto do título (não a caixa inteira) ainda tocam o quadro (+ folga)? quando não, abre
  const c = items[0], gap = 12, clear = () => {
    if (reveal.i !== 0) return gsap.ticker.remove(clear); // passou/voltou antes de abrir: a classe já resolveu
    const b = c.getBoundingClientRect();
    if ([...textRects(head), $('.tag', head).getBoundingClientRect()]
      .some(a => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap)) return;
    gsap.ticker.remove(clear);
    c.classList.add('is-open', 'is-on'); story();
    REVEAL_FX[c.dataset.rv](c);
  };
  gsap.ticker.add(clear);
}
// retângulos de cada linha de texto dentro de el (as caixas dos blocos ocupam a coluna toda e exagerariam a área)
function textRects(el) {
  const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), r = document.createRange();
  while (w.nextNode()) if (w.currentNode.textContent.trim()) { r.selectNodeContents(w.currentNode); out.push(...r.getClientRects()); }
  return out;
}
// hq: na abertura (i = -1) o título fica grande, na margem esquerda e centrado na altura; a 1ª passada o encolhe até o lugar dele (coluna da direita).
// FLIP: mede o lugar natural (sem transform) e calcula o deslocamento/escala até a posição de abertura
function hqHead(s, head, i, mode) {
  const dur = mode ? 0 : 1.1;
  if (i >= 0) return gsap.to(head, { x: 0, y: 0, scale: 1, duration: dur, ease: 'expo.inOut', overwrite: 'auto' });
  gsap.killTweensOf(head);
  const now = { x: gsap.getProperty(head, 'x'), y: gsap.getProperty(head, 'y'), scale: gsap.getProperty(head, 'scale') };
  gsap.set(head, { x: 0, y: 0, scale: 1 });
  const r = head.getBoundingClientRect(), sr = s.getBoundingClientRect();
  const k0 = Math.min(1.9, sr.width * .62 / r.width, sr.height * .6 / r.height);
  const k = innerWidth < innerHeight ? Math.max(1.3, k0) : k0, pad /* celular em pé: a caixa ocupa a largura toda e a conta encolhia o título */ = parseFloat(getComputedStyle(s).paddingLeft);
  // na horizontal: borda esquerda (já ampliada) na margem do slide, como os outros títulos; na vertical: centro
  gsap.fromTo(head, now, { x: sr.left + pad + r.width * k / 2 - (r.left + r.width / 2), y: sr.top + sr.height / 2 - (r.top + r.height / 2), scale: k,
    transformOrigin: '50% 50%', duration: dur, ease: 'expo.inOut' });
}
addEventListener('resize', () => { const s = slides[cur]; if (s?.classList.contains('hq') && reveal.i < 0) hqHead(s, $('.hq__head', s), -1, 'resize'); });

/* ====== hq em pixel art (slide 2): personagens desenhados em vetor numa tela pequena e "pixelizados" ======
   cena = 150×100 (desenhada em S× essa resolução), ampliada pelo css (image-rendering: pixelated).
   personagem = camada própria: formas em vetor → bordas endurecidas (alfa 0/1) → cores presas à paleta usada →
   contorno escuro de 1px em volta, como sprite de jogo de luta. f = quadro da animação (0/1) */
// ponytail: S = resolução real (S=2 → 300×200, contorno e curvas 2× mais finos); desenho continua nas coordenadas 150×100. S=1 volta ao antigo
const HW = 150, HH = 100, S = 2, INK = '#1a1c2c';
let BLINK = false; // head() desenha os olhos fechados (só ao montar as camadas de piscada)
const cv = (w = HW) => { const c = document.createElement('canvas'); c.width = w * S; c.height = HH * S; return c; };
function painter(x) { // pincéis que guardam as cores usadas (paleta para prender os tons depois)
  const used = new Set(); x.setTransform(S, 0, 0, S, 0, 0);
  const fill = c => { used.add(c); x.fillStyle = c; };
  return {
    used, x,
    R: (c, ox, oy, w, h) => { fill(c); x.fillRect(ox, oy, w, h); },
    E: (c, cx, cy, rx, ry, rot = 0) => { fill(c); x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fill(); },
    P: (c, ...pts) => { fill(c); x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); },
    L: (c, w, ...pts) => { used.add(c); x.strokeStyle = c; x.lineWidth = w; x.lineCap = x.lineJoin = 'round';
      x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); },
    D: (c, ...pts) => { fill(c); pts.forEach(([a, b]) => x.fillRect(a, b, 1, 1)); }, // pixels soltos
  };
}
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
function pixelize(layer, used, outline = INK) {
  const x = layer.getContext('2d'), W = layer.width, H = layer.height, img = x.getImageData(0, 0, W, H), p = img.data, pal = [...used].filter(c => c[0] === '#').map(hex);
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 110) { p[i + 3] = 0; continue; }
    let best = 0, bd = 1e9;
    pal.forEach((c, k) => { const d = (c[0] - p[i]) ** 2 + (c[1] - p[i + 1]) ** 2 + (c[2] - p[i + 2]) ** 2; if (d < bd) { bd = d; best = k; } });
    [p[i], p[i + 1], p[i + 2]] = pal[best]; p[i + 3] = 255;
  }
  const o = hex(outline), solid = (a, b) => a >= 0 && b >= 0 && a < W && b < H && p[(b * W + a) * 4 + 3] === 255 && !edge[b * W + a];
  const edge = new Uint8Array(W * H);
  for (let b = 0; b < H; b++) for (let a = 0; a < W; a++) {
    if (p[(b * W + a) * 4 + 3]) continue;
    if (solid(a + 1, b) || solid(a - 1, b) || solid(a, b + 1) || solid(a, b - 1)) edge[b * W + a] = 1;
  }
  edge.forEach((e, k) => { if (e) { p.set(o, k * 4); p[k * 4 + 3] = 255; } });
  x.putImageData(img, 0, 0);
  return layer;
}
const sprite = (draw, w = HW) => [0, 1].map(f => { const l = cv(w), pt = painter(l.getContext('2d')); draw(pt, f); return pixelize(l, pt.used); });

/* ---------- pessoas ---------- */
// cabeça de frente, luz vinda da esquerda: sombra na direita e no queixo. skin = [base, sombra, luz]
// o: { iris, lips, smile } — olhos com íris, nariz com luz e sombra, lábios em dois tons
function head(pt, cx, cy, skin, f, o = {}) {
  const [s, S, l] = skin, iris = o.iris || '#4a2f22', lips = o.lips || '#a35a4c';
  pt.E(S, cx - 9, cy + 1, 2, 3.5); pt.E(S, cx + 9, cy + 1, 2, 3.5); pt.D(s, [cx - 9, cy], [cx + 8, cy]); // orelhas
  pt.E(S, cx, cy + .5, 9, 11.5);                                  // sombra (lado direito + queixo)
  pt.E(s, cx - 1, cy - .5, 8, 10.5);                               // rosto (estreito: queixo mais definido)
  pt.E(l, cx - 4, cy - 5, 3, 2); pt.E(l, cx - 5, cy + 2, 1.5, 2);   // luz na testa e na bochecha
  if (o.blush) { pt.E(o.blush, cx - 5, cy + 3, 2, 1); pt.E(o.blush, cx + 4, cy + 3, 2, 1); }
  o.under?.();                                                     // barba etc.: por cima da pele, por baixo de olhos/nariz/boca
  pt.R(S, cx - 6, cy - 4, 4, 1); pt.R(S, cx + 2, cy - 4, 4, 1);     // fundo dos olhos
  if (BLINK) { pt.R(S, cx - 6, cy - 2, 4, 1); pt.R(S, cx + 2, cy - 2, 4, 1); pt.R(INK, cx - 6, cy - 1, 4, 1); pt.R(INK, cx + 2, cy - 1, 4, 1); } // piscando (relógio próprio: BLINKS)
  else {
    pt.R('#f6f1ea', cx - 6, cy - 2, 4, 2); pt.R('#f6f1ea', cx + 2, cy - 2, 4, 2);
    pt.R(iris, cx - 5, cy - 2, 2, 2); pt.R(iris, cx + 3, cy - 2, 2, 2); pt.D(INK, [cx - 4, cy - 2], [cx + 4, cy - 2]);
    pt.R(INK, cx - 6, cy - 3, 4, 1); pt.R(INK, cx + 2, cy - 3, 4, 1);   // pálpebra
  }
  pt.R(l, cx - 1, cy, 1, 3); pt.R(S, cx, cy + 1, 1, 3); pt.R(S, cx - 2, cy + 4, 4, 1); // nariz: luz, sombra, narinas
  if (o.closed) { pt.R(lips, cx - 3, cy + 6, 7, 1); pt.D(lips, [cx - 4, cy + 5], [cx + 3, cy + 5]); pt.R(o.lipsLight || l, cx - 2, cy + 7, 5, 1); } // sorriso de boca fechada
  else if (o.smile) { pt.R(lips, cx - 3, cy + 6, 7, 1); pt.R('#ffffff', cx - 2, cy + 6, 5, 1); pt.R(lips, cx - 2, cy + 7, 5, 1); pt.D(S, [cx - 4, cy + 5], [cx + 4, cy + 5]); }
  else { pt.R(lips, cx - 2, cy + 6, 5, 1); pt.R(o.lipsLight || l, cx - 1, cy + 7, 3, 1); }
  pt.E(S, cx + 1, cy + 9.5, 4, 1.2);                               // sombra embaixo do queixo
}
// tronco em v (ombros mais largos que a cintura), sombra no lado direito, peitoral e dobra da roupa. w = meia largura dos ombros
function torso(pt, cx, top, shirt, shadow, bottom = 66, w = 18) {
  const b = w - 5;
  pt.P(shadow, [cx - w + 1, top + 2], [cx + w - 1, top + 2], [cx + b, bottom], [cx - b, bottom]);
  pt.P(shirt, [cx - w + 1, top + 2], [cx + w - 7, top + 2], [cx + b - 5, bottom], [cx - b, bottom]);
  pt.E(shirt, cx - w + 3, top + 5, 4.5, 4); pt.E(shadow, cx + w - 3, top + 5, 4.5, 4);   // ombros
  pt.L(shadow, 1, [cx - 9, top + 12], [cx - 2, top + 13]); pt.L(shadow, 1, [cx + 4, top + 14], [cx + 5, bottom - 2]); // peitoral, dobra
}
// membro com volume: traço de sombra mais largo + traço base deslocado para a luz (esquerda/cima)
function limb(pt, base, shade, w, ...pts) { pt.L(shade, w, ...pts); pt.L(base, w - 2, ...pts.map(([a, b]) => [a - 1, b - 1])); }
// desenha só dentro do rosto (barba que não vaza para fora da cara)
function inFace(pt, cx, cy, fn) { const x = pt.x; x.save(); x.beginPath(); x.ellipse(cx, cy + .5, 9, 11.5, 0, 0, 7); x.clip(); fn(); x.restore(); }
// cacho em espiral (millena): mecha em zigue-zague que afina na ponta + riscos de brilho inclinados nas voltas
function ringlet(pt, c, hl, x, y, len, w, amp = 1.5) {
  const n = Math.max(2, Math.round(len / 3.2)), pts = [];
  for (let k = 0; k <= n; k++) pts.push([x + (k % 2 ? amp : -amp) * (1 - k / n * .5), y + k * len / n]);
  pts.slice(1).forEach((q, k) => pt.L(c, w * (1 - k / n * .55), pts[k], q));
  pts.slice(1, -1).forEach(([a, b], k) => { const r = w * (1 - k / n * .55) * .38; pt.L(hl, .6, [a - r, b - r * .9], [a + r, b + r * .3]); });
}
// cachos: bolinhas que formam a silhueta + um risco de brilho em metade delas
function curls(pt, c, hl, r, pts) {
  pts.forEach(([a, b]) => pt.E(c, a, b, r, r));
  pts.forEach(([a, b], k) => k % 2 || pt.L(hl, .7, [a - r * .55, b], [a - r * .1, b - r * .55], [a + r * .45, b - r * .3]));
}

// almir (pela foto): 40 e poucos, cabelo escuro penteado de lado com fios grisalhos, têmporas grisalhas, olheiras,
// bigode escuro ligado ao queixo branco (cavanhaque grisalho), camiseta preta com estampa branca, tatuagem em cada antebraço
const AL = { skin: ['#e6b79b', '#c48f73', '#f2d0b8'], hair: '#2b2622', gray: '#8a857f', silver: '#c4bfb8', tee: '#2b2d36', teeSh: '#1b1c22', tat: '#24476b', white: ['#eeede8', '#c8c6bf', '#9e9c95'] }; // white = camiseta branca do quadro "study"
function almirHead(pt, cx, cy, f) {
  const { skin, hair, gray, silver } = AL;
  head(pt, cx, cy, skin, f, { lips: '#a5675a', lipsLight: '#d49a85', under: () => inFace(pt, cx, cy, () => {
    pt.R(skin[1], cx - 6, cy + .5, 4, .5); pt.R(skin[1], cx + 2, cy + .5, 4, .5);               // olheiras
    pt.P(silver, [cx - 5, cy + 7.5], [cx + 5, cy + 7.5], [cx + 4, cy + 11.5], [cx, cy + 12.5], [cx - 4, cy + 11.5]); // queixo branco
    pt.P('#9d9892', [cx + 1, cy + 8], [cx + 5, cy + 7.5], [cx + 4, cy + 11.5], [cx + 1, cy + 12.3]);              // sombra do queixo
    pt.P('#4d4744', [cx - 4.5, cy + 4.6], [cx + 4.5, cy + 4.6], [cx + 5.2, cy + 8.5], [cx + 4, cy + 8.5], [cx + 3.5, cy + 6], [cx - 3.5, cy + 6], [cx - 4, cy + 8.5], [cx - 5.2, cy + 8.5]); // bigode descendo ao queixo
    pt.R('#6e6864', cx - 1, cy + 8, 2, 1.5);                                                     // mosca
  }) });
  // cabelo curto penteado de lado (risca à esquerda), fios grisalhos, têmporas grisalhas
  pt.E(hair, cx, cy - 8.8, 10.5, 5.3); pt.R(hair, cx - 11, cy - 9, 2.5, 6); pt.R(hair, cx + 8.5, cy - 9, 2.5, 6);
  pt.P(hair, [cx - 10, cy - 8], [cx - 6, cy - 13.5], [cx + 4, cy - 14.8], [cx + 10.5, cy - 11.5], [cx + 11, cy - 6], [cx + 6, cy - 9.5], [cx - 2, cy - 8.5], [cx - 9, cy - 5]);
  pt.L('#4a423c', .6, [cx - 6, cy - 13.2], [cx - 8.8, cy - 8]);                                   // risca
  pt.L(gray, .6, [cx - 4, cy - 12.6], [cx + 5, cy - 13.4]); pt.L(gray, .6, [cx - 5, cy - 10.5], [cx + 2, cy - 11.6]); pt.L(gray, .6, [cx + 4, cy - 10.6], [cx + 9, cy - 9.8]);
  pt.R(gray, cx - 11, cy - 6, 2.5, 4); pt.R(gray, cx + 8.5, cy - 6, 2.5, 4); pt.D(silver, [cx - 11, cy - 4], [cx + 10, cy - 4], [cx - 10, cy - 6]);
  pt.R(hair, cx - 7, cy - 5.2, 5, 1.2); pt.R(hair, cx + 2, cy - 5.2, 5, 1.2); pt.R(gray, cx - 7, cy - 5.2, 1, .6); pt.R(gray, cx + 6, cy - 5.2, 1, .6); // sobrancelhas
}
// pescoço, camiseta preta com estampa e gola (comum às duas poses). top = linha dos ombros
function almirTee(pt, cx, cy, top, bottom, w, tee = AL.tee, teeSh = AL.teeSh) {
  const { skin } = AL;
  pt.R(skin[1], cx - 3, cy + 9, 7, top - cy - 6); pt.R(skin[0], cx - 3, cy + 9, 4, 5);            // pescoço
  torso(pt, cx, top, tee, teeSh, bottom, w);
  pt.E(teeSh, cx, cy + 15, 5.5, 2.5); pt.E(skin[1], cx, cy + 14, 4, 1.6);                          // gola careca
}
// estampas da camiseta do almir com mais pixels que o resto da cena (pedido do usuário): cada uma num canvas próprio por cima
// do quadro (.hq__logo, criado depois do buildHq), posto em % da cena. [desenho, centro x, centro y, largura, altura, escala] na cena
// (o desenho usa largura × altura; a escala só encolhe na tela)
// cada cena tem uma lista: estudo = estampa dos ramones + adesivo do wu-tang na tampa do notebook de casa (pedido em 2026-11-13)
const LOGOS = { talk: [[dkLogo, 26, 49, 14.5, 16.5]], study: [[ramonesLogo, 82, 53.2, 22, 18, .85], [wuLogo, 81, 65.3, 8.2, 6.7]], team: [[wuLogo, 26, 51.6, 15.6, 12.7]] };
// wu-tang clan (team, camiseta preta), 3× os pixels da cena. contorno traçado da referência do usuário (2026-11-11), em coordenadas
// da imagem dela (logo em ~52–842 × 40–685): asas com a direita mais alta, o gancho em "s" entre elas (aberto em cima, bulbo à
// esquerda com a voltinha, ponta à direita), a tigela embaixo e a vírgula partindo a base. o vazado deixa ver a camiseta.
// desenhado em vetor e endurecido: cada pixel vira amarelo cheio ou nada
const WU_PATH = 'M122 83L367 145C335 170 325 230 358 268C368 280 388 286 397 274C401 266 392 256 382 254C376 252 372 247 372 241L460 200'
  + 'C482 210 497 245 495 280C512 270 525 245 520 215C512 185 495 165 475 155L715 44C800 110 840 220 835 330C830 450 760 570 640 630'
  + 'C590 655 535 670 485 678C520 580 528 470 500 428C485 410 455 405 440 418C415 440 410 480 425 520C440 555 458 580 470 600'
  + 'C330 605 190 550 110 450C60 380 50 290 70 200C80 150 100 110 122 83Z';
function wuLogo(w, h) {
  const P = S * 3, c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = w * P; c.height = h * P; x.scale(P, P); x.scale(w / 790, h / 645); x.translate(-52, -40);
  x.fillStyle = '#ffe234'; x.fill(new Path2D(WU_PATH));
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  x.putImageData(img, 0, 0);
  return c;
}
// dead kennedys (talk, camiseta preta), 2× os pixels da cena: círculo vermelho e os traços brancos do "dk" saindo do centro,
// cada um com contorno preto; cor de cada pixel pela distância aos traços
function dkLogo(w, h) {
  const P = S * 2, W = w * P, H = h * P, R = 6.5 * P, c = document.createElement('canvas'), x = c.getContext('2d');
  const SEG = [[0, -.2, 0, -1.2], [0, .2, 0, 1.2], [.15, -.1, .95, -.85], [.15, .15, .9, .85], [-.15, -.1, -.7, -.6], [-.15, .15, -.7, .9], [-.75, -.85, -.75, .9]] // k: haste, braços; d: haste, barrigas
    .map(s => s.map(v => v * R));
  const dist = (x, y, [a, b, c, d]) => { const dx = c - a, dy = d - b, t = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - a - t * dx, y - b - t * dy); };
  c.width = W; c.height = H;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const px = i + .5 - W / 2, py = j + .5 - H / 2, d = Math.min(...SEG.map(s => dist(px, py, s)));
    const col = d < .6 * P ? '#f2f2f2' : d < .9 * P ? AL.teeSh : Math.hypot(px, py) < R ? '#d4202a' : null;
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  }
  return c;
}
// ramones (study, camiseta branca), 3× os pixels da cena: "RAMONES" em cima e o selo (anel, nomes em volta, estrelinhas, águia com
// flechas, escudo listrado, ramo e taco). desenhado em vetor e depois endurecido: cada pixel vira tinta cheia ou nada (sem meio-tom)
function ramonesLogo(w, h) {
  const P = S * 3, c = document.createElement('canvas'), x = c.getContext('2d'), ink = '#1b1c22', paper = AL.white[0];
  c.width = w * P; c.height = h * P; x.scale(P, P); x.fillStyle = x.strokeStyle = ink; x.textAlign = 'center';
  x.font = '900 3.6px "Arial Black", Arial, sans-serif'; x.fillText('RAMONES', w / 2, 3.3, w - 3);
  x.translate(w / 2, 11.4);
  const ring = (r, lw) => { x.lineWidth = lw; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); };
  const poly = (fill, ...p) => { x.fillStyle = fill; x.beginPath(); p.forEach(([a, b]) => x.lineTo(a, b)); x.fill(); x.fillStyle = ink; };
  ring(6.35, .35);
  // nomes em volta, no sentido horário, topo das letras para fora; '*' = estrelinha
  const T = 'TOMMY * JOHNNY * JOEY * DEEDEE * ';
  x.font = '1.6px Georgia, serif'; x.textBaseline = 'middle';
  [...T].forEach((ch, i) => {
    const a = (148 + i * 360 / T.length) * Math.PI / 180;
    x.save(); x.rotate(a); x.translate(5.3, 0); x.rotate(Math.PI / 2);
    if (ch === '*') { x.beginPath(); x.arc(0, 0, .28, 0, 7); x.fill(); } else x.fillText(ch, 0, 0);
    x.restore();
  });
  for (let i = 0; i < 28; i++) { const a = i / 28 * 2 * Math.PI; x.beginPath(); x.arc(4.35 * Math.cos(a), 4.35 * Math.sin(a), .14, 0, 7); x.fill(); } // anel de estrelinhas
  // águia: flechas em leque, asas abertas, cabeça branca, escudo listrado, cauda; ramo à esquerda e taco à direita
  x.lineWidth = .14; [-1.1, -.55, 0, .55, 1.1].forEach(d => { x.beginPath(); x.moveTo(d * .3, -.9); x.lineTo(d, -3.3); x.stroke(); poly(ink, [d - .25, -3.1], [d, -3.6], [d + .25, -3.1]); });
  [-1, 1].forEach(s => {
    poly(ink, [s * .5, -.9], [s * 3.4, -2.7], [s * 3.6, -1.3], [s * 3.1, .1], [s * 1, .9]);
    x.strokeStyle = paper; x.lineWidth = .12; [-1.6, -.9, -.2].forEach(b => { x.beginPath(); x.moveTo(s * 1.1, b + .7); x.lineTo(s * 3.2, b - .6); x.stroke(); }); x.strokeStyle = ink;
  });
  x.beginPath(); x.ellipse(-.35, -1.25, .55, .5, 0, 0, 7); x.fill(); x.fillStyle = paper; x.beginPath(); x.ellipse(-.35, -1.25, .35, .3, 0, 0, 7); x.fill(); x.fillStyle = ink;
  poly(ink, [-.9, -.6], [.9, -.6], [.9, 1.3], [0, 2.1], [-.9, 1.3]); poly(paper, [-.7, -.4], [.7, -.4], [.7, .1], [-.7, .1]);  // escudo: faixa clara em cima
  x.strokeStyle = paper; x.lineWidth = .14; [-.45, 0, .45].forEach(d => { x.beginPath(); x.moveTo(d, .35); x.lineTo(d, 1.5); x.stroke(); }); x.strokeStyle = ink; // listras
  poly(ink, [-.8, 1.9], [.8, 1.9], [.3, 3.4], [0, 3.1], [-.3, 3.4]);                                                         // cauda
  x.lineCap = 'round'; [[paper, .9], [ink, .5]].forEach(([c, lw]) => { x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); x.moveTo(1.4, 2.7); x.lineTo(3.4, -1.9); x.stroke(); }); // taco, com respiro claro em volta
  x.lineWidth = .16; x.beginPath(); x.moveTo(-1.2, 1.9); x.quadraticCurveTo(-2.6, 1.4, -3.1, -.4); x.stroke();               // ramo
  [[-2.2, 1.5], [-2.7, .9], [-3, .2], [-2.4, .6], [-1.8, 1.4]].forEach(([a, b]) => { x.beginPath(); x.ellipse(a, b, .32, .16, -.8, 0, 7); x.fill(); });
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;                                                         // endurece
  for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] > 70, dark = d[i] < 140; d[i + 3] = on ? 255 : 0; if (on) [d[i], d[i + 1], d[i + 2]] = dark ? [27, 28, 34] : [238, 237, 232]; }
  x.putImageData(img, 0, 0);
  return c;
}
// estudando na mesa com um livro (quadro "study"), de camiseta branca dos ramones (pedido do usuário).
// o.cx / o.tee = posição e camiseta; o.work = sem livro, mãos no teclado (quadro "team", camiseta preta do wu-tang)
function almir(pt, f, o = {}) {
  const cx = o.cx ?? 82, cy = 28, { skin, tat } = AL, [tee, teeSh, teeDk] = o.tee || AL.white;
  const [hx, hy, ty] = o.work ? [10, 65, -3] : [12, 71, 0]; // ponta dos antebraços; no notebook (work) as mãos somem atrás da tampa e a tatuagem sobe junto
  almirTee(pt, cx, cy, 40, 66, 18, tee, teeSh);
  // braços: manga curta, braço e antebraço tatuados apoiados na mesa, mãos no livro
  limb(pt, tee, teeSh, 8, [cx - 16, 45], [cx - 19, 52]); limb(pt, teeSh, teeDk, 8, [cx + 16, 45], [cx + 19, 52]);
  limb(pt, skin[0], skin[1], 6, [cx - 19, 53], [cx - 21, 60], [cx - hx, hy]);
  checker(pt, '#262a33', cx - 20.3, 53.4, .28, 4.4, 6, 1.5);                                    // xadrez (mesmo do quadro "talk"), logo abaixo da manga
  limb(pt, skin[1], '#a6735a', 6, [cx + 19, 53], [cx + 21, 60], [cx + hx, hy]);
  pt.E(tat, cx + 17, 65 + ty, 2, 1.6); pt.E(skin[1], cx + 17, 65 + ty, 1, .7);                              // tatuagem antebraço direito
  pt.L(tat, 1, [cx + 20, 61 + ty], [cx + 19, 62 + ty]); pt.D(tat, [cx + 19, 63 + ty], [cx + 14, 68 + ty], [cx + 15, 67 + ty]);
  if (!o.work) {
    pt.P('#f4f1e8', [cx - 13, 66], [cx, 64], [cx, 76], [cx - 15, 78]); pt.P('#ddd7c8', [cx, 64], [cx + 13, 66], [cx + 15, 78], [cx, 76]); // livro aberto
    [68, 71, 74].forEach(b => { pt.L('#9a948c', 1, [cx - 10, b + 1], [cx - 3, b]); pt.L('#9a948c', 1, [cx + 3, b], [cx + 10, b + 1]); });
    if (f) pt.P('#ffffff', [cx, 64], [cx + 7, 59], [cx + 9, 72], [cx, 76]);                        // página virando
  }
  pt.E(skin[0], cx - hx, hy + 2, 3, 2.5); pt.E(skin[1], cx + hx, hy + 2, 3, 2.5);                         // mãos
  almirHead(pt, cx, cy, f);
}
// pernas de calça + sapatos (corpo inteiro). hip = linha da cintura, foot = chão
// pernas retas (polígonos: a ponta redonda do traço engolia o sapato), vão entre as pernas, barra da calça e sapato com bico pra fora
// tatuagem do almir (pela foto): arco por cima de uma grade 2×3 de quadrados pretos com uma bolinha de pele no meio de cada,
// linha embaixo e duas fileiras de binário. desenhada em miniatura (≈3,5×7) e girada ao longo do antebraço (ang em rad)
function almirTattoo(pt, x0, y0, ang, skin) {
  const x = pt.x, ink = '#262a33';
  x.save(); x.translate(x0, y0); x.rotate(ang);
  pt.L(ink, .5, [-2.2, -2.6], [-1.4, -3.9], [0, -4.4], [1.4, -3.9], [2.2, -2.6]);                   // arco
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    pt.R(ink, -2 + c * 2.25, -2.75 + r * 2, 1.75, 1.5); pt.R(skin, -1.4 + c * 2.25, -2.25 + r * 2, .6, .6);
  }
  pt.R(ink, -2.2, 3.5, 4.4, .45);                                                                   // linha
  for (let i = 0; i < 4; i++) { pt.R(ink, -2 + i * 1.15, 4.4, .7, .45); pt.R(ink, -1.6 + i * 1.15, 5.3, .7, .45); } // binário
  x.restore();
}
// xadrez de casas d×d (d = 1 → 2 pixels reais), recortado num retângulo w×h girado (ang) em volta de (x0, y0): o recorte acompanha
// o braço, as casas ficam retas na grade (girar as casas borraria o xadrez)
function checker(pt, c, x0, y0, ang, w, h, d = 1 / S) {
  const x = pt.x, r = Math.hypot(w, h) / 2;
  x.save(); x.translate(x0, y0); x.rotate(ang); x.beginPath(); x.rect(-w / 2, -h / 2, w, h); x.setTransform(S, 0, 0, S, 0, 0); x.clip();
  for (let b = Math.floor(y0 - r); b < y0 + r; b += d) for (let a = Math.floor(x0 - r); a < x0 + r; a += d)
    if ((Math.round(a / d) + Math.round(b / d)) % 2 === 0) pt.R(c, a, b, d, d);
  x.restore();
}
// tatuagem em pixel art (mapa de linhas, '1' = tinta; 1 caractere = 1 pixel real), girada sem borrar:
// cada pixel real da área busca o pixel do mapa na posição "desgirada" (vizinho mais próximo)
function pixelTattoo(pt, c, x0, y0, ang, map) {
  const d = 1 / S, W = map[0].length * d, H = map.length * d, r = Math.hypot(W, H) / 2, cs = Math.cos(ang), sn = Math.sin(ang);
  for (let b = Math.floor(y0 - r); b < y0 + r; b += d) for (let a = Math.floor(x0 - r); a < x0 + r; a += d) {
    const dx = a + d / 2 - x0, dy = b + d / 2 - y0, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
    if (map[Math.floor((v + H / 2) / d)]?.[Math.floor((u + W / 2) / d)] === '1') pt.R(c, a, b, d, d);
  }
}
// cruz de malta do vasco (cruz pátea): quatro braços que alargam para fora, com vãos em diagonal entre eles
const MALTA = ['..1111111..', '...11111...', '1..11111..1', '111.111.111', '11111111111', '11111111111', '11111111111', '111.111.111', '1..11111..1', '...11111...', '..1111111..'];
// escorpião visto de cima: ferrão e cauda em cima, corpo com patas, pinças embaixo
const SCORPION = [
  '...11....',
  '..1..1...',
  '.....1...',
  '....1....',
  '....1....',
  '...111...',
  '1.11111.1',
  '.1.111.1.',
  '1.11111.1',
  '..11111..',
  '.1.....1.',
  '11.....11',
];
function legs(pt, cx, hip, foot, jeans, jeansSh, shoe) {
  const h = foot - 4;
  pt.P(jeans, [cx - 10, hip], [cx, hip], [cx, hip + 10], [cx - 2, h], [cx - 10, h]); pt.P(jeansSh, [cx - 2.5, hip + 10], [cx, hip + 10], [cx - 2, h], [cx - 4, h]);
  pt.P(jeans, [cx, hip], [cx + 10, hip], [cx + 10, h], [cx + 2, h], [cx, hip + 10]); pt.P(jeansSh, [cx + 7.5, hip], [cx + 10, hip], [cx + 10, h], [cx + 8, h]);
  pt.R(jeansSh, cx - 10, h - 1, 8, 1); pt.R(jeansSh, cx + 2, h - 1, 8, 1);                          // barra
  pt.P(shoe, [cx - 10, h], [cx - 2, h], [cx - 2, foot], [cx - 13, foot], [cx - 13.5, foot - 1.5], [cx - 11.5, h + .6]); // sapato esquerdo
  pt.P(shoe, [cx + 2, h], [cx + 10, h], [cx + 11.5, h + .6], [cx + 13.5, foot - 1.5], [cx + 13, foot], [cx + 2, foot]); // sapato direito
  pt.R(INK, cx - 13, foot - .7, 11, .7); pt.R(INK, cx + 2, foot - .7, 11, .7);                      // sola
}
// de pé, corpo inteiro, desabafando com o rafael (quadro "talk"): mão atrás da cabeça, a outra aberta pra ele
function almirStand(pt, f) {
  const cx = 26, cy = 22, { skin, tee, teeSh, tat } = AL;
  legs(pt, cx, 60, 97, '#3a4660', '#2a3348', '#1c1c22');
  pt.R('#5d3a28', cx - 11, 58, 22, 2.5);                                                            // cinto
  almirTee(pt, cx, cy, 34, 60, 16);
  limb(pt, tee, teeSh, 7, [cx - 14, 38], [cx - 19, 33]); limb(pt, skin[0], skin[1], 5, [cx - 19, 32], [cx - 23, 26], [cx - 14, 16 + f * .5]); // mão atrás da cabeça
  almirTattoo(pt, cx - 19.3, 20.5, .73, skin[0]);                                                  // tatuagem da foto no antebraço
  pixelTattoo(pt, '#262a33', cx - 20.5, 29.6, 0, SCORPION);                                         // escorpião no braço, acima da manga                                        // tatuagem xadrez no braço, logo acima da manga
  pt.E(skin[0], cx - 12, 15 + f * .5, 3, 3);                                                        // mão (a cabeça passa por cima)
  limb(pt, teeSh, '#141519', 7, [cx + 14, 38], [cx + 18, 45]); limb(pt, skin[1], '#a6735a', 5, [cx + 18, 46], [cx + 22, 54], [cx + 31, 50 - f]); // mão aberta pro rafael
  pt.E(tat, cx + 22, 51, 1.6, 1.3); pt.E(skin[1], cx + 22, 51, .7, .5);
  almirHead(pt, cx, cy, f);
  pt.E(skin[1], cx + 33, 49 - f, 3, 2.2); pt.D(skin[0], [cx + 34, 47 - f], [cx + 35, 48 - f]);
}

// rafael (pela foto): na casa dos 40, cabelo castanho-escuro ondulado penteado pra trás, barba cheia escura com o queixo grisalho,
// vascaíno: camisa preta com a faixa diagonal branca e a cruz vermelha. jeans claro. de pé, corpo inteiro, explicando com as mãos abertas
function rafael(pt, f) {
  const cx = 124, cy = 24, skin = ['#e3b08f', '#c08868', '#f2cdb0'], hair = '#3a2a20', hl = '#6a4e3c', beard = '#4a3428', beardSh = '#3a281f', polo = '#24242b', poloSh = '#141418';
  legs(pt, cx, 60, 97, '#8fb0d6', '#6d8fb8', '#4a3528');
  pt.R('#5d3a28', cx - 11, 58, 22, 2.5);
  pt.R(skin[1], cx - 3, cy + 8, 7, 10); pt.R(skin[0], cx - 3, cy + 8, 4, 8);                        // pescoço à mostra
  torso(pt, cx, 36, polo, poloSh, 60, 16);
  pt.P('#f2f2f2', [cx + 15, 38], [cx + 9, 36.5], [cx - 11, 60], [cx - 4, 60]); // faixa diagonal: do ombro esquerdo dele (direita de quem olha) ao quadril direito
  pixelTattoo(pt, '#d4202a', cx + 7, 43.5, 0, MALTA);                                                // cruz de malta vermelha na faixa, na altura do peito
  pt.E(poloSh, cx, 38.5, 5, 2); pt.E(skin[1], cx, 37.8, 3.6, 1.4); pt.L('#f2f2f2', .6, [cx - 5, 38.2], [cx, 40.4], [cx + 5, 38.2]); // gola com friso branco (fixa no ombro; a cabeça desceu 2 para encurtar o pescoço)
  limb(pt, polo, poloSh, 7, [cx + 14, 38], [cx + 18, 45]); limb(pt, skin[1], '#a6735a', 5, [cx + 18, 46], [cx + 20, 53], [cx + 19, 59]); // braço solto ao lado do corpo
  limb(pt, polo, poloSh, 7, [cx - 14, 38], [cx - 18, 45]); limb(pt, skin[0], skin[1], 5, [cx - 18, 46], [cx - 21, 54], [cx - 30, 52 - f]); // explica pro almir
  pt.E(skin[0], cx - 32, 51 - f, 3, 2.2); pt.D(skin[1], [cx - 34, 49 - f], [cx - 35, 50 - f]);
  pt.E(skin[1], cx + 19, 60.5, 2.4, 2.6);
  head(pt, cx, cy, skin, f, { lips: beard, lipsLight: beard, iris: '#3a2618', under: () => inFace(pt, cx, cy, () => {
    pt.P(beard, [cx - 9.5, cy - 3], [cx - 7.5, cy + 2], [cx - 4, cy + 3.8], [cx + 4, cy + 3.8], [cx + 7.5, cy + 2], [cx + 9.5, cy - 3], [cx + 10, cy + 14], [cx - 10, cy + 14]); // barba cheia
    pt.P(beardSh, [cx + 3, cy + 4], [cx + 7.5, cy + 2], [cx + 9.5, cy - 3], [cx + 10, cy + 14], [cx + 3, cy + 14]); // sombra da barba
  }) });
  // barba só no rosto (sem descer pelo pescoço, a pedido: parecia papada); fios grisalhos no queixo
  pt.E(beard, cx + 1, cy + 9.5, 4.3, 1.5);                                                            // cobre a sombra de pele que o head() põe sob o queixo
  pt.R('#8f8a85', cx - 1.5, cy + 8.5, .5, 1.5); pt.R('#a9a49e', cx, cy + 9, .5, 2); pt.R('#8f8a85', cx + 1.5, cy + 8.5, .5, 1.5);
  // boca própria dentro da barba (a do head() some na barba: lábio claro e largo virava focinho)
  pt.P(beard, [cx - 4.5, cy + 4.4], [cx + 4.5, cy + 4.4], [cx + 5, cy + 6.4], [cx + 3, cy + 5.5], [cx - 3, cy + 5.5], [cx - 5, cy + 6.4]); // bigode caindo nos cantos
  if (f) { pt.R('#3a1a18', cx - 2, cy + 5.8, 5, 2); pt.R('#f4f1ea', cx - 1.5, cy + 5.8, 4, .6); }   // falando: boca aberta, dentes de cima
  else pt.R('#a8675a', cx - 2, cy + 6.4, 5, .6);                                                        // fechada: só o lábio de baixo
  // cabelo ondulado penteado pra trás, entradas leves
  pt.E(hair, cx, cy - 8.5, 11, 6); pt.R(hair, cx - 11, cy - 9, 2.5, 7); pt.R(hair, cx + 8.5, cy - 9, 2.5, 7);
  pt.P(hair, [cx - 10, cy - 7], [cx - 8, cy - 13], [cx, cy - 15.5], [cx + 8, cy - 13.5], [cx + 11.5, cy - 8], [cx + 9, cy - 6], [cx + 4, cy - 9.5], [cx - 4, cy - 9.5], [cx - 8, cy - 6]);
  pt.L(hl, .6, [cx - 7, cy - 10], [cx - 3, cy - 12.5], [cx + 2, cy - 13], [cx + 6, cy - 11]); pt.L(hl, .6, [cx - 5, cy - 13], [cx, cy - 14.5], [cx + 4, cy - 14]);
  pt.R(beard, cx - 7, cy - 5.3, 5, 1.3); pt.R(beard, cx + 2, cy - 5.3, 5, 1.3);                       // sobrancelhas
}

// millena (pela foto): vinte e poucos, cabelo castanho-escuro bem cacheado e volumoso, sobrancelhas grossas, bochechas coradas,
// sorriso de boca fechada, brinco laranja, colar dourado, sem óculos. blusa verde-água, mão erguida para o "toca aqui"
function millena(pt, f, study = false, o = {}) { // study: sentada digitando (mãos atrás da tampa do notebook). o.cx / o.top = posição e roupa (quadro "team")
  const cx = o.cx ?? (study ? 62 : 32), cy = 30, skin = ['#e4b08c', '#c38866', '#f3cdaa'], hair = '#1d1411', hl = '#5a3a2a', [top, topSh, topDk] = o.top || ['#1f9e8f', '#157568', '#0f5c52'];
  // volume atrás: massa escura + mechas em espiral nas bordas e nas costas
  pt.E(hair, cx, cy - 3, 13, 12); pt.P(hair, [cx - 13, cy - 4], [cx + 13, cy - 4], [cx + 14, cy + 22], [cx - 14, cy + 22]);
  pt.E(hl, cx - 5, cy - 12, 3.2, 1.2, -.3);                                                   // brilho no alto da cabeça
  [[cx - 14.5, cy - 2, 29], [cx - 12.5, cy - 2, 32], [cx - 9.5, cy + 6, 26], [cx + 14.5, cy - 2, 27], [cx + 12.5, cy - 2, 33], [cx + 9.5, cy + 6, 26]]
    .forEach(([a, b, len], k) => ringlet(pt, k % 3 === 1 ? '#2a1c17' : hair, hl, a, b, len, 4.6, 1.6));
  // contorno do alto da cabeça: ondas irregulares, não bolinhas
  pt.L(hair, 3, [cx - 12, cy - 9], [cx - 9, cy - 13.5], [cx - 5, cy - 14.2], [cx - 1, cy - 15.6], [cx + 4, cy - 14.4], [cx + 8, cy - 13.6], [cx + 12, cy - 9.5]);
  pt.L(hl, .6, [cx - 8, cy - 12], [cx - 6, cy - 13.2], [cx - 4, cy - 12.4]); pt.L(hl, .6, [cx + 2, cy - 13.2], [cx + 4, cy - 14], [cx + 6, cy - 13]);
  pt.R(skin[1], cx - 2, cy + 9, 5, 7);
  torso(pt, cx, 42, top, topSh, 66, 15);
  pt.P(skin[1], [cx - 4, cy + 13], [cx + 4, cy + 13], [cx, cy + 18]);                         // decote em v
  pt.L('#d9a441', .6, [cx - 4, cy + 13], [cx, cy + 16], [cx + 4, cy + 13]); pt.E('#7a3b2a', cx, cy + 16.6, .8, .8); // colar com pingente
  if (study) {
    limb(pt, top, topSh, 7, [cx - 13, 47], [cx - 16, 54]); limb(pt, skin[0], skin[1], 5, [cx - 16, 55], [cx - 16, 62], [cx - 9 + f, 66]);
    limb(pt, topSh, topDk, 7, [cx + 13, 47], [cx + 16, 54]); limb(pt, skin[1], '#a6735a', 5, [cx + 16, 55], [cx + 16, 62], [cx + 9 - f, 66]);
  } else {
    limb(pt, top, topSh, 7, [cx - 13, 47], [cx - 16, 54]); limb(pt, skin[0], skin[1], 5, [cx - 16, 55], [cx - 18, 61], [cx - 7, 70]); // braço na mesa
    pt.E(skin[0], cx - 6, 71, 2.5, 2);
    const hx = f ? 0 : -2;                                                                      // mão encontra a do andré no quadro 2
    limb(pt, top, topSh, 7, [cx + 13, 47], [cx + 18, 41]); limb(pt, skin[0], skin[1], 5, [cx + 18, 40], [cx + 22, 31], [cx + 25 + hx, 21]);
    pt.E(skin[0], cx + 25 + hx, 17, 2.5, 3.5); pt.D(skin[1], [cx + 26 + hx, 14], [cx + 27 + hx, 16]);
  }
  head(pt, cx, cy, skin, f, { closed: 1, lips: '#b4565e', lipsLight: '#e08a8c', iris: '#2b1a14', blush: '#e8968a' });
  // franja: risca de lado, testa à mostra; mechas em espiral emoldurando o rosto e caindo na frente dos ombros
  pt.P(hair, [cx - 11, cy - 5], [cx - 7, cy - 12.5], [cx + 7, cy - 12.5], [cx + 11, cy - 5], [cx + 6, cy - 9.5], [cx - 1, cy - 10], [cx - 7, cy - 8.5], [cx - 9, cy + 1]);
  pt.L(hl, .6, [cx - 6, cy - 10.5], [cx - 2, cy - 11.6], [cx + 3, cy - 11.2]);
  ringlet(pt, hair, hl, cx - 10.5, cy - 8, 36, 4.4, 1.5); ringlet(pt, hair, hl, cx - 13, cy - 3, 30, 3.8, 1.4);
  ringlet(pt, hair, hl, cx + 10.5, cy - 8, 32, 4.4, 1.5);
  pt.R('#1c1210', cx - 6.5, cy - 5.5, 4.5, 1.2); pt.D('#1c1210', [cx - 7.5, cy - 4.5]); pt.R('#1c1210', cx + 2, cy - 5.5, 4.5, 1.2); pt.D('#1c1210', [cx + 6.5, cy - 4.5]); // sobrancelhas grossas
  // sem óculos (tirados a pedido em 2026-11-13; a armação está em _restauracao/2026-11-13-antes-de-tirar-oculos/)
}

// andré (pela foto): vinte e poucos, cabelo preto curto e cacheado (volume em cima, lados baixos), sobrancelhas retas e grossas,
// barba por fazer fechada no maxilar, sorrisão. moletom azul-marinho com cordão, mão erguida para o "toca aqui"
function andre(pt, f, study = false, o = {}) { // study: sentado, mãos no teclado e headset. o.cx = posição; o.tee = camiseta preta de manga curta (quadro "team")
  const cx = o.cx ?? (study ? 86 : 84), cy = 29, skin = ['#ebc2a0', '#c9977a', '#f8dcc2'], hair = '#16131a', hl = '#3d3846';
  const [top, topSh, topDk] = o.tee ? ['#24242b', '#141418', '#0c0c10'] : ['#33405e', '#222b42', '#182035'];
  pt.R(skin[1], cx - 3, cy + 9, 7, 8); pt.R(skin[0], cx - 3, cy + 9, 4, 5);
  torso(pt, cx, 41, top, topSh, 66, 17);
  if (o.tee) { pt.E(topSh, cx, cy + 14.5, 5.5, 2.5); pt.E(skin[1], cx, cy + 13.6, 4, 1.6); }           // gola careca
  else {
    pt.E(topSh, cx, cy + 15, 8.5, 3.6); pt.E(top, cx - 1, cy + 14.5, 7.5, 2.8); pt.E(skin[1], cx, cy + 13.8, 4.2, 1.6); // capuz em volta do pescoço
    pt.L('#dfe4ee', .7, [cx - 2.5, cy + 17], [cx - 3, cy + 25]); pt.L('#dfe4ee', .7, [cx + 2.5, cy + 17], [cx + 3, cy + 24]); // cordão
    pt.L(topSh, 1, [cx - 9, 60], [cx + 7, 60]);                                                // bolso canguru
  }
  // antebraços: manga longa do moletom ou pele (camiseta). [luz, sombra] do braço direito (lado da sombra) e do esquerdo
  const hy = o.lap ? 65 : 67; // ponta dos antebraços: mãos em cima do teclado; no notebook (lap) somem atrás da tampa
  const [faR, faL] = o.tee ? [[skin[1], '#a6735a'], [skin[0], skin[1]]] : [[topSh, topDk], [top, topSh]];
  limb(pt, topSh, topDk, 8, [cx + 15, 46], [cx + 18, 53]); limb(pt, ...faR, 6, [cx + 18, 54], [cx + 20, 61], [cx + 11, hy]); // braço na mesa
  pt.E(skin[1], cx + 9, hy + 2, 3, 2.5);
  if (study) { limb(pt, top, topSh, 8, [cx - 15, 46], [cx - 18, 53]); limb(pt, ...faL, 6, [cx - 18, 54], [cx - 20, 61], [cx - 11 + f, hy]); pt.E(skin[0], cx - 9 + f, hy + 2, 3, 2.5); }
  else {
    const hx = f ? 0 : 2;
    limb(pt, top, topSh, 8, [cx - 15, 46], [cx - 19, 40]); limb(pt, top, topSh, 6, [cx - 19, 39], [cx - 23, 30], [cx - 25 + hx, 23]);
    pt.E(skin[0], cx - 26 + hx, 17, 2.5, 3.5); pt.D(skin[1], [cx - 25 + hx, 14], [cx - 24 + hx, 16]);
  }
  head(pt, cx, cy, skin, f, { smile: 1, lips: '#b06a5a', iris: '#3a3028', under: () => inFace(pt, cx, cy, () => {
    const jaw = [[cx - 9.5, cy - 3], [cx - 8, cy + 2.5], [cx - 5, cy + 3.6], [cx - 2, cy + 4.3], [cx + 2, cy + 4.3], [cx + 5, cy + 3.6], [cx + 8, cy + 2.5], [cx + 9.5, cy - 3], [cx + 10, cy + 14], [cx - 10, cy + 14]];
    pt.P('#b9927c', ...jaw);                                                                   // barba por fazer: sombra lisa no maxilar
  }) });
  // cachos curtos: volume em cima, lados baixos
  pt.E(hair, cx, cy - 8.5, 10.5, 5.5); pt.R(hair, cx - 10.5, cy - 8, 1.8, 6); pt.R(hair, cx + 8.7, cy - 8, 1.8, 6);
  curls(pt, hair, hl, 2.7, [[cx - 8, cy - 11], [cx - 3.5, cy - 14], [cx + 1.5, cy - 14.8], [cx + 6.5, cy - 13.5], [cx + 9, cy - 10],
    [cx - 5, cy - 9.5], [cx + 0, cy - 11], [cx + 5, cy - 10], [cx - 2, cy - 8], [cx + 3, cy - 7.8]]);
  pt.R(hair, cx - 7, cy - 5.3, 5, 1.4); pt.R(hair, cx + 2, cy - 5.3, 5, 1.4);                  // sobrancelhas retas e grossas
  if (study && !o.tee) { // headset: arco por cima dos cachos, conchas com luz azul (só na cena de estudo dele)
    pt.L('#2b2f3a', 1.6, [cx - 10.5, cy - 1], [cx - 9.5, cy - 10], [cx, cy - 15.5], [cx + 9.5, cy - 10], [cx + 10.5, cy - 1]);
    pt.R('#2b2f3a', cx - 12.5, cy - 3, 4, 7); pt.R('#2b2f3a', cx + 8.5, cy - 3, 4, 7); pt.R('#00c2ff', cx - 11.5, cy - 1, 1, 3); pt.R('#00c2ff', cx + 10.5, cy - 1, 1, 3);
  }
}
const millenaStudy = (pt, f) => millena(pt, f, true), andreStudy = (pt, f) => andre(pt, f, true);
// notebook da millena, de costas para nós (na frente dela): tampa com adesivos
function laptop(pt) {
  const cx = 62;
  pt.R('#8f98a5', cx - 17, 69, 34, 3);
  pt.R('#9aa3af', cx - 14, 53, 28, 17); pt.R('#c5ccd6', cx - 14, 53, 25, 15);
  pt.E('#ff8fb1', cx - 6, 59, 2.5, 2.5); pt.R('#3b5dc9', cx + 2, 60, 7, 5); pt.R('#ffffff', cx + 3, 61, 2, 1); pt.R('#ffffff', cx + 6, 63, 2, 1); pt.R('#ffcd75', cx - 10, 64, 5, 2);
}

// robô do "antes": cabeça de caixa, visor, antena, digitando no automático
function robot(pt, f) {
  const cx = 46, g = ['#c9d2db', '#9aa6b2', '#e8edf2'];
  pt.L(g[1], 2, [cx, 10], [cx, 16]); pt.E(f ? '#e8434f' : '#ffcd75', cx, 9, 2.5, 2.5);       // antena
  pt.R(g[1], cx - 15, 16, 31, 24); pt.R(g[0], cx - 15, 16, 27, 21); pt.R(g[2], cx - 13, 18, 6, 2); // cabeça
  pt.R('#2b3440', cx - 11, 22, 23, 9);                                     // visor
  pt.R(f ? '#2b3440' : '#00c2ff', cx - 8, 25, 5, 3); pt.R(f ? '#00c2ff' : '#2b3440', cx + 4, 25, 5, 3); // olhos alternando
  pt.R(g[1], cx - 6, 33, 13, 2);                                            // boca grade
  pt.R(g[1], cx - 4, 40, 9, 4);                                             // pescoço
  pt.R(g[1], cx - 19, 44, 39, 22); pt.R(g[0], cx - 19, 44, 34, 20);           // corpo
  pt.R('#2b3440', cx - 9, 49, 18, 9); pt.R('#e8434f', cx - 6, 52, 3, 3); pt.R('#ffcd75', cx - 1, 52, 3, 3); pt.R(f ? '#38b764' : '#257953', cx + 4, 52, 3, 3);
  pt.L(g[1], 6, [cx - 20, 48], [cx - 22, 60], [cx - 12 + f * 3, 70]); pt.L(g[1], 6, [cx + 20, 48], [cx + 24, 60], [cx + 16 - f * 3, 70]); // braços digitando
}

// robô-cúpula de um olho só (laranja), resetando senha
function botPass(pt, f) {
  const cx = 40, o = ['#f2a03d', '#c97a22', '#ffc874'];
  pt.E(o[1], cx, 27, 14, 13); pt.E(o[0], cx - 1, 26, 12.5, 11.5); pt.E(o[2], cx - 6, 19, 4, 2);     // cúpula
  pt.R(o[1], cx - 14, 30, 28, 6); pt.R(o[0], cx - 14, 30, 25, 4);                                     // aba
  pt.E(INK, cx, 24, 6, 6); pt.E(f ? '#00c2ff' : '#7fe3ff', cx, 24, 4, 4); pt.R('#ffffff', cx - 2, 22, 2, 2); // olho único
  pt.R(o[1], cx - 3, 36, 6, 4);                                                                        // pescoço
  pt.R(o[1], cx - 15, 40, 30, 26); pt.R(o[0], cx - 15, 40, 26, 24);                                   // corpo
  pt.R('#2b3440', cx - 9, 46, 18, 8); [0, 1, 2, 3].forEach(j => pt.R('#ffffff', cx - 7 + j * 4, 49, 2, 2)); // peito: ****
  pt.L(o[1], 5, [cx - 15, 44], [cx - 18, 58], [cx - 8 + f * 3, 69]); pt.L(o[1], 5, [cx + 15, 44], [cx + 19, 58], [cx + 10 - f * 3, 69]); // digitando
}
// robô alto e magro (verde-água), duas antenas, ao lado da impressora digitando num notebook (de costas para nós, mãos atrás
// da tampa, uma de cada vez por quadro): não consegue acessar o software de gerenciamento da impressora (pedido em 2026-11-13)
function botPrint(pt, f) {
  const cx = 46, g = ['#3fb6a8', '#2b8a7f', '#7fe0d3'];
  pt.L(g[1], 1.5, [cx - 5, 9], [cx - 8, 3]); pt.L(g[1], 1.5, [cx + 5, 9], [cx + 8, 3]);                // antenas piscando
  pt.E(f ? '#e8434f' : '#ffcd75', cx - 8, 3, 1.8, 1.8); pt.E(f ? '#ffcd75' : '#e8434f', cx + 8, 3, 1.8, 1.8);
  pt.R(g[1], cx - 10, 8, 21, 18); pt.R(g[0], cx - 10, 8, 18, 16); pt.R(g[2], cx - 8, 10, 5, 2);       // cabeça
  pt.R(INK, cx - 7, 13, 5, 5); pt.R(INK, cx + 2, 13, 5, 5); pt.R('#ffffff', cx - 6, 14, 2, 2); pt.R('#ffffff', cx + 3, 14, 2, 2);
  pt.L(INK, 1, [cx - 5, 21], [cx - 3, 20], [cx - 1, 21], [cx + 1, 20], [cx + 3, 21], [cx + 5, 20]); // boca tremida
  if (f) pt.E('#9be7ff', cx + 13, 12, 1.2, 2);                                                         // gota de suor
  pt.R(g[1], cx - 3, 26, 7, 3);
  pt.R(g[1], cx - 9, 29, 19, 36); pt.R(g[0], cx - 9, 29, 16, 34);                                      // corpo
  pt.E('#2b3440', cx - 1, 40, 4, 4); pt.L('#ffcd75', 1, [cx - 1, 40], [cx + 1 + f, 37 + f]);          // ponteiro de pressão
  pt.L(g[1], 4, [cx - 9, 32], [cx - 18, 43], [cx - 17, 52], [cx - 8, 57 - f * 2]); pt.L(g[1], 4, [cx + 9, 32], [cx + 18, 43], [cx + 17, 52], [cx + 7, 55 + f * 2]); // braços digitando: cotovelos para fora da tampa
  pt.E(g[0], cx - 17, 47, 2, 2); pt.E(g[0], cx + 17, 47, 2, 2);                                       // juntas dos cotovelos
  pt.R('#8f98a5', cx - 17, 62, 34, 3);                                                                 // notebook: base
  pt.R('#9aa3af', cx - 14, 46, 28, 17); pt.R('#c5ccd6', cx - 14, 46, 25, 15);                          // tampa
  pt.E('#e8434f', cx - 6, 52, 2.5, 2.5); pt.R('#3fb6a8', cx + 2, 53, 7, 5); pt.R('#ffffff', cx + 3, 54, 2, 1); pt.R('#ffcd75', cx - 10, 57, 5, 2); // adesivos
}
/* ---------- cenários (pixels "duros", sem pixelizar) ---------- */
function deskBg(pt, top = '#8a5f43', front = '#6e4a33', W = HW) {
  pt.R(top, 0, 64, W, 12); pt.R('#9c6e50', 0, 64, W, 1);
  pt.R(front, 0, 76, W, 16); pt.R('#5d3a28', 0, 76, W, 2);
  pt.R('#5d3a28', 8, 92, 6, 8); pt.R('#5d3a28', W - 14, 92, 6, 8);
}
const BG = {
  bot(pt, f) {
    pt.R('#d7dee6', 0, 0, HW, 64); pt.R('#c5cdd6', 0, 56, HW, 8);
    pt.R('#f4f4f4', 120, 8, 18, 18); pt.R(INK, 128, 12, 2, 6); pt.R(INK, 128, 17, f ? 6 : 1, 2);      // relógio
    pt.R(INK, 78, 18, 44, 34); pt.R('#12202e', 80, 20, 40, 30);                                         // monitor
    [[30, 18], [22, 34], [36, 26], [16, 30], [28, 12]].forEach(([a, b], j) => pt.R('#38b764', 83, 23 + j * 5, f ? b : a, 2));
    pt.R(INK, 96, 52, 8, 6);
    deskBg(pt, '#8f969e', '#737a83');
    pt.R('#3a3f48', 26, 66, 40, 6); for (let j = 0; j < 8; j++) pt.R('#5a606a', 28 + j * 5, 67, 3, 2);  // teclado
    for (let j = 0; j < 6 + f * 2; j++) pt.R(j % 2 ? '#e8edf2' : '#ffffff', 126, 62 - j * 2, 16, 2);    // pilha de chamados
  },
  study(pt, f) {
    pt.R('#2b2f4f', 0, 0, HW, 64);
    pt.R('#5d3a28', 8, 6, 40, 32); pt.R('#0d1024', 10, 8, 36, 28);                                      // janela
    pt.E('#ffcd75', 36, 15, 4, 4); pt.E('#0d1024', 38, 14, 3, 3);                                         // lua
    [[16, 12], [24, 26], [14, 30], [42, 30], [28, 14]].forEach(([a, b], j) => (j + f) % 2 && pt.R('#ffffff', a, b, 1, 1));
    for (let j = 0; j < 30; j++) pt.R(f ? '#363b5e' : '#3a4066', Math.round(122 - j * .7), 30 + j, Math.round(10 + j * 1.4), 1); // cone de luz
    pt.R('#ffcd75', 118, 24, 16, 6); pt.R('#7d8a99', 130, 30, 2, 34);                                    // luminária
    deskBg(pt);
    // livros (de baixo pra cima), centrados em x 28, 5 de altura; os títulos vêm por cima em texto (.hq__books no html)
    [['#ffcd75', 34], ['#3b5dc9', 30], ['#38b764', 33], ['#e8434f', 28], ['#b100dd', 31]].forEach(([c, w], j) => pt.R(c, 28 - w / 2, 60 - j * 5, w, 5));
  },
  // millena estudando à noite: quarto lilás, varal de luzinhas, janela com a cidade, estante com planta, notas na parede, caneca e caderno
  studyM(pt, f) {
    pt.R('#3a2f55', 0, 0, HW, 64); pt.R('#33294c', 0, 56, HW, 8);
    pt.R('#5d3a28', 6, 16, 30, 32); pt.R('#141633', 8, 18, 26, 28); pt.E('#ffe9a8', 28, 23, 2.5, 2.5);       // janela, lua
    [[9, 32, 6], [16, 26, 6], [23, 35, 10]].forEach(([a, t, w]) => { pt.R('#252a4d', a, t, w, 46 - t); pt.R(f ? '#ffcd75' : '#ffe9a8', a + 2, t + 3, 1, 1); pt.R(f ? '#ffe9a8' : '#ffcd75', a + w - 2, t + 7, 1, 1); });
    const wy = a => 5 + 5 * Math.sin(Math.PI * (a % 30) / 30);                                              // varal de luzinhas, piscando alternado
    pt.L('#6b5d8a', .6, ...Array.from({ length: 31 }, (_, k) => [k * 5, wy(k * 5)]));
    for (let a = 5; a < HW; a += 10) pt.R((a / 10 + f) % 2 < 1 ? '#ffcd75' : '#ff8fb1', a - 1, wy(a), 2, 2);
    pt.R('#6e4a33', 104, 30, 40, 2); [['#ff8fb1', 9], ['#9be7ff', 11], ['#ffcd75', 10], ['#b9aee0', 8]].forEach(([c, h], j) => pt.R(c, 106 + j * 4, 30 - h, 3, h)); // estante
    pt.R('#c0583a', 128, 23, 8, 7); pt.E('#38b764', 130, 20, 3, 4, -.4); pt.E('#257953', 135, 19, 3, 5, .4);   // vaso
    [[108, 38, '#ffe14d'], [118, 36, '#ff8fb1'], [128, 39, '#9be7ff'], [113, 46, '#9be7ff'], [124, 47, '#ffe14d']].forEach(([a, b, c]) => { pt.R(c, a, b, 7, 7); pt.R('#6b5d8a', a + 1, b + 3, 5, 1); }); // notas
    deskBg(pt);
    pt.R('#ffffff', 100, 57, 7, 8); pt.R('#ffffff', 107, 59, 2, 3); pt.R('#ff8fb1', 100, 59, 7, 2); pt.R('#c9c3d9', 102 + f, 50, 1, 4); pt.R('#c9c3d9', 105 - f, 48, 1, 5); // caneca
    pt.P('#f4f1e8', [114, 66], [128, 64], [128, 73], [113, 75]); pt.P('#ddd7c8', [128, 64], [142, 66], [143, 75], [128, 73]); // caderno
    [67, 70].forEach(b => { pt.L('#3b5dc9', .6, [116, b + 1], [126, b]); pt.L('#9a948c', .6, [130, b], [140, b + 1]); });
    pt.L('#ffcd75', 1.2, [134, 77], [146, 70]);                                                              // lápis
  },
  // andré estudando de madrugada: quarto escuro, monitor grande com código colorido, fita de led, relógio 02:00, energético e o patinho do debug
  studyA(pt, f) {
    pt.R('#20263a', 0, 0, HW, 64); pt.R('#1b2032', 0, 56, HW, 8);
    pt.R('#00c2ff', 0, 54, HW, 1); pt.R('#1d4a6b', 0, 55, HW, 1);                                            // fita de led
    pt.R('#2a3550', 2, 14, 56, 46);                                                                          // brilho do monitor na parede
    pt.R(INK, 6, 18, 48, 36); pt.R('#0d1424', 8, 20, 44, 32);                                                 // monitor
    [[0, '#ff79c6', 10], [4, '#8be9fd', 16], [4, '#50fa7b', 12], [8, '#f1fa8c', 14], [8, '#8be9fd', 10], [4, '#bd93f9', 18], [0, '#ff79c6', 6]]
      .forEach(([ind, c, w], j) => { pt.R(c, 11 + ind, 23 + j * 4, w, 2); pt.R('#6272a4', 13 + ind + w, 23 + j * 4, 6, 2); });
    pt.R(f ? '#f8f8f2' : '#0d1424', 11, 51, 3, 1);                                                           // cursor
    pt.R(INK, 27, 54, 6, 9); pt.R('#3a3f48', 22, 62, 16, 2);
    pt.R('#3a3046', 104, 22, 40, 2); [['#e8434f', 10], ['#3b5dc9', 12], ['#ffcd75', 9]].forEach(([c, h], j) => pt.R(c, 106 + j * 4, 22 - h, 3, h)); // estante
    pt.R('#5a606a', 124, 15, 10, 7); pt.R('#3a3f48', 126, 17, 2, 2); pt.R('#e8434f', 131, 17, 1, 1); pt.R('#38b764', 131, 19, 1, 1); // controle de videogame
    pt.R('#111111', 114, 30, 23, 11);                                                                          // relógio digital 02:00
    const DIG = { 0: ['111', '101', '101', '101', '111'], 2: ['111', '001', '111', '100', '111'] };
    [[116, 0], [120, 2], [127, 0], [131, 0]].forEach(([a, d]) => DIG[d].forEach((r, y) => [...r].forEach((p, x) => p === '1' && pt.R('#ff3b3b', a + x, 33 + y, 1, 1))));
    if (f) { pt.R('#ff3b3b', 124, 34, 1, 1); pt.R('#ff3b3b', 124, 36, 1, 1); }
    deskBg(pt);
    pt.R('#2b2f3a', 70, 67, 32, 5); for (let j = 0; j < 7; j++) pt.R(['#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c'][(j + f) % 4], 72 + j * 4, 68, 2, 2); // teclado com luz
    pt.E('#2b2f3a', 108, 70, 2.5, 3.5);                                                                      // mouse
    pt.R('#38b764', 126, 54, 7, 11); pt.R('#c9d2db', 126, 54, 7, 1); pt.R('#111111', 127, 57, 5, 4); pt.R('#ffe14d', 129, 57, 1, 4); // energético
    pt.E('#ffe14d', 142, 62, 4, 3); pt.E('#ffe14d', 140, 57.5, 2.5, 2.5); pt.R('#ff8a1f', 136.5, 57.5, 2, 1); pt.D(INK, [140, 57]); // patinho de borracha
  },
  // página 3, hoje: os três juntos na mesma área do escritório dos robôs (janelas redondas pro parque). cena larga TEAM_W×100.
  // monitor grande no meio com a jurema 2.0 (tela vazada: o terminal .hq__term do html, com código rolando, fica atrás) e o mascote sentado em cima;
  // cada um no seu notebook (teamLaptops, na frente das pessoas). pessoas: almir 26, millena 92, andré 214 (TEAM_X)
  team(pt, f) {
    const W = TEAM_W, X = pt.x;
    pt.R('#d7dee6', 0, 0, W, 64); pt.R('#c5cdd6', 0, 56, W, 8);
    [[57, 26, .8], [230, 26, .8]].forEach(([cx, cy, k]) => { X.save(); X.translate(cx, cy); X.scale(k, k); X.translate(-23, -25); ON_WALL.win[1](pt, 0, f); X.restore(); }); // janelas (a de sempre, 80%: entre almir e millena, e atrás do andré)
    deskBg(pt, '#8f969e', '#737a83', W);
    pt.R(INK, 112, 18, 74, 42); X.clearRect(114, 20, 70, 38);                                          // monitor grande da jurema (74×42): tela vazada
    pt.R(INK, 145, 60, 8, 4); pt.R('#3a3f48', 140, 63, 18, 2);
    officeTop(pt, f, W);
  },
  // conversa almir × rafael (corpo inteiro): parede clara, rodapé, piso de tábuas e um vaso no meio, embaixo dos balões
  talk(pt, f) {
    pt.R('#e6edf3', 0, 0, HW, 86); pt.R('#d3dde6', 0, 80, HW, 6);
    pt.R('#c9b8a3', 0, 86, HW, 14); for (let j = 0; j < 6; j++) pt.R('#b5a28b', j * 26 + (j % 2) * 9, 90 + (j % 2) * 5, 18, 1);
    pt.R('#c0583a', 70, 76, 11, 11); pt.R('#9c4530', 70, 76, 11, 2);                                    // vaso
    pt.E('#38b764', 72, 72, 4, 6, -.5); pt.E('#257953', 79, 71, 4, 7, .5); pt.E('#38b764', 75.5, 68, 3, 8);
  },
  // reset de senha: post-its de cadeado na parede, tela de login com "senha expirada" piscando
  pass(pt, f) {
    pt.R('#ece6d6', 0, 0, HW, 64); pt.R('#ddd5c1', 0, 56, HW, 8);
    [[60, 28, '#ffe14d'], [71, 31, '#ffb3c7'], [62, 41, '#9be7ff'], [73, 44, '#ffe14d'], [82, 35, '#ffb3c7']].forEach(([a, b, c], j) => {
      if (j === 4 && !f) return;                                                                         // mais um chega
      pt.R(c, a, b, 9, 9); pt.R(INK, a + 3, b + 4, 3, 3); pt.R(INK, a + 3, b + 2, 1, 2); pt.R(INK, a + 5, b + 2, 1, 2); pt.R(INK, a + 3, b + 2, 3, 1);
    });
    pt.R(INK, 94, 20, 48, 34); pt.R('#dfe8f2', 96, 22, 44, 30);                                          // monitor
    pt.R('#ffffff', 104, 26, 28, 22); pt.R('#0099ef', 104, 26, 28, 3);
    pt.R('#c5cdd6', 107, 32, 22, 4); [0, 1, 2, 3, 4].forEach(j => pt.R(INK, 109 + j * 4, 33, 2, 2));    // ******
    pt.R(f ? '#e8434f' : '#ffb3b8', 107, 39, 22, 4); pt.R('#0099ef', 112, 44, 12, 2);
    pt.R(INK, 114, 54, 8, 6);
    deskBg(pt, '#8f969e', '#737a83');
    pt.R('#3a3f48', 18, 66, 44, 6); for (let j = 0; j < 9; j++) pt.R('#5a606a', 20 + j * 5, 67, 3, 2);  // teclado
  },
  // impressora: papel enroscado, luz de erro piscando, folhas jogadas na mesa
  print(pt, f) {
    pt.R('#dde6ea', 0, 0, HW, 64); pt.R('#cbd5da', 0, 56, HW, 8);
    pt.R('#ffffff', 8, 12, 22, 14); pt.R('#e8434f', 8, 12, 22, 3); pt.R('#9aa6b2', 11, 18, 16, 1); pt.R('#9aa6b2', 11, 21, 12, 1); // aviso na parede
    deskBg(pt, '#8f969e', '#737a83');
    pt.R('#a5acb3', 96, 30, 46, 34); pt.R('#c9ced3', 96, 30, 42, 31); pt.R('#e8ebee', 100, 26, 34, 5); pt.R('#ffffff', 103, 22, 28, 5);
    pt.R(INK, 100, 44, 34, 3);                                                                           // saída
    pt.R('#2b3440', 124, 34, 12, 6); pt.R(f ? '#e8434f' : '#5a1a1f', 126, 36, 3, 2); pt.R('#ffcd75', 131, 36, 3, 2);
    pt.P('#ffffff', [14, 66], [28, 64], [30, 70], [16, 72]); pt.P('#eef1f4', [64, 68], [76, 66], [78, 72], [65, 73]);
  },
};
// ia: orbe azul com rostinho, flutuando
function aiOrb(pt, f, cx = 120, top = 8) {
  const cy = top + (f ? 0 : 2);
  // jurema 2.0: vermelho por fora, laranja, miolo amarelo e brilho claro
  pt.E('#d63a2f', cx, cy, 8, 8); pt.E('#ff8a1f', cx - 1, cy - 1, 7, 7); pt.E('#ffd23f', cx - 2, cy - 2, 4, 4); pt.E('#fff1a8', cx - 3, cy - 3, 1.5, 1.5);
  pt.R('#ffffff', cx - 4, cy - 1, 2, 3); pt.R('#ffffff', cx + 2, cy - 1, 2, 3); pt.R(INK, cx - 2, cy + 3, 4, 1);
  pt.D('#ffcd75', ...(f ? [[cx - 12, cy - 6], [cx + 11, cy + 4]] : [[cx + 12, cy - 7], [cx - 11, cy + 5]]));
}
// elenco do quadro "team": millena de mostarda (pedido: outra cor de roupa), almir de preto (wu-tang), andré de camiseta preta
const TEAM_W = 250;
const TEAM_X = { almir: 26, millena: 92, andre: 206 }; // almir na ponta esquerda, millena no meio, andré na direita (pedido do usuário)
const teamMillena = (pt, f) => millena(pt, f, true, { cx: TEAM_X.millena, top: ['#8fd0f5', '#5aa9dc', '#3f86b8'] }); // azul claro
const teamAlmir = (pt, f) => almir(pt, f, { cx: TEAM_X.almir, work: true, tee: [AL.tee, AL.teeSh, '#141519'] });
const teamAndre = (pt, f) => andre(pt, f, true, { cx: TEAM_X.andre, tee: true, lap: true });
const teamOrb = (pt, f) => aiOrb(pt, f, 149, 8);                                                     // sentado em cima do monitor grande
// notebooks do "team", de costas para nós (como o da millena no estudo), um de cada tamanho: millena pequeno, almir médio
// (tampa baixa para não cobrir a estampa), andré grande. as mãos dos três ficam atrás da tampa.
// [centro, meia largura da tampa, topo da tampa, sombra, tampa]; base 3 mais larga de cada lado. adesivos de cada um por cima
const notebook = (pt, cx, w, top, sh, lt) => { // notebook de costas para nós: base, tampa com sombra à direita
  pt.R('#8f98a5', cx - w - 3, 69, 2 * w + 6, 3); pt.R(sh, cx - w, top, 2 * w, 70 - top); pt.R(lt, cx - w, top, 2 * w - 3, 68 - top);
};
// estudo do almir: notebook grafite (tampa baixa, abaixo da estampa dos ramones); o adesivo do wu-tang é o .hq__logo da cena (LOGOS)
const almirStudy = (pt, f) => almir(pt, f, { work: true });
function studyLaptop(pt) { notebook(pt, 82, 15, 61, '#2b2d36', '#3d404c'); }
function teamLaptops(pt) {
  const { almir: a, millena: m, andre: n } = TEAM_X;
  [[m, 12, 60, '#a9b1bc', '#c5ccd6'], [a, 14, 59, '#2b2d36', '#3d404c'], [n, 17, 57, '#1c1c22', '#2e2f38']].forEach(([cx, w, top, sh, lt]) => {
    notebook(pt, cx, w, top, sh, lt);
  }); // máquinas da dream: sem adesivos (pedido do usuário em 2026-11-13)
}
/* ---------- escritório em volta (página 1: faixas largas, WW×100) ----------
   a cena de sempre (150×100) fica em dx; o resto da faixa vira escritório: parede com móveis, coisas na mesa, uma mesa só, piso.
   ponytail: itens vêm de duas listas (parede / mesa) em ordem diferente por cena, centrados em cada espaço livre */
const WW = 476, WIDE = { bot: 20, pass: 306, print: 163 };
const WALL_C = { bot: ['#d7dee6', '#c5cdd6'], pass: ['#ece6d6', '#ddd5c1'], print: ['#dde6ea', '#cbd5da'] };
const ON_WALL = {
  win: [46, (pt, x, f) => { // janela redonda; lá fora o parque: céu, árvores, arbustos, flores; as copas balançam e um passarinho passa
    const cx = x + 23, cy = 25, X = pt.x;
    pt.E('#5d6b7a', cx, cy, 20, 20); pt.E('#7d8a99', cx, cy, 18.5, 18.5);                               // moldura
    X.save(); X.beginPath(); X.ellipse(cx, cy, 16, 16, 0, 0, 7); X.clip();
    pt.R('#9fd3f5', cx - 16, cy - 16, 32, 32); pt.E('#c4e6fb', cx - 6, cy - 9, 7, 2.5);                  // céu e nuvem
    pt.E('#4f9a5a', cx - 9, cy + 6, 9, 6); pt.E('#5aa866', cx + 8, cy + 5, 10, 6);                        // copas ao fundo
    pt.R('#7cc36a', cx - 16, cy + 8, 32, 9); pt.P('#e3d3a8', [cx - 2, cy + 8], [cx + 2, cy + 8], [cx + 7, cy + 17], [cx - 6, cy + 17]); // grama e caminho
    pt.R('#6e4a33', cx - 9, cy + 1, 2, 9); pt.R('#6e4a33', cx + 9, cy - 1, 2, 11);                       // troncos
    const s = f ? 1 : 0;
    pt.E('#257953', cx - 8 + s, cy - 1, 6, 5.5); pt.E('#38b764', cx - 9 + s, cy - 2.5, 4.5, 4);            // árvore da esquerda
    pt.E('#257953', cx + 10 - s, cy - 4, 7, 7); pt.E('#38b764', cx + 9 - s, cy - 6, 5, 5);                 // árvore da direita
    pt.E('#3f8f4c', cx - 13, cy + 11, 4, 2.5); pt.E('#3f8f4c', cx + 13, cy + 10, 4, 2.5);                 // arbustos
    [[-12, 13, '#ff6b8a'], [-4, 13, '#ffe14d'], [11, 14, '#ff6b8a'], [4, 15, '#ffffff']].forEach(([a, b, c]) => pt.R(c, cx + a, cy + b, 1, 1)); // flores
    pt.R(INK, cx - 4 + f * 6, cy - 11, 1, 1); pt.R(INK, cx - 3 + f * 6, cy - 12 + f, 1, 1); pt.R(INK, cx - 5 + f * 6, cy - 12 + f, 1, 1); // passarinho
    X.restore();
    pt.E('#ffffff', cx - 8, cy - 9, 2.5, 1.2, -.7);                                                       // brilho no vidro
  }],
  board: [36, (pt, x, f) => { // mural de chamados; o "urgente" pisca
    pt.R('#8a5f43', x, 10, 36, 28); pt.R('#c99a63', x + 2, 12, 32, 24);
    [[4, 14, '#ffffff'], [14, 15, '#ffe14d'], [25, 14, '#ffffff'], [4, 25, '#ffb3c7'], [25, 25, '#9be7ff']].forEach(([a, b, c]) => {
      pt.R(c, x + a, b, 7, 8); pt.R('#9aa6b2', x + a + 1, b + 3, 5, 1); pt.R('#9aa6b2', x + a + 1, b + 5, 4, 1); pt.R('#e8434f', x + a + 3, b, 1, 1);
    });
    pt.R(f ? '#e8434f' : '#ff8a8a', x + 14, 25, 8, 9); pt.R('#ffffff', x + 17, 26, 2, 4); pt.R('#ffffff', x + 17, 31, 2, 2);
  }],
  shelf: [34, (pt, x) => [27, 45].forEach((y, r) => { // estante de pastas
    pt.R('#6e4a33', x, y, 34, 2);
    ['#3b5dc9', '#e8434f', '#ffcd75', '#38b764', '#8e7cc3', '#3b5dc9', '#ff8a1f'].forEach((c, j) => {
      if ((j + r) % 5 === 4) return;                                                                   // vão de pasta emprestada
      const h = 10 + (j + r) % 3; pt.R(c, x + 2 + j * 4.5, y - h, 4, h); pt.R('#ffffff', x + 3 + j * 4.5, y - h + 2, 2, 1);
    });
  })],
  ac: [32, (pt, x, f) => { // ar-condicionado soprando
    pt.R('#f4f6f8', x, 7, 32, 10); pt.R('#b8c2cc', x, 15, 32, 2); pt.R('#9aa6b2', x + 3, 12, 26, 1); pt.R(f ? '#38b764' : '#257953', x + 27, 9, 2, 2);
    [5, 14, 23].forEach(a => pt.R('#a9bccc', x + a + f * 2, 20 + f * 2, 4, 1));
  }],
  poster: [22, (pt, x) => { // aviso de "atenção" que ninguém lê
    pt.R(INK, x, 12, 22, 30); pt.R('#ffffff', x + 1, 13, 20, 28); pt.R('#e8434f', x + 1, 13, 20, 5);
    pt.R('#e8434f', x + 9, 21, 4, 10); pt.R('#e8434f', x + 9, 33, 4, 3); pt.R('#9aa6b2', x + 4, 38, 14, 1);
  }],
  clock: [14, (pt, x, f) => { pt.R('#f4f4f4', x, 12, 14, 14); pt.R(INK, x + 6, 15, 2, 5); pt.R(INK, x + 6, 19, f ? 5 : 1, 2); }],
};
const ON_DESK = { // em cima da mesa (tampo em y 64)
  screen: [36, (pt, x, f) => { // monitor com a fila de chamados; o mais antigo pisca
    pt.R(INK, x, 36, 36, 22); pt.R('#f4f6f8', x + 2, 38, 32, 18); pt.R('#0099ef', x + 2, 38, 32, 3);
    for (let r = 0; r < 3; r++) { pt.R(r === 2 && f ? '#ffb3b8' : '#dfe8f2', x + 4, 43 + r * 4, 28, 3); pt.R('#9aa6b2', x + 6, 44 + r * 4, 12, 1); }
    pt.R(INK, x + 15, 58, 6, 6); pt.R('#3a3f48', x + 11, 63, 14, 2);
    pt.R('#3a3f48', x + 7, 67, 22, 4); for (let j = 0; j < 5; j++) pt.R('#5a606a', x + 9 + j * 4, 68, 2, 2); // teclado
  }],
  phone: [16, (pt, x, f) => { // telefone tocando
    pt.R('#3a3f48', x, 58, 16, 7); pt.R('#5a606a', x + 2, 55 - f, 12, 3); pt.R('#2b3440', x + 4, 60, 8, 3);
    if (f) { pt.R('#e8434f', x - 3, 52, 2, 1); pt.R('#e8434f', x + 17, 52, 2, 1); pt.R('#e8434f', x - 2, 49, 1, 2); pt.R('#e8434f', x + 17, 49, 1, 2); }
  }],
  mug: [8, (pt, x, f) => { pt.R('#ffffff', x, 57, 6, 8); pt.R('#ffffff', x + 6, 59, 2, 3); pt.R('#0099ef', x, 59, 6, 2); pt.R('#ffffff', x + 1 + f, 50, 1, 3); pt.R('#ffffff', x + 4 - f, 48, 1, 4); }],
  plant: [12, (pt, x) => {
    pt.R('#c0583a', x + 2, 56, 8, 9); pt.R('#9c4530', x + 2, 56, 8, 2);
    pt.E('#38b764', x + 3, 50, 3, 6, -.5); pt.E('#257953', x + 9, 50, 3, 6, .5); pt.E('#38b764', x + 6, 47, 2.5, 7);
  }],
  pile: [16, (pt, x, f) => { for (let j = 0; j < 7 + f; j++) pt.R(j % 2 ? '#e8edf2' : '#ffffff', x + (j % 2), 63 - j * 2, 15, 2); }],
};
const SEQ = {
  bot: [['board', 'win', 'shelf', 'poster', 'win', 'ac'], ['phone', 'screen', 'mug', 'pile', 'plant', 'screen', 'pile']],
  pass: [['win', 'shelf', 'clock', 'board', 'win', 'poster'], ['plant', 'screen', 'pile', 'phone', 'screen', 'mug', 'pile']],
  print: [['shelf', 'win', 'ac', 'board', 'win', 'clock'], ['screen', 'mug', 'plant', 'pile', 'phone', 'screen']],
};
// itens em fila, do começo da lista até acabar o espaço, centrados entre x0 e x1
function fillRow(pt, f, x0, x1, items, gap) {
  const fit = []; let w = 0;
  for (const it of items) { const n = (fit.length ? gap : 0) + it[0]; if (w + n > x1 - x0 - gap) break; fit.push(it); w += n; }
  let x = x0 + (x1 - x0 - w) / 2;
  fit.forEach(([iw, draw]) => { draw(pt, Math.round(x), f); x += iw + gap; });
}
function office(pt, f, k, dx) {
  const [wall, base] = WALL_C[k], [ws, ds] = SEQ[k], free = [[0, dx], [dx + HW, WW]];
  pt.R(wall, 0, 0, WW, 64); pt.R(base, 0, 56, WW, 8);
  free.forEach(([a, b], j) => fillRow(pt, f, a, b, [...ws.slice(j * 2), ...ws].map(n => ON_WALL[n]), 16));
  deskBg(pt, '#8f969e', '#737a83', WW);
  free.forEach(([a, b], j) => fillRow(pt, f, a, b, [...ds.slice(j * 3), ...ds].map(n => ON_DESK[n]), 14));
}
// por cima da cena do meio: luminárias no teto, gaveteiros, piso e pés (a mesa vira uma só, os pés da cena do meio somem)
function officeTop(pt, f, W = WW) {
  for (let a = 18; a < W; a += 92) { pt.R('#9aa6b2', a, 0, 36, 4); pt.R(f && a === 202 ? '#dfe5ea' : '#ffffff', a + 1, 0, 34, 3); }
  pt.R('#aab2bb', 0, 92, W, 8); pt.R('#8e969f', 0, 92, W, 2);
  for (let a = 8; a < W - 20; a += 112) { pt.R('#5d3a28', a, 92, 6, 8); pt.R('#646b73', a + 14, 79, 26, 11); pt.R('#9aa6b2', a + 24, 83, 6, 1); }
  pt.R('#5d3a28', W - 14, 92, 6, 8);
}

const CAST = { talk: [almirStand, rafael], bot: [robot], pass: [botPass], print: [botPrint], study: [almirStudy, studyLaptop], studyM: [millenaStudy, laptop], studyA: [andreStudy], team: [teamMillena, teamAlmir, teamAndre, teamOrb, teamLaptops] };
const LAYERS = {};
// uma cena por vez (cada uma leva uns 300ms; todas juntas travavam a abertura do deck por segundos no celular)
function buildScene(k) {
  LAYERS[k] = [0, 1].map(f => {
    const dx = WIDE[k], c = cv(k === 'team' ? TEAM_W : dx === undefined ? HW : WW), pt = painter(c.getContext('2d'));
    if (dx !== undefined) office(pt, f, k, dx);
    pt.x.translate(dx || 0, 0); BG[k](pt, f); pt.x.setTransform(S, 0, 0, S, 0, 0);
    if (dx !== undefined) officeTop(pt, f);
    pt.x.resetTransform();
    CAST[k].forEach(d => pt.x.drawImage(sprite(d, spriteW(k))[f], (dx || 0) * S, 0));
    return c;
  });
  BLINKS[k] = CAST[k].filter(d => HUMANS.includes(d)).map(d => ({
    img: [0, 1].map(f => blinkLayer(d, f, spriteW(k))), dx: WIDE[k] || 0, on: false, until: 0, next: performance.now() + 1500 + Math.random() * 4500 }));
}
// piscadas: cada pessoa tem o próprio relógio (intervalo aleatório de 2,5 a 7s), então ninguém pisca junto.
// camada da piscada = só os pixels que mudam com o olho fechado, desenhada por cima da cena
const HUMANS = [almirStudy, almirStand, rafael, millena, andre, millenaStudy, andreStudy, teamMillena, teamAlmir, teamAndre], BLINKS = {};
const spriteW = k => k === 'team' ? TEAM_W : HW; // a cena larga do "team" desenha as pessoas direto na largura toda (sem dx)
function blinkLayer(d, f, w) {
  const a = sprite(d, w)[f]; BLINK = true; const b = sprite(d, w)[f]; BLINK = false;
  const pa = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, xb = b.getContext('2d'), img = xb.getImageData(0, 0, b.width, b.height), pb = img.data;
  for (let i = 0; i < pb.length; i += 4) if (pa[i] === pb[i] && pa[i + 1] === pb[i + 1] && pa[i + 2] === pb[i + 2] && pa[i + 3] === pb[i + 3]) pb[i + 3] = 0;
  xb.putImageData(img, 0, 0);
  return b;
}
let hqF = 0;
$$('.hq__term pre').forEach(p => p.innerHTML += p.innerHTML); // código em dobro: rolar meia altura e voltar ao início não dá salto
$$('.hq canvas[data-scene]').forEach(c => (LOGOS[c.dataset.scene] || []).forEach(([draw, ax, ay, dw, dh, k = 1]) => { // estampas e adesivos (ver LOGOS)
  const w = dw * k, h = dh * k;
  const o = draw(dw, dh); o.className = 'hq__logo'; c.after(o);
  const sw = c.width / S / 100; // largura da cena em centésimos (altura = 100)
  Object.assign(o.style, { position: 'absolute', left: (ax - w / 2) / sw + '%', top: ay - h / 2 + '%', width: w / sw + '%', height: h + '%' });
}));
const drawHq = () => $$('.hq canvas[data-scene]').forEach(c => {
  const x = c.getContext('2d'), k = c.dataset.scene; if (!LAYERS[k]) return; // cena ainda não montada
  x.clearRect(0, 0, c.width, c.height); x.drawImage(LAYERS[k][hqF], 0, 0);
  BLINKS[k].forEach(b => b.on && x.drawImage(b.img[hqF], b.dx * S, 0));
});
// monta as cenas depois que o deck já apareceu, uma por tarefa (o passador continua respondendo entre elas)
const hqQueue = Object.keys(BG);
requestAnimationFrame(() => setTimeout(function next() { const k = hqQueue.shift(); if (!k) return; buildScene(k); drawHq(); setTimeout(next, 0); }));
setInterval(() => { if (slides[cur]?.classList.contains('hq')) { hqF ^= 1; drawHq(); } }, 450);
setInterval(() => {
  if (!slides[cur]?.classList.contains('hq')) return;
  const t = performance.now(); let changed = false;
  Object.values(BLINKS).flat().forEach(b => {
    if (t >= b.next) { b.until = t + 160; b.next = t + 2500 + Math.random() * 4500; }
    if ((t < b.until) !== b.on) { b.on = !b.on; changed = true; }
  });
  if (changed) drawHq();
}, 80);


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
  if (slide.hasAttribute('data-drum')) drum.seen = true;
  const id = panelsOf(slide)[i], panel = id && $('#' + id);
  live.open = true; live.url = panel?.dataset.url || slide.dataset.url; live.slide = slide; live.i = i; live.panel = panel; live.sub = -1;
  live.from = $(`[data-from="${id}"]`, slide);
  $('.addr', L).textContent = panel ? panel.dataset.addr : live.url;
  L.classList.toggle('is-panel', !!panel);
  L.classList.toggle('has-url', !!live.url);
  if (panel) {
    panel.classList.add('on');
    const v = $('video', panel); if (v) { v.currentTime = 0; v.play().catch(() => {}); }
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
      $$('video', L).forEach(v => v.pause());
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
  const ch = e.target.closest('.car__card');
  if (ch && !live.busy) openLive(slides[cur], $$('.car__card', slides[cur]).indexOf(ch));
  // botões ← → do canto = passador/setas: mesma step(). ficam acima da janela (#hud z-index 110 > #live 100), senão o clique
  // caía no fundo e fechava a janela. blur: com o foco no botão, Enter/Espaço do passador "apertariam" o botão de novo (passada dupla)
  const nav = e.target.closest('[data-nav]');
  if (nav) { nav.blur(); step(+nav.dataset.nav); }
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
    // xodós: recolhe e só gira para o próximo cartão (a descrição fica para ler); a janela abre na passada seguinte
    const then = s.hasAttribute('data-drum') ? () => drumGo(s, nxt) : () => openLive(s, nxt);
    return closeLive(d < 0 ? null : nxt < panelsOf(s).length ? then : () => go(cur + 1));
  }
  const s = slides[cur];
  if (s.hasAttribute('data-flow')) {
    const n = $$('.station', s).length;
    if (d > 0 && flow.i < n - 1) return flowGo(s, flow.i + 1);
    if (d < 0 && flow.i >= 0) return flowGo(s, flow.i - 1);
  }
  if (s.hasAttribute('data-reveal')) {
    const n = $$('[data-rv]', s).length;
    if (d > 0 && reveal.i < n - 1) return revealGo(s, reveal.i + 1);
    if (d < 0 && reveal.i >= 0) return revealGo(s, reveal.i - 1);
  }
  // carrossel com a janela fechada: "próximo" abre o cartão da frente (se ainda não abriu) ou gira para o seguinte;
  // "anterior" gira para trás (o anterior conta como visto: o próximo "próximo" gira de novo para frente)
  if (s.hasAttribute('data-drum')) {
    if (d > 0 && !drum.seen) return openLive(s, drum.i);
    if (d > 0 && drum.i < XODOS.length - 1) return drumGo(s, drum.i + 1);
    if (d < 0 && drum.i > 0) { drumGo(s, drum.i - 1); drum.seen = true; return; }
  }
  if (d > 0 && s.hasAttribute('data-live')) openLive(s);
  else go(cur + d);
}
$('#restart').addEventListener('click', () => go(0));

/* celular: arrastar o dedo para o lado = passador (esquerda = próximo, direita = anterior). gesto mais vertical que horizontal é rolagem: ignora */
let touch0 = null;
addEventListener('touchstart', e => { touch0 = e.touches.length === 1 ? e.touches[0] : null; }, { passive: true });
addEventListener('touchend', e => {
  if (!touch0) return;
  const t = e.changedTouches[0], dx = t.clientX - touch0.clientX, dy = t.clientY - touch0.clientY;
  touch0 = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
}, { passive: true });

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
