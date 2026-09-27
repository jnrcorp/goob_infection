// Graphics quality presets. 'auto' picks one from the GPU the first time,
// and steps down once if the frame rate can't keep up (see main.js).
export const QUALITY_PRESETS = {
  low: {
    label: 'Low',
    renderScale: 0.67,    // fraction of the screen's resolution
    textureSize: 512,     // procedural texture resolution (pixels)
    normalMaps: false,
    lights: 8,            // nearest dynamic lights
    shadows: 'none',      // real-time sun shadows: 'none' | 'sun' | 'all' (sharper)
    bloom: false,
    msaa: 0,
    fxaa: true,
    smaa: false,
    contactShadows: 1,    // baked soft shadows under furniture (strength)
  },
  medium: {
    label: 'Medium',
    renderScale: 0.85,
    textureSize: 1024,
    normalMaps: true,
    lights: 16,
    shadows: 'sun',
    bloom: true,
    msaa: 0,
    fxaa: false,
    smaa: true,       // (MSAA showed dotted cracks along floor seams at low angles)
    contactShadows: 1,
  },
  high: {
    label: 'High',
    renderScale: 1,
    textureSize: 1024,
    normalMaps: true,
    lights: 24,
    shadows: 'all',
    bloom: true,
    msaa: 0,
    fxaa: false,
    smaa: true,       // (MSAA showed dotted cracks along floor seams at low angles)
    contactShadows: 1,
  },
};

// Title-screen button order.
export const QUALITY_CHOICES = ['auto', 'low', 'medium', 'high'];

// Best guess from the GPU's name: integrated and software GPUs get Low,
// Apple silicon Medium, dedicated NVIDIA/AMD cards High.
export function detectQuality(renderer) {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const touch = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900;
  if (touch || /swiftshader|llvmpipe|software|mali|adreno|powervr/i.test(name)) return 'low';
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|\bamd\b/i.test(name) && !/radeon\(tm\) graphics|vega \d+ graphics/i.test(name)) return 'high';
  if (/apple m\d/i.test(name)) return 'medium';
  if (/intel|radeon|apple/i.test(name)) return 'low';
  return 'medium';
}

// Next preset down (for the automatic step-down), or null at Low.
export function lowerQuality(name) {
  return { high: 'medium', medium: 'low' }[name] ?? null;
}
