/* Table2Eat — motion system */
gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 900px)').matches;

const qs = (s, ctx = document) => ctx.querySelector(s);
const qsa = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

/* ============================================================
   NAV — glass background on scroll
   ============================================================ */
function initNav() {
  const nav = qs('#nav');
  ScrollTrigger.create({
    start: 'top -60',
    end: 99999,
    onUpdate(self) { nav.classList.toggle('is-scrolled', self.scroll() > 60); }
  });
}

/* ============================================================
   QUIET CURSOR TRAIL — a small soft dot that lags the real cursor.
   No ring, no blend mode, no system-cursor replacement: a subtle
   tactile touch that stays out of the way. Desktop only.
   ============================================================ */
function initCursorTrail() {
  if (reduceMotion || isMobile) return;
  const dot = qs('#cursorTrail');
  if (!dot) return;
  gsap.set(dot, { xPercent: -50, yPercent: -50 });
  const xTo = gsap.quickTo(dot, 'x', { duration: .55, ease: 'power3' });
  const yTo = gsap.quickTo(dot, 'y', { duration: .55, ease: 'power3' });
  window.addEventListener('mousemove', (e) => {
    xTo(e.clientX); yTo(e.clientY);
    dot.classList.add('visible');
  });
  window.addEventListener('mouseleave', () => dot.classList.remove('visible'));
}

/* ============================================================
   MAGNETIC BUTTONS — every .btn drifts gently toward the cursor
   ============================================================ */
function initMagnetic() {
  if (reduceMotion || isMobile) return;
  qsa('.btn').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: .5, ease: 'power3' });
    const yTo = gsap.quickTo(btn, 'y', { duration: .5, ease: 'power3' });
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * .3);
      yTo((e.clientY - r.top - r.height / 2) * .3);
    });
    btn.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}

/* ============================================================
   HERO — split-line title reveal + staggered entrance
   ============================================================ */
function initHero() {
  const heroLines = qsa('.hero-title .split-line-inner');

  if (reduceMotion) {
    gsap.set(heroLines, { yPercent: 0 });
    gsap.set('.hero .eyebrow, .hero-sub, .hero-actions, .hero-note, .hero-badge', { opacity: 1, y: 0 });
    gsap.set('.hero-blob', { opacity: 1, scale: 1 });
    return;
  }

  gsap.set(heroLines, { yPercent: 110 });
  gsap.set('.hero .eyebrow, .hero-sub, .hero-actions, .hero-note, .hero-badge', { opacity: 0, y: 22 });
  gsap.set('.hero-blob', { opacity: 0, scale: .9 });

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero .eyebrow', { opacity: 1, y: 0, duration: .9 }, .1)
    .to(heroLines, { yPercent: 0, duration: 1.1, stagger: .12 }, .22)
    .to('.hero-sub', { opacity: 1, y: 0, duration: 1 }, .5)
    .to('.hero-actions', { opacity: 1, y: 0, duration: .9 }, .62)
    .to('.hero-note', { opacity: 1, y: 0, duration: .8 }, .7)
    .to('.hero-blob', { opacity: 1, scale: 1, duration: 1.3, ease: 'power3.out' }, .3)
    .fromTo('.hero-blob img', { scale: 1.25 }, { scale: 1.08, duration: 2, ease: 'power2.out' }, .3)
    .to('.hero-badge', { opacity: 1, y: 0, duration: .9 }, .85);

  /* idle life at rest — the dish keeps a slow breathing float once it has
     settled in, so it doesn't just go still after the entrance finishes.
     Paused while the hero is off-screen so it isn't burning frame budget
     (and competing with Lenis's own per-frame work) for the whole session. */
  gsap.delayedCall(2.3, () => {
    const floatTl = gsap.timeline({ repeat: -1, yoyo: true })
      .to('.hero-blob', { y: -8, duration: 2.8, ease: 'sine.inOut' }, 0)
      .to('.hero-blob', { rotation: 1.2, duration: 2.8, ease: 'sine.inOut' }, 0);
    ScrollTrigger.create({
      trigger: '.hero', start: 'top bottom', end: 'bottom top',
      onEnter: () => floatTl.play(),
      onLeave: () => floatTl.pause(),
      onEnterBack: () => floatTl.play(),
      onLeaveBack: () => floatTl.pause(),
    });
  });
}

/* ============================================================
   SPLIT-LINE section headings (outside the hero) — masked reveal
   on scroll instead of the hero's page-load timeline
   ============================================================ */
function initSplitHeadings() {
  const groups = qsa('.section-title, .reserve-title');
  groups.forEach((heading) => {
    const inners = qsa('.split-line-inner', heading);
    if (!inners.length) return;
    if (reduceMotion) { gsap.set(inners, { yPercent: 0 }); return; }
    gsap.set(inners, { yPercent: 110 });
    gsap.to(inners, {
      yPercent: 0, duration: 1, stagger: .1, ease: 'expo.out',
      scrollTrigger: { trigger: heading, start: 'top 88%', once: true }
    });
  });
}

/* ============================================================
   Generic [data-reveal] scroll entrances, varied by type
   ============================================================ */
function initReveals() {
  const revealTypes = {
    up:    { from: { opacity: 0, y: 46 },            to: { opacity: 1, y: 0 } },
    fade:  { from: { opacity: 0, y: 24, scale: .97 }, to: { opacity: 1, y: 0, scale: 1 } },
    scale: { from: { opacity: 0, scale: .82 },        to: { opacity: 1, scale: 1 } },
    clip:  { from: { opacity: 1, clipPath: 'inset(0 0 100% 0 round 28px)' }, to: { clipPath: 'inset(0 0 0% 0 round 28px)' } },
  };

  /* One ScrollTrigger per element here would mean 20-30+ separate
     instances across the page, each needing bounds-checking on every
     scroll tick. Grouping by reveal type and using ScrollTrigger.batch
     (GSAP's own recommendation for "many similar reveal elements") cuts
     that down to one batched trigger per type instead. */
  const groups = { up: [], fade: [], scale: [], clip: [] };
  qsa('[data-reveal]').forEach((el) => {
    if (el.closest('.hero')) return; // hero handled by initHero
    const key = revealTypes[el.dataset.reveal] ? el.dataset.reveal : 'up';
    groups[key].push(el);
  });

  Object.entries(groups).forEach(([key, els]) => {
    if (!els.length) return;
    const type = revealTypes[key];
    if (reduceMotion) { gsap.set(els, type.to); return; }
    gsap.set(els, type.from);
    ScrollTrigger.batch(els, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { ...type.to, duration: 1, ease: 'expo.out', stagger: 0.06 }),
    });
  });

  /* stagger bento cards within their own section (reviews grid gets its
     own scattered-settle treatment instead — see initReviewsScatter) */
  qsa('.bento').forEach((grid) => {
    if (grid.id === 'reviewsBento') return;
    const cards = qsa('.bento-card', grid);
    if (reduceMotion) { gsap.set(cards, { opacity: 1, y: 0, scale: 1 }); return; }
    ScrollTrigger.batch(cards, {
      start: 'top 90%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'expo.out', stagger: .1 }),
      once: true
    });
  });
}

/* ============================================================
   MENU BENTO — pointer-tilt on the photo cards (skips the
   glassmorphism quote card mixed into the same grid)
   ============================================================ */
function initBentoTilt() {
  if (reduceMotion || isMobile) return;
  qsa('#menu .bento-card:not(.glass-note)').forEach((card) => {
    const rxTo = gsap.quickTo(card, 'rotationX', { duration: .6, ease: 'power3' });
    const ryTo = gsap.quickTo(card, 'rotationY', { duration: .6, ease: 'power3' });
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const py = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      ryTo(px * 8);
      rxTo(py * -8);
    });
    card.addEventListener('mouseleave', () => { rxTo(0); ryTo(0); });
  });
}

/* ============================================================
   REVIEWS — scattered-note entrance, straightens on hover
   ============================================================ */
function initReviewsScatter() {
  const grid = qs('#reviewsBento');
  if (!grid) return;
  const cards = qsa('.bento-card', grid);

  const starts = [
    { x: -50, y: -34, rotation: -11 },
    { x: 46, y: 26, rotation: 8 },
    { x: -40, y: 38, rotation: -7 },
    { x: 44, y: -30, rotation: 9 },
  ];
  const rest = [-2, 1.5, -1, 2];

  if (reduceMotion) { gsap.set(cards, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }); return; }

  cards.forEach((card, i) => gsap.set(card, { opacity: 0, scale: .82, ...starts[i % starts.length] }));

  ScrollTrigger.create({
    trigger: grid, start: 'top 85%', once: true,
    onEnter: () => cards.forEach((card, i) => {
      gsap.to(card, {
        opacity: 1, scale: 1, x: 0, y: 0, rotation: rest[i % rest.length],
        duration: 1.1, ease: 'back.out(1.6)', delay: i * .12
      });
    })
  });

  cards.forEach((card, i) => {
    const hoverTl = gsap.timeline({ paused: true });
    hoverTl.to(card, { rotation: 0, y: -8, scale: 1.03, duration: .4, ease: 'power3.out' });
    card.addEventListener('mouseenter', () => hoverTl.play());
    card.addEventListener('mouseleave', () => hoverTl.reverse());
  });
}

/* ============================================================
   TASTING REEL — horizontal pinned scroll through more dishes
   ============================================================ */
function initTastingReel() {
  const track = qs('#tastingTrack');
  if (!track) return;
  const cards = qsa('.tasting-card', track);

  if (reduceMotion || isMobile) {
    gsap.set(cards, { opacity: 1, scale: 1 });
    return;
  }

  const getDistance = () => track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(document.documentElement).fontSize) * 3;

  const scrollTween = gsap.to(track, {
    x: () => -getDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.tasting-pin',
      start: 'top top',
      end: () => '+=' + getDistance(),
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true
    }
  });

  cards.forEach((card) => {
    gsap.fromTo(card, { scale: .9, autoAlpha: .5 }, {
      scale: 1, autoAlpha: 1, ease: 'none',
      scrollTrigger: {
        trigger: card, containerAnimation: scrollTween,
        start: 'left 90%', end: 'left 55%', scrub: true
      }
    });
  });
}

/* ============================================================
   COUNT-UP NUMBERS — About section stats
   ============================================================ */
function initCountUps() {
  qsa('[data-count-to]').forEach((el) => {
    const target = parseFloat(el.dataset.countTo);
    const decimals = parseInt(el.dataset.decimals || '0', 10);

    if (reduceMotion) { el.textContent = target.toFixed(decimals); return; }

    const counter = { val: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(counter, {
        val: target, duration: 1.6, ease: 'power2.out',
        onUpdate: () => { el.textContent = counter.val.toFixed(decimals); }
      })
    });
  });
}

/* ============================================================
   MARQUEE — velocity-linked speed on scroll
   ============================================================ */
function initMarquee() {
  const track = qs('#marqueeTrack');
  if (!track || reduceMotion) return;
  const baseTween = gsap.to(track, { xPercent: -50, duration: 22, ease: 'none', repeat: -1, paused: true });
  ScrollTrigger.create({
    trigger: '.marquee-strip',
    start: 'top bottom',
    end: 'bottom top',
    onEnter: () => baseTween.play(),
    onLeave: () => baseTween.pause(),
    onEnterBack: () => baseTween.play(),
    onLeaveBack: () => baseTween.pause(),
    onUpdate(self) {
      const vel = self.getVelocity ? self.getVelocity() : 0;
      const speed = gsap.utils.clamp(0.4, 3, 1 + Math.abs(vel) / 2000);
      baseTween.timeScale(speed);
    }
  });
}

/* ============================================================
   ABOUT — pinned story text, alternating left/right slide-in
   (skipped under reduced motion: all lines shown stacked instead)
   ============================================================ */
function initAboutStory() {
  const storyTrack = qs('#storyTrack');
  if (!storyTrack) return;
  const lines = qsa('.story-line', storyTrack);
  const sides = [-46, 46, -46, 46]; // alternate entry side per line index

  if (reduceMotion) {
    storyTrack.style.position = 'static';
    storyTrack.style.minHeight = 'auto';
    lines.forEach((line) => {
      line.style.position = 'static';
      line.style.opacity = 1;
      line.style.marginBottom = '1rem';
    });
    return;
  }

  gsap.set(lines, { opacity: 0 });
  lines.forEach((line, i) => gsap.set(line, { x: sides[i % sides.length] }));
  gsap.set(lines[0], { opacity: 1, x: 0 });

  ScrollTrigger.create({
    trigger: '.about',
    start: 'top top',
    end: '+=140%',
    pin: true,
    scrub: false,
    onUpdate(self) {
      const idx = Math.min(lines.length - 1, Math.floor(self.progress * lines.length));
      lines.forEach((line, i) => {
        if (i === idx && !line.dataset.shown) {
          line.dataset.shown = '1';
          gsap.to(line, { opacity: 1, x: 0, duration: .7, ease: 'power3.out' });
          lines.forEach((other, j) => {
            if (j !== i) gsap.to(other, { opacity: 0, x: sides[j % sides.length] * .6, duration: .5 });
          });
        }
      });
    }
  });
}

/* ============================================================
   RESERVE CTA — subtle horizontal drift on scroll
   ============================================================ */
function initReserveDrift() {
  if (reduceMotion) return;
  gsap.to('.reserve-title', {
    xPercent: -3,
    ease: 'none',
    scrollTrigger: { trigger: '.reserve-cta', start: 'top bottom', end: 'bottom top', scrub: 1 }
  });
}

/* ============================================================
   Booking flow open triggers
   ============================================================ */
function initBookingTriggers() {
  qsa('#openBookingBtn, #openBookingBtn2, #openBookingBtn3, #openBookingBtn4')
    .forEach((btn) => btn.addEventListener('click', (e) => window.Table2EatBooking?.open(e.currentTarget)));
}

/* ============================================================
   INIT — wait for the custom fonts (Fraunces/Instrument Sans) so
   the split-line masks measure against final text metrics
   ============================================================ */
document.fonts.ready.then(() => {
  initNav();
  initCursorTrail();
  initMagnetic();
  initHero();

  /* Both of these pin a section and add a pin-spacer that pushes every
     later-in-document element further down. They must run (and be
     refreshed) BEFORE any trigger is created for content below them —
     otherwise that trigger's start position is calculated short by the
     pin's added scroll distance and can fire the instant it's created. */
  initTastingReel();
  initAboutStory();
  ScrollTrigger.refresh();

  initSplitHeadings();
  initReveals();
  initBentoTilt();
  initReviewsScatter();
  initCountUps();
  initMarquee();
  initReserveDrift();
  initBookingTriggers();

  ScrollTrigger.refresh();
  window.addEventListener('resize', () => ScrollTrigger.refresh());

  /* images (several hotlinked, off the critical path) can still be loading
     when the block above runs — ScrollTrigger's cached trigger positions
     need a resync once the page reaches full height, or pinned sections
     can land short */
  window.addEventListener('load', () => ScrollTrigger.refresh());
});
