/* ====== fx3d — experimento three.js nos painéis do slide 2 ======
   TESTE DE DESIGN, isolado do resto: para desligar, remova as 3 tags "fx3d" no fim do index.html.
   Ponto de restauração do deck antes do 3d: _restauracao/2026-10-28-antes-do-3d/
   - roscas viram anéis extrudados que giram ao entrar e "saltam" no hover (sem paralaxe do mouse)
   - prints das plataformas viram placas 3d que voam de trás, flutuam e sobem no hover
   three r128 (build clássico) para rodar com o deck aberto direto do disco (file://), sem servidor.
   Depende de main.js: CHARTS, chartFocus, num, $, $$ e gsap. */
(() => {
  if (!window.THREE || !document.createElement('canvas').getContext('webgl')) return; // sem webgl: fica o 2d
  const T = THREE;
  document.documentElement.classList.add('fx3d');
  document.head.insertAdjacentHTML('beforeend', `<style>
.fx3d .pie svg{visibility:hidden}
.fx3d .pie > canvas{position:absolute;left:-14%;top:-14%;width:128%;height:128%}
.fx3d .pie__center{z-index:1}
.fx3d .pie__center span{margin-top:0}
.fx3d .pie__lbl{position:absolute;left:0;top:0;z-index:1;font-size:clamp(12px,1.4vw,22px);font-weight:700;letter-spacing:-.02em;color:#fff;
  text-shadow:0 1px 8px rgba(0,0,0,.35);pointer-events:none;white-space:nowrap}
.fx3d .panel--list > canvas{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2}
.fx3d .plat img{opacity:0!important;transition:none;transform:none!important}
</style>`);

  const lerp = (a, b, k) => a + (b - a) * k;
  const scenes = {}, active = new Set();

  function base(host, fov) {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = T.sRGBEncoding; // cores da marca exatas (hex em srgb)
    host.appendChild(renderer.domElement);
    return { renderer, canvas: renderer.domElement, scene: new T.Scene(), camera: new T.PerspectiveCamera(fov, 1, 1, 10000) };
  }

  // sombra suave dos prints, desenhada num canvas
  function shadowTex() {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = c.height = 256;
    x.filter = 'blur(18px)'; x.fillStyle = 'rgba(6,7,15,.55)'; x.fillRect(40, 40, 176, 176);
    return new T.CanvasTexture(c);
  }

  // cor do gráfico: 'var(--chart-1)' vira o hex do tema atual (claro/escuro), em espaço linear para o three
  const tone = c => new T.Color(c.startsWith('var(') ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() : c).convertSRGBToLinear();

  /* ---------- rosca 3d ---------- */
  const R0 = 54, R1 = 92, DEPTH = 18, GAP = .012;

  function donut(id) {
    const cfg = CHARTS[id], pie = $('.pie', cfg.el), s = base(pie, 30), { scene, camera } = s;
    s.focus = -1;
    scene.add(new T.HemisphereLight(0xffffff, 0xb8c4d6, .7));
    const key = new T.DirectionalLight(0xffffff, .55); key.position.set(120, 260, 300); scene.add(key);
    const rim = new T.DirectionalLight(0x7fdcff, .3); rim.position.set(-260, -120, 120); scene.add(rim);
    s.tilt = new T.Group(); s.spin = new T.Group(); s.tilt.add(s.spin); scene.add(s.tilt);

    let acc = 0;
    s.segs = cfg.data.map(([, , c], i) => {
      const p = cfg.pct[i], a0 = Math.PI / 2 - acc / 50 * Math.PI, a1 = Math.PI / 2 - (acc + p) / 50 * Math.PI; // do topo, sentido horário
      acc += p;
      const sh = new T.Shape(), gi = GAP * R1 / R0; // respiro de mesma largura na borda de fora e de dentro
      sh.absarc(0, 0, R1, a1 + GAP, a0 - GAP, false);
      sh.absarc(0, 0, R0, a0 - gi, a1 + gi, true);
      const m = new T.Mesh(
        new T.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.5, bevelSegments: 3, curveSegments: 48 }),
        new T.MeshPhysicalMaterial({ color: tone(c), roughness: .38, metalness: 0, clearcoat: 1, clearcoatRoughness: .25, transparent: true }));
      const mid = (a0 + a1) / 2;
      m.userData = { c, i, mid, dx: Math.cos(mid), dy: Math.sin(mid), lift: 0, fade: 1, pop: 0, dim: 1 };
      s.spin.add(m);
      return m;
    });
    if (cfg.arcLabels) s.labels = s.segs.map((m, i) => {
      const d = document.createElement('div');
      d.className = 'pie__lbl'; d.textContent = num(cfg.pct[i], 1) + '%';
      pie.appendChild(d);
      return d;
    });

    // hover no 3d: raio da câmera até a fatia
    const ray = new T.Raycaster(), v = new T.Vector2();
    s.canvas.addEventListener('pointermove', e => {
      const r = s.canvas.getBoundingClientRect();
      v.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(v, camera);
      const hit = ray.intersectObjects(s.segs)[0], i = hit ? hit.object.userData.i : -1;
      if (i !== s.hoverI) { s.hoverI = i; chartFocus(cfg, i); }
    });
    s.canvas.addEventListener('pointerleave', () => { s.hoverI = -1; chartFocus(cfg, -1); });

    s.size = () => {
      const w = pie.clientWidth * 1.28;
      if (!w || w === s.w) return; // redimensionar limpa o canvas: só quando mudou de fato
      s.w = w; s.renderer.setSize(w, w, false); s.px = pie.clientWidth;
      camera.aspect = 1; camera.position.set(0, 0, 450); camera.updateProjectionMatrix();
    };
    s.start = () => {
      s.tilt.rotation.set(0, 0, 0);
      gsap.fromTo(s.spin.rotation, { z: -Math.PI * .9 }, { z: 0, duration: 1.8, ease: 'expo.out', delay: .3 });
      s.segs.forEach((m, i) => {
        gsap.fromTo(m.userData, { lift: 140, fade: 0 }, { lift: 0, fade: 1, duration: 1.2, ease: 'expo.out', delay: .45 + i * .14 });
        gsap.fromTo(m.scale, { z: .01 }, { z: 1, duration: 1.1, ease: 'back.out(2.2)', delay: .55 + i * .14 });
      });
    };
    const p = new T.Vector3();
    s.frame = t => {
      s.tilt.rotation.x = lerp(s.tilt.rotation.x, -.72, .06); // inclinação fixa (sem paralaxe do mouse, a pedido do usuário)
      s.tilt.rotation.y = lerp(s.tilt.rotation.y, 0, .06);
      s.segs.forEach(m => {
        const u = m.userData, on = s.focus === u.i;
        u.pop = lerp(u.pop, on ? 12 : 0, .15);
        u.dim = lerp(u.dim, s.focus < 0 || on ? 1 : .3, .15);
        m.position.set(u.dx * u.pop, u.dy * u.pop, u.lift + (on ? 6 : 0) + Math.sin(t / 900 + u.i) * 1.5);
        m.material.opacity = u.fade * u.dim;
      });
      s.renderer.render(scene, camera);
      s.labels?.forEach((d, i) => { // % preso no topo da fatia
        const m = s.segs[i], u = m.userData;
        p.set(Math.cos(u.mid) * (R0 + R1) / 2, Math.sin(u.mid) * (R0 + R1) / 2, DEPTH + 2);
        m.localToWorld(p).project(camera);
        d.style.transform = `translate(${((p.x + 1) / 2 * 1.28 - .14) * s.px}px,${((1 - p.y) / 2 * 1.28 - .14) * s.px}px) translate(-50%,-50%)`;
        d.style.opacity = m.material.opacity;
      });
    };
    return s;
  }

  /* ---------- prints em placas 3d ---------- */
  function rounded(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new T.ShapeGeometry(s, 6), pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + .5, pos.getY(i) / h + .5);
    return g;
  }

  function plats(panel) {
    const s = base(panel, 30), { scene, camera } = s, shTex = shadowTex();
    s.hover = -1;
    s.cards = $$('.plat img', panel).map((img, i) => {
      const tex = new T.TextureLoader().load((window.PRINTS || {})[img.getAttribute('src')] || img.src);
      tex.anisotropy = s.renderer.capabilities.getMaxAnisotropy();
      tex.encoding = T.sRGBEncoding;
      const m = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ map: tex, transparent: true }));
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, depthTest: false }));
      sh.renderOrder = -1; // sombra sempre por baixo, mesmo quando a placa flutua para trás
      scene.add(sh, m);
      const card = img.closest('.plat');
      card.addEventListener('mouseenter', () => s.hover = i);
      card.addEventListener('mouseleave', () => s.hover = -1);
      return { img, card, m, sh, u: { z: 0, rx: 0, fade: 1, lift: 0, dim: 1, w: 0, h: 0 } };
    });
    // câmera na distância em que 1 unidade = 1px no plano z=0: as placas caem exatamente sobre o lugar das <img>
    s.size = () => {
      if (!panel.clientWidth || (panel.clientWidth === s.W && panel.clientHeight === s.H)) return;
      s.W = panel.clientWidth; s.H = panel.clientHeight;
      s.renderer.setSize(s.W, s.H, false);
      camera.aspect = s.W / s.H; camera.position.set(0, 0, s.H / 2 / Math.tan(T.MathUtils.degToRad(15))); camera.updateProjectionMatrix();
    };
    s.start = () => s.cards.forEach((c, i) =>
      gsap.fromTo(c.u, { z: -900, rx: -1.1, fade: 0 }, { z: 0, rx: 0, fade: 1, duration: 1.4, ease: 'expo.out', delay: .45 + i * .09 }));
    s.frame = t => {
      const cr = s.canvas.getBoundingClientRect(), k = s.W / cr.width; // k desfaz a escala da janela durante a abertura
      s.cards.forEach((c, i) => {
        const r = c.img.getBoundingClientRect(), w = r.width * k, h = r.height * k, u = c.u;
        const sel = c.card.classList.contains('is-on'), on = s.hover === i || sel; // is-on = item escolhido pelo passador
        u.dim = lerp(u.dim, panel.classList.contains('has-sel') && !on ? .35 : 1, .12);
        if (Math.abs(w - u.w) > .5 || Math.abs(h - u.h) > .5) { c.m.geometry.dispose(); c.m.geometry = rounded(w, h, 12); u.w = w; u.h = h; }
        const x = (r.left - cr.left) * k + w / 2 - s.W / 2, y = s.H / 2 - ((r.top - cr.top) * k + h / 2);
        u.lift = lerp(u.lift, on ? 40 : 0, .12);
        c.m.position.set(x, y + u.lift * .2, u.z + u.lift + Math.sin(t / 1100 + i * 1.3) * 6); // sobe um pouco para não cobrir o nome
        c.m.rotation.x = lerp(c.m.rotation.x, u.rx + (on ? -.08 : 0), .1);
        c.m.rotation.y = lerp(c.m.rotation.y, 0, .1);
        c.m.material.opacity = u.fade * u.dim;
        c.sh.position.set(x, y - 12 - u.lift * .2, u.z - 2);
        c.sh.scale.set(w * (1.25 + u.lift / 300), h * (1.35 + u.lift / 250), 1);
        c.sh.material.opacity = u.fade * u.dim * (1 - u.lift / 220);
      });
      s.renderer.render(scene, camera);
    };
    return s;
  }

  /* ---------- liga/desliga junto com o painel (classe .on posta pelo main.js) ---------- */
  let raf = 0;
  const frame = t => { active.forEach(s => s.frame(t)); raf = active.size ? requestAnimationFrame(frame) : 0; };
  $$('#live .panel').forEach(panel => new MutationObserver(() => {
    const id = panel.id;
    if (panel.classList.contains('on')) {
      const s = scenes[id] ||= CHARTS[id] ? donut(id) : panel.classList.contains('panel--list') ? plats(panel) : null;
      if (!s || active.has(s)) return;
      if (!s.ro) (s.ro = new ResizeObserver(() => s.size())).observe(panel);
      s.size(); s.start(); active.add(s);
      if (!raf) raf = requestAnimationFrame(frame);
    } else active.delete(scenes[id]);
  }).observe(panel, { attributes: true, attributeFilter: ['class'] }));

  // tecla t troca o tema: as fatias pegam o tom do novo tema
  new MutationObserver(() => Object.values(scenes).forEach(s => s.segs?.forEach(m => m.material.color.copy(tone(m.userData.c)))))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // hover na legenda (2d) também destaca a fatia 3d
  const focus2d = window.chartFocus;
  window.chartFocus = (cfg, i) => { focus2d(cfg, i); const s = scenes[cfg.el.id]; if (s) s.focus = i < 0 ? cfg.sel ?? -1 : i; };

  window.fx3d = { scenes, frame: t => active.forEach(s => s.frame(t)) }; // para depurar no console
})();
