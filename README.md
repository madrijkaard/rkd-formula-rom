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

The current version is a **cockpit prototype**: a straight, infinite, looping track with grandstands on both sides and no opponents. A pseudo-3D (OutRun-style) world is rendered at a low internal resolution and scaled up with nearest-neighbour filtering. A pixel-art cockpit sits on top of it, and the steering wheel with the driver's hands rotates slightly as you steer. A HUD shows the lap, distance, position, speed and a minimap.

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
| Pseudo-3D track | Renders a straight, infinite, looping track with grandstands, fences and kerbs at 384×216, scaled up to full screen | PARTIAL |
| Cockpit overlay | Draws the static pixel-art cockpit (halo, bodywork, front tyres, red inner walls) over the track | PARTIAL |
| Rotating wheel and hands | Rotates the steering wheel and gloved hands up to 7° around the steering column as the car steers | PARTIAL |
| Live wheel display | Shows the current gear and a power bar on the steering wheel screen | PARTIAL |
| Car physics | Accelerates, brakes, coasts, shifts gears, computes RPM and moves the car sideways within the track limits, on a fixed 120 Hz update loop | PARTIAL |
| Keyboard controls | Left Shift accelerates, Left Ctrl brakes and the left/right arrows steer | PARTIAL |
| Accelerometer steering (experimental) | Steers by tilting an Android phone held in landscape, enabled with `?tilt=1` in the URL; on-screen throttle and brake buttons are not implemented yet | PARTIAL |
| HUD | Shows lap, distance in km, position, speed in km/h and a minimap of the straight track | PARTIAL |
| Cockpit layer builder | Generates `assets/cockpit.png` and `assets/wheel_hands.png` from `assets/cockpit_source.jpg`, with an identity check at 0° | PARTIAL |

> No automated tests exist yet, so every feature is marked `PARTIAL`.

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

To try the experimental accelerometer steering on an Android phone, open the game with `?tilt=1` at the end of the URL (for example `http://<your-computer-ip>:8080/?tilt=1`) and hold the phone in landscape.

### Configuration

Game tuning lives in `js/config.js`; no file needs to be edited before running. Useful values:

- `CAR` sets acceleration, braking, top speed, steering response (`steerRate`) and gear changes.
- `WHEEL.maxDeg` sets the maximum steering wheel rotation (currently `7.0` degrees), and `WHEEL.visible` hides or shows the wheel and hands layer.
- `TRACK` and `VIEW` set the track geometry and the camera.

### Rebuilding the cockpit layers (optional)

Only needed if `assets/cockpit_source.jpg` or `tools/build_cockpit.py` changes:

```bash
pip install pillow numpy opencv-python-headless
python3 tools/build_cockpit.py
```

This regenerates `assets/cockpit.png` and `assets/wheel_hands.png`. Add `--preview DIR` to also save preview images to a folder.
