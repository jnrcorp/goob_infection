import * as THREE from 'three';

// Vertical render resolution. Width follows the window's aspect ratio.
export const PS1_HEIGHT = 240;
// Higher = chunkier vertex wobble. 1 snaps vertices to whole low-res pixels.
const VERTEX_JITTER = 1.5;
// Colors per channel after quantizing (PS1 used 15-bit color: 32 levels).
const COLOR_LEVELS = 31;

const snapUniform = { value: new THREE.Vector2(160, 120) };

// Patch a built-in material so its vertices snap to a coarse screen grid,
// giving the PS1's characteristic wobble.
export function ps1ify(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snapUniform;
    shader.vertexShader = 'uniform vec2 uSnap;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;`
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
        varying vec2 vUv;
        float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
        float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
        void main() {
          gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
          #include <colorspace_fragment>
          float d = bayer4(vUv * uRes) - 0.5;
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

  setSize(width, height) {
    this.renderer.setSize(width, height, false);
    const h = PS1_HEIGHT;
    const w = Math.max(1, Math.round(h * width / height));
    this.target.setSize(w, h);
    this.postMaterial.uniforms.uRes.value.set(w, h);
    snapUniform.value.set(w / 2 / VERTEX_JITTER, h / 2 / VERTEX_JITTER);
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
