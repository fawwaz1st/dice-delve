/* ==========================================================================
   Ular Tangga Modern — confetti.js
   Perayaan kemenangan: keping kertas manila & cat poster meloncat dari dua
   sisi meja. Satu canvas dibuat sesuai kebutuhan dan dibuang saat selesai.
   Menghormati prefers-reduced-motion: tanpa gerakan, tanpa kanvas.
   ========================================================================== */

(function () {
  'use strict';

  const COLORS = ['#e8542e', '#3f6db3', '#4e8f5b', '#eab54d', '#3fa7b5', '#f3e0bd'];

  let canvas = null;
  let ctx = null;
  let raf = 0;
  let parts = [];
  let running = false;

  function ensureCanvas() {
    if (canvas) return Boolean(ctx);
    canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    return Boolean(ctx);
  }

  function fitCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeParts(count) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    parts = [];
    for (let i = 0; i < count; i += 1) {
      const fromLeft = Math.random() < 0.5;
      parts.push({
        x: fromLeft ? -10 : W + 10,
        y: H * (0.16 + Math.random() * 0.3),
        vx: (fromLeft ? 1 : -1) * (3.2 + Math.random() * 4.4),
        vy: -(6.5 + Math.random() * 6.5),
        g: 0.16 + Math.random() * 0.08,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.25,
        life: 0,
      });
    }
  }

  function tick() {
    if (!ctx || !canvas) return;
    fitCanvas();
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);

    let alive = false;
    for (const p of parts) {
      p.life += 1;
      p.vy += p.g;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      if (p.y < H + 24 && p.life < 260) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life / 260);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
    }

    if (alive) {
      raf = requestAnimationFrame(tick);
    } else {
      running = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, W, H);
      // Canvas dibuang agar DOM tidak menumpuk setelah perayaan selesai.
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
      if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
    }
  }

  /** Ledakan keping dari dua sisi layar. count = jumlah keping. */
  let resizeHandler = null;

  function burst(count = 150) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!ensureCanvas()) return;
    fitCanvas();
    makeParts(count);
    if (!running) {
      running = true;
      resizeHandler = () => { if (canvas) fitCanvas(); };
      window.addEventListener('resize', resizeHandler);
      raf = requestAnimationFrame(tick);
    }
  }

  window.UT = window.UT || {};
  window.UT.confetti = { burst };
})();
