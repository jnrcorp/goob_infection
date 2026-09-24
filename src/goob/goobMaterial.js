import * as THREE from 'three';

// Shared clock for every wobbling goob surface.
export const goobTime = { value: 0 };

// Glossy green goob that wobbles slowly in place. The wobble phase comes from
// each instance's position, so neighboring blobs don't pulse in sync.
export function createGoobMaterial({ color = 0x4cff2e, emissive = 0x145a08, amplitude = 0.07 } = {}) {
  const material = new THREE.MeshLambertMaterial({ color, emissive });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = goobTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 goobOrigin = instanceMatrix[3].xyz;
      #else
        vec3 goobOrigin = vec3(0.0);
      #endif
      float goobPhase = goobOrigin.x * 3.1 + goobOrigin.z * 2.3 + goobOrigin.y * 1.7;
      transformed += normal * sin(uTime * 2.2 + goobPhase + position.y * 7.0 + position.x * 5.0) * ${amplitude.toFixed(3)};`
    );
  };
  return material;
}
