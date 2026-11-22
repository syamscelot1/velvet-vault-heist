// vision.js — the geometry of being seen: cones, lines of sight and smoke.
// Nothing here knows about guards or the DOM; it only answers questions about
// points, angles and rectangles, so the world and the tests can share it.

import { SNEAK_RANGE } from './config.js';

// Smallest signed turn from angle `from` to angle `to`, in (-PI, PI].
export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Is the point (x, y) inside the cone rooted at (cx, cy), facing `angle`,
// reaching `range` with a full width of `fov` radians?
export function pointInCone(x, y, cx, cy, angle, range, fov) {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 0.001) return true;
  return Math.abs(angleDiff(angle, Math.atan2(dy, dx))) <= fov / 2;
}

// Liang-Barsky: does the segment (x1, y1)-(x2, y2) touch the rectangle?
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// Is the segment blocked by any rectangle in the list?
export function segmentBlocked(x1, y1, x2, y2, rects) {
  for (const r of rects) {
    if (segmentHitsRect(x1, y1, x2, y2, r)) return true;
  }
  return false;
}

// Closest point on the segment (x1, y1)-(x2, y2) to the point (px, py).
export function nearestOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + dx * t, y: y1 + dy * t };
}

// Is the point inside any smoke cloud?
export function pointInSmoke(x, y, smokes) {
  for (const s of smokes) {
    if (Math.hypot(x - s.x, y - s.y) <= s.r) return true;
  }
  return false;
}

// Does the segment pass through any smoke cloud? A cloud between a watcher
// and the thief breaks the line of sight just as a wall does.
export function smokeBetween(x1, y1, x2, y2, smokes) {
  for (const s of smokes) {
    const n = nearestOnSegment(s.x, s.y, x1, y1, x2, y2);
    if (Math.hypot(s.x - n.x, s.y - n.y) <= s.r) return true;
  }
  return false;
}

// Can a detector ({x, y, angle, range, fov}) see the target (tx, ty)?
// `blockers` are the rectangles that stop sight (walls and cover — never the
// velvet ropes, which block feet but not eyes). `smokes` hide the thief when
// they stand inside a cloud or when a cloud hangs between watcher and thief.
// A sneaking thief is spotted at a shorter range.
export function canSee(det, tx, ty, blockers, smokes, sneaking = false) {
  const range = det.range * (sneaking ? SNEAK_RANGE : 1);
  if (!pointInCone(tx, ty, det.x, det.y, det.angle, range, det.fov)) return false;
  if (segmentBlocked(det.x, det.y, tx, ty, blockers)) return false;
  if (pointInSmoke(tx, ty, smokes)) return false;
  if (smokeBetween(det.x, det.y, tx, ty, smokes)) return false;
  return true;
}
