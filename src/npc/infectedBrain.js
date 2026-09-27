import * as THREE from 'three';
import { sfx } from '../core/sound.js';

// Tuning for hostile infected coworkers.
export const INFECTED = {
  sightRange: 14,       // meters
  fovDegrees: 140,      // total field of view
  touchRange: 2.2,      // always notices you this close
  hearRunning: 6,       // hears you running within this range
  hearVacuum: 8,        // hears the vacuum (sucking or blowing) within this range
  forgetAfter: 6,       // seconds without seeing you before giving up
  wanderSpeed: 0.45,
  chaseSpeed: 2.3,      // you walk at 3.4 and run at 5.6
  attackRange: 1.15,    // starts a lunge this close
  hitRange: 1.5,        // lunge lands if you're still this close
  windup: 0.45,         // seconds of lunge before it lands
  recover: 1.6,         // seconds after a lunge before chasing again
  damage: 10,           // suit integrity per hit
  stunTime: 3,          // seconds stunned by a vacuum blast
  knockback: 6,         // m/s pushed away by a blast
  maxAttackers: 2,      // at most this many lunge at once; the rest crowd around
};

const EYE = 1.55;

// Behavior of one infected coworker:
// dazed â†’ wander â†’ chase â†’ windup â†’ recover â†’ chase ...; a vacuum blast stuns
// them from any state; losing you sends them to where they last saw you.
export class InfectedBrain {
  constructor(npc, env) {
    this.npc = npc;
    this.env = env; // { player, nav, collision, sightIgnore, isHostile, onHit, isNoisy, attackers, canOpenDoors, canAttack }
    this.reset(4 + Math.random() * 3);
  }

  reset(dazedFor) {
    this.state = 'dazed';
    this.timer = dazedFor;
    this.route = null;
    this.repath = 0;
    this.sense = Math.random() * 0.3;
    this.lastSeen = null;
    this.unseenFor = 0;
    this.knock = new THREE.Vector3();
    this.stuckFor = 0;
    this.npc.person.action = null;
  }

  // Vacuum blast from `dir` (horizontal unit vector pointing away from the player).
  stun(dir) {
    this.state = 'stunned';
    this.timer = INFECTED.stunTime;
    this.knock.copy(dir).multiplyScalar(INFECTED.knockback);
    this.route = null;
    this.npc.path = null;
  }

  update(dt) {
    const { npc, env } = this;
    const person = npc.person;
    person.action = null;
    let moving = false;

    this.sense -= dt;
    const checkSenses = this.sense <= 0;
    if (checkSenses) this.sense = 0.25;

    switch (this.state) {
      case 'dazed':
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'wander';
        break;

      case 'wander':
        if (env.isHostile() && checkSenses && this.noticesPlayer()) {
          this.startChase();
          break;
        }
        moving = npc.stepWander(dt);
        break;

      case 'chase': {
        const p = env.player.pos;
        const dist = Math.hypot(p.x - npc.pos.x, p.z - npc.pos.z);
        const sameLevel = Math.abs(p.y - npc.pos.y) < 1;
        if (checkSenses) {
          if (this.canSeePlayer()) {
            this.lastSeen = p.clone();
            this.unseenFor = 0;
          } else {
            this.unseenFor += 0.25;
          }
          if (this.unseenFor > INFECTED.forgetAfter) {
            this.state = 'wander';
            npc.home.copy(npc.pos);
            break;
          }
        }
        if (sameLevel && dist < INFECTED.attackRange && env.isHostile() && this.canReachPlayer()) {
          if (!env.canAttack()) {
            this.facePlayer(dt); // Easy: just loom at arm's length, moaning
          } else if (env.attackers() < INFECTED.maxAttackers) {
            this.state = 'windup';
            this.timer = INFECTED.windup;
            sfx.lunge(npc.pos);
          } else {
            this.facePlayer(dt); // waiting for a turn to lunge
          }
          break;
        }
        moving = this.moveToward(dt, this.unseenFor === 0 ? p : this.lastSeen);
        break;
      }

      case 'windup': {
        this.timer -= dt;
        person.action = 'lunge';
        person.actionT = 1 - this.timer / INFECTED.windup;
        this.facePlayer(dt);
        if (this.timer <= 0) {
          const p = env.player.pos;
          const dist = Math.hypot(p.x - npc.pos.x, p.z - npc.pos.z);
          if (dist < INFECTED.hitRange && Math.abs(p.y - npc.pos.y) < 1 && this.canReachPlayer()) env.onHit(npc);
          this.state = 'recover';
          this.timer = INFECTED.recover;
        }
        break;
      }

      case 'recover':
        this.timer -= dt;
        person.action = 'lunge';
        person.actionT = Math.max(0, this.timer / INFECTED.recover - 0.3);
        if (this.timer <= 0) this.state = 'chase';
        break;

      case 'stunned': {
        this.timer -= dt;
        person.action = 'stunned';
        if (this.knock.lengthSq() > 0.01) {
          npc.move(this.knock.x * dt, this.knock.z * dt);
          this.knock.multiplyScalar(Math.exp(-5 * dt));
        }
        if (this.timer <= 0) {
          this.startChase();
          this.unseenFor = 0;
        }
        break;
      }
    }
    return moving;
  }

  startChase() {
    this.state = 'chase';
    this.lastSeen = this.env.player.pos.clone();
    this.unseenFor = 0;
    this.repath = 0;
    this.npc.path = null;
  }

  noticesPlayer() {
    const { npc, env } = this;
    const p = env.player.pos;
    if (Math.abs(p.y - npc.pos.y) > 2.5) return false;
    const dist = Math.hypot(p.x - npc.pos.x, p.z - npc.pos.z);
    if (dist < INFECTED.touchRange) return true;
    const speed = Math.hypot(env.player.vel.x, env.player.vel.z);
    if (speed > 4 && dist < INFECTED.hearRunning) return true;
    if (env.isNoisy() && dist < INFECTED.hearVacuum) return true;
    return this.canSeePlayer();
  }

  canSeePlayer() {
    const { npc, env } = this;
    const p = env.player.pos;
    const dx = p.x - npc.pos.x;
    const dz = p.z - npc.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > INFECTED.sightRange || Math.abs(p.y - npc.pos.y) > 2.5) return false;
    const facing = Math.sin(npc.yaw) * dx + Math.cos(npc.yaw) * dz;
    const inView = this.state === 'chase' || facing / Math.max(dist, 1e-3) > Math.cos(THREE.MathUtils.degToRad(INFECTED.fovDegrees / 2));
    if (!inView) return false;
    const from = new THREE.Vector3(npc.pos.x, npc.pos.y + EYE, npc.pos.z);
    const to = new THREE.Vector3(p.x, env.player.eyeY, p.z);
    const dir = to.clone().sub(from);
    const d = dir.length();
    dir.divideScalar(d);
    return env.collision.raycast(from, dir, d, env.sightIgnore) >= d;
  }

  // Nothing solid between their chest and yours (a shut door, a wall), so a
  // lunge can actually land.
  canReachPlayer() {
    const { npc, env } = this;
    const p = env.player.pos;
    const from = new THREE.Vector3(npc.pos.x, npc.pos.y + 1.2, npc.pos.z);
    const to = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    const dir = to.clone().sub(from);
    const d = dir.length();
    if (d < 1e-3) return true;
    dir.divideScalar(d);
    return env.collision.raycast(from, dir, d, env.sightIgnore) >= d;
  }

  facePlayer(dt) {
    const p = this.env.player.pos;
    this.npc.turnTowards(Math.atan2(p.x - this.npc.pos.x, p.z - this.npc.pos.z), dt);
  }

  // Straight at the target when there's a clear line, otherwise along the
  // walking network. Returns whether it moved.
  moveToward(dt, target) {
    const { npc, env } = this;
    let aim = target;
    if (!this.clearPath(target)) {
      this.repath -= dt;
      if (!this.route || this.repath <= 0) {
        this.route = env.nav.path(env.nav.nearest(npc.pos), env.nav.nearest(target), env.canOpenDoors());
        this.repath = 0.6;
      }
      while (this.route && this.route.length && Math.hypot(this.route[0].x - npc.pos.x, this.route[0].z - npc.pos.z) < 0.5) {
        this.route.shift();
      }
      // No way through (a shut door they can't open): wait rather than
      // pressing against it. An empty route means they've reached the last
      // waypoint near the target, so go straight for it.
      if (!this.route) return false;
      if (this.route.length) aim = this.route[0];
    } else {
      this.route = null;
    }
    const dx = aim.x - npc.pos.x;
    const dz = aim.z - npc.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return false;
    const step = Math.min(d, INFECTED.chaseSpeed * dt);
    const before = npc.pos.clone();
    npc.move((dx / d) * step, (dz / d) * step);
    npc.turnTowards(Math.atan2(dx, dz), dt);

    // Stuck on a corner: drop the current route and pick a fresh one.
    if (npc.pos.distanceTo(before) < step * 0.3) {
      this.stuckFor += dt;
      if (this.stuckFor > 0.6) {
        this.route?.shift();
        this.repath = 0;
        this.stuckFor = 0;
      }
    } else {
      this.stuckFor = 0;
    }
    return true;
  }

  // Can walk straight there: clear at knee and chest height, same level.
  clearPath(target) {
    const { npc, env } = this;
    if (Math.abs(target.y - npc.pos.y) > 0.6) return false;
    const dir = new THREE.Vector3(target.x - npc.pos.x, 0, target.z - npc.pos.z);
    const d = dir.length();
    if (d < 0.1) return true;
    dir.divideScalar(d);
    for (const h of [0.5, 1.2]) {
      const from = new THREE.Vector3(npc.pos.x, npc.pos.y + h, npc.pos.z);
      if (env.collision.raycast(from, dir, d, env.moveIgnore) < d) return false;
    }
    return true;
  }
}
