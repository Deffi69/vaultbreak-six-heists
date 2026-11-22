// VAULTBREAK rendering: top-down canvas drawing of the whole bank floor,
// vision cones, cameras, lasers, loot and the HUD. All art is drawn code —
// no image files, so the game stays one small offline bundle.
import { TILE, MAP_W, MAP_H } from './levels.js';
import { exitTile } from './engine.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 64;
export const OX = 96; // world offset x: the whole 34x19 floor fits on screen
export const OY = 76;

const COL = {
  bg: '#0b1020',
  floorA: '#1a2238',
  floorB: '#1e2742',
  wall: '#3a4a6b',
  wallTop: '#55648f',
  loot: '#f5c542',
  gold: '#ffd94d',
  jewel: '#7fe7ff',
  vault: '#c9a227',
  guard: '#e5484d',
  guardCone: 'rgba(229,72,77,0.20)',
  guardConeHot: 'rgba(229,72,77,0.38)',
  camCone: 'rgba(245,197,66,0.16)',
  camConeHot: 'rgba(245,197,66,0.34)',
  laser: '#ff2e4d',
  player: '#35d07f',
  exit: '#2fbf71',
  smoke: 'rgba(200,200,210,0.55)',
};

function cone(ctx, x, y, dir, fov, range, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - fov / 2, dir + fov / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, state, t) {
  const level = state.level;
  ctx.save();
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Floor.
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const ch = level.map[ty][tx];
      const x = OX + tx * TILE;
      const y = OY + ty * TILE;
      if (ch === '#') continue;
      ctx.fillStyle = (tx + ty) % 2 ? COL.floorA : COL.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === 'H') {
        ctx.fillStyle = '#2c3a5e';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = '#8fa3d9';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HIDE', x + TILE / 2, y + TILE / 2 + 4);
      }
    }
  }

  // Getaway exit zone.
  const ex = exitTile(state);
  if (ex) {
    const exTx = Math.floor(ex.x / TILE);
    const exTy = Math.floor(ex.y / TILE);
    const exX = OX + exTx * TILE;
    const exY = OY + exTy * TILE;
    const pulse = state.exitOpen ? 0.55 + 0.3 * Math.sin(t * 5) : 0.22;
    ctx.fillStyle = state.exitOpen ? `rgba(47,191,113,${pulse})` : 'rgba(120,130,150,0.25)';
    ctx.fillRect(exX, exY, TILE * 2, TILE * 2);
    ctx.strokeStyle = state.exitOpen ? '#2fbf71' : '#5a6a8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(exX + 1, exY + 1, TILE * 2 - 2, TILE * 2 - 2);
    // The getaway van.
    ctx.fillStyle = state.exitOpen ? '#e8f5ee' : '#9aa7c2';
    roundRect(ctx, exX + 10, exY + 18, 44, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#22304d';
    ctx.fillRect(exX + 40, exY + 24, 10, 12);
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(exX + 20, exY + 46, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(exX + 44, exY + 46, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = state.exitOpen ? '#0f7a44' : '#5a6a8a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const labelX = Math.max(110, Math.min(VIEW_W - 110, exX + TILE));
    ctx.fillText(state.exitOpen ? 'GETAWAY VAN — GO!' : 'GETAWAY — locked', labelX, exY - 6);
  }

  // Loot.
  for (const item of state.loot) {
    if (item.taken) continue;
    const x = OX + item.x;
    const y = OY + item.y;
    if (item.kind === 'cash') {
      ctx.fillStyle = '#7ee787';
      ctx.fillRect(x - 9, y - 6, 18, 12);
      ctx.fillStyle = '#1d7a33';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', x, y + 4);
    } else if (item.kind === 'gold') {
      ctx.fillStyle = COL.gold;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 6); ctx.lineTo(x - 6, y - 6); ctx.lineTo(x + 6, y - 6); ctx.lineTo(x + 10, y + 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6d00';
      ctx.fillRect(x - 6, y - 2, 12, 2);
    } else if (item.kind === 'jewel') {
      ctx.fillStyle = COL.jewel;
      ctx.beginPath();
      ctx.moveTo(x, y - 10); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 9, y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x - 2, y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (item.kind === 'vault') {
      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(x - 16, y - 14, 32, 28);
      ctx.strokeStyle = COL.vault;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 16, y - 14, 32, 28);
      ctx.fillStyle = COL.vault;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2f3a';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.vault;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VAULT $5,000', x, y - 20);
    } else if (item.kind === 'keycard') {
      ctx.fillStyle = '#ff9f43';
      ctx.fillRect(x - 8, y - 5, 16, 10);
      ctx.fillStyle = '#7a3d00';
      ctx.fillRect(x - 5, y - 2, 6, 4);
    }
  }

  // Tool crates.
  for (const crate of state.crates) {
    if (crate.taken) continue;
    const x = OX + crate.x;
    const y = OY + crate.y;
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(x - 10, y - 10, 20, 20);
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 10, y - 10, 20, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', x, y + 5);
  }

  // Laser panels.
  for (const panel of state.panels) {
    const x = OX + panel.x;
    const y = OY + panel.y;
    ctx.fillStyle = panel.used ? '#3a4a6b' : '#ff5c8a';
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = panel.used ? '#8fa3d9' : '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(panel.used ? 'OFF' : 'PANEL', x, y + 22);
  }

  // Vision cones (under walls so walls occlude them).
  for (const cam of state.cameras) {
    if (state.empTimer > 0) continue;
    const hot = cam.suspicion > 0.6;
    cone(ctx, OX + cam.x, OY + cam.y, cam.dir, 0.9, cam.range, hot ? COL.camConeHot : COL.camCone);
  }
  for (const guard of state.guards) {
    const hot = guard.state === 'chase' || guard.suspicion > 0.6;
    const fill = guard.state === 'chase' ? COL.guardConeHot : hot ? COL.guardConeHot : COL.guardCone;
    cone(ctx, OX + guard.x, OY + guard.y, guard.dir, 1.25, 175, fill);
  }

  // Lasers.
  for (const laser of state.lasers) {
    const on = laser.on && state.empTimer <= 0;
    ctx.strokeStyle = on ? COL.laser : '#3a4a6b';
    ctx.lineWidth = on ? 3 : 1;
    if (on && laser.tripped) ctx.lineWidth = 5;
    ctx.setLineDash(on ? [] : [4, 6]);
    ctx.beginPath();
    ctx.moveTo(OX + laser.x1, OY + laser.y1);
    ctx.lineTo(OX + laser.x2, OY + laser.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (on) {
      ctx.fillStyle = COL.laser;
      ctx.beginPath(); ctx.arc(OX + laser.x1, OY + laser.y1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(OX + laser.x2, OY + laser.y2, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Walls (drawn over cones so they block the light visually).
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (level.map[ty][tx] !== '#') continue;
      const x = OX + tx * TILE;
      const y = OY + ty * TILE;
      ctx.fillStyle = COL.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COL.wallTop;
      ctx.fillRect(x, y, TILE, 3);
    }
  }
  // Locked doors.
  for (const key of state.doors) {
    const [tx, ty] = key.split(',').map(Number);
    const x = OX + tx * TILE;
    const y = OY + ty * TILE;
    ctx.fillStyle = '#8a6d1f';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    // Drawn padlock (no emoji font needed in headless browsers).
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + 13, 5, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(x + TILE / 2 - 6, y + 13, 12, 9);
  }

  // Cameras (wall-mounted).
  for (const cam of state.cameras) {
    const x = OX + cam.x;
    const y = OY + cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cam.dir);
    ctx.fillStyle = state.empTimer > 0 ? '#3a4a6b' : '#f5c542';
    ctx.fillRect(-2, -4, 14, 8);
    ctx.fillStyle = state.empTimer > 0 ? '#55648f' : '#ff2e4d';
    ctx.beginPath(); ctx.arc(12, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (cam.suspicion > 0.05) {
      ctx.fillStyle = '#ff2e4d';
      ctx.fillRect(x - 12, y - 22, 24 * cam.suspicion, 4);
    }
  }

  // Guards.
  for (const guard of state.guards) {
    const x = OX + guard.x;
    const y = OY + guard.y;
    ctx.fillStyle = guard.state === 'chase' ? '#ff2e4d' : COL.guard;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
    // Facing tick + cap brim.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(guard.dir) * 17, y + Math.sin(guard.dir) * 17);
    ctx.stroke();
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(x - 8, y - 15, 16, 5);
    // Suspicion bar.
    if (guard.suspicion > 0.05) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(x - 14, y - 26, 28, 5);
      ctx.fillStyle = guard.suspicion > 0.6 ? '#ff2e4d' : '#f5c542';
      ctx.fillRect(x - 13, y - 25, 26 * guard.suspicion, 3);
      if (guard.state === 'chase') {
        ctx.fillStyle = '#ff2e4d';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', x, y - 30);
      }
    }
  }

  // Smoke cloud.
  if (state.smokeTimer > 0) {
    const x = OX + state.smokeX;
    const y = OY + state.smokeY;
    ctx.fillStyle = COL.smoke;
    ctx.beginPath(); ctx.arc(x, y, 64, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 30, y - 18, 44, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 28, y + 16, 40, 0, Math.PI * 2); ctx.fill();
  }

  // Player: hooded thief, green cloak, direction nose.
  const p = state.player;
  const px = OX + p.x;
  const py = OY + p.y;
  ctx.save();
  if (state.disguiseTimer > 0) ctx.globalAlpha = 0.85;
  ctx.fillStyle = state.disguiseTimer > 0 ? '#7c6aa8' : COL.player;
  ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#06281a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#06281a';
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(p.dir) * 6, py + Math.sin(p.dir) * 6);
  ctx.arc(px, py, 7, p.dir - 0.9, p.dir + 0.9);
  ctx.closePath(); ctx.fill();
  // Hood point.
  ctx.fillStyle = state.disguiseTimer > 0 ? '#5b4a86' : '#1f9d5c';
  ctx.beginPath();
  ctx.moveTo(px - Math.cos(p.dir) * 10, py - Math.sin(p.dir) * 10);
  ctx.lineTo(px - Math.cos(p.dir + 0.5) * 16, py - Math.sin(p.dir + 0.5) * 16);
  ctx.lineTo(px - Math.cos(p.dir - 0.5) * 16, py - Math.sin(p.dir - 0.5) * 16);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  if (p.hidden) {
    ctx.fillStyle = '#8fa3d9';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', px, py - 20);
  }
  if (p.sneaking) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('sneaking', px, py + 26);
  }

  // Channel progress ring.
  if (state.channel) {
    const c = state.channel;
    const x = OX + c.x;
    const y = OY + c.y - 30;
    ctx.fillStyle = '#111827';
    ctx.fillRect(x - 40, y - 10, 80, 14);
    ctx.fillStyle = '#35d07f';
    ctx.fillRect(x - 39, y - 9, 78 * Math.min(1, c.t / c.need), 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(c.label, x, y - 16);
  }

  ctx.restore();

  // Red flash when busted / lockdown vignette.
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,46,77,${state.flash * 0.35})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (state.lockdown) {
    ctx.strokeStyle = `rgba(255,46,77,${0.4 + 0.3 * Math.sin(t * 6)})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, VIEW_W - 6, VIEW_H - 6);
  }
}

export function drawHUD(ctx, state, totalScore, screen) {
  const level = state.level;
  ctx.fillStyle = '#0d1326';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.strokeStyle = '#2c3a5e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, HUD_H); ctx.lineTo(VIEW_W, HUD_H); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`VAULTBREAK`, 16, 28);
  ctx.fillStyle = '#8fa3d9';
  ctx.font = '13px monospace';
  ctx.fillText(`Mission ${level.id}/6 — ${level.name}`, 16, 50);

  // Loot counter.
  ctx.fillStyle = COL.loot;
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`LOOT $${state.lootValue.toLocaleString('en-US')}`, 330, 30);
  ctx.fillStyle = '#8fa3d9';
  ctx.font = '12px monospace';
  ctx.fillText(`score ${totalScore.toLocaleString('en-US')}`, 330, 50);

  // Alarm / heat meter.
  const ax = 560;
  const aw = 210;
  ctx.fillStyle = '#8fa3d9';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('ALARM', ax, 20);
  ctx.fillStyle = '#111827';
  ctx.fillRect(ax, 26, aw, 16);
  const alarmColor = state.alarm < 35 ? '#35d07f' : state.alarm < 70 ? '#f5c542' : '#ff2e4d';
  ctx.fillStyle = alarmColor;
  ctx.fillRect(ax + 1, 27, (aw - 2) * (state.alarm / 100), 14);
  ctx.strokeStyle = '#55648f';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax, 26, aw, 16);
  ctx.fillStyle = state.lockdown ? '#ff2e4d' : '#8fa3d9';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(state.lockdown ? 'LOCKDOWN!' : state.alarm >= 70 ? 'HOT — hide!' : state.alarm >= 35 ? 'warm' : 'quiet', ax, 56);

  // Lives.
  ctx.fillStyle = '#ff5c8a';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, 3 - state.lives)), 795, 30);
  ctx.fillStyle = '#8fa3d9';
  ctx.font = '12px monospace';
  ctx.fillText('lives', 795, 50);

  // Tools.
  const tools = [
    ['1', 'Lockpick', state.tools.lockpick],
    ['2', 'EMP', state.tools.emp],
    ['3', 'Disguise', state.tools.disguise],
    ['4', 'Smoke', state.tools.smoke],
  ];
  let tx = 880;
  ctx.font = '11px monospace';
  for (const [key, name, count] of tools) {
    ctx.fillStyle = count > 0 ? '#e9d5ff' : '#55648f';
    ctx.fillRect(tx, 12, 92, 40);
    ctx.fillStyle = '#111827';
    ctx.fillText(`[${key}] ${name}`, tx + 5, 28);
    ctx.fillText(`x${count}`, tx + 5, 44);
    tx += 98;
  }

  // Active tool timers.
  let ty = HUD_H + 16;
  ctx.font = 'bold 12px monospace';
  if (state.empTimer > 0) { ctx.fillStyle = '#7fe7ff'; ctx.fillText(`EMP active ${Math.ceil(state.empTimer)}s`, 16, ty); ty += 16; }
  if (state.disguiseTimer > 0) { ctx.fillStyle = '#c4b5fd'; ctx.fillText(`DISGUISE ${Math.ceil(state.disguiseTimer)}s`, 16, ty); ty += 16; }
  if (state.smokeTimer > 0) { ctx.fillStyle = '#d1d5db'; ctx.fillText(`SMOKE ${Math.ceil(state.smokeTimer)}s`, 16, ty); ty += 16; }
  if (state.hasKeycard) { ctx.fillStyle = '#ff9f43'; ctx.fillText('KEYCARD ✓', 16, ty); }

  // Message toast.
  if (state.messageTimer > 0 && state.message) {
    ctx.font = 'bold 15px monospace';
    const w = ctx.measureText(state.message).width + 24;
    ctx.fillStyle = 'rgba(13,19,38,0.92)';
    roundRect(ctx, (VIEW_W - w) / 2, VIEW_H - 56, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, VIEW_W / 2, VIEW_H - 35);
    ctx.textAlign = 'left';
  }

  // Bottom bar: objective left, controls centre, timer right.
  const mm = Math.floor(state.time / 60);
  const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
  ctx.fillStyle = 'rgba(13,19,38,0.85)';
  ctx.fillRect(0, VIEW_H - 26, VIEW_W, 26);
  ctx.fillStyle = '#8fa3d9';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(state.vaultTaken ? '→ reach the getaway van' : '→ crack the VAULT, then escape', 16, VIEW_H - 9);
  ctx.textAlign = 'center';
  ctx.fillText('WASD move · SHIFT sneak · SPACE crack · 1-4 tools · P pause · M mute · R restart', VIEW_W / 2, VIEW_H - 9);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`${mm}:${ss}`, VIEW_W - 16, VIEW_H - 8);
  ctx.textAlign = 'left';
}

export function drawPanel(ctx, title, lines, buttons, accent = '#35d07f') {
  ctx.fillStyle = 'rgba(5,8,18,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 760;
  const h = 150 + lines.length * 26 + buttons.length * 52;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = '#0d1326';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, y + 58);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '15px monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 102 + i * 26);
  });
  buttons.forEach((b, i) => {
    const by = y + 118 + lines.length * 26 + i * 52;
    ctx.fillStyle = b.primary ? accent : '#2c3a5e';
    roundRect(ctx, VIEW_W / 2 - 180, by, 360, 40, 8);
    ctx.fill();
    ctx.fillStyle = b.primary ? '#06281a' : '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(b.label, VIEW_W / 2, by + 26);
    b.y = by;
    b.h = 40;
  });
  ctx.textAlign = 'left';
}
