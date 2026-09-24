import * as THREE from 'three';

// Vertical render resolution. Width follows the window's aspect ratio.
// 240 is authentic PS1; 480 keeps the look with much less shimmer.
export const PS1_HEIGHT = 480;
// Vertex wobble: snaps vertices to the pixel grid like the PS1 did. Off by
// default: it makes nearly-touching surfaces (eyes on a face, a sign on a
// wall) fight over which is in front, which flickers. Debug key 1 toggles it.
const VERTEX_SNAP_DEFAULT = false;
// Higher = chunkier wobble when it's on. 1 snaps to whole low-res pixels.
const VERTEX_JITTER = 1;
// Color steps per channel after quantizing. The PS1 had 32 (15-bit color);
// 64 keeps the banding subtle, so the dither doesn't crawl as you look around.
const COLOR_LEVELS = 63;

const snapUniform = { value: new THREE.Vector2(160, 120) };
const snapOnUniform = { value: VERTEX_SNAP_DEFAULT ? 1 : 0 };

// Runtime toggles, for tracking down visual artifacts.
export const ps1Settings = {
  get vertexSnap() { return snapOnUniform.value > 0.5; },
  set vertexSnap(on) { snapOnUniform.value = on ? 1 : 0; },
};

// Patch a built-in material so its vertices snap to a coarse screen grid,
// giving the PS1's characteristic wobble. Pass { snap: false } for large
// architectural surfaces: snapping the few big triangles of a floor makes
// the whole texture jump as you turn, which reads as flicker.
export function ps1ify(material, { snap = true } = {}) {
  if (!snap) return material;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snapUniform;
    shader.uniforms.uSnapOn = snapOnUniform;
    shader.vertexShader = 'uniform vec2 uSnap;\nuniform float uSnapOn;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (uSnapOn > 0.5 && gl_Position.w > 0.0) {
        gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;
      }`
    );
  };
  return material;
}

// Renders the scene at low resolution, then upscales with nearest-neighbor
// filtering, ordered dithering and reduced color depth.
export class PS1Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.target = new THREE.WebGLRenderTarget(320, PS1_HEIGHT, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
    });

    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(320, PS1_HEIGHT) },
        uDither: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uDither;
        varying vec2 vUv;
        float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
        float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
        void main() {
          gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
          #include <colorspace_fragment>
          float d = (bayer4(vUv * uRes) - 0.5) * uDither;
          gl_FragColor.rgb = clamp(floor(gl_FragColor.rgb * ${COLOR_LEVELS}.0 + d + 0.5) / ${COLOR_LEVELS}.0, 0.0, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(quad);
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  get dither() {
    return this.postMaterial.uniforms.uDither.value > 0.5;
  }

  set dither(on) {
    this.postMaterial.uniforms.uDither.value = on ? 1 : 0;
  }

  setSize(width, height) {
    this.renderer.setSize(width, height, false);
    const h = PS1_HEIGHT;
    const w = Math.max(1, Math.round(h * width / height));
    this.target.setSize(w, h);
    this.postMaterial.uniforms.uRes.value.set(w, h);
    snapUniform.value.set(w / 2 / VERTEX_JITTER, h / 2 / VERTEX_JITTER);
  }

  // overlay: things held in front of the camera (drawn last, over everything,
  // so they never clip into walls).
  render(scene, camera, overlay = null) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    if (overlay) {
      r.autoClear = false;
      r.clearDepth();
      r.render(overlay.scene, overlay.camera);
      r.autoClear = true;
    }
    r.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
