/* ============================================================
   A CONTA DA VIRADA — lógica, gráficos e interatividade
   D3 (gráficos) · GSAP + ScrollTrigger (scrollytelling) · KaTeX (fórmulas)
   ============================================================ */
(function () {
  "use strict";

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  const hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- formatação pt-BR ---------- */
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtDec = (n, d) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtAbbrev = (n) => {
    if (Math.abs(n) >= 1e6) return fmtDec(n / 1e6, 1) + " mi";
    if (Math.abs(n) >= 1e3) return fmtDec(n / 1e3, 0) + " mil";
    return fmtInt(n);
  };

  /* ============================================================
     THEME TOGGLE
     ============================================================ */
  (function theme() {
    const btn = $("#themeToggle");
    const label = $("#themeLabel");
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem("acv-theme"); } catch (e) {}
    if (saved) root.setAttribute("data-theme", saved);
    const sync = () => {
      const dark = root.getAttribute("data-theme") !== "light";
      label.textContent = dark ? "ESCURO" : "CLARO";
      btn.setAttribute("aria-pressed", String(!dark));
    };
    sync();
    btn.addEventListener("click", () => {
      const dark = root.getAttribute("data-theme") !== "light";
      const next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("acv-theme", next); } catch (e) {}
      sync();
    });
  })();

  /* ============================================================
     PROGRESS BAR
     ============================================================ */
  (function progress() {
    const bar = $("#progressBar");
    let ticking = false;
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? (window.scrollY / h) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, p)) + "%";
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ============================================================
     COUNT-UP
     ============================================================ */
  function countUp(el, to, opts) {
    opts = opts || {};
    const dur = RM ? 0 : (opts.dur || 1500);
    const decimals = opts.decimals || 0;
    const abbrev = opts.abbrev || false;
    const suffix = opts.suffix || "";
    const render = (v) => {
      const txt = abbrev ? fmtAbbrev(v) : (decimals ? fmtDec(v, decimals) : fmtInt(v));
      el.textContent = txt + suffix;
    };
    if (dur === 0) { render(to); return; }
    const start = performance.now();
    const from = opts.from || 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      render(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // elementos [data-countup] disparam ao entrar na tela
  function initCountups() {
    const els = $$("[data-countup]");
    const run = (el) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      countUp(el, parseFloat(el.dataset.to), {
        decimals: el.dataset.decimals ? parseInt(el.dataset.decimals, 10) : 0,
        abbrev: el.dataset.abbrev === "true",
        suffix: el.dataset.suffix || ""
      });
    };
    if (RM || !("IntersectionObserver" in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ============================================================
     HERO COUNTER (dispara ao carregar)
     ============================================================ */
  function initHero() {
    const el = $("#heroCounterValue");
    const from = parseInt(el.closest(".counter").dataset.from, 10);
    const to = parseInt(el.closest(".counter").dataset.to, 10);
    el.textContent = fmtInt(from);
    const go = () => countUp(el, to, { from, dur: RM ? 0 : 2600 });
    if (RM) { el.textContent = fmtInt(to); return; }
    setTimeout(go, 450);
  }

  /* ============================================================
     REVEAL (fade-up suave em títulos/textos)
     ============================================================ */
  function initReveal() {
    if (RM || !hasST) return;
    const sel = ".eyebrow, .dossie-tag, .section__title, .section__lede, .sub-title, .formula, .test__read, .vcard, .fp-stat, .proc-list li, .source, .punch, .counter__caption, .hero__title, .hero__lede";
    $$(sel).forEach((el) => {
      el.classList.add("reveal");
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });
  }

  /* ============================================================
     STAMPS (PASSA / REPROVA entram com leve rotação)
     ============================================================ */
  function initStamps() {
    $$("[data-stamp]").forEach((el) => {
      if (RM || !hasST) { el.style.opacity = "1"; return; }
      gsap.fromTo(el, { opacity: 0, scale: 1.5, rotate: -14 },
        { opacity: 1, scale: 1, rotate: -3, duration: 0.5, ease: "back.out(2)",
          scrollTrigger: { trigger: el, start: "top 85%", once: true } });
    });
  }

  /* ============================================================
     GRÁFICO DE DÍGITOS (barras + linha esperada)
     usado pelo Teste 1 (último dígito) e Teste 2 (Benford)
     ============================================================ */
  function digitChart(mount, cfg) {
    const W = 340, H = 210, padL = 16, padR = 8, padT = 14, padB = 24;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const baseY = padT + plotH;
    const obs = cfg.observed, exp = cfg.expected; // exp: array[10]
    const maxVal = Math.max(d3.max(obs), d3.max(exp)) * 1.06;
    const step = plotW / 10;
    const bw = step * 0.66;
    const x = (i) => padL + i * step + step / 2;
    const y = (v) => padT + plotH * (1 - v / maxVal);

    const svg = d3.select(mount).append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img")
      .attr("aria-label", cfg.ariaLabel);

    // baseline
    svg.append("line").attr("class", "axis-line")
      .attr("x1", padL).attr("x2", W - padR).attr("y1", baseY).attr("y2", baseY);

    // barras observadas
    const bars = svg.selectAll("rect.bar-rect").data(obs).enter().append("rect")
      .attr("class", "bar-rect")
      .attr("x", (d, i) => x(i) - bw / 2)
      .attr("width", bw)
      .attr("y", (d) => y(d))
      .attr("height", (d) => baseY - y(d))
      .attr("rx", 1.5)
      .style("fill", cfg.color);

    // rótulos dos dígitos
    svg.selectAll("text.axis-text").data(obs).enter().append("text")
      .attr("class", "axis-text")
      .attr("x", (d, i) => x(i))
      .attr("y", baseY + 15)
      .attr("text-anchor", "middle")
      .text((d, i) => i);

    // linha esperada
    const line = d3.line().x((d, i) => x(i)).y((d) => y(d));
    const path = svg.append("path").attr("class", "exp-line").attr("d", line(exp));
    const dots = svg.selectAll("circle.exp-dot").data(exp).enter().append("circle")
      .attr("class", "exp-dot").attr("cx", (d, i) => x(i)).attr("cy", (d) => y(d)).attr("r", 2.4);

    // animação de desenho
    const drawn = { v: false };
    function draw() {
      if (drawn.v) return; drawn.v = true;
      if (RM || !hasGSAP) return; // estado final já aplicado
      bars.attr("y", baseY).attr("height", 0);
      gsap.to(bars.nodes(), {
        duration: 0.8, ease: "power2.out", stagger: 0.04,
        attr: { y: (i, t) => y(obs[i]), height: (i, t) => baseY - y(obs[i]) }
      });
      const len = path.node().getTotalLength();
      path.attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
      gsap.to(path.node(), { attr: { "stroke-dashoffset": 0 }, duration: 1.1, ease: "power1.inOut", delay: 0.2 });
      dots.attr("opacity", 0);
      gsap.to(dots.nodes(), { attr: { opacity: 1 }, duration: 0.3, stagger: 0.04, delay: 0.6 });
    }
    if (RM || !hasST) { draw(); }
    else ScrollTrigger.create({ trigger: mount, start: "top 80%", once: true, onEnter: draw });
  }

  function buildCard(container, candClass, candColor, name, statHTML) {
    const card = document.createElement("div");
    card.className = "chartcard";
    card.style.setProperty("--c", candColor);
    card.innerHTML =
      `<div class="chartcard__head">
         <span class="chartcard__name">${name}</span>
         <span class="chartcard__stat">${statHTML}</span>
       </div>
       <div class="chartcard__plot"></div>`;
    container.appendChild(card);
    return $(".chartcard__plot", card);
  }

  /* ============================================================
     TESTE 1 — ÚLTIMO DÍGITO
     ============================================================ */
  function buildLastDigit(d) {
    const t = d.teste_ultimo_digito;
    const mount = $("#lastDigitCharts");
    const vgrid = $("#t1Verdict");
    [["lula", d.resultado.lula.nome, "var(--cand-a)"],
     ["flavio", d.resultado.flavio.nome, "var(--cand-b)"]].forEach(([k, nome, color]) => {
      const c = t[k];
      const expArr = new Array(10).fill(c.esperado_const);
      const plot = buildCard(mount, k, color, nome,
        `χ² <b>${fmtDec(c.chi2, 2)}</b> · p <b>${fmtDec(c.p, 4)}</b>`);
      digitChart(plot, {
        observed: c.observado, expected: expArr, color,
        ariaLabel: `Último dígito das seções de ${nome}: distribuição plana, χ² ${c.chi2}, p ${c.p}`
      });
      vgrid.appendChild(verdictChip(nome, color, `χ²=${fmtDec(c.chi2,2)} · p=${fmtDec(c.p,4)}`, c.veredito, "pass"));
    });
  }

  /* ============================================================
     TESTE 2 — BENFORD
     ============================================================ */
  function buildBenford(d) {
    const t = d.teste_benford;
    const mount = $("#benfordCharts");
    const vgrid = $("#t2Verdict");
    [["lula", d.resultado.lula.nome, "var(--cand-a)"],
     ["flavio", d.resultado.flavio.nome, "var(--cand-b)"]].forEach(([k, nome, color]) => {
      const c = t[k];
      const plot = buildCard(mount, k, color, nome,
        `χ² <b>${fmtInt(c.chi2)}</b> · p <b>≈ 0</b>`);
      digitChart(plot, {
        observed: c.observado, expected: c.esperado, color,
        ariaLabel: `Benford 2º dígito de ${nome}: observado desvia do esperado, χ² ${c.chi2}`
      });
      vgrid.appendChild(verdictChip(nome, color, `χ²=${fmtInt(c.chi2)} · p≈0`, c.veredito, "fail"));
    });
  }

  function verdictChip(name, color, stat, verdict, kind) {
    const el = document.createElement("div");
    el.className = "vchip";
    el.style.setProperty("--c", color);
    el.innerHTML =
      `<span class="vchip__name">${name}</span>
       <span class="vchip__num mono">${stat}</span>
       <span class="vchip__verdict vchip__verdict--${kind}">${verdict}</span>`;
    return el;
  }

  /* ============================================================
     DEMO DE ESCALA (mesma virada: cheia em pessoas, sliver em pontos)
     ============================================================ */
  function buildScaleDemo() {
    const mount = $("#scaleDemo");
    if (!mount) return;
    const people = $(".scale-demo__fill--people", mount);
    const points = $(".scale-demo__fill--points", mount);
    const animate = () => {
      // pessoas: a magnitude inteira (100%); pontos: 2,8 numa escala de 100
      if (RM || !hasGSAP) { people.style.width = "100%"; points.style.width = "2.8%"; return; }
      gsap.to(people, { width: "100%", duration: 1.1, ease: "power2.out" });
      gsap.to(points, { width: "2.8%", duration: 1.1, ease: "power2.out", delay: 0.15 });
    };
    if (RM || !hasST) animate();
    else ScrollTrigger.create({ trigger: mount, start: "top 80%", once: true, onEnter: animate });
  }

  /* ============================================================
     ESTOQUE DE VOTOS (barras horizontais)
     ============================================================ */
  function buildStock(d) {
    const mount = $("#stockChart");
    const items = d.virada.estoque;
    const max = d3.max(items, (x) => x.valor);
    items.forEach((it, i) => {
      const pct = (it.valor / max) * 100;
      const row = document.createElement("div");
      row.className = "stock__item";
      row.innerHTML =
        `<div class="stock__meta">
           <span class="stock__label">${it.rotulo}</span>
           <span class="stock__val mono" data-target="${it.valor}">0</span>
         </div>
         <div class="stock__bar"><div class="stock__bar-fill stock__bar-fill--${i+1}" data-pct="${pct}"></div></div>`;
      mount.appendChild(row);
    });
    const animate = () => {
      $$(".stock__bar-fill", mount).forEach((f) => {
        const pct = f.dataset.pct + "%";
        if (RM || !hasGSAP) { f.style.width = pct; }
        else gsap.to(f, { width: pct, duration: 1, ease: "power2.out" });
      });
      $$(".stock__val", mount).forEach((v) => countUp(v, parseInt(v.dataset.target, 10), {}));
    };
    if (RM || !hasST) animate();
    else ScrollTrigger.create({ trigger: mount, start: "top 78%", once: true, onEnter: animate });
  }

  /* ============================================================
     TRANSFERÊNCIA (barras empilhadas)
     ============================================================ */
  function buildTransfer(d) {
    const mount = $("#transferChart");
    d.virada.transferencia.forEach((r) => {
      const row = document.createElement("div");
      row.className = "transfer__row";
      row.innerHTML =
        `<span class="transfer__origin">${r.origem}</span>
         <div class="transfer__bar" role="img" aria-label="${r.origem}: Lula ${r.lula}%, Flávio ${r.flavio}%, outros ${r.outros}%">
           <div class="transfer__seg transfer__seg--a" data-w="${r.lula}">${r.lula}</div>
           <div class="transfer__seg transfer__seg--b" data-w="${r.flavio}">${r.flavio}</div>
           <div class="transfer__seg transfer__seg--o" data-w="${r.outros}">${r.outros}</div>
         </div>`;
      mount.appendChild(row);
    });
    const animate = () => {
      $$(".transfer__seg", mount).forEach((s, i) => {
        const w = s.dataset.w + "%";
        if (RM || !hasGSAP) { s.style.width = w; }
        else gsap.to(s, { width: w, duration: 0.9, ease: "power2.out", delay: (i % 3) * 0.08 });
      });
    };
    if (RM || !hasST) animate();
    else ScrollTrigger.create({ trigger: mount, start: "top 80%", once: true, onEnter: animate });
  }

  /* ============================================================
     FINGERPRINT — estatísticas + histograma
     ============================================================ */
  function buildFingerprint(d) {
    const t = d.teste_fingerprint;
    const stats = $("#fpStats");
    const cards = [
      { v: fmtDec(t.correlacao, 2), l: "Correlação tamanho × % do vencedor (perto de 0 e negativa)" },
      { v: fmtDec(t.media_share_vencedor, 1) + "%", l: "% médio do vencedor por seção" },
      { v: fmtInt(t.secoes_ge_95), l: "Seções com vencedor ≥ 95% (de 499 mil)" },
      { v: fmtInt(t.secoes_100), l: "Seções beirando 100% (0,006%)" }
    ];
    cards.forEach((c) => {
      const el = document.createElement("div");
      el.className = "fp-stat";
      el.innerHTML = `<div class="fp-stat__v mono">${c.v}</div><div class="fp-stat__l">${c.l}</div>`;
      stats.appendChild(el);
    });

    // histograma
    const mount = $("#fpHistogram");
    const data = t.hist, bins = t.hist_bins;
    const W = 720, H = 300, padL = 16, padR = 12, padT = 16, padB = 46;
    const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH;
    const max = d3.max(data) * 1.05;
    const step = plotW / data.length, bw = step * 0.78;
    const x = (i) => padL + i * step + step / 2;
    const y = (v) => padT + plotH * (1 - v / max);

    const svg = d3.select(mount).append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
      .attr("aria-label", "Distribuição do percentual do vencedor por seção: curva em sino centrada em ~60%, sem pico em 100%");

    svg.append("line").attr("class", "axis-line").attr("x1", padL).attr("x2", W - padR).attr("y1", baseY).attr("y2", baseY);

    const bars = svg.selectAll("rect").data(data).enter().append("rect")
      .attr("class", (d, i) => i >= data.length - 1 ? "fp-bar fp-bar--hot" : "fp-bar")
      .attr("x", (d, i) => x(i) - bw / 2).attr("width", bw)
      .attr("y", (d) => y(d)).attr("height", (d) => baseY - y(d)).attr("rx", 1.5);

    // rótulos de faixa (só alguns, para não poluir no mobile)
    svg.selectAll("text").data(bins).enter().append("text")
      .attr("class", "axis-text")
      .attr("x", (d, i) => x(i)).attr("y", baseY + 16)
      .attr("text-anchor", "end")
      .attr("transform", (d, i) => `rotate(-45 ${x(i)} ${baseY + 16})`)
      .text((d, i) => (i % 2 === 0 ? d.split("–")[0] : ""));

    const drawn = { v: false };
    function draw() {
      if (drawn.v) return; drawn.v = true;
      if (RM || !hasGSAP) return;
      bars.attr("y", baseY).attr("height", 0);
      gsap.to(bars.nodes(), {
        duration: 0.9, ease: "power2.out", stagger: 0.05,
        attr: { y: (i) => y(data[i]), height: (i) => baseY - y(data[i]) }
      });
    }
    if (RM || !hasST) draw();
    else ScrollTrigger.create({ trigger: mount, start: "top 78%", once: true, onEnter: draw });
  }

  /* ============================================================
     SIMULADOR — "1 em 190"
     ============================================================ */
  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

  function buildSim(d) {
    const gap = d.truque_190.surpresa_pontos; // 2,79
    const range = $("#sigmaRange");
    const elSigma = $("#simSigma"), elZ = $("#simZ"), elOdds = $("#simOdds"),
          elVerdict = $("#simVerdict"), elExplain = $("#simExplain");
    const curveMount = $("#simCurve");

    // curva normal + região de cauda (SVG)
    const W = 720, H = 190, padL = 10, padR = 10, padT = 10, padB = 24;
    const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH;
    const XR = 4; // ±4 em z
    const xz = (z) => padL + plotW * (z + XR) / (2 * XR);
    const npdf = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    const peak = npdf(0);
    const yv = (v) => padT + plotH * (1 - v / (peak * 1.1));

    const svg = d3.select(curveMount).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    svg.append("line").attr("class", "axis-line").attr("x1", padL).attr("x2", W - padR).attr("y1", baseY).attr("y2", baseY);

    const pts = d3.range(-XR, XR + 0.01, 0.08);
    const area = d3.area().x((z) => xz(z)).y0(baseY).y1((z) => yv(npdf(z)));
    const linegen = d3.line().x((z) => xz(z)).y((z) => yv(npdf(z)));
    svg.append("path").attr("d", area(pts)).attr("fill", "var(--surface-2)");
    svg.append("path").attr("d", linegen(pts)).attr("fill", "none").attr("stroke", "var(--ink-dim)").attr("stroke-width", 1.4);

    const tailR = svg.append("path").attr("fill", "var(--amber-soft)").attr("stroke", "var(--amber)").attr("stroke-width", 1);
    const tailL = svg.append("path").attr("fill", "var(--amber-soft)").attr("stroke", "var(--amber)").attr("stroke-width", 1);
    const markR = svg.append("line").attr("stroke", "var(--amber)").attr("stroke-width", 1.5).attr("stroke-dasharray", "3 3");
    const markL = svg.append("line").attr("stroke", "var(--amber)").attr("stroke-width", 1.5).attr("stroke-dasharray", "3 3");
    const zlabel = svg.append("text").attr("class", "axis-text").attr("fill", "var(--amber)").attr("text-anchor", "middle");

    function update() {
      const sigma = parseFloat(range.value);
      const z = gap / sigma;
      const p = Math.min(1, 2 * (1 - Phi(z))); // bicaudal
      const odds = p > 0 ? Math.round(1 / p) : Infinity;

      elSigma.textContent = fmtDec(sigma, 2);
      elZ.textContent = fmtDec(z, 2);
      elOdds.textContent = isFinite(odds) ? ("1 em " + fmtInt(odds)) : "1 em 1";

      const common = odds <= 20;
      elVerdict.textContent = common ? "COMUM" : (odds <= 200 ? "INCOMUM" : "“RARÍSSIMO”");
      elVerdict.className = "sim__verdict mono " + (common ? "is-common" : "is-rare");

      // caudas (|Z| >= z)
      const zc = Math.min(z, XR);
      const ptsR = d3.range(zc, XR + 0.01, 0.06);
      const ptsL = d3.range(-XR, -zc + 0.01, 0.06);
      tailR.attr("d", area(ptsR));
      tailL.attr("d", area(ptsL));
      markR.attr("x1", xz(zc)).attr("x2", xz(zc)).attr("y1", baseY).attr("y2", yv(npdf(zc)));
      markL.attr("x1", xz(-zc)).attr("x2", xz(-zc)).attr("y1", baseY).attr("y2", yv(npdf(-zc)));
      zlabel.attr("x", xz(zc)).attr("y", yv(npdf(zc)) - 6).text("z = " + fmtDec(z, 2));

      let msg;
      if (common) {
        msg = `Com o erro <strong>completo</strong> da pesquisa (σ ≈ 2,68, somando amostra, desenho, viés de casa e mudança tardia), uma surpresa de 2,79 pontos é z ≈ ${fmtDec(z,2)}: acontece em cerca de <strong>1 a cada ${fmtInt(odds)} eleições</strong>. É o esperado — pesquisas erram assim o tempo todo.`;
      } else if (odds <= 300) {
        msg = `Aqui está o truque: fingindo que a pesquisa só erra pela <strong>amostra</strong> (σ ≈ 1,0), a mesma surpresa vira “<strong>1 em ${fmtInt(odds)}</strong>” — exatamente o número que viralizou. Nada mudou nos votos; só se jogou fora 3 das 4 fontes de erro.`;
      } else {
        msg = `Encolhendo o σ ainda mais (σ = ${fmtDec(sigma,2)}), a conta cospe “<strong>1 em ${fmtInt(odds)}</strong>”. Quanto menor o σ que você finge, mais “impossível” fica — e é tudo manipulação do denominador, não evidência de fraude.`;
      }
      elExplain.innerHTML = msg;
    }

    range.addEventListener("input", update);
    $$(".sim__tick").forEach((btn) => btn.addEventListener("click", () => {
      range.value = btn.dataset.sigma; update();
    }));
    update();
  }

  /* ============================================================
     DECOMPOSIÇÃO DE VARIÂNCIA
     ============================================================ */
  function buildVariance(d) {
    const mount = $("#varianceBreakdown");
    const fontes = d.truque_190.fontes_erro;
    const maxSig = d3.max(fontes, (f) => f.sigma);
    const head = document.createElement("p");
    head.className = "section__footnote mono";
    head.innerHTML = `As quatro fontes de erro, combinadas em quadratura → σ_total = ${fmtDec(d.truque_190.sigma_total, 2)} pontos.`;
    mount.appendChild(head);
    fontes.forEach((f) => {
      const pct = (f.sigma / maxSig) * 100;
      const row = document.createElement("div");
      row.className = "variance__row";
      row.innerHTML =
        `<span class="variance__label">${f.rotulo}</span>
         <span class="variance__sigma mono">σ = ${fmtDec(f.sigma, 2)}</span>
         <div class="variance__track"><div class="variance__fill" data-pct="${pct}"></div></div>`;
      mount.appendChild(row);
    });
    const animate = () => $$(".variance__fill", mount).forEach((f, i) => {
      const w = f.dataset.pct + "%";
      if (RM || !hasGSAP) f.style.width = w;
      else gsap.to(f, { width: w, duration: 0.8, ease: "power2.out", delay: i * 0.08 });
    });
    if (RM || !hasST) animate();
    else ScrollTrigger.create({ trigger: mount, start: "top 82%", once: true, onEnter: animate });
  }

  /* ============================================================
     GARANTIAS PROCESSUAIS
     ============================================================ */
  function buildProcess() {
    const mount = $("#procList");
    const items = [
      `<strong>Teste público de integridade.</strong> Urnas sorteadas no dia da eleição e votadas na frente de fiscais de todos os partidos, com o voto conferido contra o registro.`,
      `<strong>Boletim de urna impresso.</strong> Cada seção imprime seu resultado ao fechar, antes de qualquer transmissão. Qualquer cidadão pode fotografar, somar e conferir com o total publicado.`,
      `<strong>Código auditado por quem não confia um no outro.</strong> O software das urnas é inspecionado por partidos, OAB, Ministério Público, Polícia Federal e Forças Armadas — adversários entre si, o que torna um conluio inviável.`
    ];
    items.forEach((t) => { const li = document.createElement("li"); li.innerHTML = t; mount.appendChild(li); });
  }

  /* ============================================================
     FÓRMULAS (KaTeX)
     ============================================================ */
  function renderFormulas() {
    if (typeof katex === "undefined") return;
    $$("[data-katex]").forEach((fig) => {
      const holder = document.createElement("div");
      holder.className = "formula__math";
      try {
        katex.render(fig.dataset.katex, holder, { throwOnError: false, displayMode: true });
      } catch (e) { holder.textContent = fig.dataset.katex; }
      fig.insertBefore(holder, fig.firstChild);
    });
  }

  /* ============================================================
     CÓDIGO-FONTE (busca os .py reais e injeta)
     ============================================================ */
  function loadCode() {
    const files = [["scripts/analyze.py", "code-analyze"], ["scripts/fingerprint.py", "code-fingerprint"]];
    files.forEach(([path, id]) => {
      fetch(path).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((txt) => { $("#" + id).textContent = txt; })
        .catch(() => {
          $("#" + id).textContent =
            `# Não foi possível carregar ${path} aqui.\n# Veja o arquivo no repositório do projeto.`;
        });
    });
    $$(".code-block__copy").forEach((btn) => btn.addEventListener("click", () => {
      const code = $("#" + btn.dataset.copy).textContent;
      navigator.clipboard && navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "copiado"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "copiar"; btn.classList.remove("copied"); }, 1600);
      });
    }));
  }

  /* ============================================================
     INIT
     ============================================================ */
  function boot(d) {
    renderFormulas();
    initHero();
    initCountups();
    buildScaleDemo();
    buildStock(d);
    buildTransfer(d);
    buildLastDigit(d);
    buildBenford(d);
    buildFingerprint(d);
    buildSim(d);
    buildVariance(d);
    buildProcess();
    loadCode();
    initReveal();
    initStamps();
    if (hasST) ScrollTrigger.refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    fetch("data.json").then((r) => r.json()).then(boot).catch((err) => {
      console.error("Falha ao carregar data.json", err);
      document.body.insertAdjacentHTML("afterbegin",
        '<p style="padding:1rem;color:#e05d4b;font-family:monospace">Erro ao carregar os dados (data.json). Rode via servidor estático.</p>');
    });
  });
})();
