// BambuHelper Web Flasher - client logic.
// Builds ESP Web Tools manifests on the fly from a single board map, and
// keeps the install button in sync with the user's board selection.

const BOARDS = {
  esp32s3: {
    chipFamily: 'ESP32-S3',
    label: 'ESP32-S3 SuperMini + 1.54" ST7789 (DIY)',
    img: 'img/board-esp32s3.jpg',
  },
  esp32s3_zero: {
    chipFamily: 'ESP32-S3',
    label: 'Waveshare ESP32-S3-Zero + 1.54" ST7789 (DIY)',
    img: 'img/board-esp32s3-zero.png',
  },
  ws_lcd_200: {
    chipFamily: 'ESP32-S3',
    label: 'Waveshare ESP32-S3-Touch-LCD-2 (240x320)',
    img: 'img/board-ws-lcd-200.png',
  },
  ws_lcd_154: {
    chipFamily: 'ESP32-S3',
    label: 'Waveshare ESP32-S3-Touch-LCD-1.54 (240x240)',
    img: 'img/board-ws-lcd-154.png',
  },
  cyd: {
    chipFamily: 'ESP32',
    label: 'CYD / ESP32-2432S028 (240x320)',
    img: 'img/board-cyd.png',
  },
  esp32c3: {
    chipFamily: 'ESP32-C3',
    label: 'ESP32-C3 SuperMini + 1.54" ST7789 (DIY)',
    img: 'img/board-esp32c3.png',
  },
};

const DEFAULT_BOARD = 'esp32s3';

let _version = null;
let _currentManifestUrl = null;

async function loadVersion() {
  const r = await fetch('firmware/latest/VERSION', { cache: 'no-cache' });
  if (!r.ok) {
    throw new Error(`firmware/latest/VERSION returned HTTP ${r.status}`);
  }
  const text = (await r.text()).trim();
  if (!text) {
    throw new Error('VERSION file is empty');
  }
  return text;
}

function buildManifest(boardId, version) {
  const board = BOARDS[boardId];
  const binUrl = new URL(
    `firmware/latest/BambuHelper-${boardId}-${version}-Full.bin`,
    location.href,
  ).href;
  return {
    name: 'BambuHelper',
    version,
    new_install_prompt_erase: true,
    builds: [{
      chipFamily: board.chipFamily,
      parts: [{ path: binUrl, offset: 0 }],
    }],
  };
}

function manifestBlobUrl(boardId, version) {
  if (_currentManifestUrl) {
    URL.revokeObjectURL(_currentManifestUrl);
    _currentManifestUrl = null;
  }
  const blob = new Blob(
    [JSON.stringify(buildManifest(boardId, version))],
    { type: 'application/json' },
  );
  _currentManifestUrl = URL.createObjectURL(blob);
  return _currentManifestUrl;
}

function populateBoardSelect() {
  const sel = document.getElementById('board-select');
  for (const [id, info] of Object.entries(BOARDS)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = info.label;
    sel.appendChild(opt);
  }
  sel.value = DEFAULT_BOARD;
}

function renderBoardPreview(boardId) {
  const wrap = document.getElementById('board-preview');
  const info = BOARDS[boardId];
  wrap.innerHTML = '';
  const img = document.createElement('img');
  img.src = info.img;
  img.alt = info.label;
  img.loading = 'lazy';
  // If a preview image is missing, hide the broken-image icon silently.
  img.addEventListener('error', () => { img.style.display = 'none'; });
  wrap.appendChild(img);
}

function renderInstallButton(boardId, version) {
  // ESP Web Tools caches the manifest the first time the button is rendered.
  // Recreate the element on every board switch so the new manifest is picked up.
  const slot = document.getElementById('install-slot');
  slot.innerHTML = '';
  const btn = document.createElement('esp-web-install-button');
  btn.setAttribute('manifest', manifestBlobUrl(boardId, version));
  // Fallback content for browsers without Web Serial.
  const fallback = document.createElement('span');
  fallback.setAttribute('slot', 'unsupported');
  fallback.className = 'unsupported';
  fallback.textContent =
    'Your browser does not support Web Serial. Use Chrome or Edge on desktop.';
  btn.appendChild(fallback);
  const notAllowed = document.createElement('span');
  notAllowed.setAttribute('slot', 'not-allowed');
  notAllowed.className = 'unsupported';
  notAllowed.textContent =
    'Web Serial requires a secure context (HTTPS). Open this page from https://.';
  btn.appendChild(notAllowed);
  slot.appendChild(btn);
}

function showStatus(message, kind) {
  const line = document.getElementById('status-line');
  line.textContent = message || '';
  line.className = 'status-line' + (kind ? ' ' + kind : '');
}

function showVersion(version) {
  document.getElementById('version-line').textContent =
    `Will flash: ${version}`;
}

function showVersionError(err) {
  document.getElementById('version-line').textContent = '';
  showStatus(
    `Could not load firmware version (${err.message}). The site may be mid-deploy - try again in a minute.`,
    'error',
  );
  document.getElementById('install-slot').innerHTML = '';
}

async function init() {
  populateBoardSelect();
  renderBoardPreview(DEFAULT_BOARD);

  try {
    _version = await loadVersion();
  } catch (err) {
    showVersionError(err);
    return;
  }

  showVersion(_version);
  renderInstallButton(DEFAULT_BOARD, _version);

  document.getElementById('board-select').addEventListener('change', (e) => {
    const boardId = e.target.value;
    renderBoardPreview(boardId);
    renderInstallButton(boardId, _version);
  });
}

init();
