/* Table2Eat — scroll animations & page choreography */
gsap.registerPlugin(ScrollTrigger);

/* ---------- NAV: shrink + glass on scroll ---------- */
const nav = document.getElementById('nav');
ScrollTrigger.create({
  start: 'top -60',
  end: 99999,
  onUpdate(self){ nav.classList.toggle('is-scrolled', self.scroll() > 60); }
});

/* ---------- HERO entrance (page load) ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const tl = gsap.timeline({ defaults:{ ease:'expo.out' } });
  tl.to('.hero .eyebrow', { opacity:1, y:0, duration:.9 }, .1)
    .to('.hero-title', { opacity:1, y:0, duration:1.1 }, .22)
    .to('.hero-sub', { opacity:1, y:0, duration:1, }, .4)
    .to('.hero-actions', { opacity:1, y:0, duration:.9 }, .52)
    .to('.hero-note', { opacity:1, y:0, duration:.8 }, .62)
    .to('.hero-blob', { opacity:1, scale:1, duration:1.3, ease:'power3.out',
        clearProps:'transform' }, .3)
    .fromTo('.hero-blob img', { scale:1.25 }, { scale:1.08, duration:2, ease:'power2.out' }, .3)
    .to('.hero-badge', { opacity:1, y:0, duration:.9 }, .75);
});

/* initial states for hero pieces (set immediately, before load tl runs) */
gsap.set('.hero .eyebrow, .hero-sub, .hero-actions, .hero-note, .hero-badge', { opacity:0, y:22 });
gsap.set('.hero-title', { opacity:0, y:34 });
gsap.set('.hero-blob', { opacity:0, scale:.9 });

/* ---------- Generic [data-reveal] scroll entrances, varied by type ---------- */
const revealTypes = {
  up:    { from:{ opacity:0, y:46 },              to:{ opacity:1, y:0 } },
  fade:  { from:{ opacity:0, y:24, scale:.97 },   to:{ opacity:1, y:0, scale:1 } },
  scale: { from:{ opacity:0, scale:.82 },         to:{ opacity:1, scale:1 } },
  clip:  { from:{ opacity:1, clipPath:'inset(0 0 100% 0 round 28px)' }, to:{ clipPath:'inset(0 0 0% 0 round 28px)' } },
};

document.querySelectorAll('[data-reveal]').forEach((el, i) => {
  const type = revealTypes[el.dataset.reveal] || revealTypes.up;
  if (el.closest('.hero')) return; // hero handled by load timeline
  gsap.set(el, type.from);
  gsap.to(el, {
    ...type.to,
    duration: 1,
    ease: 'expo.out',
    delay: (i % 5) * 0.06,
    scrollTrigger: {
      trigger: el,
      start: 'top 88%',
      once: true,
    }
  });
});

/* stagger bento cards within their own section (overrides generic single-el trigger timing) */
gsap.utils.toArray('.bento').forEach(grid => {
  const cards = grid.querySelectorAll('.bento-card');
  ScrollTrigger.batch(cards, {
    start: 'top 90%',
    onEnter: batch => gsap.to(batch, { opacity:1, y:0, scale:1, duration:.9, ease:'expo.out', stagger:.1 }),
    once:true
  });
});

/* ---------- Marquee: link speed to scroll velocity ---------- */
const marqueeTrack = document.getElementById('marqueeTrack');
if (marqueeTrack) {
  let baseTween = gsap.to(marqueeTrack, { xPercent:-50, duration:22, ease:'none', repeat:-1 });
  ScrollTrigger.create({
    trigger: '.marquee-strip',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate(self){
      const vel = self.getVelocity ? self.getVelocity() : 0;
      const speed = gsap.utils.clamp(0.4, 3, 1 + Math.abs(vel) / 2000);
      baseTween.timeScale(speed);
    }
  });
}

/* ---------- About: pinned story text crossfade ---------- */
const storyTrack = document.getElementById('storyTrack');
if (storyTrack) {
  const lines = storyTrack.querySelectorAll('.story-line');
  gsap.set(lines, { opacity:0, y:14 });
  gsap.set(lines[0], { opacity:1, y:0 });

  ScrollTrigger.create({
    trigger: '.about',
    start: 'top top',
    end: '+=140%',
    pin: true,
    scrub: false,
    onUpdate(self){
      const idx = Math.min(lines.length - 1, Math.floor(self.progress * lines.length));
      lines.forEach((line, i) => {
        const active = i === idx;
        if (active && !line.dataset.shown) {
          line.dataset.shown = '1';
          gsap.to(line, { opacity:1, y:0, duration:.6, ease:'power2.out' });
          lines.forEach((other,j) => { if (j!==i) gsap.to(other, { opacity:0, y:-10, duration:.5 }); });
        }
      });
    }
  });
}

/* ---------- Reserve CTA heading: subtle horizontal drift on scroll ---------- */
gsap.to('.reserve-title', {
  xPercent: -3,
  ease: 'none',
  scrollTrigger: {
    trigger: '.reserve-cta',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1
  }
});

/* ---------- Buttons that open booking flow ---------- */
document.querySelectorAll('#openBookingBtn, #openBookingBtn2, #openBookingBtn3, #openBookingBtn4')
  .forEach(btn => btn.addEventListener('click', (e) => window.Table2EatBooking?.open(e.currentTarget)));
