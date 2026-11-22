// VAULTBREAK engine: movement, collision, vision cones, detection, the
// alarm/heat meter, loot, tools, lockdown and the win/lose rules.
// Pure logic over a level definition — no drawing here.
import { LEVELS, TILE, MAP_W, MAP_H } from './levels.js';
import { mulberry32 } from './rng.js';

export const LOOT_VALUE = { cash: 250, gold: 800, jewel: 1500, vault: 5000 };
export const LOOT_WEIGHT = { cash: 1, gold: 3, jewel: 2, vault: 6 };
export const PLAYER_R = 12;

function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return '#';
  return level.map[ty][tx];
}

export function isWall(level, tx, ty) {
  return tileAt(level, tx, ty) === '#';
}

// Circle vs wall tiles: slide along walls instead of sticking.
export function collide(level, x, y, r) {
  let nx = x;
  let ny = y;
  const minTx = Math.floor((nx - r) / TILE);
  const maxTx = Math.floor((nx + r) / TILE);
  const minTy = Math.floor((ny - r) / TILE);
  const maxTy = Math.floor((ny + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isWall(level, tx, ty)) continue;
      const cx = Math.max(tx * TILE, Math.min(nx, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(ny, ty * TILE + TILE));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      }
    }
  }
  return { x: nx, y: ny };
}

// Bresenham line of sight on the tile grid: walls block sight.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const tx0 = Math.floor(x0 / TILE);
  const ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE);
  const ty1 = Math.floor(y1 / TILE);
  let dx = Math.abs(tx1 - tx0);
  let dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1;
  const sy = ty0 < ty1 ? 1 : -1;
  let err = dx - dy;
  let x = tx0;
  let y = ty0;
  for (let i = 0; i < 200; i++) {
    if (x === tx1 && y === ty1) return true;
    if (isWall(level, x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return false;
}

export function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Build a fresh, fully deterministic mission state from a level index.
export function createMission(levelIndex, seed = 1) {
  const level = LEVELS[levelIndex];
  const rng = mulberry32(seed * 7919 + levelIndex * 104729 + 13);
  const state = {
    levelIndex,
    level,
    time: 0,
    alarm: 0,
    lives: 3,
    score: 0,
    lootValue: 0,
    lootCarried: 0,
    vaultTaken: false,
    exitOpen: false,
    status: 'playing', // playing | busted | complete | failed | won
    statusText: '',
    spottedBy: null,
    lockdown: false,
    empTimer: 0,
    disguiseTimer: 0,
    smokeTimer: 0,
    smokeX: 0,
    smokeY: 0,
    tools: { ...level.tools },
    hasKeycard: false,
    channel: null, // { kind, x, y, t, need, label }
    flash: 0,
    shake: 0,
    message: '',
    messageTimer: 0,
    ghost: true, // stays true while the alarm never passed 50
    bustedCount: 0,
    player: { x: 0, y: 0, dir: 0, sneaking: false, moving: false, hidden: false },
    guards: [],
    cameras: [],
    lasers: [],
    panels: [],
    loot: [],
    crates: [],
    doors: new Set(),
  };

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const ch = level.map[ty][tx];
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      if (ch === 'S') { state.player.x = cx; state.player.y = cy; }
      else if (ch === 'L') state.loot.push({ kind: 'cash', x: cx, y: cy, taken: false });
      else if (ch === 'g') state.loot.push({ kind: 'gold', x: cx, y: cy, taken: false });
      else if (ch === 'j') state.loot.push({ kind: 'jewel', x: cx, y: cy, taken: false });
      else if (ch === 'V') state.loot.push({ kind: 'vault', x: cx, y: cy, taken: false });
      else if (ch === 'K') state.loot.push({ kind: 'keycard', x: cx, y: cy, taken: false });
      else if (ch === 'T') state.crates.push({ x: cx, y: cy, taken: false });
      else if (ch === 'D') state.doors.add(tx + ',' + ty);
    }
  }

  state.guards = level.guards.map((g, i) => {
    const wp = g.path.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));
    return {
      id: i,
      waypoints: wp,
      wpIndex: 0,
      x: wp[0].x,
      y: wp[0].y,
      dir: 0,
      speed: g.speed,
      state: 'patrol', // patrol | suspicious | chase | search
      suspicion: 0,
      alertTimer: 0,
      lastSeenX: 0,
      lastSeenY: 0,
      phase: rng(),
    };
  });
  state.cameras = level.cameras.map((c) => ({
    x: c.x * TILE + TILE / 2,
    y: c.y * TILE + TILE / 2,
    baseAngle: (c.angle * Math.PI) / 180,
    sweep: (c.sweep * Math.PI) / 180,
    speed: (c.speed * Math.PI) / 180,
    range: c.range,
    suspicion: 0,
    phase: rng() * Math.PI * 2,
  }));
  state.lasers = level.lasers.map((l) => ({
    x1: l.x1 * TILE + TILE / 2,
    y1: l.y1 * TILE + TILE / 2,
    x2: l.x2 * TILE + TILE / 2,
    y2: l.y2 * TILE + TILE / 2,
    on: true,
    tripped: 0,
  }));
  state.panels = level.panels.map((p) => ({
    x: p.x * TILE + TILE / 2,
    y: p.y * TILE + TILE / 2,
    used: false,
  }));
  return state;
}

function doorTileAt(state, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return state.doors.has(tx + ',' + ty);
}

// A locked door blocks movement unless opened with a keycard/lockpick.
export function blockedByDoor(state, x, y) {
  if (!doorTileAt(state, x, y)) return false;
  return true;
}

export function movePlayer(state, dx, dy, dt) {
  const p = state.player;
  const speed = (p.sneaking ? 82 : 152) / (1 + state.lootCarried * 0.045);
  const nx = p.x + dx * speed * dt;
  const ny = p.y + dy * speed * dt;
  // Try full move, then axis-separated slides, then stop.
  const tryPos = (x, y) => {
    if (blockedByDoor(state, x, y)) return false;
    const r = collide(state.level, x, y, PLAYER_R);
    if (Math.abs(r.x - x) > 0.01 || Math.abs(r.y - y) > 0.01) {
      // collided with a wall: accept the slid position
      p.x = r.x; p.y = r.y;
      return true;
    }
    p.x = x; p.y = y;
    return true;
  };
  const movedX = tryPos(nx, p.y);
  const movedY = tryPos(p.x, ny);
  p.moving = movedX || movedY || dx !== 0 || dy !== 0;
  if (dx !== 0 || dy !== 0) p.dir = Math.atan2(dy, dx);
}

// How visible the player is to one observer right now (0..1 per second).
function visibilityRate(state, ox, oy, odir, range, fov) {
  const p = state.player;
  const dx = p.x - ox;
  const dy = p.y - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), odir)) > fov / 2) return 0;
  if (state.smokeTimer > 0 && Math.hypot(p.x - state.smokeX, p.y - state.smokeY) < 110) return 0;
  if (p.hidden) return 0;
  if (!hasLineOfSight(state.level, ox, oy, p.x, p.y)) return 0;
  if (state.disguiseTimer > 0 && dist > 56) return 0;
  let rate = 1.1 + (1 - dist / range) * 2.2;
  if (p.sneaking) rate *= 0.45;
  if (p.moving) rate *= 1.25;
  return rate;
}

function guardTarget(state, guard) {
  if (guard.state === 'chase' || guard.state === 'search') {
    return { x: guard.lastSeenX, y: guard.lastSeenY };
  }
  const wp = guard.waypoints[guard.wpIndex];
  return wp;
}

export function updateMission(state, input, dt, sound) {
  if (state.status !== 'playing') return;
  state.time += dt;
  const p = state.player;

  // Timers.
  if (state.empTimer > 0) state.empTimer -= dt;
  if (state.disguiseTimer > 0) state.disguiseTimer -= dt;
  if (state.smokeTimer > 0) state.smokeTimer -= dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.flash > 0) state.flash -= dt * 2;
  if (state.shake > 0) state.shake -= dt * 3;

  // Tools.
  if (input.tool === 'lockpick') useLockpick(state, sound);
  if (input.tool === 'emp') useEmp(state, sound);
  if (input.tool === 'disguise') useDisguise(state, sound);
  if (input.tool === 'smoke') useSmoke(state, sound);
  input.tool = null;

  // Movement.
  p.sneaking = !!input.sneak;
  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    movePlayer(state, dx / len, dy / len, dt);
  } else {
    p.moving = false;
  }

  // Hiding closet.
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  p.hidden = tileAt(state.level, tx, ty) === 'H';

  // Channelled actions (vault crack, door pick, panel hack).
  updateChannel(state, input, dt, sound);

  // Loot pickup (instant for cash/gold/jewel/keycard; vault is channelled).
  for (const item of state.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - p.x, item.y - p.y) > 26) continue;
    if (item.kind === 'vault') continue;
    item.taken = true;
    if (item.kind === 'keycard') {
      state.hasKeycard = true;
      state.message = 'KEYCARD TAKEN — locked doors open for you now';
      state.messageTimer = 3;
      if (sound) sound.pickup();
    } else {
      state.lootValue += LOOT_VALUE[item.kind];
      state.lootCarried += LOOT_WEIGHT[item.kind];
      state.score += LOOT_VALUE[item.kind];
      if (sound) sound.pickup();
    }
  }
  // Tool crates give one charge of each tool.
  for (const crate of state.crates) {
    if (crate.taken) continue;
    if (Math.hypot(crate.x - p.x, crate.y - p.y) > 26) continue;
    crate.taken = true;
    for (const k of Object.keys(state.tools)) state.tools[k] += 1;
    state.message = 'TOOL CRATE — +1 of every tool';
    state.messageTimer = 3;
    if (sound) sound.gold();
  }

  // Lasers: crossing a live beam trips the alarm.
  for (const laser of state.lasers) {
    if (!laser.on || state.empTimer > 0) { laser.tripped = 0; continue; }
    const d = distToSegment(p.x, p.y, laser.x1, laser.y1, laser.x2, laser.y2);
    if (d < 13) {
      laser.tripped = 1;
      state.alarm = Math.min(100, state.alarm + 45 * dt);
      state.spottedBy = 'LASER GRID';
      if (state.alarm > 50) state.ghost = false;
    } else {
      laser.tripped = 0;
    }
  }

  // Guards: patrol, get suspicious, chase, search.
  let anySpotted = false;
  for (const guard of state.guards) {
    const target = guardTarget(state, guard);
    const wantDir = angleTo(guard.x, guard.y, target.x, target.y);
    const turn = guard.state === 'patrol' ? 3.2 : 6;
    guard.dir += Math.max(-turn * dt, Math.min(turn * dt, angleDiff(wantDir, guard.dir)));
    const distToTarget = Math.hypot(target.x - guard.x, target.y - guard.y);
    const speed = guard.state === 'chase' ? guard.speed * 1.75 : guard.speed;
    if (distToTarget > 6) {
      const step = Math.min(speed * dt, distToTarget);
      guard.x += Math.cos(guard.dir) * step;
      guard.y += Math.sin(guard.dir) * step;
    } else if (guard.state === 'patrol') {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
    } else if (guard.state === 'search') {
      guard.alertTimer -= dt;
      if (guard.alertTimer <= 0) { guard.state = 'patrol'; guard.suspicion = 0; }
    }

    const rate = visibilityRate(state, guard.x, guard.y, guard.dir, 175, 1.25);
    if (rate > 0) {
      guard.suspicion = Math.min(1, guard.suspicion + rate * dt * 0.55);
      guard.lastSeenX = p.x;
      guard.lastSeenY = p.y;
      if (guard.suspicion > 0.45) guard.state = 'suspicious';
      if (guard.suspicion >= 1) {
        guard.state = 'chase';
        guard.alertTimer = 6;
        anySpotted = true;
        state.spottedBy = 'GUARD';
        if (sound) sound.spotted();
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - 0.35 * dt);
      if (guard.state === 'suspicious' && guard.suspicion <= 0.05) guard.state = 'patrol';
    }
    if (guard.state === 'chase') {
      guard.alertTimer -= dt;
      if (guard.alertTimer <= 0) { guard.state = 'search'; guard.alertTimer = 5; }
    }
    // Caught: a guard touches the player.
    if (Math.hypot(guard.x - p.x, guard.y - p.y) < 26) {
      busted(state, sound);
      return;
    }
  }

  // Cameras: sweep, build suspicion, raise the alarm.
  for (const cam of state.cameras) {
    const t = state.time * cam.speed + cam.phase;
    cam.dir = cam.baseAngle + Math.sin(t) * cam.sweep;
    if (state.empTimer > 0) { cam.suspicion = Math.max(0, cam.suspicion - dt); continue; }
    const rate = visibilityRate(state, cam.x, cam.y, cam.dir, cam.range, 0.9);
    if (rate > 0) {
      cam.suspicion = Math.min(1, cam.suspicion + rate * dt * 0.5);
      if (cam.suspicion >= 1) {
        anySpotted = true;
        state.spottedBy = 'CAMERA';
        state.alarm = Math.min(100, state.alarm + 30 * dt);
        if (sound) sound.spotted();
      }
    } else {
      cam.suspicion = Math.max(0, cam.suspicion - 0.3 * dt);
    }
  }

  // Alarm: rises while spotted, decays slowly otherwise.
  if (anySpotted) {
    state.alarm = Math.min(100, state.alarm + 22 * dt);
    if (state.alarm > 50) state.ghost = false;
  } else {
    state.alarm = Math.max(0, state.alarm - 2.2 * dt);
  }
  state.lockdown = state.alarm >= 100;
  if (state.lockdown) {
    for (const guard of state.guards) {
      if (guard.state === 'patrol' || guard.state === 'suspicious') {
        guard.state = 'chase';
        guard.lastSeenX = p.x;
        guard.lastSeenY = p.y;
        guard.alertTimer = 8;
      }
    }
  }
  if (state.alarm >= 80 && sound) sound.startAlarmLoop();
  else if (sound) sound.stopAlarmLoop();

  // Exit: only open once the vault is taken.
  if (state.exitOpen) {
    const ex = exitTile(state);
    if (ex && Math.hypot(ex.x - p.x, ex.y - p.y) < 34) {
      completeMission(state, sound);
    }
  }
}

function exitTile(state) {
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (state.level.map[ty][tx] === 'E') {
        return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      }
    }
  }
  return null;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function nearestInteractable(state, kinds) {
  const p = state.player;
  let best = null;
  let bestD = 1e9;
  const consider = (x, y, kind, ref) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestD && kinds.includes(kind)) { bestD = d; best = { x, y, kind, ref, d }; }
  };
  for (const item of state.loot) {
    if (!item.taken && item.kind === 'vault') consider(item.x, item.y, 'vault', item);
  }
  for (const panel of state.panels) {
    if (!panel.used) consider(panel.x, panel.y, 'panel', panel);
  }
  // Locked door in front of the player.
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (state.doors.has((tx + dx) + ',' + (ty + dy))) {
      consider((tx + dx) * TILE + TILE / 2, (ty + dy) * TILE + TILE / 2, 'door', { tx: tx + dx, ty: ty + dy });
    }
  }
  return bestD < 44 ? best : null;
}

function updateChannel(state, input, dt, sound) {
  const p = state.player;
  if (state.channel) {
    const c = state.channel;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d > 52 || !input.interact) {
      state.channel = null; // moved away or let go: channel breaks
      return;
    }
    c.t += dt;
    if (c.t >= c.need) {
      state.channel = null;
      if (c.kind === 'vault') {
        c.ref.taken = true;
        state.vaultTaken = true;
        state.exitOpen = true;
        state.lootValue += LOOT_VALUE.vault;
        state.lootCarried += LOOT_WEIGHT.vault;
        state.score += LOOT_VALUE.vault;
        state.message = 'VAULT CRACKED — $5,000! Get to the getaway van!';
        state.messageTimer = 4;
        if (sound) sound.vault();
      } else if (c.kind === 'door') {
        state.doors.delete(c.ref.tx + ',' + c.ref.ty);
        state.message = 'DOOR PICKED — move through';
        state.messageTimer = 2.5;
        if (sound) sound.door();
      } else if (c.kind === 'panel') {
        c.ref.used = true;
        for (const laser of state.lasers) laser.on = false;
        state.message = 'LASER GRID DISABLED';
        state.messageTimer = 3;
        if (sound) sound.emp();
      }
    }
    return;
  }
  if (!input.interact) return;
  const target = nearestInteractable(state, ['vault', 'door', 'panel']);
  if (!target) return;
  const need = target.kind === 'vault' ? (state.tools.lockpick > 0 ? 1.2 : 3.5)
    : target.kind === 'door' ? (state.hasKeycard ? 0.4 : 2.2)
    : 1.5;
  if (target.kind === 'vault' && state.tools.lockpick > 0) state.tools.lockpick -= 1;
  state.channel = { kind: target.kind, x: target.x, y: target.y, t: 0, need, ref: target.ref, label: target.kind === 'vault' ? 'CRACKING VAULT…' : target.kind === 'door' ? 'PICKING LOCK…' : 'HACKING PANEL…' };
}

function useLockpick(state, sound) {
  if (state.tools.lockpick <= 0) { state.message = 'NO LOCKPICKS LEFT — find a tool crate'; state.messageTimer = 2; return; }
  const target = nearestInteractable(state, ['door']);
  if (!target) { state.message = 'NO LOCKED DOOR NEARBY'; state.messageTimer = 2; return; }
  state.tools.lockpick -= 1;
  state.doors.delete(target.ref.tx + ',' + target.ref.ty);
  state.message = 'DOOR PICKED INSTANTLY';
  state.messageTimer = 2;
  if (sound) sound.door();
}

function useEmp(state, sound) {
  if (state.tools.emp <= 0) { state.message = 'NO EMP CHARGES LEFT'; state.messageTimer = 2; return; }
  state.tools.emp -= 1;
  state.empTimer = 10;
  state.message = 'EMP BURST — cameras & lasers dead for 10s';
  state.messageTimer = 3;
  if (sound) sound.emp();
}

function useDisguise(state, sound) {
  if (state.tools.disguise <= 0) { state.message = 'NO DISGUISES LEFT'; state.messageTimer = 2; return; }
  state.tools.disguise -= 1;
  state.disguiseTimer = 12;
  state.message = 'DISGUISE ON — guards ignore you at a distance (12s)';
  state.messageTimer = 3;
  if (sound) sound.click();
}

function useSmoke(state, sound) {
  if (state.tools.smoke <= 0) { state.message = 'NO SMOKE BOMBS LEFT'; state.messageTimer = 2; return; }
  state.tools.smoke -= 1;
  state.smokeTimer = 6;
  state.smokeX = state.player.x;
  state.smokeY = state.player.y;
  for (const guard of state.guards) {
    if (guard.state === 'chase') { guard.state = 'search'; guard.alertTimer = 4; }
    guard.suspicion = Math.max(0, guard.suspicion - 0.6);
  }
  state.message = 'SMOKE OUT — line of sight broken (6s)';
  state.messageTimer = 3;
  if (sound) sound.smoke();
}

function busted(state, sound) {
  state.bustedCount += 1;
  state.lives -= 1;
  state.flash = 1;
  state.shake = 1;
  if (sound) { sound.busted(); sound.stopAlarmLoop(); }
  if (state.lives <= 0) {
    state.status = 'failed';
    state.statusText = 'CAUGHT THREE TIMES — the crew is in custody.';
    if (sound) sound.lose();
    return;
  }
  // Lose half the carried loot, respawn at the start, alarm jumps.
  state.lootValue = Math.floor(state.lootValue / 2);
  state.score = Math.max(0, state.score - Math.floor(state.score * 0.25));
  state.alarm = Math.min(100, state.alarm + 30);
  state.status = 'busted';
  state.statusText = 'BUSTED! The guard hauled you back to the start. Loot halved.';
  for (const guard of state.guards) {
    guard.state = 'patrol';
    guard.suspicion = 0;
    guard.wpIndex = 0;
    guard.x = guard.waypoints[0].x;
    guard.y = guard.waypoints[0].y;
  }
  for (const cam of state.cameras) cam.suspicion = 0;
  const level = state.level;
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (level.map[ty][tx] === 'S') {
        state.player.x = tx * TILE + TILE / 2;
        state.player.y = ty * TILE + TILE / 2;
      }
    }
  }
}

function completeMission(state, sound) {
  const timeBonus = Math.max(0, Math.round((state.level.par - state.time) * 10));
  const ghostBonus = state.ghost ? 500 : 0;
  state.score += timeBonus + ghostBonus;
  state.status = 'complete';
  state.statusText = `CLEAN GETAWAY — time bonus $${timeBonus}${ghostBonus ? ' + ghost bonus $500' : ''}`;
  if (sound) { sound.win(); sound.stopAlarmLoop(); }
}

export { exitTile };
