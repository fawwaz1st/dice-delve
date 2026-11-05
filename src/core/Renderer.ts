import { WebGPURenderer } from 'three/webgpu';
import { PCFSoftShadowMap, ACESFilmicToneMapping } from 'three/webgpu';
import type { DeviceTier } from './Platform.js';

/** Renderer WebGPU-first dengan fallback WebGL2 otomatis. */
export class Renderer {
  readonly gpu: WebGPURenderer;
  readonly canvas: HTMLCanvasElement;
  readonly tier: DeviceTier;

  private constructor(gpu: WebGPURenderer, canvas: HTMLCanvasElement, tier: DeviceTier) {
    this.gpu = gpu;
    this.canvas = canvas;
    this.tier = tier;
  }

  static async create(canvas: HTMLCanvasElement, tier: DeviceTier): Promise<Renderer> {
    const gpu = new WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    gpu.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1.5 : 2));
    gpu.shadowMap.enabled = true;
    gpu.shadowMap.type = PCFSoftShadowMap;
    gpu.toneMapping = ACESFilmicToneMapping;
    gpu.toneMappingExposure = 1.25;
    await gpu.init();
    return new Renderer(gpu, canvas, tier);
  }

  get backend(): string {
    const backend = this.gpu.backend as unknown as { isWebGPUBackend?: boolean };
    return backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  }

  get drawCalls(): number {
    return this.gpu.info.render.calls;
  }

  setSize(width: number, height: number): void {
    this.gpu.setSize(width, height);
  }

  setPixelRatio(value: number): void {
    this.gpu.setPixelRatio(value);
  }

  render(scene: import('three/webgpu').Scene, camera: import('three/webgpu').Camera): void {
    this.gpu.render(scene, camera);
  }
}
