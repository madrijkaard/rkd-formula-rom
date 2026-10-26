# 🏎️ rkd-formula-rom

<p align="center">
  <img src="https://img.shields.io/badge/platform-Web%20Browser-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Web Browser">
  <img src="https://img.shields.io/badge/language-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/markup-HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/style-CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/tool-Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/library-NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white" alt="NumPy">
  <img src="https://img.shields.io/badge/library-OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV">
  <img src="https://img.shields.io/badge/library-Pillow-3776AB?style=for-the-badge" alt="Pillow">
</p>

## 📖 About the project

**rkd-formula-rom** is a Formula 1 game developed to run in a browser, with a retro 16-bit look inspired by Mega Drive / SNES racing games and a first-person cockpit view.

The current version is a **Suzuka driving prototype** with no opponents. A closed 5.807 km circuit follows an illustrated Suzuka GP map, including the S Curves, Degner, Hairpin, Spoon, 130R, final chicane and figure-eight overpass. A software 3D road renderer projects the curves and hills at 384x216 with depth testing, then scales the result with nearest-neighbour filtering. The pixel-art cockpit, moving front tyres and steering wheel remain separate layers. The HUD shows lap, position, speed, the current section, gradient and a circuit minimap. The original straight-track renderer is still available in the configuration.

## 🛠️ Technologies used

| Technology | What it is used for |
| --- | --- |
| JavaScript (ES modules) | All game code: main loop, car physics, input handling and rendering, with no build step |
| HTML5 Canvas | Drawing the pseudo-3D track, the cockpit layers, the wheel display and the HUD |
| CSS3 | Full-screen layout of the game canvas and the controls help footer |
| Device Orientation API | Experimental accelerometer steering for Android browsers (enabled with `?tilt=1`) |
| Python 3 | `tools/build_cockpit.py`, which generates the cockpit image layers from the mockup |
| Pillow | Reading and writing the cockpit PNG layers in the build script |
| NumPy | Pixel-level mask and colour operations in the build script |
| OpenCV | Inpainting and image processing when splitting the mockup into layers |

## 🧩 Mapped features

| Feature | What it does | Status |
| --- | --- | --- |
| Suzuka circuit | Closed 5.807 km approximation with 18 named turns, a 52 m elevation range, a bridge/underpass, kerbs, runoff, grandstands and braking markers, rendered at 384×216 | PARTIAL |
| Cockpit overlay | Draws the static pixel-art cockpit (halo, bodywork, front tyres, red inner walls) over the track | PARTIAL |
| Rotating wheel and hands | Rotates the steering wheel and gloved hands up to 7° around the steering column as the car steers, while the driver's legs stay fixed in the cockpit | PARTIAL |
| Live wheel display | Shows the current gear and a power bar on the steering wheel screen | PARTIAL |
| Front tyre animation | Distance-driven rubber and sidewall motion, with progressive smoothing at high speed and a complete stop when the car stops | PARTIAL |
| Car physics | Automatic corner following with manual lateral movement at 120 Hz, hill resistance, cockpit shake and progressive speed loss against either edge on straights and bends | PARTIAL |
| Keyboard controls | Left Shift accelerates, Left Ctrl brakes and the left/right arrows steer | PARTIAL |
| Accelerometer steering (experimental) | Steers by tilting an Android phone held in landscape, enabled with `?tilt=1` in the URL; on-screen throttle and brake buttons are not implemented yet | PARTIAL |
| HUD | Lap, position, speed, current section, gradient and a Suzuka minimap with live position and the upper crossing highlighted | PARTIAL |
| Cockpit layer builder | Generates `assets/cockpit.png` and `assets/wheel_hands.png` from `assets/cockpit_source.jpg`, with an identity check at 0° | PARTIAL |

> Features remain marked `PARTIAL` while this is a prototype. Track continuity, turn directions, elevation, bridge clearance, road visibility, basic physics and tyre animation have automated regression tests. This is an arcade approximation, not a surveyed simulator circuit.

## 🚀 How to run the project

### Requirements

- A modern desktop browser with ES module support (Chrome, Edge, Firefox or Safari).
- **Python 3** to serve the files locally. Browsers block ES modules opened straight from `file://`, so the game must be served over HTTP.
- No Node.js, package installation or build step is required to play.

### Running the game

```bash
git clone https://github.com/madrijkaard/rkd-formula-rom.git
cd rkd-formula-rom
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser and click the game screen once so it receives keyboard input.

| Key | Action |
| --- | --- |
| `Left Shift` | Accelerate |
| `Left Ctrl` | Brake |
| `←` / `→` | Steer |

When accelerating into a bend, tap the arrow in the direction of that bend to enable automatic following for that corner. You can then release it; each new corner requires another input. Holding only the accelerator pulls the car towards the outside of the curve until you activate assistance. Reaching the road edge triggers cockpit shake and progressive speed loss, with no instant stop or forced pause. The arrows also move the car laterally, and insisting against either edge can gradually stop it even at full throttle. Steer back towards the road to recover.

To try the experimental accelerometer steering on an Android phone, open the game with `?tilt=1` at the end of the URL (for example `http://<your-computer-ip>:8080/?tilt=1`) and hold the phone in landscape.

### Configuration

Game tuning lives in `js/config.js`; no file needs to be edited before running. Useful values:

- `CAR` sets acceleration, braking, top speed, steering response (`steerRate`) and gear changes.
- `WHEEL.maxDeg` sets the maximum steering wheel rotation (currently `7.0` degrees), and `WHEEL.visible` hides or shows the wheel and hands layer.
- `TIRES.animated` enables the front tyre rolling texture. Set it to `false` to stop the texture animation. Rotation follows distance travelled, including coasting and braking; `radius`, `blurStart` and `blurFull` tune the rolling speed and high-speed smoothing (metres and metres/second).
- `TIRES.steering` enables experimental front tyre steering, following the car's smoothed direction. The tyre on the side of the turn opens outward (up to `steerMaxDeg`, currently 7 degrees); the opposite tyre turns inward with a smaller angle (`steerInwardRatio`, currently 0.75). The tread widens slightly outward and narrows inward to emphasize perspective. Set only `steering` to `false` to restore the previous fixed silhouettes while keeping the rolling animation. The tyres are separated at load time using the current artwork's bodywork edge; the chassis stays in front of them.
- `TRACK.layout` selects `'suzuka'` (default) or `'straight'` (the previous renderer). `TRACK` and `VIEW` tune road width and camera projection. Suzuka's authored centreline and approximate height profile are in `js/game/track.js`.

### Suzuka reference and fidelity

The centreline is hand-traced from the supplied GP diagram and interpolated with a closed centripetal spline, resampled by distance to 5,807 metres. The same centreline drives the road, camera, corner names, minimap and lap wrap. The 18 turn directions follow the reference; the upper west-straight crossing and the lower road after Degner are separate surfaces, with approximately 10 m between road levels in this implementation.

The hills follow the broad shape of the official elevation profile: downhill start/finish, a climb through the S Curves, a drop through Degner, a climb towards the hairpin, the Spoon descent, and the final descent back onto the main straight. Heights are **relative to the lowest point**, with a 52 m total range. The per-metre slopes, corner radii, banking, track width, bridge dimensions, terrain and scenery are approximations. The source diagrams are not a topographic survey. The 2026 overtaking/straight-mode zones in the supplied images are not implemented as gameplay systems.

References consulted:

- [Suzuka Circuit course guide](https://www.suzukacircuit.jp/eng/course_s/): GP length, 18 turns and 10-16 m width.
- [Official course map and elevation profile, July 2026](https://www.suzukacircuit.jp/course_s/pdf/suzuka_courseguide.pdf): layout, corner geometry, height profile and underpass.
- [Super Formula circuit information](https://superformula.net/sf2/circuit/suzuka): 52 m elevation difference.
- [Honda's Suzuka circuit guide](https://global.honda/en/F1/circuit/suzuka/introduction/): figure-eight layout, named corner sequence and downhill main straight.

For inspection in the browser console, `window.__rkd.car.z` is distance along the lap in metres. Setting it moves the car to another part of the course; the next frame updates the road and minimap. The existing keyboard controls are unchanged.

### Rebuilding the cockpit layers (optional)

Only needed if `assets/cockpit_source.jpg` or `tools/build_cockpit.py` changes:

```bash
pip install pillow numpy opencv-python-headless
python3 tools/build_cockpit.py
```

This regenerates `assets/cockpit.png` and `assets/wheel_hands.png`. Add `--preview DIR` to also save preview images to a folder.

The game currently uses `assets/cockpit-ferrari.png`, with rounded hand-clearance recesses and a reference-based Ferrari palette: white cockpit shoulders, red outer bodywork and dark carbon inner walls. Its dimensions and transparency match the original cockpit. This curated asset is not regenerated by the Python script. Set `COCKPIT.src` in `js/config.js` to `assets/cockpit-rounded.png` for the previous red recesses, or `assets/cockpit.png` for the original. The wheel and hands remain controlled separately by `WHEEL.visible` (currently `true`).

The active wheel layer is `assets/wheel_hands-hp-clean.png`, with HP emblems near the index-finger bases and plain red fabric replacing the outer glove and forearm markings. The forearms have subtle red shading; the wheel, display region, seams and transparency are preserved. This edited asset is not regenerated by the Python builder; use `WHEEL.src = 'assets/wheel_hands.png'` to restore the original gloves.

At load time, `js/render/pilot-layers.js` separates the legs from this artwork. The renderer draws them with the cockpit before rotating the wheel and hands. The separation outline uses the current 1280×800 artwork coordinates; a replacement with a different pilot pose will need an updated outline.

### Running regression tests (optional)

With Node.js 24 installed, run `node --test tests/*.test.mjs`. The tests cover the tyre animation plus the closed track, the 18 turn directions, elevation range, crossover clearance, hill resistance, automatic corner following, progressive edge slowing, depth occlusion and road visibility around the lap. No packages are required; Node.js is not needed to play the game.
