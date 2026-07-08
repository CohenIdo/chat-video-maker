# Conversation Simulator

Create animated chat conversations, preview them on a simulated phone, and export them as video.

## Run it

No build step, no dependencies. Serve the folder with any static server:

```sh
python3 -m http.server 4173
# then open http://localhost:4173
```

(Or use the bundled `.claude/launch.json` config.)

## Features

### Device simulation
Choose the simulated device before previewing or exporting:

| Device | Resolution | Cutout | Status bar |
|---|---|---|---|
| iPhone 16 Pro Max | 1320 × 2868 | Dynamic Island | iOS |
| iPhone 16 Pro | 1206 × 2622 | Dynamic Island | iOS |
| iPhone 16 | 1179 × 2556 | Dynamic Island | iOS |
| iPhone 15 Pro Max | 1290 × 2796 | Dynamic Island | iOS |
| iPhone 15 | 1179 × 2556 | Dynamic Island | iOS |
| iPhone SE | 750 × 1334 | none (home button) | iOS classic |
| Samsung Galaxy S25 Ultra | 1440 × 3120 | punch-hole | Android |
| Samsung Galaxy S25 | 1080 × 2340 | punch-hole | Android |
| Google Pixel 9 Pro | 1280 × 2856 | punch-hole | Android |
| Generic Android Phone | 1080 × 2400 | punch-hole | Android |
| Custom Resolution | any | none | iOS |

Each preset automatically configures screen size and aspect ratio, safe areas
(Dynamic Island / punch-hole, home indicator, landscape side insets), status
bar layout (iOS, iOS classic, Android), rounded screen corners, and an
optional device frame with hardware buttons. iOS devices get the iMessage
look; Android devices get a Material look.

- **Phone frame** — toggle the hardware frame on/off.
- **Orientation** — portrait or landscape (cutouts and safe areas rotate correctly).
- **Side view angle** — the phone stays upright while the camera moves up to
  45° to the left or right (3D perspective view with depth shading), like a
  product-promo shot. Slider + quick presets.
- **Dark mode** — light/dark chat theme.
- **Canvas background** — studio gradient or solid color (visible behind the frame / rounded corners).

### Chat apps
Selectable app skins, each with authentic bubbles, header, input bar, and details:

- **WhatsApp** (default) — green header with "online", wallpaper, TODAY chip, in-bubble timestamps with blue double ticks, mic button.
- **iMessage** — blue/gray bubbles with tails, centered avatar header, "Delivered".
- **Instagram DM** — purple-pink gradient sent bubbles, avatars beside received messages, "Active now".
- **Messenger** — blue gradient bubbles, avatars, icon-row input with "Aa".
- **TikTok DM** — red sent bubbles, avatars on both sides, centered-name header.
- **Android Messages** — Material You styling.

### Participants
- Editable names for both sides.
- Photo upload for each participant (auto-cropped to a circle; falls back to
  initials on a generated gradient). Photos appear in the header and beside
  bubbles in apps that show them.

### Conversation
- Editable message list: add sent/received messages, reorder, delete, multi-line text.
- Typing indicator with bouncing dots before received messages.
- Emoji-only messages render large.

### Preview
- Live animated preview that updates instantly on any change.
- Play / pause / restart / scrub / playback speed.

### Export
- Resolutions: Native (device), 720×1280 HD, 1080×1920 Full HD, 1440×2560 2K,
  2160×3840 4K, or custom width × height. Presets fit the device aspect ratio
  to the chosen long edge, so the video always matches the device's dimensions.
- 30 or 60 fps, MP4 (H.264) where the browser supports it, WebM otherwise.
- Pixel-perfect: the exporter uses the exact same resolution-independent
  canvas renderer as the preview, drawn natively at the target resolution —
  text and shapes are crisp at any size, including 4K.

## Architecture

```
index.html        app layout
css/style.css     UI styling
js/devices.js     device preset database + resolution math
js/renderer.js    resolution-independent canvas renderer (chat UI, status bars,
                  cutouts, frames) — renderFrame(ctx, w, h, time, state)
js/export.js      MediaRecorder-based video exporter
js/app.js         state, controls, message editor, playback loop
```

Everything is laid out in logical points and drawn through a scale transform,
so one renderer produces both the preview and the export at any pixel size.
Settings and messages persist in `localStorage`.
