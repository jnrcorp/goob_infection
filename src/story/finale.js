import * as THREE from 'three';
import { Person } from '../npc/person.js';
import { CURED_LINES } from '../npc/cast.js';
import { sfx } from '../core/sound.js';

// The ending after you expose Goob Co. and get out of the building:
// police in the parking lot lead Victoria away in handcuffs, your coworkers
// gather round, the evening news breaks the story, and the credits roll.

// Where things happen (the parking lot, in front of the entrance at x 19).
const PLAYER_SPOT = { x: 15.5, y: 0, z: -2.6 };
const POLICE_CARS = [{ x: 22, z: -9, heading: Math.PI / 2 }, { x: 10.5, z: -9, heading: -Math.PI / 2 }];
const VICTORIA_ROUTE = [{ x: 19, z: -0.8 }, { x: 20.2, z: -4.5 }, { x: 21.2, z: -7.5 }];
// Coworkers who come out to see, standing in an arc facing you.
const GATHER = [
  { name: 'Dale', x: 12.6, z: -4.4 }, { name: 'Priya', x: 11.6, z: -5.6 }, { name: 'Hank', x: 12.3, z: -6.8 },
  { name: 'Nell', x: 13.6, z: -7.5 }, { name: 'Kevin', x: 15, z: -7.6 }, { name: 'Pat', x: 16.3, z: -7.1 },
  { x: 10.6, z: -6.9 }, { x: 11.4, z: -8.2 }, { x: 14.3, z: -8.9 }, { x: 17.2, z: -8.3 },
];

const ARREST = [
  { speaker: 'Officer', text: 'Victoria, you are under arrest. You have the right to remain silent.' },
  { speaker: 'Victoria', text: 'Careful with the suit. It’s Italian.' },
  { speaker: 'Victoria', text: 'This isn’t over, Champ. People will always want goob. Goob is forever.' },
];
const COWORKERS = [
  { speaker: 'Dale', text: 'Champ! You did it! I… I had no idea. The rotation, the plaques. I just announced the winners.' },
  { speaker: 'Priya', text: 'Gary’s mug is still in the sink. I’m going to wash it. For Gary.' },
  { speaker: 'Hank', text: 'I had goob on my sandwich this morning. I’m never eating again.' },
  { speaker: 'Nell', text: 'Denise, Phil, Rosa, Ken… At least their families will finally know.' },
  { speaker: 'Kevin', text: 'So… are we still getting paid this week?' },
  { speaker: 'Dale', text: 'Go home, Champ. Take tomorrow off. Take the whole week. That’s an order. Probably my last one.' },
];
const NEWS = [
  'Good evening. Our top story tonight: Goob Co., makers of the popular household goob, has been shut down after a whistleblower walked out of its headquarters with a stack of internal files.',
  'The documents show that five employees the company said had been “transferred” — Gary Pruitt, Denise Okafor, Phil Hammond, Rosa Delgado and Ken Ashby — were in fact, and I’m reading this directly, “input.”',
  'CEO Victoria has been taken into custody. Goob Co.’s Mars shipments are grounded, and health officials urge anyone with goob at home not to eat it. Under any circumstances.',
  'The whistleblower, known to coworkers only as “Champ,” declined to comment. Coming up after the break: is your office plant plotting against you?',
];
const RESCUED = [
  { speaker: 'Dr. Pell', text: 'Fresh air. Real air. Not goob air. Champ, I owe you my life. All of us do.' },
  { speaker: 'Nell', text: 'Ten of us. Ten of us who aren’t going to Mars on Friday.' },
  { speaker: 'Otis', text: 'Twenty years I guarded that place. First time I ever walked out the front.' },
  { speaker: 'Martin', text: 'I’m going to find every plaque Victoria ever handed out, and I’m going to melt them down.' },
  { speaker: 'Kevin', text: 'I’m still a little green. Is that normal? Dr. Pell, is that normal?' },
  { speaker: 'Dr. Pell', text: 'Perfectly normal, Kevin. Probably. Let’s get you all home.' },
];
const NEWS_2 = [
  'Good evening. A week after Goob Co. was shut down, police have uncovered a secret facility beneath the company’s headquarters: a level not shown on any building plan.',
  'Ten employees were found held in cells there, scheduled for what internal documents call “transfer.” All ten were brought out alive by the same anonymous whistleblower known only as “Champ.”',
  'Goob Co.’s final Mars shipment, set to launch Friday, has been seized. Authorities say the facility’s vats will be drained and sealed. And no, there was no B2.',
];
const CREDITS_2 = `
  <h2>The Goob Infection</h2>
  <p class="credits-sub">Chapter 2: The True Facility</p>
  <h3>Starring</h3>
  <p>Champ <span>as themselves, again</span></p>
  <p>Dr. Pell <span>as The Letter Writer</span></p>
  <p>Martin · Nell · Kevin · Ivo · Luis <span>as The Next Rotation</span></p>
  <p>Guard Reyes · Guard Blake · Guard Okoro <span>as Security (Night Shift)</span></p>
  <p>The Goob <span>as The Goob</span></p>
  <h3>In memory of</h3>
  <p>Gary Pruitt · Denise Okafor · Phil Hammond · Rosa Delgado · Ken Ashby</p>
  <h3>Game</h3>
  <p>jnrcorp, with Claude</p>
  <p class="credits-note">There is no B2.</p>
  <h2 class="credits-end">Thanks for playing</h2>
`;
const CREDITS_SECONDS = 40;
const CREDITS = `
  <h2>The Goob Infection</h2>
  <p class="credits-sub">Chapter 1: The Infection</p>
  <h3>Starring</h3>
  <p>Champ <span>as themselves</span></p>
  <p>Dale <span>as The Manager</span></p>
  <p>Victoria <span>as The CEO</span></p>
  <p>Hank <span>as Patient Zero</span></p>
  <p>Priya · Tom · Marcy · Kevin · Luis · Janet · Walt · Brad · Olu · Deb · Stan · Rhonda · Mo · Earl · Gus · Nell · Pat · Carla · Martin · Rex · Lorraine · Chip · Dr. Pell · Ivo · Terry · Sal · Dwayne <span>as The Coworkers</span></p>
  <p>The Goob <span>as The Goob</span></p>
  <h3>In memory of</h3>
  <p>Gary Pruitt · Denise Okafor · Phil Hammond · Rosa Delgado · Ken Ashby</p>
  <h3>Made with</h3>
  <p>three.js · the Web Audio API · a lot of procedural carpet</p>
  <h3>Game</h3>
  <p>jnrcorp, with Claude</p>
  <p class="credits-note">No coworkers were permanently harmed in the making of this game. Except five.</p>
  <p class="credits-note">Goob Co. is fictional. Please do not eat the goob.</p>
  <h2 class="credits-end">Thanks for playing</h2>
`;

export class Finale {
  constructor({ scene, materials, cast, player, dialogue, fx, hud }) {
    Object.assign(this, { scene, cast, player, dialogue, fx, hud });
    this.running = false;
    this.flashT = 0;
    this.sirenIn = 0;

    // Two police cars with light bars, parked in the aisle (hidden until the end).
    const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f0 });
    const black = new THREE.MeshLambertMaterial({ color: 0x15171a });
    this.red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a2a).multiplyScalar(2.2) });
    this.blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2a6cff).multiplyScalar(2.2) });
    this.off = new THREE.MeshLambertMaterial({ color: 0x33363b });
    this.bars = [];
    this.cars = POLICE_CARS.map(({ x, z, heading }) => {
      const g = new THREE.Group();
      const add = (geometry, mat, px, py, pz) => {
        const m = new THREE.Mesh(geometry, mat);
        m.position.set(px, py, pz);
        g.add(m);
        return m;
      };
      add(new THREE.BoxGeometry(1.8, 0.62, 4.4), white, 0, 0.62, 0);
      add(new THREE.BoxGeometry(1.82, 0.3, 1.6), black, 0, 0.62, 0);          // doors
      add(new THREE.BoxGeometry(1.56, 0.5, 2.1), materials.get('tint'), 0, 1.18, 0.1);
      const left = add(new THREE.BoxGeometry(0.55, 0.12, 0.25), this.red, -0.3, 1.5, 0.1);
      const right = add(new THREE.BoxGeometry(0.55, 0.12, 0.25), this.blue, 0.3, 1.5, 0.1);
      this.bars.push({ left, right });
      for (const [sx, sz] of [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]]) {
        const wheel = add(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16), materials.get('rubber'), sx * 0.85, 0.33, sz);
        wheel.rotation.z = Math.PI / 2;
      }
      g.position.set(x, 0, z);
      g.rotation.y = heading;
      g.visible = false;
      scene.add(g);
      return g;
    });

    // Two officers who walk Victoria out.
    this.officers = [0, 1].map((i) => {
      const person = new Person({
        shirt: 0x1f2c4a, pants: 0x161b28, skin: [0xc68642, 0xf1c27d][i], hair: 0x1a1410, tie: 0x0d1220,
        seed: `officer${i}`, hairStyle: 'buzz',
      });
      person.root.visible = false;
      scene.add(person.root);
      return person;
    });
  }

  // Back to how it was before the ending (a new game, or a retry).
  reset() {
    this.running = false;
    for (const car of this.cars) car.visible = false;
    for (const o of this.officers) o.root.visible = false;
    document.getElementById('news').hidden = true;
    document.getElementById('credits').hidden = true;
  }

  // The whole ending. Resolves once the credits are over.
  async run(victoria) {
    this.running = true;
    this.victoria = victoria;
    const { player, fx, dialogue } = this;

    // Out in the parking lot: police have arrived, everyone's been cured,
    // and Victoria's being brought out.
    await fx.fade(1, 0.8);
    for (const car of this.cars) car.visible = true;
    for (const o of this.officers) o.root.visible = true;
    for (const npc of this.cast.all) if (npc.infected) npc.cure(CURED_LINES[npc.name] ?? CURED_LINES.default);
    for (const g of GATHER) {
      const npc = this.cast.all.find((n) => n.name === g.name);
      if (!npc) continue;
      npc.path = null;
      npc.onArrive = null;
      npc.mode = 'stand';
      npc.talkable = false;
      npc.pos.set(g.x, 0, g.z);
      npc.home.copy(npc.pos);
      npc.yaw = Math.atan2(PLAYER_SPOT.x - g.x, PLAYER_SPOT.z - g.z);
    }
    victoria.person.root.visible = true;
    victoria.collider.enabled = true;
    victoria.talkable = false;
    victoria.mode = 'stand';
    victoria.pos.set(VICTORIA_ROUTE[0].x, 0, VICTORIA_ROUTE[0].z);
    victoria.speed = 0.9;
    // Facing Victoria as she's brought out (yaw 0 looks toward -z).
    const start = VICTORIA_ROUTE[1];
    player.spawn({ ...PLAYER_SPOT, yaw: Math.atan2(PLAYER_SPOT.x - start.x, PLAYER_SPOT.z - start.z) });
    player.lookTarget = null;
    this.sirenIn = 0;
    await fx.fade(0, 1.2);

    // The walk to the police car (you watch her go), then a few words.
    this.watch = victoria;
    await new Promise((resolve) => victoria.walkPath(VICTORIA_ROUTE.slice(1), resolve));
    this.watch = null;
    player.lookTarget = victoria.headPoint;
    victoria.yaw = Math.atan2(PLAYER_SPOT.x - victoria.pos.x, PLAYER_SPOT.z - victoria.pos.z);
    await dialogue.play(ARREST);
    await fx.fade(1, 0.6);
    victoria.person.root.visible = false;
    victoria.collider.enabled = false;
    for (const o of this.officers) o.root.visible = false;
    await fx.fade(0, 0.6);

    // Your coworkers.
    player.lookTarget = { x: 13.4, y: 1.5, z: -6.4 };
    await dialogue.play(COWORKERS);

    // The evening news, then the credits.
    await fx.fade(1, 1.2);
    await this.news();
    await this.credits();
    this.running = false;
  }

  // Called every frame while the ending runs: flashing light bars, sirens,
  // and the officers walking beside Victoria.
  update(dt) {
    if (!this.running) return;
    if (this.watch) this.player.lookTarget = this.watch.headPoint;
    this.flashT += dt;
    const phase = Math.floor(this.flashT * 3) % 2;
    for (const bar of this.bars) {
      bar.left.material = phase ? this.red : this.off;
      bar.right.material = phase ? this.off : this.blue;
    }
    this.sirenIn -= dt;
    if (this.sirenIn <= 0) {
      this.sirenIn = 2.2;
      sfx.siren({ x: POLICE_CARS[0].x, y: 1, z: POLICE_CARS[0].z });
    }
    const v = this.victoria;
    if (!v || !this.officers[0].root.visible) return;
    const s = Math.sin(v.yaw);
    const c = Math.cos(v.yaw);
    const moving = !!v.path;
    this.officers.forEach((o, i) => {
      const side = i ? 0.7 : -0.7;
      o.root.position.set(v.pos.x + c * side - s * 0.35, v.pos.y, v.pos.z - s * side - c * 0.35);
      o.root.rotation.y = v.yaw;
      o.pose = moving ? 'walk' : 'stand';
      o.update(dt, v.speed);
    });
  }

  // Chapter 2's ending: up out of B3 into the parking lot at night, where
  // the police are already raiding the building; the people you freed say a
  // few words, then the news and the credits.
  async runChapter2(rescued) {
    this.running = true;
    const { player, fx, dialogue } = this;
    await fx.fade(1, 0.8);
    for (const car of this.cars) car.visible = true;
    rescued.forEach((npc, i) => {
      npc.path = null;
      npc.onArrive = null;
      npc.brain = null;
      npc.mode = 'stand';
      npc.talkable = false;
      const g = GATHER[i % GATHER.length];
      npc.pos.set(g.x, 0, g.z);
      npc.home.copy(npc.pos);
      npc.yaw = Math.atan2(PLAYER_SPOT.x - g.x, PLAYER_SPOT.z - g.z);
    });
    player.rig = null;
    player.spawn({ ...PLAYER_SPOT, yaw: Math.atan2(PLAYER_SPOT.x - 13.4, PLAYER_SPOT.z + 6.4) });
    player.lookTarget = { x: 13.4, y: 1.5, z: -6.4 };
    this.sirenIn = 0;
    await fx.fade(0, 1.2);
    await dialogue.play(RESCUED);
    await fx.fade(1, 1.2);
    await this.news(NEWS_2, { headline: 'BREAKING: SECRET GOOB FACILITY FOUND UNDER HQ', graphic: 'THERE IS<br>NO B2' });
    await this.credits(CREDITS_2);
    this.running = false;
  }

  // Testing: the news and credits on their own (?finale=news).
  async newsAndCredits() {
    this.running = true;
    await this.news();
    await this.credits();
    this.running = false;
  }

  // A TV news bulletin, one line at a time (E, Space, Enter or a click moves on).
  news(lines = NEWS, { headline = 'BREAKING: GOOB CO. CEO ARRESTED', graphic = 'GOOB CO.<br>SHUT DOWN' } = {}) {
    const el = document.getElementById('news');
    const text = document.getElementById('news-text');
    el.querySelector('.news-headline').textContent = headline;
    el.querySelector('.news-graphic').innerHTML = graphic;
    el.hidden = false;
    return this.advance(lines, (line) => { text.textContent = line; }, 9).then(() => { el.hidden = true; });
  }

  // Scrolling credits (any key or a click skips to the end).
  credits(html = CREDITS) {
    const el = document.getElementById('credits');
    const roll = document.getElementById('credits-roll');
    roll.innerHTML = html;
    el.hidden = false;
    // Scroll from below the screen until the last line has gone off the top.
    const start = performance.now();
    const scroll = () => {
      const t = Math.min(1, (performance.now() - start) / (CREDITS_SECONDS * 1000));
      const from = el.clientHeight;
      const to = -roll.offsetHeight;
      roll.style.transform = `translate(-50%, ${from + (to - from) * t}px)`;
    };
    scroll();
    const ticker = setInterval(scroll, 16);
    return new Promise((resolve) => {
      const done = () => {
        clearInterval(ticker);
        clearTimeout(timer);
        window.removeEventListener('keydown', done);
        el.removeEventListener('click', done);
        el.hidden = true;
        resolve();
      };
      const timer = setTimeout(done, (CREDITS_SECONDS + 1) * 1000);
      setTimeout(() => {
        window.addEventListener('keydown', done);
        el.addEventListener('click', done);
      }, 1500);
    });
  }

  // Show lines one after another: each moves on after `seconds`, or sooner
  // on E / Space / Enter / click.
  advance(lines, show, seconds) {
    return new Promise((resolve) => {
      let i = -1;
      let timer = null;
      const next = () => {
        i += 1;
        clearTimeout(timer);
        if (i >= lines.length) {
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('click', next);
          resolve();
          return;
        }
        show(lines[i]);
        timer = setTimeout(next, seconds * 1000);
      };
      const onKey = (e) => { if (['KeyE', 'Space', 'Enter'].includes(e.code)) next(); };
      window.addEventListener('keydown', onKey);
      window.addEventListener('click', next);
      next();
    });
  }
}
