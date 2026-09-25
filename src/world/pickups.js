import * as THREE from 'three';

// Rolls of duct tape. { enabled(tape), onTake(tape) } decide when they can be
// picked up and what happens; a taken roll hides until restored.
export function createDuctTape(ctx, spots, { enabled, onTake }) {
  const { scene, materials, interactions } = ctx;
  const tapeGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12);
  const coreGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.074, 10);

  return spots.map((spot, index) => {
    const group = new THREE.Group();
    group.position.set(spot.x, spot.y + 0.035, spot.z);
    group.rotation.y = index * 1.3;
    const roll = new THREE.Mesh(tapeGeo, materials.get('steel'));
    const core = new THREE.Mesh(coreGeo, materials.get('cardboard'));
    group.add(roll, core);
    scene.add(group);
    const tape = {
      index,
      group,
      get taken() { return !group.visible; },
      set taken(v) { group.visible = !v; },
    };
    interactions.add({
      mesh: [roll, core],
      label: 'Take duct tape (patches your suit)',
      enabled: () => !tape.taken && enabled(tape),
      use: () => onTake(tape),
    });
    return tape;
  });
}
