// VAULTBREAK screenshot staging: deterministic scenes rendered by the game's
// own code, driven by ?shot=<name>&seed=<n>. Each shot steps the engine a
// fixed number of 1/60s slices with scripted input, so the same shot always
// renders the same frame. No randomness beyond the mission seed.
import { createMission, updateMission } from './engine.js';
import { TILE } from './levels.js';

const EMPTY_INPUT = { up: false, down: false, left: false, right: false, sneak: false, interact: false, tool: null };

function step(game, input, n) {
  for (let i = 0; i < n; i++) {
    updateMission(game.mission, input, 1 / 60, null);
    if (game.mission.status !== 'playing') break;
  }
}

function placePlayer(game, tx, ty) {
  game.mission.player.x = tx * TILE + TILE / 2;
  game.mission.player.y = ty * TILE + TILE / 2;
}

export function stageShot(game, name, seed) {
  const s = seed || 1;
  if (name === 'start') {
    // Mission 1, early: the thief crosses the shop floor, guard cone sweeping.
    game.levelIndex = 0;
    game.mission = createMission(0, s);
    game.totalScore = 0;
    step(game, { ...EMPTY_INPUT, right: true }, 55);
    step(game, { ...EMPTY_INPUT, down: true }, 30);
    step(game, EMPTY_INPUT, 45);
    game.mission.alarm = 12;
    game.screen = 'playing';
  } else if (name === 'play') {
    // Mission 3, mid-heist: thief near the vault, lasers live, cameras sweeping.
    game.levelIndex = 2;
    game.mission = createMission(2, s);
    game.totalScore = 3850;
    placePlayer(game, 13, 12);
    game.mission.player.dir = Math.PI / 2;
    step(game, { ...EMPTY_INPUT, right: true }, 25);
    step(game, EMPTY_INPUT, 40);
    game.mission.alarm = 35;
    game.screen = 'playing';
  } else if (name === 'alarm') {
    // Mission 4, heat high: alarm 82, guards converging on the thief.
    // No engine steps here: a step could let a guard reach the thief and
    // trigger the busted respawn, which would move the scene off-script.
    game.levelIndex = 3;
    game.mission = createMission(3, s);
    game.totalScore = 9200;
    placePlayer(game, 16, 10);
    game.mission.player.dir = -Math.PI / 2;
    game.mission.alarm = 82;
    for (const guard of game.mission.guards) {
      guard.state = 'chase';
      guard.suspicion = 1;
      guard.lastSeenX = game.mission.player.x;
      guard.lastSeenY = game.mission.player.y;
      guard.alertTimer = 8;
      guard.dir = Math.atan2(game.mission.player.y - guard.y, game.mission.player.x - guard.x);
    }
    for (const cam of game.mission.cameras) cam.suspicion = 0.8;
    game.screen = 'playing';
  } else if (name === 'win') {
    // Mission 6 complete: vault cracked, getaway van waiting, score posted.
    game.levelIndex = 5;
    game.mission = createMission(5, s);
    game.totalScore = 42100;
    placePlayer(game, 27, 9);
    game.mission.vaultTaken = true;
    game.mission.exitOpen = true;
    game.mission.lootValue = 12450;
    game.mission.score = 15200;
    game.mission.time = 212;
    game.mission.alarm = 64;
    game.mission.status = 'complete';
    game.mission.statusText = 'CLEAN GETAWAY — time bonus $640 + ghost bonus $500';
    step(game, EMPTY_INPUT, 5);
    game.mission.status = 'complete';
    game.screen = 'complete';
  } else {
    // Unknown shot name: fall back to the title screen's demo floor.
    game.levelIndex = 0;
    game.mission = createMission(0, s);
    game.screen = 'title';
  }
  game.buttons = [];
}
