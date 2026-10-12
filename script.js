// CRÓNICA PT — JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      navToggle.classList.toggle('active');
    });
    navMenu.querySelectorAll('.nav-link, .btn-nav').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.classList.remove('active');
      });
    });
  }
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  const backToTop = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) backToTop.classList.add('visible');
    else backToTop.classList.remove('visible');
  });
  const fadeElements = document.querySelectorAll('.fade-in');
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  fadeElements.forEach(el => fadeObserver.observe(el));
  const statNumbers = document.querySelectorAll('.stat-number[data-count]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { animateCounter(entry.target); counterObserver.unobserve(entry.target); }
    });
  }, { threshold: 0.5 });
  statNumbers.forEach(stat => counterObserver.observe(stat));
  console.log('CrónicaPT loaded successfully');
});

// ============================================
// MOTOR DE TRADUÇÃO PT <-> EN
// Traduz todos os nós de texto do DOM usando
// o dicionário PT_EN definido em translations.js
// ============================================
let currentLang = localStorage.getItem('lang') || 'pt';
let EN_PT = null;

function buildEnToPt() {
  const m = {};
  for (const [pt, en] of Object.entries(window.PT_EN || {})) m[en] = pt;
  return m;
}

function translateTextNode(node, dict) {
  const t = node.nodeValue;
  const trimmed = t.trim();
  if (!trimmed || trimmed.length < 2) return;
  const idx = t.indexOf(trimmed);
  const rep = dict[trimmed];
  if (rep !== undefined && rep !== trimmed) {
    const lead = t.slice(0, idx);
    const trail = t.slice(idx + trimmed.length);
    node.nodeValue = lead + rep + trail;
  }
}

function walkTextNodes(dict) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeValue.trim().length > 1 &&
                      !/^[€$0-9\s.,%+\-:()|←↑↓→↑↓←↔✓✅🔥₿🏆🏠💰📈📝🏛️⬆️⬇️🔹🔺⭐⚠️]*$/.test(n.nodeValue.trim()))
                    ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => translateTextNode(n, dict));
}

function applyDictToPlaceholders(dict) {
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
    if (!el.dataset.origPh) el.dataset.origPh = el.placeholder;
    const rep = dict[el.dataset.origPh];
    if (rep) el.placeholder = rep;
  });
}

function applyDictToSelects(dict) {
  document.querySelectorAll('select option').forEach(el => {
    if (!el.dataset.origTxt) el.dataset.origTxt = el.textContent;
    const rep = dict[el.dataset.origTxt.trim()];
    if (rep) el.textContent = rep;
  });
}

function translateTitle(title, lang) {
  const dict = lang === 'en' ? window.PT_EN : (EN_PT || (EN_PT = buildEnToPt()));
  let out = title;
  // substitui a parte descritiva, mantém sufixo da marca
  const brand = 'Crónica PT Investimento';
  for (const [pt, en] of Object.entries(dict)) {
    if (pt === brand) continue;
    if (out.includes(pt)) out = out.split(pt).join(en);
  }
  out = out.split(brand).join(lang === 'en' ? 'Crónica PT Investment' : 'Crónica PT Investimento');
  return out;
}

function translatePage(lang) {
  if (!window.PT_EN) return;
  const dict = lang === 'en' ? window.PT_EN : (EN_PT || (EN_PT = buildEnToPt()));
  walkTextNodes(dict);
  applyDictToPlaceholders(dict);
  applyDictToSelects(dict);
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-PT';
  document.title = translateTitle(document.title, lang);
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === lang)
  );
  localStorage.setItem('lang', lang);
  currentLang = lang;
}

function switchLanguage(lang) {
  if (lang === currentLang) return;
  translatePage(lang);
}

// Ao carregar: aplica idioma guardado (EN -> traduz tudo)
window.addEventListener('load', () => {
  if (window.PT_EN && currentLang === 'en') translatePage('en');
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === currentLang)
  );
});

// Forms: mensagens no idioma ativo
function handleSubscribe(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('input[type="text"]')?.value || '';
  const email = form.querySelector('input[type="email"]')?.value || '';
  const msg = currentLang === 'en'
    ? `Thank you, ${name || 'investor'}! 💰\nYou'll receive daily summaries at: ${email}`
    : `Obrigado, ${name || 'investidor'}! 💰\nReceberás resumos diários em: ${email}`;
  alert(msg);
  form.reset();
}

function animateCounter(element) {
  const target = parseInt(element.getAttribute('data-count'), 10);
  const duration = 2000;
  const start = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(update);
    else element.textContent = target;
  }
  requestAnimationFrame(update);
}

function handleSubscribe(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('input[type="text"]')?.value || '';
  const email = form.querySelector('input[type="email"]')?.value || '';
  alert(`Obrigado, ${name || 'investidor'}! 💰\nReceberás resumos diários em: ${email}`);
  form.reset();
}

function handleContact(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('input[type="text"]')?.value || '';
  const email = form.querySelector('input[type="email"]')?.value || '';
  alert(`Mensagem enviada, ${name || 'visitante'}! ✉️\nResponderemos para ${email}.`);
  form.reset();
}

// ============================================
// MOEDA BITCOIN FLUTUANTE (vagueio aleatório)
// Escolhe destinos aleatórios pelo ecrã e vagueia
// entre eles com curvas suaves — movimento imprevisível
// ============================================
(function () {
  function startBtc() {
  const el = document.querySelector('.floating-btc');
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const coin = el.querySelector('.coin');
  let W = window.innerWidth, H = window.innerHeight;
  window.addEventListener('resize', () => { W = window.innerWidth; H = window.innerHeight; });

  // Margens: evita bordas e navbar
  const M = 90, TOP = 130;
  const rand = (a, b) => a + Math.random() * (b - a);

  let x = rand(M, W - M), y = rand(TOP, H - M);   // começa num ponto aleatório
  let tx = x, ty = y;                              // destino atual
  let vx = 0, vy = 0;                              // velocidade (física suave)
  let rot = 0, rotSpeed = rand(-30, 30);           // rotação e velocidade angular

  function novoDestino() {
    tx = rand(M, W - M);
    ty = rand(TOP, H - M);
    rotSpeed = rand(-40, 40); // nova velocidade de rotação a cada destino
  }
  novoDestino();

  const MAX_SPEED = 45;      // px/s — lento e solto
  const STEER = 0.55;        // força de guiamento (curvas suaves)
  let alpha = 0, targetAlpha = 0.35;
  let fadeTimer = rand(4, 10), fadePeriod = rand(8, 20);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Pequenas perturbações aleatórias (turbulência)
    vx += rand(-18, 18) * dt;
    vy += rand(-18, 18) * dt;

    // Guiamento suave em direção ao destino
    const dx = tx - x, dy = ty - y;
    const dist = Math.hypot(dx, dy) || 1;
    vx += (dx / dist) * STEER * 60 * dt;
    vy += (dy / dist) * STEER * 60 * dt;

    // Limita velocidade
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_SPEED) { vx = (vx / sp) * MAX_SPEED; vy = (vy / sp) * MAX_SPEED; }

    x += vx * dt;
    y += vy * dt;

    // Chegou ao destino (ou perto) -> escolhe outro
    if (dist < 40) novoDestino();

    // Mantém dentro do ecrã com rebote suave
    if (x < M)     { x = M;     vx = Math.abs(vx); novoDestino(); }
    if (x > W - M) { x = W - M; vx = -Math.abs(vx); novoDestino(); }
    if (y < TOP)   { y = TOP;   vy = Math.abs(vy); novoDestino(); }
    if (y > H - M) { y = H - M; vy = -Math.abs(vy); novoDestino(); }

    // Rotação orgânica
    rot += rotSpeed * dt;

    // Fade aleatório (desaparece e reaparece)
    fadeTimer += dt;
    if (fadeTimer > fadePeriod) {
      targetAlpha = targetAlpha > 0.05 ? 0 : 0.35;
      fadeTimer = 0;
      fadePeriod = targetAlpha === 0 ? rand(2, 4) : rand(8, 20);
    }
    alpha += (targetAlpha - alpha) * Math.min(dt / 1.8, 1);

    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    coin.style.transform = `rotate(${rot.toFixed(1)}deg)`;
    coin.style.opacity = alpha.toFixed(3);

    requestAnimationFrame(loop);
  }
  // Aparece suavemente no arranque
  targetAlpha = 0.35;
  requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBtc);
  } else {
    startBtc();
  }
})();
