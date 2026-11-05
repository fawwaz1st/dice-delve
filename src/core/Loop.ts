/** Loop permainan: fixed timestep + interpolasi, render didecouple. */
export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private readonly step = 1 / 60;
  private readonly maxFrame = 0.25;

  constructor(
    private readonly update: UpdateFn,
    private readonly render: RenderFn,
  ) {}

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    let frame = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frame > this.maxFrame) frame = this.maxFrame;
    this.accumulator += frame;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    const alpha = this.accumulator / this.step;
    this.render(alpha);
    requestAnimationFrame(this.tick);
  };
}
