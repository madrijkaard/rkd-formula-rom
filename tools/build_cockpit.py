#!/usr/bin/env python3
"""Build the cockpit overlay layers from assets/cockpit_source.jpg:
   assets/cockpit.png      static base (halo, body, tyres), area under the wheel filled
   assets/wheel_hands.png  steering wheel + gloved hands + forearms, rotated at runtime

1. Builds a hard 1-bit mask of the car (halo frame + pillar, bodywork, front tyres,
   wheel and hands) from hand-tuned polygons refined with colour heuristics.
   Everything else (sky, stands, fences, track, banner, rival cars) becomes transparent.
2. Removes the baked HUD (LAP, POS, minimap, speed) by inpainting.
3. Blanks the wheel display (gear digit + power bar) so the game draws it live.
4. Splits the wheel + hands + forearms into their own layer (extended below the image
   bottom so a rotated layer never shows a gap) and fills the area under it in the base
   with a plausible dark cockpit interior and steering column hub.

Usage: python3 tools/build_cockpit.py [--preview DIR]
Requires: Pillow, numpy, opencv-python(-headless).
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'cockpit_source.jpg')
OUT = os.path.join(ROOT, 'assets', 'cockpit.png')
OUT_WHEEL = os.path.join(ROOT, 'assets', 'wheel_hands.png')

# Steering wheel + hands + forearms outline (source pixels). The outline runs through the
# dark cockpit gap between the wheel/gloves and the bodywork, down to the bottom edge.
WHEEL = [
    (480, 400), (560, 397), (720, 397), (800, 410), (840, 418), (880, 434), (910, 446),
    (935, 460), (955, 474), (985, 490), (1000, 515), (1012, 545), (1020, 575), (1028, 610),
    (1035, 645), (1048, 680), (1065, 705), (1078, 720),
    (212, 720), (226, 690), (240, 650), (255, 615), (265, 580), (278, 540), (290, 505),
    (300, 480), (310, 465), (330, 452), (360, 437), (400, 420), (440, 410),
]
# Left of the left grip the mockup has a dark wedge between the bodywork and the wheel's
# red outer frame line. It belongs to the cockpit, not the wheel: dark pixels inside this
# zone that connect to the outside are kept static in the base (otherwise a rotated wheel
# drags a black slab over the bodywork stripes).
GAP_L_ZONE = [(250, 395), (450, 395), (412, 406), (398, 416), (387, 427), (378, 440), (366, 455),
              (346, 473), (336, 498), (322, 528), (304, 560), (250, 560)]
# Same gap on the right (beside the right grip, between the wheel's top-right red frame and
# the sidepod): the mirror of GAP_L_ZONE about x = MIRROR_SUM / 2. With the red inner wall
# in the base these dark mockup pixels showed as a black patch dragged by the wheel.
GAP_R_ZONE = [(1276 - x, y) for x, y in GAP_L_ZONE]
# Right forearm, outer side at the bottom of the screen: the mockup has a black wedge
# beside the sleeve (right of the blue badge) that was cut into the layer as if it were
# arm. The left forearm is plain red sleeve there. Dark pixels of that wedge become the
# mirrored left sleeve where the left sleeve exists, and leave the layer elsewhere.
SLEEVE_R_BOX = (1035, 680, 1120, 720)   # x0, y0, x1, y1 (search box for the wedge)
# The chassis is symmetric: the base hidden under the right half of the wheel is the
# mirror image of the left half's base (original pixels where visible, approved fill where
# hidden). Mirror axis measured by matching the visible bodywork/rim left vs right:
# x = 638.0 (source_x = 1276 - x, no vertical offset), mean abs error 11.5 per channel.
MIRROR_SUM = 1276
# Inner side walls of the cockpit opening (user markup, native coords). The opening floor
# is a trapezoid: top edge y=410 from x 525 to 751, sides running down-out to (6, 691) and
# its mirror. Between each side and the bodywork rim above it the inside face of the
# monocoque is painted in the bodywork reds; the right wall is the mirror of the left one
# (axis x = MIRROR_SUM / 2), which also makes the hand opening in the rim symmetric.
WALL_TOP = (525, 410)
WALL_BOT = (6, 691)
WALL_RIM_FLAT_X = 444     # from here to WALL_TOP the rim is the dash-top line (y 409)
WALL_RAMP = [(36, 4, 4), (52, 0, 0), (76, 0, 0), (108, 0, 0), (118, 0, 0), (144, 5, 10),
             (178, 11, 18), (202, 19, 24), (216, 43, 47), (222, 63, 68)]   # image reds
# Depth cues on the inner walls (user markup, measured in native coords):
# fold = crease between the chassis top surface and the inner wall, a straight line
# through (507, 384) with slope 0.452 px down per px to the left; hand opening = recess
# in the wall between x 204 (rear end face) and x 442 (front end face), rim to floor.
WALL_FOLD = (507, 384, 0.452)
WALL_RECESS_X = (204, 442)
WALL_END_FACE_W = 7
WHEEL_PIVOT = (640, 503)    # centre of the wheel display = steering column axis
WHEEL_EXTRA_ROWS = 80       # layer continues below the screen edge
HUB_RADIUS = 46
DITHER_AMP = 28           # ordered-dither strength for the filled area
FOREARM_SLOPE = 0.38       # forearm edges move this many px sideways per px down

# --- silhouette polygons, in source pixels (1280x720) ------------------------------
HALO = [  # top frame + arch inner edge + pillar (sky is removed by colour afterwards)
    (0, 0), (1280, 0), (1280, 68), (1200, 72), (1150, 76), (1100, 80), (1050, 85), (1000, 90),
    (940, 96), (910, 100), (880, 106), (850, 111), (800, 124), (780, 132), (750, 145), (725, 158),
    (712, 170), (700, 183), (690, 195), (678, 200), (670, 208), (664, 222), (660, 235),
    (657, 245), (655, 255),
    (655, 345), (662, 350), (672, 356), (672, 372), (603, 372), (603, 360), (610, 355),
    (618, 350), (623, 345), (623, 255), (621, 245), (618, 235), (610, 226), (600, 217),
    (592, 210), (580, 198), (568, 182),
    (555, 165), (540, 150), (520, 136), (500, 125), (470, 115), (440, 108), (400, 104),
    (350, 101), (330, 98), (300, 94), (250, 88), (200, 80), (100, 70), (0, 62),
]
BODY = [  # bodywork top edge from left to right, closed along the bottom
    (0, 461), (20, 460), (40, 457), (70, 455), (100, 454), (108, 452),
    (372, 397), (380, 391), (400, 382), (420, 377), (450, 370), (480, 364), (500, 360),
    (520, 357), (540, 355), (560, 354), (603, 352), (672, 352), (700, 354), (720, 355),
    (740, 359), (760, 362), (780, 366), (800, 370), (820, 374), (840, 377), (860, 382),
    (880, 387), (905, 394),
    (1165, 452), (1180, 453), (1200, 457), (1240, 459), (1280, 461), (1280, 720), (0, 720),
]
TYRE_L = [
    (108, 452), (110, 440), (115, 420), (122, 400), (128, 388), (134, 376), (146, 362),
    (160, 350), (175, 341), (192, 334), (260, 332), (285, 334), (296, 336), (305, 339),
    (318, 344), (332, 350), (345, 356), (355, 363), (362, 372), (367, 385), (372, 394),
    (375, 402), (366, 412), (108, 470),
]
TYRE_R = [
    (905, 400), (910, 380), (920, 360), (932, 345), (940, 340), (950, 335), (962, 330),
    (1060, 330), (1075, 333), (1095, 340), (1110, 350), (1125, 365), (1140, 385),
    (1150, 400), (1158, 415), (1162, 430), (1165, 452), (905, 452),
]

# Baked HUD rectangles to inpaint (x0, y0, x1, y1).
HUD_BOXES = [
    (24, 26, 128, 102),     # LAP 1/5
    (1155, 26, 1260, 102),  # POS 3/8
    (1075, 615, 1262, 690), # 287 KM/H
]
MINIMAP_BOX = (25, 520, 210, 670)

# Wheel display areas repainted with the screen background; the game draws them live
# (shift LEDs, gear digit, power bar). Keep in sync with js/render/dash.js.
DASH_BLANK = [
    (562, 454, 714, 471),   # shift LED row
    (616, 480, 662, 527),   # gear digit
    (551, 529, 728, 555),   # power bar
]
SCREEN_BG = (9, 9, 9)

def poly_mask(shape, pts):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m

def directional_fill(img, hole):
    """Fill hole pixels by copying along the diagonal livery stripes of the bodywork so
    the stripes continue instead of being blurred. For every hole pixel the stripe slope
    is estimated locally: the slope whose valid samples on both sides of the hole agree
    best wins, and the nearer of those two samples is copied."""
    out = img.copy()
    H, W = hole.shape
    f = img.astype(int)
    slopes = np.arange(-0.10, -0.52, -0.02)
    ys, xs = np.nonzero(hole)

    def walk(y, x, slope, sgn):
        for d in range(1, 160):
            sx = x + sgn * d
            sy = int(round(y + sgn * d * slope))
            if not (0 <= sx < W and 0 <= sy < H):
                return None
            if not hole[sy, sx]:
                # step 2 px further in so we sample clean texture, not the hole edge
                sx2, sy2 = x + sgn * (d + 2), int(round(y + sgn * (d + 2) * slope))
                if 0 <= sx2 < W and 0 <= sy2 < H and not hole[sy2, sx2]:
                    return d, sy2, sx2
                return d, sy, sx
        return None

    for y, x in zip(ys, xs):
        best = None
        for sl in slopes:
            a = walk(y, x, sl, 1)
            b = walk(y, x, sl, -1)
            if not a or not b:
                continue
            diff = np.abs(f[a[1], a[2]] - f[b[1], b[2]]).sum()
            # also compare a second sample pair further out for robustness
            score = diff
            if best is None or score < best[0]:
                best = (score, a, b)
        if best:
            _, a, b = best
            src = a if a[0] <= b[0] else b
            out[y, x] = img[src[1], src[2]]
    return out

def fill_under_wheel(img, hole):
    """Plausible cockpit behind the wheel layer: what surrounds the layer (bodywork,
    cockpit rim, interior, sleeves) is continued inwards by inpainting, so a rotated
    layer uncovers a continuation instead of a black cut-out. The steering column hub
    sits deep under the wheel centre. Filled colours are snapped to the image's own
    palette for crisp pixels. Pixels outside `hole` are left exactly as they are."""
    H, W = hole.shape
    fill = cv2.inpaint(img, hole * 255, 8, cv2.INPAINT_TELEA)
    yy, xx = np.mgrid[0:H, 0:W]
    res = fill.copy()
    # steering column hub behind the wheel centre (never uncovered at small angles)
    px, py = WHEEL_PIVOT
    r = np.hypot(xx - px, yy - py)
    res[r < HUB_RADIUS + 4] = (22, 22, 24)
    res[r < HUB_RADIUS] = (44, 44, 48)
    res[(r < HUB_RADIUS) & (yy < py - HUB_RADIUS * 0.4)] = (70, 70, 76)
    res[r < HUB_RADIUS * 0.55] = (28, 28, 30)
    res[r < HUB_RADIUS * 0.3] = (12, 12, 12)
    # crisp pixels: snap filled colours to a palette sampled from the visible image
    pal = img[hole == 0].reshape(-1, 3)[::61].astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, _, centers = cv2.kmeans(pal, 48, None, crit, 2, cv2.KMEANS_PP_CENTERS)
    sel = hole > 0
    # 4x4 ordered dither before snapping turns the smooth inpainted gradients into
    # pixel-art shading instead of a blurry smudge
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5
    thr = bayer[yy % 4, xx % 4][..., None] * DITHER_AMP
    pix = np.clip(res.astype(np.float32) + thr, 0, 255)[sel]
    d = ((pix[:, None, :] - centers[None]) ** 2).sum(2)
    out = img.copy()
    out[sel] = centers[d.argmin(1)].astype(np.uint8)
    return out


def inner_walls(base, mask):
    """Paint the inside faces of the cockpit side walls in the bodywork reds.

    Left wall = every pixel between the bodywork rim (lowest red/white bodywork pixel per
    column, median-smoothed; the dash-top line y 409 from WALL_RIM_FLAT_X on) and the
    floor edge line WALL_TOP-WALL_BOT. Shading per pixel from its position across the wall:
    a 2 px shadow under the rim lip, a lit upper face darkening toward the floor (the face
    turns inward, away from the light), a slightly brighter wall nearer the camera, and a
    2 px highlight on the floor edge plus a 2 px shadow just inside the floor. Levels are
    ordered-dithered (4x4 Bayer) between reds taken from the image. The right wall is the
    exact mirror of the left one. Floor/interior (inside the trapezoid) is untouched apart
    from that 2 px edge shadow. Returns the new base and the mask of changed pixels."""
    H, W = mask.shape
    out = base.copy()
    region = np.zeros((H, W), bool)
    b = base.astype(int)
    r, g, bl = b[..., 0], b[..., 1], b[..., 2]
    body = (mask > 0) & (((r > 130) & (r > g + 50)) | (np.minimum(np.minimum(r, g), bl) > 150))
    tx, ty = WALL_TOP
    slope = (WALL_BOT[0] - tx) / (WALL_BOT[1] - ty)           # dx per dy (negative)
    xs = np.arange(0, tx + 1)
    rim = np.empty(len(xs))
    for x in xs:
        ys = np.flatnonzero(body[380:700, x])
        rim[x] = ys.max() + 380 if len(ys) else ty - 1
    pad = np.pad(rim, 2, mode='edge')
    rim = np.array([np.median(pad[i:i + 5]) for i in range(len(xs))])
    rim = np.where(xs >= WALL_RIM_FLAT_X, np.maximum(rim, ty - 1), rim)
    floor = ty + (xs - tx) / slope
    ramp = np.array(WALL_RAMP, np.uint8)
    n = len(ramp) - 1                                         # top colour: highlight only
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    fx, fy, fs = WALL_FOLD
    fold = np.maximum(fy + (fx - xs) * fs, rim + 1)       # never above the rim
    rx0, rx1 = WALL_RECESS_X
    ew = WALL_END_FACE_W
    hi = ramp[n]                                            # brightest red: lit edges

    def dith(L, x, y, lo_i=0):
        L = np.clip(L, 0, 1) * (n - 1 - lo_i) + lo_i
        lo = int(np.floor(L))
        return ramp[min(lo + (1 if L - lo > bayer[y % 4, x % 4] else 0), n - 1)]

    for x in xs:
        in_recess = rx0 <= x <= rx1
        rear_face = rx0 <= x < rx0 + ew
        front_face = rx1 - ew < x <= rx1
        for y in range(int(np.floor(rim[x])) + 1, min(int(np.ceil(floor[x])) + 3, H)):
            if not mask[y, x]:
                continue
            region[y, x] = True
            d_top, d_bot = y - rim[x], floor[x] - y
            if d_bot < 0:                                     # floor side of the edge
                out[y, x] = (b[y, x] * 0.55).astype(np.uint8)
                continue
            # vertical end faces of the hand recess, rim to floor
            if rear_face:      # faces forward/away from the light: deep shadow, lit lip
                out[y, x] = hi if x == rx0 else (ramp[0] if x < rx0 + ew - 1 else ramp[1])
                continue
            if front_face:     # faces back toward the camera: lit, lip highlight
                out[y, x] = hi if x == rx1 else dith(0.62 - 0.25 * (d_top / max(floor[x] - rim[x], 1)), x, y)
                continue
            if d_bot < 1:
                out[y, x] = ramp[5]                           # floor-edge highlight (dim)
                continue
            fd = y - fold[x]                                  # distance below the fold
            if fd < 0:
                # top surface between rim and fold (stepped-down ledge in the recess):
                # lit lip on the rim, a 1 px step shadow, then flat light red
                if d_top < 1.5:
                    out[y, x] = hi
                elif d_top < 2.5:
                    out[y, x] = ramp[1]
                else:
                    out[y, x] = dith(0.80, x, y)
                continue
            if fd < 1:
                out[y, x] = hi                                # fold highlight
                continue
            # inner wall: dark band under the fold, then a gradient darkening to the floor
            v = fd / max(floor[x] - fold[x], 1)
            L = 0.50 - 0.46 * v + 0.08 * (1 - x / tx)
            band = np.clip((fd - 1) / 6, 0, 1)
            L = 0.06 + (L - 0.06) * band
            if in_recess:
                L -= 0.12                                     # recess is set back: darker
                cs = (rx1 - ew) - x                           # cast shadow of the front face
                if 0 <= cs < 10:
                    L -= 0.16 * (1 - cs / 10)
            out[y, x] = dith(L, x, y)
    yy, xx = np.nonzero(region)
    xr = MIRROR_SUM - xx
    ok = (xr >= 0) & (xr < W)
    yy, xx, xr = yy[ok], xx[ok], xr[ok]
    ok = mask[yy, xr] > 0
    out[yy[ok], xr[ok]] = out[yy[ok], xx[ok]]
    region[yy[ok], xr[ok]] = True
    # right side: where the right stripe ends a few px above the mirrored rim, close the
    # gap of original dark pixels with the lip colour so the lit edge stays continuous
    for x in range(MIRROR_SUM - tx, W):
        rows = np.flatnonzero(region[:, min(x, MIRROR_SUM)])
        if not len(rows):
            continue
        r0 = rows.min()
        ys = np.flatnonzero(body[380:r0, x])
        if len(ys) and r0 - (ys.max() + 381) <= 6:
            for y in range(ys.max() + 381, r0):
                if mask[y, x] and not body[y, x]:
                    out[y, x] = out[r0, min(x, MIRROR_SUM)]
                    region[y, x] = True
    # the last columns right of x = MIRROR_SUM have no left counterpart: extend the edge
    for x in range(MIRROR_SUM + 1, W):
        rows = np.flatnonzero(region[:, MIRROR_SUM] & (mask[:, x] > 0))
        out[rows, x] = out[rows, MIRROR_SUM]
        region[rows, x] = True
    return out, region


def main():
    preview = None
    if '--preview' in sys.argv:
        preview = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(preview, exist_ok=True)
    img = np.array(Image.open(SRC).convert('RGB'))
    H, W, _ = img.shape
    f = img.astype(int)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx, mn = f.max(2), f.min(2)
    sky = (b > r + 40) & (b > 110) & (b > g + 10)

    halo = poly_mask((H, W), HALO) & ~sky
    body = poly_mask((H, W), BODY)
    k = np.ones((9, 9), np.uint8)
    dark = (mx < 80)
    tyres = np.zeros((H, W), np.uint8)
    for pts in (TYRE_L, TYRE_R):
        p = poly_mask((H, W), pts)
        # polygons are traced slightly inside the black outline; grow into dark pixels only
        tyres |= p | (cv2.dilate(p, np.ones((5, 5), np.uint8)) & dark)
    mask = (halo | body | tyres).astype(np.uint8)
    # clean: fill pin holes, drop specks
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
    keep = np.zeros_like(mask)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 500:
            keep[lab == i] = 1
    inv = (1 - keep).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 60:
            keep[lab == i] = 1
    mask = keep

    out = img.copy()
    # --- remove baked HUD ---
    hud = np.zeros((H, W), np.uint8)
    for (x0, y0, x1, y1) in HUD_BOXES:
        box = np.zeros((H, W), np.uint8); box[y0:y1, x0:x1] = 1
        bright = (mn > 150)  # white digits / letters + their outline
        sel = cv2.dilate((box & bright).astype(np.uint8), np.ones((7, 7), np.uint8)) & box
        hud |= sel
    # the top text sits on the black frame: just paint it black where opaque
    out[(hud > 0) & (np.arange(H)[:, None] < 200)] = (0, 0, 0)
    # speed text on bodywork: inpaint
    sp = hud.copy(); sp[:200] = 0
    # minimap: white line + its dark outline
    x0, y0, x1, y1 = MINIMAP_BOX
    box = np.zeros((H, W), np.uint8); box[y0:y1, x0:x1] = 1
    white = (mn > 170) & (mx - mn < 40)
    mm = cv2.dilate((box & white).astype(np.uint8), np.ones((11, 11), np.uint8)) & box
    out = directional_fill(out, mm)
    if sp.any():
        out = cv2.inpaint(out, sp * 255, 6, cv2.INPAINT_TELEA)

    for (x0, y0, x1, y1) in DASH_BLANK:
        out[y0:y1, x0:x1] = SCREEN_BG

    # --- split wheel + hands layer ---
    wheel_area = poly_mask((H, W), WHEEL) & mask
    # the outline runs through the black gap around the wheel: drop those near-black
    # pixels from the moving layer (the base is dark there anyway) so a rotated layer
    # never drags a slab of black over the bodywork or the cockpit rim
    dist = cv2.distanceTransform(wheel_area, cv2.DIST_L2, 3)
    dark = out.max(axis=2) < 45
    band = (dist <= 16) & (np.mgrid[0:H, 0:W][0] < 690)
    wheel = wheel_area & ~(dark & band).astype(np.uint8)
    wheel = cv2.morphologyEx(wheel, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # dark wedge left of the left grip: flood from outside the layer through dark pixels
    zone = poly_mask((H, W), GAP_L_ZONE)
    allowed = wheel & (out.max(axis=2) < 60) & zone
    reach = (1 - wheel).astype(np.uint8)
    for _ in range(80):
        nxt = cv2.dilate(reach, np.ones((3, 3), np.uint8)) & (allowed | (1 - wheel))
        if (nxt == reach).all():
            break
        reach = nxt
    wheel = wheel & (1 - reach)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(wheel, connectivity=4)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 400:
            wheel[lab == i] = 0
    # the base fill below is computed for this mask, so the v22 look stays identical
    wheel_fill = wheel.copy()
    # dark gap right of the right grip (mirror of the left fix): same flood, mirrored zone
    zone = poly_mask((H, W), GAP_R_ZONE)
    allowed = wheel & (out.max(axis=2) < 60) & zone
    reach = (1 - wheel).astype(np.uint8)
    for _ in range(80):
        nxt = cv2.dilate(reach, np.ones((3, 3), np.uint8)) & (allowed | (1 - wheel))
        if (nxt == reach).all():
            break
        reach = nxt
    wheel = wheel & (1 - reach)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(wheel, connectivity=4)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 400:
            wheel[lab == i] = 0
    freed_r = (wheel_fill > 0) & (wheel == 0)    # now static base pixels (red wall / fill)
    print('GAP_R: moved', int(freed_r.sum()), 'px from the wheel layer to the base')
    wl = np.dstack([out, (wheel * 255).astype(np.uint8)])
    wl[wheel == 0] = 0
    # complete the right forearm's outer edge with the mirrored left sleeve
    x0, y0, x1, y1 = SLEEVE_R_BOX
    box = np.zeros((H, W), np.uint8); box[y0:y1, x0:x1] = 1
    dk = ((wheel > 0) & (out.max(axis=2) < 45) & (box > 0)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(dk, connectivity=8)
    sleeve_fix = np.zeros((H, W), bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 100:
            sleeve_fix |= lab == i
    yy, xx = np.nonzero(sleeve_fix)
    src = wl[yy, MIRROR_SUM - xx]
    has = src[:, 3] > 0
    wl[yy, xx] = np.where(has[:, None], src, 0)
    wheel[yy[~has], xx[~has]] = 0
    print('right sleeve: recoloured', int(has.sum()), 'px, removed', int((~has).sum()), 'px')
    # continue the forearms below the screen edge along their own direction (the left one
    # runs down-left, the right one down-right), so a rotated layer never shows a gap there
    k = np.arange(1, WHEEL_EXTRA_ROWS + 1)[:, None]
    xs = np.arange(W)[None, :]
    slope = np.where(xs < WHEEL_PIVOT[0], FOREARM_SLOPE, -FOREARM_SLOPE)
    src_x = np.clip(np.round(xs + slope * k).astype(int), 0, W - 1)
    # the sleeve badges (white / blue) touch the bottom edge: continue plain sleeve
    # fabric instead, by replacing them with the nearest fabric pixel of that row
    row = wl[-1].copy()
    rgb = row[:, :3].astype(int)
    badge = (row[:, 3] > 0) & (rgb.max(1) > 60) & (rgb[:, 0] - rgb[:, 1:].max(1) < 40)
    badge = cv2.dilate(badge.astype(np.uint8)[None], np.ones((1, 7), np.uint8))[0] > 0
    good = np.flatnonzero((row[:, 3] > 0) & ~badge)
    for x in np.flatnonzero(badge & (row[:, 3] > 0)):
        row[x] = row[good[np.abs(good - x).argmin()]]
    ext = row[src_x]
    wl = np.concatenate([wl, ext], axis=0)
    Image.fromarray(wl, 'RGBA').save(OUT_WHEEL, optimize=True)
    print('wrote', OUT_WHEEL, wl.shape)

    base = fill_under_wheel(out, wheel_fill)
    # right half: mirror the (approved) left-half base, only where hidden under the wheel
    yy, xx = np.nonzero((wheel_fill > 0) & (np.arange(W)[None, :] > WHEEL_PIVOT[0]))
    base[yy, xx] = base[yy, np.clip(MIRROR_SUM - xx, 0, W - 1)]
    # red inner side walls of the cockpit opening (deliberate change to the chassis)
    base, wall_region = inner_walls(base, mask)
    # at 0 degrees base + wheel layer must reproduce the approved image exactly, except in
    # the inner-wall region, which the user asked to repaint on purpose
    same = np.where(wheel[..., None] > 0, out, base)
    # ... and except the GAP_R pixels moved out of the wheel layer: they now show the base
    # (red inner wall / under-wheel fill) instead of the mockup's dark gap
    # ... and except the completed right sleeve edge (black wedge -> red sleeve / base)
    keep = (mask > 0) & ~wall_region & ~freed_r & ~sleeve_fix
    assert (same[keep] == out[keep]).all(), 'base + wheel layer differs at 0 deg'
    rgba = np.dstack([base, (mask * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(OUT, optimize=True)
    print('wrote', OUT, rgba.shape)
    if preview:
        mag = np.zeros_like(out); mag[:] = (255, 0, 255)
        comp = np.where(mask[..., None] > 0, out, mag)
        Image.fromarray(comp).save(os.path.join(preview, 'cockpit-mask-magenta.png'))
        comp2 = np.where(mask[..., None] > 0, base, mag)
        Image.fromarray(comp2).save(os.path.join(preview, 'cockpit-base-magenta.png'))
        wm = np.where(wheel[..., None] > 0, out, mag)
        Image.fromarray(wm).save(os.path.join(preview, 'wheel-hands-magenta.png'))
        Image.fromarray(np.dstack([sp * 255] * 3).astype(np.uint8)).save(os.path.join(preview, 'inpaint-mask.png'))

if __name__ == '__main__':
    main()
