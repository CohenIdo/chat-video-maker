// Device preset database.
// All dimensions are physical pixels (portrait). Logical sizes drive layout so
// rendering scales crisply to any export resolution.
// cutout/statusBar/corner values are in logical points.

const DEVICES = [
  {
    id: 'iphone-16-pro-max',
    name: 'iPhone 16 Pro Max',
    width: 1320, height: 2868,
    logicalWidth: 440, logicalHeight: 956,
    cornerRadius: 62,
    cutout: { type: 'dynamic-island', width: 125, height: 37, top: 11 },
    statusBar: { style: 'ios', height: 59 },
    homeIndicator: true,
    os: 'ios',
    frameColor: '#3d3c41', // natural titanium
    supportsLandscape: true,
  },
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    width: 1206, height: 2622,
    logicalWidth: 402, logicalHeight: 874,
    cornerRadius: 62,
    cutout: { type: 'dynamic-island', width: 125, height: 37, top: 11 },
    statusBar: { style: 'ios', height: 59 },
    homeIndicator: true,
    os: 'ios',
    frameColor: '#3d3c41',
    supportsLandscape: true,
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    width: 1179, height: 2556,
    logicalWidth: 393, logicalHeight: 852,
    cornerRadius: 55,
    cutout: { type: 'dynamic-island', width: 125, height: 37, top: 11 },
    statusBar: { style: 'ios', height: 59 },
    homeIndicator: true,
    os: 'ios',
    frameColor: '#2c3a4b', // ultramarine
    supportsLandscape: true,
  },
  {
    id: 'iphone-15-pro-max',
    name: 'iPhone 15 Pro Max',
    width: 1290, height: 2796,
    logicalWidth: 430, logicalHeight: 932,
    cornerRadius: 55,
    cutout: { type: 'dynamic-island', width: 125, height: 37, top: 11 },
    statusBar: { style: 'ios', height: 59 },
    homeIndicator: true,
    os: 'ios',
    frameColor: '#45423e',
    supportsLandscape: true,
  },
  {
    id: 'iphone-15',
    name: 'iPhone 15',
    width: 1179, height: 2556,
    logicalWidth: 393, logicalHeight: 852,
    cornerRadius: 55,
    cutout: { type: 'dynamic-island', width: 125, height: 37, top: 11 },
    statusBar: { style: 'ios', height: 59 },
    homeIndicator: true,
    os: 'ios',
    frameColor: '#2d3141',
    supportsLandscape: true,
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    width: 750, height: 1334,
    logicalWidth: 375, logicalHeight: 667,
    cornerRadius: 0,
    cutout: { type: 'none' },
    statusBar: { style: 'ios-classic', height: 20 },
    homeIndicator: false,
    homeButton: true,
    os: 'ios',
    frameColor: '#1c1c1e',
    supportsLandscape: true,
  },
  {
    id: 'galaxy-s25-ultra',
    name: 'Samsung Galaxy S25 Ultra',
    width: 1440, height: 3120,
    logicalWidth: 480, logicalHeight: 1040,
    cornerRadius: 22,
    cutout: { type: 'punch-hole', radius: 8, centerY: 22 },
    statusBar: { style: 'android', height: 40 },
    homeIndicator: true,
    os: 'android',
    frameColor: '#37393e',
    supportsLandscape: true,
  },
  {
    id: 'galaxy-s25',
    name: 'Samsung Galaxy S25',
    width: 1080, height: 2340,
    logicalWidth: 360, logicalHeight: 780,
    cornerRadius: 32,
    cutout: { type: 'punch-hole', radius: 7, centerY: 19 },
    statusBar: { style: 'android', height: 34 },
    homeIndicator: true,
    os: 'android',
    frameColor: '#3a4a5a',
    supportsLandscape: true,
  },
  {
    id: 'pixel-9-pro',
    name: 'Google Pixel 9 Pro',
    width: 1280, height: 2856,
    logicalWidth: 427, logicalHeight: 952,
    cornerRadius: 42,
    cutout: { type: 'punch-hole', radius: 9, centerY: 28 },
    statusBar: { style: 'android', height: 48 },
    homeIndicator: true,
    os: 'android',
    frameColor: '#4a4642', // porcelain-ish
    supportsLandscape: true,
  },
  {
    id: 'generic-android',
    name: 'Generic Android Phone',
    width: 1080, height: 2400,
    logicalWidth: 360, logicalHeight: 800,
    cornerRadius: 30,
    cutout: { type: 'punch-hole', radius: 7, centerY: 19 },
    statusBar: { style: 'android', height: 34 },
    homeIndicator: true,
    os: 'android',
    frameColor: '#222327',
    supportsLandscape: true,
  },
  {
    id: 'custom',
    name: 'Custom Resolution',
    width: 1080, height: 1920,
    logicalWidth: 393, logicalHeight: 698.7, // recomputed from custom size
    cornerRadius: 0,
    cutout: { type: 'none' },
    statusBar: { style: 'ios', height: 54 },
    homeIndicator: true,
    os: 'ios',
    frameColor: '#222327',
    supportsLandscape: true,
    isCustom: true,
  },
];

// Export resolution presets: fit the device aspect ratio to the given long edge.
const EXPORT_RESOLUTIONS = [
  { id: 'native', name: 'Native (device resolution)' },
  { id: 'hd', name: '720 × 1280 (HD)', longEdge: 1280 },
  { id: 'fhd', name: '1080 × 1920 (Full HD)', longEdge: 1920 },
  { id: '2k', name: '1440 × 2560 (2K)', longEdge: 2560 },
  { id: '4k', name: '2160 × 3840 (4K)', longEdge: 3840 },
  { id: 'custom', name: 'Custom Width × Height' },
];

function getDevice(id) {
  return DEVICES.find(d => d.id === id) || DEVICES[0];
}

// Resolve the effective device config given app state (custom size, orientation).
// Returns { pxWidth, pxHeight, logicalWidth, logicalHeight, ...preset } in the
// CURRENT orientation.
function resolveDevice(state) {
  const preset = getDevice(state.deviceId);
  let d = { ...preset };

  if (preset.isCustom) {
    d.width = Math.max(16, state.customDeviceWidth | 0 || 1080);
    d.height = Math.max(16, state.customDeviceHeight | 0 || 1920);
    // Keep UI proportions sane: treat the short edge as ~393 logical points.
    const shortPx = Math.min(d.width, d.height);
    const scale = shortPx / 393;
    d.logicalWidth = d.width / scale;
    d.logicalHeight = d.height / scale;
  }

  if (state.orientation === 'landscape') {
    d = {
      ...d,
      width: d.height, height: d.width,
      logicalWidth: d.logicalHeight, logicalHeight: d.logicalWidth,
      landscape: true,
    };
  }
  return d;
}

// Resolve export pixel dimensions for the current state.
function resolveExportSize(state) {
  const d = resolveDevice(state);
  const preset = EXPORT_RESOLUTIONS.find(r => r.id === state.exportRes) || EXPORT_RESOLUTIONS[0];
  if (preset.id === 'native') return { width: d.width, height: d.height };
  if (preset.id === 'custom') {
    return {
      width: Math.max(16, state.customExportWidth | 0 || d.width),
      height: Math.max(16, state.customExportHeight | 0 || d.height),
    };
  }
  // Fit device aspect so the long edge matches the preset.
  const aspect = d.width / d.height;
  let w, h;
  if (d.height >= d.width) {
    h = preset.longEdge;
    w = Math.round(h * aspect / 2) * 2;
  } else {
    w = preset.longEdge;
    h = Math.round(w / aspect / 2) * 2;
  }
  return { width: w, height: h };
}
