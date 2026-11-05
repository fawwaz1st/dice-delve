export type Easing = (t: number) => number;

export const Ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

export interface TweenHandle {
  cancel(): void;
}

/**
 * Jalankan tween sekali; u callback tiap frame, selesai panggil done.
 * Digerakkan rAF (halus 60fps), tapi dilengkapi fallback timer agar
 * tidak macet saat tab di belakang / rAF tercekik. Gameplay yang
 * di-await selalu selesai dalam (duration + 200)ms wall-clock.
 */
export function tween(opts: {
  duration: number;
  ease?: Easing;
  onUpdate: (t: number) => void;
  onDone?: () => void;
}): TweenHandle {
  const { duration, ease = Ease.outCubic, onUpdate, onDone } = opts;
  const start = performance.now();
  let raf = 0;
  let alive = true;
  let timer: number | undefined;

  const finish = () => {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    if (timer !== undefined) clearTimeout(timer);
    onUpdate(1);
    onDone?.();
  };

  const step = (now: number) => {
    if (!alive) return;
    const t = Math.min(1, (now - start) / duration);
    onUpdate(ease(t));
    if (t < 1) raf = requestAnimationFrame(step);
    else finish();
  };

  raf = requestAnimationFrame(step);
  timer = window.setTimeout(finish, duration + 200);

  return {
    cancel: () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

