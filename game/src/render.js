// render.js — everything the eye sees, drawn on one canvas.
// The static room (floor, carpet, walls, paintings, ropes, cover) is painted
// once per level to an offscreen canvas; each frame the living things are
// drawn over it: loot, exit, cones, cameras, guards, the thief, smoke, then
// the HUD, banners and panels. The field is 1280x720 and the HUD is a 64 px
// band across its top — that is why the paintings sit at y 70 and the
// cameras at y 84, below the band instead of on the wall.

import {
  COLORS,
  FIELD_H,
  FIELD_W,
  CAMERA_FOV,
  GUARD_FOV,
  HUNT_ALARM,
  WALL,
} from './config.js';

// Clickable HUD tool buttons, in field coordinates. main.js hit-tests them.
export const SMOKE_BUTTON = { x: 1018, y: 12, w: 112, h: 40 };
export const EMP_BUTTON = { x: 1142, y: 12, w: 122, h: 40 };

const HUD_H = 64;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const staticLayer = document.createElement('canvas');
  staticLayer.width = FIELD_W;
  staticLayer.height = FIELD_H;
  let level = null;

  // --- the static room, painted once per level -------------------------
  function paintStatic(lv) {
    const c = staticLayer.getContext('2d');
    // Marble checker floor.
    const tile = 64;
    for (let y = 0; y < FIELD_H; y += tile) {
      for (let x = 0; x < FIELD_W; x += tile) {
        c.fillStyle = ((x / tile + y / tile) % 2 === 0) ? COLORS.floorA : COLORS.floorB;
        c.fillRect(x, y, tile, tile);
      }
    }
    // A crimson carpet runner across the middle of the room, gold-edged.
    c.fillStyle = COLORS.carpet;
    c.fillRect(WALL, 356, FIELD_W - WALL * 2, 48);
    c.fillStyle = COLORS.carpetEdge;
    c.fillRect(WALL, 356, FIELD_W - WALL * 2, 3);
    c.fillRect(WALL, 401, FIELD_W - WALL * 2, 3);
    // A thin gold line down the carpet's centre.
    c.fillRect(WALL, 378, FIELD_W - WALL * 2, 2);

    // Walls: dark border with a gold inner trim.
    c.fillStyle = COLORS.wall;
    c.fillRect(0, 0, FIELD_W, WALL);
    c.fillRect(0, FIELD_H - WALL, FIELD_W, WALL);
    c.fillRect(0, 0, WALL, FIELD_H);
    c.fillRect(FIELD_W - WALL, 0, WALL, FIELD_H);
    c.strokeStyle = COLORS.wallTrim;
    c.lineWidth = 2;
    c.strokeRect(WALL + 1, WALL + 1, FIELD_W - WALL * 2 - 2, FIELD_H - WALL * 2 - 2);

    // Paintings on the top wall, below the HUD band.
    for (const p of lv.paintings) {
      c.fillStyle = COLORS.paintingFrame;
      c.fillRect(p.x - 42, p.y - 24, 84, 48);
      c.fillStyle = `hsl(${p.hue}, 55%, 32%)`;
      c.fillRect(p.x - 36, p.y - 18, 72, 36);
      c.fillStyle = `hsl(${(p.hue + 40) % 360}, 60%, 55%)`;
      c.beginPath();
      c.arc(p.x - 12, p.y + 4, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `hsl(${(p.hue + 90) % 360}, 45%, 45%)`;
      c.fillRect(p.x + 2, p.y - 12, 26, 22);
    }

    // Velvet ropes: a red bar on gold posts.
    for (const r of lv.ropes) {
      c.fillStyle = COLORS.rope;
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = COLORS.ropePost;
      c.beginPath();
      c.arc(r.x, r.y + r.h / 2, 5, 0, Math.PI * 2);
      c.arc(r.x + r.w, r.y + r.h / 2, 5, 0, Math.PI * 2);
      c.fill();
    }

    // Cover: display cases, sofas, planters and pedestals.
    for (const cover of lv.cover) {
      if (cover.kind === 'case') {
        c.fillStyle = COLORS.caseFrame;
        c.fillRect(cover.x, cover.y, cover.w, cover.h);
        c.fillStyle = COLORS.caseGlass;
        c.globalAlpha = 0.75;
        c.fillRect(cover.x + 5, cover.y + 5, cover.w - 10, cover.h - 10);
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cover.x + 8, cover.y + cover.h - 8);
        c.lineTo(cover.x + cover.w - 20, cover.y + 8);
        c.stroke();
      } else if (cover.kind === 'sofa') {
        c.fillStyle = COLORS.sofa;
        roundRect(c, cover.x, cover.y, cover.w, cover.h, 10);
        c.fill();
        c.fillStyle = 'rgba(0, 0, 0, 0.3)';
        c.fillRect(cover.x + 6, cover.y + 6, cover.w - 12, 12);
        c.strokeStyle = COLORS.carpetEdge;
        c.lineWidth = 1;
        roundRect(c, cover.x, cover.y, cover.w, cover.h, 10);
        c.stroke();
      } else if (cover.kind === 'planter') {
        c.fillStyle = COLORS.planterPot;
        c.fillRect(cover.x + 14, cover.y + cover.h - 22, cover.w - 28, 22);
        c.fillStyle = COLORS.planter;
        c.beginPath();
        c.arc(cover.x + cover.w / 2, cover.y + cover.h / 2 - 6, 26, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.15)';
        c.beginPath();
        c.arc(cover.x + cover.w / 2 - 8, cover.y + cover.h / 2 - 14, 9, 0, Math.PI * 2);
        c.fill();
      } else if (cover.kind === 'pedestal') {
        c.fillStyle = COLORS.pedestal;
        c.fillRect(cover.x, cover.y, cover.w, cover.h);
        c.fillStyle = COLORS.carpetEdge;
        c.fillRect(cover.x, cover.y, cover.w, 4);
        c.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        c.lineWidth = 2;
        c.strokeRect(cover.x, cover.y, cover.w, cover.h);
      }
    }
  }

  function drawCone(x, y, angle, range, fov, fill, edge) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - fov / 2, angle + fov / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawLootShape(kind, x, y) {
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'sapphire') {
      ctx.fillStyle = '#6ec6ff';
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(0, 15);
      ctx.moveTo(-11, 0);
      ctx.lineTo(11, 0);
      ctx.stroke();
    } else if (kind === 'portrait') {
      ctx.fillStyle = COLORS.paintingFrame;
      ctx.fillRect(-13, -16, 26, 32);
      ctx.fillStyle = '#c98a4b';
      ctx.fillRect(-10, -13, 20, 26);
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(0, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, 2, 16, 10);
    } else if (kind === 'mask') {
      ctx.fillStyle = COLORS.loot;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(-5, -1, 3, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -1, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'crown') {
      ctx.fillStyle = COLORS.loot;
      ctx.beginPath();
      ctx.moveTo(-14, 9);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-7, 2);
      ctx.lineTo(0, -11);
      ctx.lineTo(7, 2);
      ctx.lineTo(14, -6);
      ctx.lineTo(14, 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(0, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPanel(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 5, 14, 0.62)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const pw = 640;
    const ph = 110 + lines.length * 30;
    const px = (FIELD_W - pw) / 2;
    const py = (FIELD_H - ph) / 2;
    ctx.fillStyle = 'rgba(18, 13, 26, 0.95)';
    roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = accent || COLORS.carpetEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText(title, FIELD_W / 2, py + 58);
    ctx.font = '16px Georgia, serif';
    lines.forEach((line, i) => {
      ctx.fillStyle = line.dim ? COLORS.hudDim : COLORS.hudText;
      ctx.fillText(line.text, FIELD_W / 2, py + 100 + i * 30);
    });
    ctx.textAlign = 'left';
  }

  function drawHud(world, ui) {
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, FIELD_W, HUD_H);
    ctx.fillStyle = COLORS.carpetEdge;
    ctx.fillRect(0, HUD_H - 2, FIELD_W, 2);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`ROOM ${world.levelIndex + 1}/3`, 16, 18);
    ctx.font = '15px Georgia, serif';
    ctx.fillStyle = COLORS.hudDim;
    ctx.fillText(world.level.name.toUpperCase(), 16, 40);

    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 240, 18);
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = COLORS.hudDim;
    ctx.fillText(`BEST ${ui.best || 0}`, 240, 40);

    ctx.fillStyle = COLORS.loot;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText(`LOOT ${world.lootTaken}/${world.loot.length}`, 430, 18);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText(world.exitOpen ? 'EXIT OPEN' : 'LIFT ALL LOOT', 430, 40);

    ctx.fillStyle = '#ff5a6e';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('♥'.repeat(Math.max(0, world.lives)) + '♡'.repeat(Math.max(0, 3 - world.lives)), 590, 20);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText('LIVES', 590, 42);

    const t = Math.ceil(world.timeLeft() - 1e-6); // the epsilon absorbs float error
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText(`TIME ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, 700, 18);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText(`PAR ${world.level.par}s`, 700, 40);

    // The alarm meter. The bar is short enough that its % never runs into
    // the SMOKE button beside it.
    const ax = 800;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText('ALARM', ax, 16);
    const bw = 170;
    const bh = 16;
    const by = 26;
    ctx.fillStyle = '#2a2233';
    ctx.fillRect(ax, by, bw, bh);
    const frac = world.alarm / 100;
    ctx.fillStyle = world.alarm >= HUNT_ALARM
      ? COLORS.alarmHigh
      : world.alarm >= 30 ? COLORS.alarmMid : COLORS.alarmLow;
    ctx.fillRect(ax, by, bw * frac, bh);
    ctx.strokeStyle = COLORS.hudDim;
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, by, bw, bh);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText(`${Math.floor(world.alarm)}%`, ax + bw + 8, by + bh / 2);
    if (world.seenByGuard) {
      ctx.fillStyle = COLORS.alarmHigh;
      ctx.font = 'bold 14px Georgia, serif';
      ctx.fillText('SPOTTED!', ax, 52);
    } else if (world.seenByCamera) {
      ctx.fillStyle = COLORS.alarmMid;
      ctx.font = 'bold 14px Georgia, serif';
      ctx.fillText('CAMERA!', ax, 52);
    }

    // Tool buttons.
    drawToolButton(SMOKE_BUTTON, `SMOKE ×${world.smokeLeft}`, world.smokeLeft > 0);
    drawToolButton(EMP_BUTTON, `EMP ×${world.empLeft}`, world.empLeft > 0);
    ctx.textBaseline = 'alphabetic';
  }

  function drawToolButton(r, label, enabled) {
    ctx.fillStyle = enabled ? '#3a2b4d' : '#241f2e';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = enabled ? COLORS.carpetEdge : '#555';
    ctx.lineWidth = 1.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    ctx.fillStyle = enabled ? COLORS.hudText : '#777';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  return {
    setLevel(lv) {
      level = lv;
      paintStatic(lv);
    },

    render(world, ui) {
      if (level !== world.level) this.setLevel(world.level);
      const scale = Math.min(canvas.width / FIELD_W, canvas.height / FIELD_H);
      const ox = (canvas.width - FIELD_W * scale) / 2;
      const oy = (canvas.height - FIELD_H * scale) / 2;
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      ctx.clearRect(0, 0, FIELD_W, FIELD_H);

      // The room.
      ctx.drawImage(staticLayer, 0, 0);

      // The exit: green and open once every piece is lifted, red till then.
      // Its label is drawn after the thief (below), so it stays readable
      // when the thief stands in the doorway.
      const e = world.level.exit;
      ctx.fillStyle = world.exitOpen ? COLORS.exitOpen : COLORS.exitShut;
      ctx.globalAlpha = world.exitOpen ? 0.95 : 0.7;
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COLORS.carpetEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(e.x, e.y, e.w, e.h);

      // Loot, glowing gold, with its name underneath.
      for (const loot of world.loot) {
        if (loot.taken) continue;
        const pulse = 0.5 + 0.3 * Math.sin(ui.time * 3 + loot.x);
        const g = ctx.createRadialGradient(loot.x, loot.y, 4, loot.x, loot.y, 46);
        g.addColorStop(0, `rgba(255, 211, 77, ${0.35 * pulse + 0.15})`);
        g.addColorStop(1, 'rgba(255, 211, 77, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(loot.x, loot.y, 46, 0, Math.PI * 2);
        ctx.fill();
        drawLootShape(loot.kind, loot.x, loot.y);
        ctx.fillStyle = COLORS.loot;
        ctx.font = 'bold 12px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(loot.name.toUpperCase(), loot.x, loot.y + 30);
        ctx.textAlign = 'left';
      }

      // Smoke clouds.
      for (const s of world.smokes) {
        ctx.fillStyle = COLORS.smoke;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(230, 230, 240, 0.25)';
        ctx.beginPath();
        ctx.arc(s.x - 24, s.y - 12, 34, 0, Math.PI * 2);
        ctx.arc(s.x + 28, s.y + 10, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vision cones: cameras first, then guards, so a guard's cone reads
      // on top where they overlap.
      for (const c of world.cameras) {
        const cone = world.cameraCone(c);
        if (!cone.dark) {
          drawCone(cone.x, cone.y, cone.angle, cone.range, CAMERA_FOV, COLORS.cameraCone, COLORS.cameraConeEdge);
        }
      }
      for (const g of world.guards) {
        const cone = world.guardCone(g);
        drawCone(
          cone.x, cone.y, cone.angle, cone.range, GUARD_FOV,
          cone.alerted ? COLORS.coneAlert : COLORS.coneCalm,
          cone.alerted ? COLORS.coneAlertEdge : COLORS.coneCalmEdge,
        );
      }

      // Cameras: a wall unit with a lens; a "z" while the EMP holds it dark.
      for (const c of world.cameras) {
        ctx.fillStyle = c.empTimer > 0 ? '#4a4a55' : COLORS.camera;
        roundRect(ctx, c.x - 9, c.y - 7, 18, 14, 4);
        ctx.fill();
        ctx.fillStyle = c.empTimer > 0 ? '#222' : '#ff5a5a';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (c.empTimer > 0) {
          ctx.fillStyle = '#9fd8ff';
          ctx.font = 'bold 16px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText('z', c.x, c.y - 12);
          ctx.textAlign = 'left';
        }
      }

      // Guards: dark suits, a facing tick, "!" while chasing, "?" while searching.
      for (const g of world.guards) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(g.x, g.y + 8, 13, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.guardSuit;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + Math.cos(g.angle) * 11, g.y + Math.sin(g.angle) * 11);
        ctx.stroke();
        if (g.state === 'chase') {
          ctx.fillStyle = '#ff4030';
          ctx.font = 'bold 22px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', g.x, g.y - 18);
          ctx.textAlign = 'left';
        } else if (g.state === 'search') {
          ctx.fillStyle = '#ffb020';
          ctx.font = 'bold 22px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText('?', g.x, g.y - 18);
          ctx.textAlign = 'left';
        }
      }

      // The thief: bright blue with a gold ring, so the eye finds them first.
      const p = world.player;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.thief;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.thiefRing;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      if (world.sneaking) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('WREN', p.x, p.y - 20);
      ctx.textAlign = 'left';

      // The exit's name label, on top of everything in the room: above a
      // bottom exit and below a top one (or it clips off the frame), with a
      // dark pill behind it so it reads over the thief in the doorway.
      const exitLabel = world.exitOpen ? e.label : `${e.label} — LOCKED`;
      ctx.font = 'bold 12px Georgia, serif';
      const labelW = ctx.measureText(exitLabel).width + 16;
      const labelY = e.y > FIELD_H / 2 ? e.y - 8 : e.y + e.h + 16;
      ctx.fillStyle = 'rgba(8, 5, 14, 0.75)';
      roundRect(ctx, e.x + e.w / 2 - labelW / 2, labelY - 13, labelW, 18, 9);
      ctx.fill();
      ctx.fillStyle = COLORS.hudText;
      ctx.textAlign = 'center';
      ctx.fillText(exitLabel, e.x + e.w / 2, labelY);
      ctx.textAlign = 'left';

      // The HUD.
      drawHud(world, ui);

      // A banner: one line, centre screen, fading out.
      if (ui.banner && ui.bannerT > 0) {
        ctx.globalAlpha = Math.min(1, ui.bannerT * 2);
        ctx.fillStyle = ui.bannerColor || COLORS.hudText;
        ctx.font = 'bold 34px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(ui.banner, FIELD_W / 2, 150);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }

      // Panels.
      if (ui.screen === 'title') {
        drawPanel('VELVET VAULT', [
          { text: 'The Marlowe Sapphire Heist', dim: false },
          { text: 'Three rooms. One sapphire. Slip past every guard and get out.', dim: true },
          { text: 'WASD / arrows to move — hold Shift to sneak', dim: true },
          { text: 'Q smoke pellet   •   E EMP the cameras   •   Click the floor to walk', dim: true },
          { text: 'Lift all the loot, then reach the exit. Three lives for the whole heist.', dim: true },
          { text: ui.best > 0 ? `Best score: ${ui.best}` : 'No heist yet — make this one count.', dim: false },
          { text: 'Press SPACE to begin', dim: false },
        ]);
      } else if (ui.screen === 'paused') {
        drawPanel('PAUSED', [
          { text: 'The gallery waits. The guards do not.', dim: true },
          { text: 'Press P to keep going', dim: false },
        ]);
      } else if (ui.screen === 'caught') {
        drawPanel('CAUGHT!', [
          { text: world.lives > 0 ? `${world.lives} ${world.lives === 1 ? 'life' : 'lives'} left — the room resets.` : '', dim: true },
          { text: 'Press SPACE to try the room again', dim: false },
        ], '#ff4030');
      } else if (ui.screen === 'level') {
        const c = world.lastClear || { timeBonus: 0, ghostBonus: 0, lootValue: 0 };
        drawPanel('ROOM CLEAR!', [
          { text: `Loot  +${c.lootValue}`, dim: false },
          { text: `Time bonus  +${c.timeBonus}`, dim: false },
          { text: c.ghostBonus > 0 ? `Ghost bonus  +${c.ghostBonus} — never seen!` : 'Spotted — no ghost bonus this room', dim: false },
          { text: `Score  ${world.score.toLocaleString('en-US')}`, dim: false },
          { text: 'Press SPACE for the next room', dim: false },
        ], COLORS.exitOpen);
      } else if (ui.screen === 'heist') {
        drawPanel('THE HEIST IS DONE!', [
          { text: 'The Marlowe Sapphire is yours. Wren slips into the night.', dim: true },
          { text: `Final score  ${world.score.toLocaleString('en-US')}`, dim: false },
          { text: ui.best > 0 ? `Best score  ${ui.best}` : '', dim: false },
          { text: 'Press SPACE to plan the next heist', dim: false },
        ], COLORS.loot);
      } else if (ui.screen === 'gameover') {
        drawPanel('THE HEIST FAILED', [
          { text: 'Three lives, spent. The gallery keeps its sapphire tonight.', dim: true },
          { text: `Score  ${world.score.toLocaleString('en-US')}`, dim: false },
          { text: 'Press SPACE to start over', dim: false },
        ], '#ff4030');
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
