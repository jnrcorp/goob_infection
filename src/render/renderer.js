import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// Filmic tone mapping. Above 1 brightens the whole image.
const EXPOSURE = 1.15;
// Bloom: only things brighter than white (light panels, screens, goob) glow.
const BLOOM = { strength: 0.3, radius: 0.45, threshold: 1.6 };

// Renders the world at the screen's resolution (times the preset's render
// scale) in HDR, then: the held tools on top, bloom, tone
// mapping to sRGB, and anti-aliasing (FXAA on Low, SMAA above). The preset decides which passes run.
export class GameRenderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EXPOSURE;
    this.width = 1;
    this.height = 1;
    this.composer = null;
  }

  // overlay: { scene, camera } for things held in front of the camera, drawn
  // over the world (after clearing depth) so they never clip into walls.
  setup(scene, camera, overlay, preset) {
    Object.assign(this, { scene, camera, overlay });
    this.applyPreset(preset);
  }

  applyPreset(preset) {
    this.preset = preset;
    this.composer?.dispose();
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: preset.msaa });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.overlay) {
      const overlayPass = new RenderPass(this.overlay.scene, this.overlay.camera);
      overlayPass.clear = false;
      overlayPass.clearDepth = true;
      composer.addPass(overlayPass);
    }

    if (preset.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    composer.addPass(new OutputPass());

    if (preset.smaa) composer.addPass(new SMAAPass(1, 1));

    this.fxaa = null;
    if (preset.fxaa) {
      this.fxaa = new ShaderPass(FXAAShader);
      composer.addPass(this.fxaa);
    }
    this.composer = composer;
    this.setSize(this.width, this.height);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    const ratio = Math.min(window.devicePixelRatio, 2) * (this.preset?.renderScale ?? 1);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    if (!this.composer) return;
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.fxaa?.material.uniforms.resolution.value.set(1 / (width * ratio), 1 / (height * ratio));
  }

  render() {
    this.composer.render();
  }
}
