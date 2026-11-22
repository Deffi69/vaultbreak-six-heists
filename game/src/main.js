// VAULTBREAK bootstrap: screens, input, the game loop and the mission flow.
// Keyboard + mouse, fully offline. The loop runs at the display refresh rate;
// the engine steps in fixed 1/60s slices so play is identical everywhere.
import { createMission, updateMission } from './engine.js';
import { drawWorld, drawHUD, drawPanel, VIEW_W, VIEW_H } from './render.js';
import { SoundBank } from './audio.js';
import { LEVELS } from './levels.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const sound = new SoundBank();

export const game = {
  screen: 'title', // title | briefing | playing | paused | busted | complete | failed | won
  levelIndex: 0,
  mission: null,
  totalScore: 0,
  buttons: [],
  muted: false,
};

const input = {
  up: false, down: false, left: false, right: false,
  sneak: false, interact: false, tool: null,
};

function startMission(index) {
  game.levelIndex = index;
  game.mission = createMission(index, 1234 + index * 97);
  game.screen = 'briefing';
  game.buttons = [];
}

function beginPlaying() {
  game.screen = 'playing';
  game.buttons = [];
}

function nextMission() {
  game.totalScore += game.mission.score;
  if (game.levelIndex + 1 >= LEVELS.length) {
    game.screen = 'won';
  } else {
    startMission(game.levelIndex + 1);
  }
  game.buttons = [];
}

function retryMission() {
  startMission(game.levelIndex);
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  Space: 'interact',
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const mapped = KEYMAP[e.code];
  if (mapped) {
    input[mapped] = true;
    e.preventDefault();
  }
  if (e.code === 'Digit1') input.tool = 'lockpick';
  if (e.code === 'Digit2') input.tool = 'emp';
  if (e.code === 'Digit3') input.tool = 'disguise';
  if (e.code === 'Digit4') input.tool = 'smoke';
  if (e.code === 'KeyM') {
    game.muted = sound.toggleMute();
  }
  if (e.code === 'KeyP' && game.screen === 'playing') game.screen = 'paused';
  else if (e.code === 'KeyP' && game.screen === 'paused') game.screen = 'playing';
  if (e.code === 'KeyR' && (game.screen === 'playing' || game.screen === 'paused' || game.screen === 'busted' || game.screen === 'failed')) {
    retryMission();
  }
  if (e.code === 'Enter' && game.screen === 'title') startMission(0);
  if (e.code === 'Enter' && game.screen === 'briefing') beginPlaying();
  if (e.code === 'Enter' && game.screen === 'complete') nextMission();
  if (e.code === 'Enter' && game.screen === 'busted') game.screen = 'playing';
});

window.addEventListener('keyup', (e) => {
  const mapped = KEYMAP[e.code];
  if (mapped) input[mapped] = false;
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (VIEW_W / rect.width);
  const y = (e.clientY - rect.top) * (VIEW_H / rect.height);
  sound.ensure();
  for (const b of game.buttons) {
    if (b.y !== undefined && x >= VIEW_W / 2 - 180 && x <= VIEW_W / 2 + 180 && y >= b.y && y <= b.y + b.h) {
      sound.click();
      b.action();
      return;
    }
  }
  // Clicking a tool chip in the HUD uses that tool.
  if (game.screen === 'playing') {
    let tx = 880;
    const tools = ['lockpick', 'emp', 'disguise', 'smoke'];
    for (const tool of tools) {
      if (x >= tx && x <= tx + 92 && y >= 12 && y <= 52) input.tool = tool;
      tx += 98;
    }
  }
});

function drawTitle(t) {
  // A dimmed demo floor behind the title, so the first paint already
  // shows the game world.
  if (!game.mission) game.mission = createMission(0, 42);
  drawWorld(ctx, game.mission, t);
  const lines = [
    'Six heists. One crew. Zero witnesses (if you play it right).',
    'Sneak past guards and their vision cones, dodge cameras and lasers,',
    'crack the vault, grab the loot — then reach the getaway van.',
    '',
    'WASD / arrows move · SHIFT sneak · SPACE hold to crack · 1-4 tools',
    'Mouse works too: click buttons and tool chips.',
  ];
  game.buttons = [
    { label: 'START THE FIRST HEIST  ▶', primary: true, action: () => startMission(0) },
    { label: 'HOW TO PLAY', primary: false, action: () => { game.screen = 'howto'; game.buttons = []; } },
  ];
  drawPanel(ctx, 'VAULTBREAK', lines, game.buttons, '#35d07f');
}

function drawHowTo() {
  const lines = [
    'GOAL — crack the VAULT in every mission, then reach the green getaway van.',
    'SEEN — a guard or camera fills its suspicion bar; at full it chases and the ALARM rises.',
    'ALARM — at 100 the building locks down and every guard hunts you. Hide in closets (H).',
    'TOOLS — 1 Lockpick opens doors & cracks vaults fast · 2 EMP kills cameras & lasers 10s',
    '         3 Disguise: guards ignore you at range 12s · 4 Smoke breaks line of sight 6s.',
    'LOOT — cash $250 · gold $800 · jewel $1,500 · vault $5,000. Heavy loot slows you down.',
    'BUSTED — 3 lives. Caught? You lose half your loot and restart at the door.',
    'SCORE — loot + time bonus + $500 ghost bonus if the alarm never passes 50.',
  ];
  game.buttons = [
    { label: 'BACK', primary: true, action: () => { game.screen = 'title'; game.buttons = []; } },
  ];
  drawPanel(ctx, 'HOW TO PLAY', lines, game.buttons, '#f5c542');
}

function render(t) {
  const m = game.mission;
  if (game.screen === 'title') { drawTitle(t); return; }
  if (game.screen === 'howto') { if (m) drawWorld(ctx, m, t); drawHowTo(); return; }
  if (!m) return;
  drawWorld(ctx, m, t);
  drawHUD(ctx, m, game.totalScore + m.score, game.screen);

  if (game.screen === 'briefing') {
    const level = LEVELS[game.levelIndex];
    const lines = [
      `Mission ${level.id} of 6 — par time ${Math.floor(level.par / 60)}:${String(level.par % 60).padStart(2, '0')}`,
      '',
      ...wrapText(level.brief, 72),
      '',
      `Tools: lockpick x${level.tools.lockpick} · EMP x${level.tools.emp} · disguise x${level.tools.disguise} · smoke x${level.tools.smoke}`,
    ];
    game.buttons = [
      { label: 'START HEIST  ▶', primary: true, action: beginPlaying },
      { label: 'BACK TO TITLE', primary: false, action: () => { game.screen = 'title'; game.buttons = []; } },
    ];
    drawPanel(ctx, level.name.toUpperCase(), lines, game.buttons, '#f5c542');
  } else if (game.screen === 'paused') {
    game.buttons = [
      { label: 'RESUME', primary: true, action: () => { game.screen = 'playing'; } },
      { label: 'RESTART MISSION', primary: false, action: retryMission },
    ];
    drawPanel(ctx, 'PAUSED', ['Take a breath. The guards are not waiting — but the alarm is.', ''], game.buttons, '#8fa3d9');
  } else if (game.screen === 'busted') {
    game.buttons = [
      { label: 'DUST OFF AND GO AGAIN', primary: true, action: () => { m.status = 'playing'; game.screen = 'playing'; } },
      { label: 'RESTART MISSION', primary: false, action: retryMission },
    ];
    drawPanel(ctx, 'BUSTED!', [m.statusText, `Lives left: ${m.lives} · Loot kept: $${m.lootValue.toLocaleString('en-US')}`], game.buttons, '#ff2e4d');
  } else if (game.screen === 'complete') {
    const last = game.levelIndex + 1 >= LEVELS.length;
    game.buttons = [
      { label: last ? 'SEE THE FINAL SCORE  ▶' : 'NEXT HEIST  ▶', primary: true, action: nextMission },
      { label: 'REPLAY THIS MISSION', primary: false, action: retryMission },
    ];
    drawPanel(ctx, 'GETAWAY CLEAN!', [m.statusText, `Mission score: $${m.score.toLocaleString('en-US')} · Total: $${(game.totalScore + m.score).toLocaleString('en-US')}`], game.buttons, '#35d07f');
  } else if (game.screen === 'failed') {
    game.buttons = [
      { label: 'TRY THE HEIST AGAIN', primary: true, action: retryMission },
      { label: 'BACK TO TITLE', primary: false, action: () => { game.screen = 'title'; game.buttons = []; } },
    ];
    drawPanel(ctx, 'THE CREW IS CAUGHT', [m.statusText, `You kept $${m.lootValue.toLocaleString('en-US')} of loot before the law caught up.`], game.buttons, '#ff2e4d');
  } else if (game.screen === 'won') {
    const lines = [
      'All six heists complete. The crew retires rich — and never caught.',
      '',
      `FINAL SCORE: $${game.totalScore.toLocaleString('en-US')}`,
      '',
      'Thanks for playing VAULTBREAK.',
    ];
    game.buttons = [
      { label: 'PLAY AGAIN FROM MISSION 1', primary: true, action: () => { game.totalScore = 0; startMission(0); } },
    ];
    drawPanel(ctx, 'THE PERFECT CREW', lines, game.buttons, '#ffd94d');
  }
}

function wrapText(text, width) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

let last = performance.now();
let acc = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const m = game.mission;
  if (game.screen === 'playing' && m) {
    acc += dt;
    const step = 1 / 60;
    let guard = 0;
    while (acc >= step && guard < 5) {
      updateMission(m, input, step, sound);
      acc -= step;
      guard++;
      if (m.status === 'busted') { game.screen = 'busted'; break; }
      if (m.status === 'complete') { game.screen = 'complete'; break; }
      if (m.status === 'failed') { game.screen = 'failed'; break; }
    }
    if (guard >= 5) acc = 0;
  }
  render(now / 1000);
  requestAnimationFrame(loop);
}

// Screenshot staging: ?shot=start|play|alarm|win&seed=N renders one fixed
// frame so the entry's screenshots are real renders of the game's own code.
// Debug handle for automated play-testing (read-only state inspection).
window.__vaultbreak = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.muted = true;
  stageShot(game, shot, Number(params.get('seed') || '1'));
  render(1.25);
  window.__shotReady = true;
} else {
  game.mission = createMission(0, 42);
  requestAnimationFrame(loop);
}
