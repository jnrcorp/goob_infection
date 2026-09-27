import * as THREE from 'three';

// Shared clock for every wobbling goob surface.
export const goobTime = { value: 0 };

// Green goob that wobbles slowly in place. The rim glows where you see it
// edge-on (a cheap stand-in for light scattering inside it), and the surface
// normals churn slowly so the shading crawls. The wobble phase comes from
// each instance's position, so neighboring blobs don't pulse in sync.
export function createGoobMaterial({ color = 0x2cb814, emissive = 0x0c4205, amplitude = 0.07 } = {}) {
  const material = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 1 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = goobTime;
    shader.vertexShader = 'uniform float uTime;\nvarying vec3 vGoob;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 goobOrigin = instanceMatrix[3].xyz;
      #else
        vec3 goobOrigin = vec3(0.0);
      #endif
      float goobPhase = goobOrigin.x * 3.1 + goobOrigin.z * 2.3 + goobOrigin.y * 1.7;
      transformed += normal * sin(uTime * 2.2 + goobPhase + position.y * 7.0 + position.x * 5.0) * ${amplitude.toFixed(3)};
      vGoob = position * 9.0 + goobOrigin;`,
    );
    shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vGoob;\n' + shader.fragmentShader
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 churn = vec3(
          sin(vGoob.x * 2.3 + uTime * 1.9) + sin(vGoob.z * 3.1 - uTime * 1.3),
          sin(vGoob.y * 2.7 + uTime * 1.6),
          sin(vGoob.z * 2.1 + uTime * 2.2) + sin(vGoob.x * 3.3 + uTime * 1.1));
        normal = normalize(normal + churn * 0.08);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float goobRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
        totalEmissiveRadiance += vec3(0.2, 0.85, 0.1) * goobRim * 0.45;`,
      );
  };
  material.customProgramCacheKey = () => `goob-${amplitude}`;
  return material;
}
