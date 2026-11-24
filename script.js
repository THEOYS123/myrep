/**
 * MY REP WiFi Voucher — Core Application Script (Vanilla JS)
 * 100% Client-Side WiFi QR Generation, Voucher Designer, High-DPI PNG Export,
 * Multi-Format Print Engine & Local History (Password-Free Storage).
 */
(function () {
  'use strict';

  const STORAGE_KEYS = {
    THEME: 'myrep_wifi_theme_v1',
    HISTORY: 'myrep_wifi_history_v1',
  };

  const TEMPLATES = {
    'modern-blue': {
      id: 'modern-blue',
      name: 'Modern Blue',
      bg: '#0A192F',
      text: '#FFFFFF',
      accent: '#22D3EE',
    },
    'dark-premium': {
      id: 'dark-premium',
      name: 'Dark Premium',
      bg: '#0F172A',
      text: '#F8FAFC',
      accent: '#38BDF8',
    },
    'cyber-neon': {
      id: 'cyber-neon',
      name: 'Cyber Neon',
      bg: '#030712',
      text: '#E2E8F0',
      accent: '#22D3EE',
    },
    'minimalist-white': {
      id: 'minimalist-white',
      name: 'Minimalist White',
      bg: '#FFFFFF',
      text: '#0A192F',
      accent: '#2563EB',
    },
    'professional-network': {
      id: 'professional-network',
      name: 'Professional Network',
      bg: '#F8FAFC',
      text: '#0F172A',
      accent: '#2563EB',
    },
  };

  const DEFAULT_SAMPLE_WIFI = {
    ssid: 'MY_REP_WIFI',
    password: 'myrep123',
    security: 'WPA',
    hidden: false,
  };

  const DEFAULT_DESIGNER = {
    voucherName: 'MY REP WIFI',
    packageName: 'Unlimited',
    duration: '1 Hari',
    price: 'Rp5.000',
    voucherCode: 'MRP001',
    description: 'Scan QR Code dengan kamera HP untuk terhubung otomatis ke WiFi.',
    templateId: 'modern-blue',
    customBg: TEMPLATES['modern-blue'].bg,
    customText: TEMPLATES['modern-blue'].text,
    customAccent: TEMPLATES['modern-blue'].accent,
    textSize: 'md',
    qrPosition: 'right',
    showPrice: true,
    showPassword: true,
    showCode: true,
  };

  const state = {
    activeView: 'dashboard',
    theme: 'light',
    maskPayloadPassword: true,
    wifi: { ...DEFAULT_SAMPLE_WIFI },
    designer: { ...DEFAULT_DESIGNER },
    qrPayload: '',
    qrMatrix: null,
    printFormat: 'id1',
    printCopies: 8,
    pendingConfirmAction: null,
  };

  // =========================================================================
  // WiFi QR Formatting, Escaping & Matrix Generation (CDN + Local Fallback)
  // =========================================================================

  function escapeWifiField(value) {
    return String(value || '').replace(/([\\;,:"])/g, '\\$1');
  }

  function buildWifiPayload(wifi) {
    const ssid = (wifi.ssid || '').trim();
    if (!ssid) return '';
    const escapedSsid = escapeWifiField(ssid);
    const hiddenFlag = wifi.hidden ? 'H:true;' : '';

    if (wifi.security === 'nopass') {
      return `WIFI:T:nopass;S:${escapedSsid};${hiddenFlag};`;
    }

    // Standard WiFi QR uses T:WPA for WPA/WPA2 and compatible WPA3 handshakes
    const escapedPass = escapeWifiField(wifi.password || '');
    return `WIFI:T:WPA;S:${escapedSsid};P:${escapedPass};${hiddenFlag};`;
  }

  function buildMaskedWifiPayload(wifi) {
    const ssid = (wifi.ssid || '').trim();
    if (!ssid) return 'WIFI:T:WPA;S:;P:;;';
    const escapedSsid = escapeWifiField(ssid);
    const hiddenFlag = wifi.hidden ? 'H:true;' : '';
    if (wifi.security === 'nopass') {
      return `WIFI:T:nopass;S:${escapedSsid};${hiddenFlag};`;
    }
    const maskLen = Math.max(4, Math.min((wifi.password || '').length, 12));
    return `WIFI:T:WPA;S:${escapedSsid};P:${'•'.repeat(maskLen)};${hiddenFlag};`;
  }

  /**
   * Generates a real QR Code module matrix using qrcode-generator CDN,
   * with a compact pure-JS Byte-mode QR Version 1-10 fallback if CDN is offline.
   */
  function generateQrMatrix(payload) {
    const text = payload || 'WIFI:T:WPA;S:MY_REP_WIFI;P:myrep123;;';

    if (typeof window.qrcode === 'function') {
      try {
        const qr = window.qrcode(0, 'M');
        qr.addData(text, 'Byte');
        qr.make();
        const count = qr.getModuleCount();
        const grid = [];
        for (let r = 0; r < count; r += 1) {
          const row = [];
          for (let c = 0; c < count; c += 1) {
            row.push(qr.isDark(r, c));
          }
          grid.push(row);
        }
        return { count, grid };
      } catch (_err) {
        // Fall through to built-in encoder
      }
    }

    return fallbackQrEncode(text);
  }

  // Compact Pure-JS QR Code Byte-Mode Encoder (EC Level M, Versions 1..10)
  function fallbackQrEncode(text) {
    const utf8 = Array.from(new TextEncoder().encode(text));
    // Version capacities in bytes for EC Level M (Versions 1..10)
    const VER_CAP = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
    // Total data codewords + EC codewords per block for Level M: [totalData, blocks, ecPerBlock]
    const VER_INFO = [
      null,
      [16, 1, 10],
      [28, 1, 16],
      [44, 1, 26],
      [64, 2, 18],
      [86, 2, 24],
      [108, 4, 16],
      [124, 4, 18],
      [154, 2, 22], // V8 has 2+2 blocks -> handled via groups below
      [182, 3, 22],
      [216, 4, 26],
    ];
    const VER_BLOCKS = [
      null,
      [[1, 16, 10]],
      [[1, 28, 16]],
      [[1, 44, 26]],
      [[2, 32, 18]],
      [[2, 43, 24]],
      [[4, 27, 16]],
      [[4, 31, 18]],
      [[2, 38, 22], [2, 39, 22]],
      [[3, 36, 22], [2, 37, 22]],
      [[4, 43, 26], [1, 44, 26]],
    ];
    const ALIGN_POS = [
      [],
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
    ];

    let ver = 1;
    while (ver <= 10 && utf8.length > VER_CAP[ver]) ver += 1;
    if (ver > 10) ver = 10;

    const totalDataBytes = VER_INFO[ver][0];
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i -= 1) {
        bits.push((val >>> i) & 1);
      }
    };

    // Mode 0100 (Byte), Char count (8 bits for V1-9, 16 bits for V10+)
    pushBits(4, 4);
    pushBits(utf8.length, ver >= 10 ? 16 : 8);
    utf8.forEach((b) => pushBits(b, 8));

    const maxBits = totalDataBytes * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < termLen; i += 1) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
      dataBytes.push(byte);
    }
    let padToggle = 0;
    while (dataBytes.length < totalDataBytes) {
      dataBytes.push(padToggle % 2 === 0 ? 0xec : 0x11);
      padToggle += 1;
    }

    // GF(256) with primitive 0x11d
    const EXP = new Uint8Array(512);
    const LOG = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i += 1) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];

    const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
    const rsGenPoly = (deg) => {
      let poly = [1];
      for (let i = 0; i < deg; i += 1) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j += 1) {
          next[j] ^= poly[j];
          next[j + 1] ^= gfMul(poly[j], EXP[i]);
        }
        poly = next;
      }
      return poly;
    };
    const rsCompute = (data, ecLen) => {
      const gen = rsGenPoly(ecLen);
      const rem = data.concat(new Array(ecLen).fill(0));
      for (let i = 0; i < data.length; i += 1) {
        const factor = rem[i];
        if (factor !== 0) {
          for (let j = 0; j < gen.length; j += 1) {
            rem[i + j] ^= gfMul(gen[j], factor);
          }
        }
      }
      return rem.slice(data.length);
    };

    const blocks = [];
    const ecBlocks = [];
    let offset = 0;
    VER_BLOCKS[ver].forEach(([count, dataLen, ecLen]) => {
      for (let b = 0; b < count; b += 1) {
        const slice = dataBytes.slice(offset, offset + dataLen);
        offset += dataLen;
        blocks.push(slice);
        ecBlocks.push(rsCompute(slice, ecLen));
      }
    });

    const interleaved = [];
    const maxDataLen = Math.max(...blocks.map((b) => b.length));
    for (let i = 0; i < maxDataLen; i += 1) {
      blocks.forEach((b) => {
        if (i < b.length) interleaved.push(b[i]);
      });
    }
    const maxEcLen = Math.max(...ecBlocks.map((b) => b.length));
    for (let i = 0; i < maxEcLen; i += 1) {
      ecBlocks.forEach((b) => {
        if (i < b.length) interleaved.push(b[i]);
      });
    }

    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(null));
    const isFunc = Array.from({ length: size }, () => new Array(size).fill(false));

    const setMod = (r, c, val, fn = true) => {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        mod[r][c] = Boolean(val);
        if (fn) isFunc[r][c] = true;
      }
    };

    const placeFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr += 1) {
        for (let dc = -1; dc <= 7; dc += 1) {
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          const inOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          setMod(r, c, inBox && (inOuter || inInner), true);
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i += 1) {
      setMod(6, i, i % 2 === 0, true);
      setMod(i, 6, i % 2 === 0, true);
    }

    const align = ALIGN_POS[ver];
    for (let i = 0; i < align.length; i += 1) {
      for (let j = 0; j < align.length; j += 1) {
        const rCenter = align[i];
        const cCenter = align[j];
        if (isFunc[rCenter][cCenter]) continue;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setMod(rCenter + dr, cCenter + dc, dark, true);
          }
        }
      }
    }

    // Reserve format info + dark module
    for (let i = 0; i < 9; i += 1) {
      if (!isFunc[8][i]) setMod(8, i, false, true);
      if (!isFunc[i][8]) setMod(i, 8, false, true);
    }
    for (let i = 0; i < 8; i += 1) {
      setMod(8, size - 1 - i, false, true);
      setMod(size - 1 - i, 8, false, true);
    }
    setMod(size - 8, 8, true, true);

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i += 1) {
        const bit = ((ver << 12) | rem) & 1;
        void bit;
      }
      // BCH (18,6) version info
      let d = ver << 12;
      for (let i = 5; i >= 0; i -= 1) {
        if ((d >>> (i + 12)) & 1) d ^= 0x1f25 << i;
      }
      const verBits = (ver << 12) | d;
      for (let i = 0; i < 18; i += 1) {
        const bit = Boolean((verBits >>> i) & 1);
        const a = Math.floor(i / 3);
        const b = (i % 3) + size - 11;
        setMod(a, b, bit, true);
        setMod(b, a, bit, true);
      }
    }

    // Place data bits
    const allBits = [];
    interleaved.forEach((b) => {
      for (let i = 7; i >= 0; i -= 1) allBits.push((b >>> i) & 1);
    });

    let bitIdx = 0;
    let dir = -1;
    for (let c = size - 1; c > 0; c -= 2) {
      if (c === 6) c -= 1;
      for (let i = 0; i < size; i += 1) {
        const r = dir === -1 ? size - 1 - i : i;
        for (let dc = 0; dc < 2; dc += 1) {
          const col = c - dc;
          if (!isFunc[r][col]) {
            const bit = bitIdx < allBits.length ? Boolean(allBits[bitIdx]) : false;
            bitIdx += 1;
            mod[r][col] = bit;
          }
        }
      }
      dir *= -1;
    }

    // Apply best mask (mask 0..7)
    const maskFn = (m, r, c) => {
      switch (m) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      }
    };

    const writeFormat = (grid, maskId) => {
      // EC Level M = 00
      const data = (0 << 3) | maskId;
      let rem = data << 10;
      for (let i = 4; i >= 0; i -= 1) {
        if ((rem >>> (i + 10)) & 1) rem ^= 0x537 << i;
      }
      const fmt = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i += 1) grid[8][i] = Boolean((fmt >>> i) & 1);
      grid[8][7] = Boolean((fmt >>> 6) & 1);
      grid[8][8] = Boolean((fmt >>> 7) & 1);
      grid[7][8] = Boolean((fmt >>> 8) & 1);
      for (let i = 9; i < 15; i += 1) grid[14 - i][8] = Boolean((fmt >>> i) & 1);

      for (let i = 0; i < 8; i += 1) grid[size - 1 - i][8] = Boolean((fmt >>> i) & 1);
      for (let i = 8; i < 15; i += 1) grid[8][size - 15 + i] = Boolean((fmt >>> i) & 1);
    };

    let bestMask = 0;
    let bestScore = Infinity;
    let bestGrid = null;

    for (let m = 0; m < 8; m += 1) {
      const candidate = mod.map((row, r) =>
        row.map((val, c) => (isFunc[r][c] ? val : maskFn(m, r, c) ? !val : val))
      );
      writeFormat(candidate, m);
      let penalty = 0;
      for (let r = 0; r < size; r += 1) {
        let run = 1;
        for (let c = 1; c < size; c += 1) {
          if (candidate[r][c] === candidate[r][c - 1]) {
            run += 1;
          } else {
            if (run >= 5) penalty += run - 2;
            run = 1;
          }
        }
        if (run >= 5) penalty += run - 2;
      }
      for (let c = 0; c < size; c += 1) {
        let run = 1;
        for (let r = 1; r < size; r += 1) {
          if (candidate[r][c] === candidate[r - 1][c]) {
            run += 1;
          } else {
            if (run >= 5) penalty += run - 2;
            run = 1;
          }
        }
        if (run >= 5) penalty += run - 2;
      }
      if (penalty < bestScore) {
        bestScore = penalty;
        bestMask = m;
        bestGrid = candidate;
      }
    }

    void bestMask;
    return { count: size, grid: bestGrid };
  }

  function drawQrToCanvas(canvas, matrix, pixelSize = 260, quietModules = 2) {
    if (!canvas || !matrix) return;
    const ctx = canvas.getContext('2d');
    const totalModules = matrix.count + quietModules * 2;
    const modulePx = Math.max(2, Math.floor(pixelSize / totalModules));
    const exactSize = modulePx * totalModules;

    canvas.width = exactSize;
    canvas.height = exactSize;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exactSize, exactSize);

    ctx.fillStyle = '#000000';
    for (let r = 0; r < matrix.count; r += 1) {
      for (let c = 0; c < matrix.count; c += 1) {
        if (matrix.grid[r][c]) {
          ctx.fillRect(
            (c + quietModules) * modulePx,
            (r + quietModules) * modulePx,
            modulePx,
            modulePx
          );
        }
      }
    }
  }

  // =========================================================================
  // Safe DOM Helpers & Brand SVG Builder
  // =========================================================================

  function clearElement(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function createMyRepMarkSvg(size = 20) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 36 36');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const rectBg = document.createElementNS(ns, 'rect');
    rectBg.setAttribute('width', '36');
    rectBg.setAttribute('height', '36');
    rectBg.setAttribute('rx', '9');
    rectBg.setAttribute('fill', '#102544');

    const rectStroke = document.createElementNS(ns, 'rect');
    rectStroke.setAttribute('x', '0.75');
    rectStroke.setAttribute('y', '0.75');
    rectStroke.setAttribute('width', '34.5');
    rectStroke.setAttribute('height', '34.5');
    rectStroke.setAttribute('rx', '8.25');
    rectStroke.setAttribute('stroke', '#22D3EE');
    rectStroke.setAttribute('stroke-opacity', '0.45');
    rectStroke.setAttribute('stroke-width', '1.5');

    const arc1 = document.createElementNS(ns, 'path');
    arc1.setAttribute('d', 'M9.5 16.5C14.2 11.8 21.8 11.8 26.5 16.5');
    arc1.setAttribute('stroke', '#22D3EE');
    arc1.setAttribute('stroke-width', '2.5');
    arc1.setAttribute('stroke-linecap', 'round');

    const arc2 = document.createElementNS(ns, 'path');
    arc2.setAttribute('d', 'M13 20.5C15.8 17.7 20.2 17.7 23 20.5');
    arc2.setAttribute('stroke', '#3B82F6');
    arc2.setAttribute('stroke-width', '2.5');
    arc2.setAttribute('stroke-linecap', 'round');

    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', '18');
    dot.setAttribute('cy', '24.75');
    dot.setAttribute('r', '2.3');
    dot.setAttribute('fill', '#FFFFFF');

    svg.append(rectBg, rectStroke, arc1, arc2, dot);
    return svg;
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 3200);
  }

  // =========================================================================
  // Voucher Card DOM Renderer (Safe textContent, Zero Unsanitized innerHTML)
  // =========================================================================

  function renderVoucherCardElement(config, qrMatrix) {
    const card = document.createElement('article');
    card.className = `voucher-card tpl-${config.designer.templateId} qr-pos-${config.designer.qrPosition} text-size-${config.designer.textSize}`;
    card.style.setProperty('--v-bg', config.designer.customBg);
    card.style.setProperty('--v-text', config.designer.customText);
    card.style.setProperty('--v-accent', config.designer.customAccent);

    // Top Header Bar (Mandatory MY REP Brand + WIFI VOUCHER)
    const topBar = document.createElement('div');
    topBar.className = 'vc-top-bar';

    const brandLockup = document.createElement('div');
    brandLockup.className = 'vc-brand-lockup';
    brandLockup.appendChild(createMyRepMarkSvg(22));

    const brandText = document.createElement('span');
    brandText.className = 'vc-brand-name';
    brandText.textContent = 'MY REP';
    brandLockup.appendChild(brandText);

    const docTitle = document.createElement('span');
    docTitle.className = 'vc-doc-title';
    docTitle.textContent = 'WIFI VOUCHER';

    topBar.append(brandLockup, docTitle);
    card.appendChild(topBar);

    // Body Section
    const body = document.createElement('div');
    body.className = 'vc-body';

    const infoCol = document.createElement('div');
    infoCol.className = 'vc-info-col';

    const headerRow = document.createElement('div');
    headerRow.className = 'vc-header-row';

    const voucherTitle = document.createElement('div');
    voucherTitle.className = 'vc-voucher-name';
    voucherTitle.textContent = config.designer.voucherName.trim() || 'MY REP WIFI';
    headerRow.appendChild(voucherTitle);

    if (config.designer.showPrice && config.designer.price.trim()) {
      const priceBox = document.createElement('div');
      priceBox.className = 'vc-price-box';
      priceBox.textContent = config.designer.price.trim();
      headerRow.appendChild(priceBox);
    }

    infoCol.appendChild(headerRow);

    const specs = document.createElement('div');
    specs.className = 'vc-specs';

    const addSpecRow = (label, value) => {
      const row = document.createElement('div');
      row.className = 'vc-spec-item';
      const lbl = document.createElement('span');
      lbl.className = 'vc-spec-label';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'vc-spec-val';
      val.textContent = value;
      row.append(lbl, val);
      specs.appendChild(row);
    };

    addSpecRow('SSID WiFi', config.wifi.ssid.trim() || 'MY_REP_WIFI');

    if (config.wifi.security === 'nopass') {
      addSpecRow('Password', 'Tanpa Password (Open)');
    } else {
      const rawPass = config.wifi.password || '';
      const passDisplay = config.designer.showPassword
        ? rawPass || '(Belum diisi)'
        : rawPass
          ? '•'.repeat(Math.min(Math.max(rawPass.length, 6), 12))
          : '••••••';
      addSpecRow('Password', passDisplay);
    }

    if (config.designer.packageName.trim()) {
      addSpecRow('Paket', config.designer.packageName.trim());
    }
    if (config.designer.duration.trim()) {
      addSpecRow('Durasi', config.designer.duration.trim());
    }

    infoCol.appendChild(specs);

    // QR Code Column
    const qrCol = document.createElement('div');
    qrCol.className = 'vc-qr-col';

    const qrDock = document.createElement('div');
    qrDock.className = 'vc-qr-dock';
    const qrCanvas = document.createElement('canvas');
    drawQrToCanvas(qrCanvas, qrMatrix, 220, 2);
    qrDock.appendChild(qrCanvas);

    const scanHint = document.createElement('span');
    scanHint.className = 'vc-scan-hint';
    scanHint.textContent = 'Scan untuk Connect';

    qrCol.append(qrDock, scanHint);

    body.append(infoCol, qrCol);
    card.appendChild(body);

    // Footer Section
    const footer = document.createElement('div');
    footer.className = 'vc-footer';

    const descSpan = document.createElement('span');
    descSpan.className = 'vc-desc';
    descSpan.textContent =
      config.designer.description.trim() ||
      'Scan QR Code menggunakan kamera HP untuk terhubung.';

    footer.appendChild(descSpan);

    if (config.designer.showCode && config.designer.voucherCode.trim()) {
      const codeSpan = document.createElement('span');
      codeSpan.className = 'vc-code-tag';
      codeSpan.textContent = `#${config.designer.voucherCode.trim()}`;
      footer.appendChild(codeSpan);
    }

    card.appendChild(footer);
    return card;
  }

  // =========================================================================
  // High-DPI Canvas PNG Exporter (Exact Layout Match + Sharp Unclipped QR)
  // =========================================================================

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawMyRepCanvasLogo(ctx, x, y, size) {
    ctx.save();
    drawRoundedRect(ctx, x, y, size, size, size * 0.25);
    ctx.fillStyle = '#102544';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, size * 0.045);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.stroke();

    const cx = x + size / 2;
    const cy = y + size * 0.68;

    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.34, Math.PI * 1.22, Math.PI * 1.78);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = Math.max(2, size * 0.075);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.2, Math.PI * 1.22, Math.PI * 1.78);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = Math.max(2, size * 0.075);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.068, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  function exportVoucherToPng(config, qrMatrix) {
    const scale = 1;
    const isStacked =
      config.designer.qrPosition === 'top' || config.designer.qrPosition === 'center';
    const W = isStacked ? 920 : 1200;
    const textMult =
      config.designer.textSize === 'sm'
        ? 0.9
        : config.designer.textSize === 'lg'
          ? 1.1
          : 1;

    const padX = 52;
    const topBarH = 104;
    const descLinesEstimate = Math.max(
      1,
      Math.ceil((config.designer.description || '').length / 56)
    );
    const footerH = 74 + (descLinesEstimate - 1) * 28;
    const qrDockSize = isStacked ? 320 : 300;
    const H = isStacked
      ? topBarH + 40 + qrDockSize + 56 + 300 + footerH + 40
      : Math.max(690, topBarH + 430 + footerH);

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');

    const { customBg, customText, customAccent, templateId } = config.designer;

    // 1. Card Background & Template Motif
    drawRoundedRect(ctx, 0, 0, W, H, 32);
    ctx.save();
    ctx.clip();

    if (templateId === 'modern-blue') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, customBg);
      grad.addColorStop(1, '#163B7A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (templateId === 'dark-premium') {
      ctx.fillStyle = customBg;
      ctx.fillRect(0, 0, W, H);
      const rad = ctx.createRadialGradient(W * 0.88, H * 0.12, 20, W * 0.88, H * 0.12, 480);
      rad.addColorStop(0, 'rgba(34, 211, 238, 0.18)');
      rad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
    } else if (templateId === 'cyber-neon') {
      ctx.fillStyle = customBg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.09)';
      ctx.lineWidth = 1.5;
      for (let gx = 0; gx < W; gx += 44) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 44) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = customBg;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Top Bar
    if (templateId === 'professional-network') {
      ctx.fillStyle = '#0A192F';
      ctx.fillRect(0, 0, W, topBarH);
    } else if (templateId === 'modern-blue') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, 0, W, topBarH);
    } else if (templateId === 'cyber-neon') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, W, topBarH);
    }

    // Top bar accent underline
    ctx.fillStyle = customAccent;
    ctx.fillRect(0, topBarH - 4, W, 4);

    // Mandatory MY REP Brand Logo
    drawMyRepCanvasLogo(ctx, padX, 26, 52);
    ctx.fillStyle = templateId === 'professional-network' ? '#FFFFFF' : customText;
    ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('MY REP', padX + 68, topBarH / 2 + 1);

    ctx.fillStyle = customAccent;
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('WIFI VOUCHER', W - padX, topBarH / 2 + 1);

    // 3. Body Layout Calculation
    const bodyTop = topBarH + 42;
    const bodyBottom = H - footerH - 24;

    const drawQrDockAt = (qx, qy, dockSize) => {
      drawRoundedRect(ctx, qx, qy, dockSize, dockSize, 22);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      if (templateId === 'cyber-neon' || templateId === 'minimalist-white') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = templateId === 'cyber-neon' ? customAccent : 'rgba(10,25,47,0.18)';
        ctx.stroke();
      }

      const innerPad = 18;
      const qrArea = dockSize - innerPad * 2;
      const quiet = 2;
      const totalMod = qrMatrix.count + quiet * 2;
      const modPx = Math.floor(qrArea / totalMod);
      const exactQr = modPx * totalMod;
      const startX = qx + Math.floor((dockSize - exactQr) / 2);
      const startY = qy + Math.floor((dockSize - exactQr) / 2);

      ctx.fillStyle = '#000000';
      for (let r = 0; r < qrMatrix.count; r += 1) {
        for (let c = 0; c < qrMatrix.count; c += 1) {
          if (qrMatrix.grid[r][c]) {
            ctx.fillRect(
              startX + (c + quiet) * modPx,
              startY + (r + quiet) * modPx,
              modPx,
              modPx
            );
          }
        }
      }

      ctx.fillStyle = customText;
      ctx.globalAlpha = 0.85;
      ctx.font = '600 20px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Scan untuk Connect', qx + dockSize / 2, qy + dockSize + 14);
      ctx.globalAlpha = 1;
    };

    const drawInfoBlock = (ix, iy, iw, centered = false) => {
      let curY = iy;
      ctx.textBaseline = 'top';

      // Voucher Name + Price
      const vName = config.designer.voucherName.trim() || 'MY REP WIFI';
      ctx.fillStyle = customText;
      ctx.font = `800 ${Math.round(34 * textMult)}px "Plus Jakarta Sans", sans-serif`;

      if (centered) {
        ctx.textAlign = 'center';
        ctx.fillText(vName, ix + iw / 2, curY);
        curY += Math.round(44 * textMult);
        if (config.designer.showPrice && config.designer.price.trim()) {
          ctx.fillStyle = customAccent;
          ctx.font = `700 ${Math.round(28 * textMult)}px "JetBrains Mono", monospace`;
          ctx.fillText(config.designer.price.trim(), ix + iw / 2, curY);
          curY += Math.round(44 * textMult);
        } else {
          curY += 12;
        }
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(vName, ix, curY, iw - (config.designer.showPrice ? 190 : 0));
        if (config.designer.showPrice && config.designer.price.trim()) {
          ctx.fillStyle = customAccent;
          ctx.font = `700 ${Math.round(28 * textMult)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(config.designer.price.trim(), ix + iw, curY + 2);
        }
        curY += Math.round(58 * textMult);
      }

      // Spec rows
      const passValue =
        config.wifi.security === 'nopass'
          ? 'Tanpa Password (Open)'
          : config.designer.showPassword
            ? config.wifi.password || '(Belum diisi)'
            : '••••••••';

      const rows = [
        ['SSID WiFi', config.wifi.ssid.trim() || 'MY_REP_WIFI'],
        ['Password', passValue],
      ];
      if (config.designer.packageName.trim()) rows.push(['Paket', config.designer.packageName.trim()]);
      if (config.designer.duration.trim()) rows.push(['Durasi', config.designer.duration.trim()]);

      const rowH = Math.round(56 * textMult);
      rows.forEach(([label, val]) => {
        ctx.fillStyle = customText;
        ctx.globalAlpha = 0.72;
        ctx.font = `500 ${Math.round(23 * textMult)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(label, ix, curY + 6);

        ctx.globalAlpha = 1;
        ctx.font = `600 ${Math.round(24 * textMult)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(val, ix + iw, curY + 5, iw * 0.65);

        ctx.strokeStyle =
          templateId === 'minimalist-white' || templateId === 'professional-network'
            ? 'rgba(15, 23, 42, 0.14)'
            : 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ix, curY + rowH - 8);
        ctx.lineTo(ix + iw, curY + rowH - 8);
        ctx.stroke();

        curY += rowH;
      });
    };

    const qrPos = config.designer.qrPosition;
    if (qrPos === 'right') {
      const qx = W - padX - qrDockSize;
      const qy = bodyTop + Math.max(0, (bodyBottom - bodyTop - qrDockSize - 36) / 2);
      drawQrDockAt(qx, qy, qrDockSize);
      drawInfoBlock(padX, bodyTop + 10, W - padX * 2 - qrDockSize - 48, false);
    } else if (qrPos === 'left') {
      const qx = padX;
      const qy = bodyTop + Math.max(0, (bodyBottom - bodyTop - qrDockSize - 36) / 2);
      drawQrDockAt(qx, qy, qrDockSize);
      const infoX = padX + qrDockSize + 48;
      drawInfoBlock(infoX, bodyTop + 10, W - padX - infoX, false);
    } else if (qrPos === 'top') {
      const qx = Math.floor((W - qrDockSize) / 2);
      drawQrDockAt(qx, bodyTop, qrDockSize);
      drawInfoBlock(padX + 20, bodyTop + qrDockSize + 64, W - (padX + 20) * 2, true);
    } else {
      // center
      drawInfoBlock(padX + 20, bodyTop, W - (padX + 20) * 2, true);
      const qx = Math.floor((W - qrDockSize) / 2);
      const qy = bodyBottom - qrDockSize - 42;
      drawQrDockAt(qx, qy, qrDockSize);
    }

    // 4. Footer
    const footerY = H - footerH;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, footerY);
    ctx.lineTo(W, footerY);
    ctx.stroke();

    ctx.fillStyle = customText;
    ctx.globalAlpha = 0.88;
    ctx.font = '500 20px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const descMaxW =
      config.designer.showCode && config.designer.voucherCode.trim()
        ? W - padX * 2 - 190
        : W - padX * 2;
    const descLines = wrapCanvasText(
      ctx,
      config.designer.description.trim() || 'Scan QR Code menggunakan kamera HP untuk terhubung.',
      descMaxW
    );
    descLines.slice(0, 2).forEach((line, idx) => {
      ctx.fillText(line, padX, footerY + 20 + idx * 26);
    });
    ctx.globalAlpha = 1;

    if (config.designer.showCode && config.designer.voucherCode.trim()) {
      ctx.fillStyle = customAccent;
      ctx.font = '700 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`#${config.designer.voucherCode.trim()}`, W - padX, footerY + 22);
    }

    ctx.restore();

    // Outer border stroke
    drawRoundedRect(ctx, 1.5, 1.5, W - 3, H - 3, 31);
    ctx.lineWidth = templateId === 'cyber-neon' ? 4 : 2;
    ctx.strokeStyle =
      templateId === 'cyber-neon'
        ? customAccent
        : templateId === 'minimalist-white'
          ? 'rgba(10, 25, 47, 0.2)'
          : 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();

    const safeSlug = (config.designer.voucherName || 'myrep-voucher')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    triggerCanvasDownload(canvas, `${safeSlug}.png`);
  }

  function exportQrOnlyPng(ssid, matrix) {
    const canvas = document.createElement('canvas');
    drawQrToCanvas(canvas, matrix, 900, 4);
    const safeSlug = (ssid || 'wifi-qr').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerCanvasDownload(canvas, `qr-${safeSlug}.png`);
  }

  function triggerCanvasDownload(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // =========================================================================
  // LocalStorage History (Strictly Excludes WiFi Passwords)
  // =========================================================================

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function saveHistoryList(items) {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(items));
    } catch (_err) {
      showToast('Gagal menyimpan ke penyimpanan lokal browser.', 'error');
    }
  }

  function saveCurrentDesignToHistory() {
    const ssid = state.wifi.ssid.trim();
    if (!ssid) {
      showToast('Nama WiFi (SSID) wajib diisi sebelum menyimpan desain.', 'error');
      return;
    }

    const entry = {
      id: `des_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      designName: state.designer.voucherName.trim() || `Voucher ${ssid}`,
      createdAt: new Date().toISOString(),
      ssid,
      security: state.wifi.security,
      hidden: Boolean(state.wifi.hidden),
      // IMPORTANT: Password is NEVER saved to localStorage
      packageName: state.designer.packageName.trim() || '-',
      duration: state.designer.duration.trim() || '-',
      price: state.designer.price.trim() || '-',
      voucherCode: state.designer.voucherCode.trim(),
      description: state.designer.description.trim(),
      templateId: state.designer.templateId,
      customization: {
        customBg: state.designer.customBg,
        customText: state.designer.customText,
        customAccent: state.designer.customAccent,
        textSize: state.designer.textSize,
        qrPosition: state.designer.qrPosition,
        showPrice: state.designer.showPrice,
        showPassword: state.designer.showPassword,
        showCode: state.designer.showCode,
      },
    };

    const items = loadHistory();
    items.unshift(entry);
    saveHistoryList(items);
    refreshHistoryView();
    refreshDashboardStats();
    showToast('Desain disimpan ke riwayat lokal (tanpa password WiFi).', 'success');
  }

  // =========================================================================
  // UI Navigation, Theme & View Synchronizers
  // =========================================================================

  const VIEW_TITLES = {
    dashboard: 'Dashboard',
    'qr-generator': 'Buat QR WiFi',
    'voucher-designer': 'Voucher Designer',
    history: 'Riwayat Desain',
    guide: 'Panduan Penggunaan',
    about: 'Tentang MY REP',
  };

  function switchView(viewId) {
    if (!VIEW_TITLES[viewId]) return;
    state.activeView = viewId;

    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('is-active', v.id === `view-${viewId}`);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === viewId);
    });

    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = VIEW_TITLES[viewId];

    if (viewId === 'dashboard') {
      refreshDashboardStats();
      renderDashboardSample();
    } else if (viewId === 'voucher-designer') {
      syncDesignerInputsFromState();
      renderDesignerLivePreview();
    } else if (viewId === 'history') {
      refreshHistoryView();
    } else if (viewId === 'qr-generator') {
      syncQrInputsFromState();
      renderStandaloneQrPreview();
    }

    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function applyTheme(theme) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    const label = document.getElementById('theme-toggle-label');
    if (label) {
      label.textContent = state.theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
    } catch (_err) {
      // ignore storage errors
    }
  }

  function openMobileSidebar() {
    document.getElementById('sidebar')?.classList.add('is-open');
    document.getElementById('sidebar-backdrop')?.classList.add('is-visible');
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('is-open');
    document.getElementById('sidebar-backdrop')?.classList.remove('is-visible');
  }

  // =========================================================================
  // Dashboard Rendering
  // =========================================================================

  function refreshDashboardStats() {
    const history = loadHistory();
    const totalEl = document.getElementById('stat-total-designs');
    const navCountEl = document.getElementById('nav-history-count');
    if (totalEl) totalEl.textContent = String(history.length);
    if (navCountEl) navCountEl.textContent = String(history.length);

    const topTplEl = document.getElementById('stat-top-template');
    const topTplMetaEl = document.getElementById('stat-top-template-meta');
    const lastPkgEl = document.getElementById('stat-last-package');
    const lastPriceEl = document.getElementById('stat-last-price');

    if (history.length > 0) {
      const counts = {};
      history.forEach((item) => {
        counts[item.templateId] = (counts[item.templateId] || 0) + 1;
      });
      const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (topTplEl) topTplEl.textContent = TEMPLATES[topId]?.name || 'Modern Blue';
      if (topTplMetaEl) topTplMetaEl.textContent = `Dipakai ${counts[topId]} kali`;

      const latest = history[0];
      if (lastPkgEl) lastPkgEl.textContent = latest.packageName || 'Unlimited';
      if (lastPriceEl) lastPriceEl.textContent = latest.price || '-';
    } else {
      if (topTplEl) topTplEl.textContent = TEMPLATES[state.designer.templateId].name;
      if (topTplMetaEl) topTplMetaEl.textContent = 'Template default aktif';
      if (lastPkgEl) lastPkgEl.textContent = state.designer.packageName;
      if (lastPriceEl) lastPriceEl.textContent = state.designer.price;
    }

    const qrStatusEl = document.getElementById('stat-qr-status');
    const qrSsidEl = document.getElementById('stat-qr-ssid');
    if (qrStatusEl) qrStatusEl.textContent = state.qrMatrix ? 'QR Siap Dipindai' : 'Belum Dibuat';
    if (qrSsidEl) qrSsidEl.textContent = state.wifi.ssid || '-';
  }

  function renderDashboardSample() {
    const host = document.getElementById('dashboard-sample-voucher');
    if (!host) return;
    clearElement(host);
    const sampleConfig = {
      wifi: { ...DEFAULT_SAMPLE_WIFI },
      designer: { ...DEFAULT_DESIGNER },
    };
    const sampleMatrix = generateQrMatrix(buildWifiPayload(sampleConfig.wifi));
    host.appendChild(renderVoucherCardElement(sampleConfig, sampleMatrix));
  }

  // =========================================================================
  // QR Generator View Logic
  // =========================================================================

  function syncQrInputsFromState() {
    const ssidInput = document.getElementById('qr-ssid');
    const secSelect = document.getElementById('qr-security');
    const passInput = document.getElementById('qr-password');
    const hiddenChk = document.getElementById('qr-hidden');

    if (ssidInput) ssidInput.value = state.wifi.ssid;
    if (secSelect) secSelect.value = state.wifi.security;
    if (passInput) passInput.value = state.wifi.password;
    if (hiddenChk) hiddenChk.checked = state.wifi.hidden;

    updateQrSecurityFieldState();
  }

  function updateQrSecurityFieldState() {
    const secSelect = document.getElementById('qr-security');
    const passInput = document.getElementById('qr-password');
    const toggleBtn = document.getElementById('toggle-qr-password-btn');
    const reqMark = document.getElementById('qr-pass-req');
    const hint = document.getElementById('qr-security-hint');
    if (!secSelect || !passInput) return;

    const isOpen = secSelect.value === 'nopass';
    passInput.disabled = isOpen;
    if (toggleBtn) toggleBtn.disabled = isOpen;
    if (reqMark) reqMark.style.display = isOpen ? 'none' : 'inline';

    if (hint) {
      if (secSelect.value === 'nopass') {
        hint.textContent = 'Jaringan terbuka tanpa password (WIFI:T:nopass;S:...;;).';
      } else if (secSelect.value === 'WPA3') {
        hint.textContent = 'Menggunakan format T:WPA agar kompatibel dengan pemindai kamera Android & iOS pada jaringan WPA3.';
      } else {
        hint.textContent = 'Menggunakan skema enkripsi standar WPA/WPA2 yang didukung luas kamera ponsel.';
      }
    }
  }

  function validateQrForm() {
    const ssidEl = document.getElementById('qr-ssid');
    const secEl = document.getElementById('qr-security');
    const passEl = document.getElementById('qr-password');
    const errSsid = document.getElementById('err-qr-ssid');
    const errPass = document.getElementById('err-qr-password');

    if (errSsid) errSsid.textContent = '';
    if (errPass) errPass.textContent = '';

    const ssid = (ssidEl?.value || '').trim();
    const security = secEl?.value || 'WPA';
    const password = passEl?.value || '';
    let valid = true;

    if (!ssid) {
      if (errSsid) errSsid.textContent = 'Nama WiFi (SSID) wajib diisi.';
      valid = false;
    } else if (new TextEncoder().encode(ssid).length > 32) {
      if (errSsid) errSsid.textContent = 'SSID melebihi batas 32 byte standar WiFi.';
      valid = false;
    }

    if (security !== 'nopass') {
      if (!password) {
        if (errPass) errPass.textContent = 'Password WiFi wajib diisi untuk tipe keamanan ini.';
        valid = false;
      } else if (password.length < 8) {
        if (errPass) errPass.textContent = 'Password WPA/WPA2/WPA3 minimal 8 karakter.';
        valid = false;
      }
    }

    return valid;
  }

  function regenerateActiveQrFromWifi() {
    const payload = buildWifiPayload(state.wifi);
    if (!payload) return false;
    state.qrPayload = payload;
    state.qrMatrix = generateQrMatrix(payload);
    return true;
  }

  function renderStandaloneQrPreview() {
    const canvas = document.getElementById('qr-standalone-canvas');
    const sumSsid = document.getElementById('summary-ssid');
    const sumSec = document.getElementById('summary-security');
    const sumHid = document.getElementById('summary-hidden');
    const payloadDisp = document.getElementById('qr-payload-display');
    const statusSub = document.getElementById('qr-status-subtitle');

    if (!state.qrMatrix) {
      regenerateActiveQrFromWifi();
    }

    if (canvas && state.qrMatrix) {
      drawQrToCanvas(canvas, state.qrMatrix, 260, 2);
    }
    if (sumSsid) sumSsid.textContent = state.wifi.ssid || '-';
    if (sumSec) {
      sumSec.textContent =
        state.wifi.security === 'nopass'
          ? 'Open Network'
          : state.wifi.security === 'WPA3'
            ? 'WPA3 (Kompatibel)'
            : 'WPA / WPA2';
    }
    if (sumHid) sumHid.textContent = state.wifi.hidden ? 'Ya (Hidden)' : 'Tidak';
    if (payloadDisp) {
      payloadDisp.textContent = state.maskPayloadPassword
        ? buildMaskedWifiPayload(state.wifi)
        : state.qrPayload;
    }
    if (statusSub) {
      statusSub.textContent = `QR aktif untuk SSID "${state.wifi.ssid}" siap dipindai.`;
    }
  }

  // =========================================================================
  // Voucher Designer Logic
  // =========================================================================

  function syncDesignerInputsFromState() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(val);
    };

    setVal('des-voucher-name', state.designer.voucherName);
    setVal('des-code', state.designer.voucherCode);
    setVal('des-ssid', state.wifi.ssid);
    setVal('des-security', state.wifi.security);
    setVal('des-password', state.wifi.password);
    setChk('des-hidden', state.wifi.hidden);
    setVal('des-package', state.designer.packageName);
    setVal('des-duration', state.designer.duration);
    setVal('des-price', state.designer.price);
    setVal('des-description', state.designer.description);

    setVal('des-color-bg', state.designer.customBg);
    setVal('des-color-text', state.designer.customText);
    setVal('des-color-accent', state.designer.customAccent);
    const hexBg = document.getElementById('hex-bg');
    const hexText = document.getElementById('hex-text');
    const hexAccent = document.getElementById('hex-accent');
    if (hexBg) hexBg.textContent = state.designer.customBg.toUpperCase();
    if (hexText) hexText.textContent = state.designer.customText.toUpperCase();
    if (hexAccent) hexAccent.textContent = state.designer.customAccent.toUpperCase();

    setChk('toggle-show-price', state.designer.showPrice);
    setChk('toggle-show-password', state.designer.showPassword);
    setChk('toggle-show-code', state.designer.showCode);

    document.querySelectorAll('.template-option').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.template === state.designer.templateId);
    });
    document.querySelectorAll('#text-size-control .seg-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.textSize === state.designer.textSize);
    });
    document.querySelectorAll('#qr-pos-control .seg-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.qrPos === state.designer.qrPosition);
    });

    const tplLabel = document.getElementById('preview-template-name');
    if (tplLabel) tplLabel.textContent = TEMPLATES[state.designer.templateId].name;

    const passInput = document.getElementById('des-password');
    const toggleBtn = document.getElementById('toggle-des-password-btn');
    const isOpen = state.wifi.security === 'nopass';
    if (passInput) passInput.disabled = isOpen;
    if (toggleBtn) toggleBtn.disabled = isOpen;
  }

  function renderDesignerLivePreview() {
    const host = document.getElementById('voucher-live-preview');
    if (!host) return;
    if (!state.qrMatrix) {
      regenerateActiveQrFromWifi();
    }
    clearElement(host);
    host.appendChild(renderVoucherCardElement(state, state.qrMatrix));
  }

  function applyTemplatePreset(templateId) {
    const tpl = TEMPLATES[templateId];
    if (!tpl) return;
    state.designer.templateId = templateId;
    state.designer.customBg = tpl.bg;
    state.designer.customText = tpl.text;
    state.designer.customAccent = tpl.accent;

    syncDesignerInputsFromState();
    // Note: Intentionally does NOT touch or mutate state.qrMatrix
    renderDesignerLivePreview();
  }

  function validateDesignerWifiForExport() {
    const errEl = document.getElementById('err-des-wifi');
    if (errEl) errEl.textContent = '';

    if (!state.wifi.ssid.trim()) {
      if (errEl) errEl.textContent = 'Nama WiFi (SSID) tidak boleh kosong.';
      showToast('Isi Nama WiFi (SSID) terlebih dahulu.', 'error');
      return false;
    }
    if (state.wifi.security !== 'nopass' && state.wifi.password.length < 8) {
      if (errEl) {
        errEl.textContent = 'Password WiFi minimal 8 karakter untuk WPA/WPA2/WPA3.';
      }
      showToast('Password WiFi minimal 8 karakter sebelum ekspor/cetak.', 'error');
      return false;
    }
    return true;
  }

  // =========================================================================
  // Print System (ID-1, A4 Grid, Thermal 58mm & 80mm)
  // =========================================================================

  function buildThermalReceiptNode(config, qrMatrix) {
    const wrap = document.createElement('div');
    wrap.className = 'print-thermal-receipt';

    const brand = document.createElement('div');
    brand.className = 'print-thermal-brand';
    brand.textContent = 'MY REP';

    const sub = document.createElement('div');
    sub.className = 'print-thermal-sub';
    sub.textContent = `WIFI VOUCHER · ${config.designer.voucherName || 'MY REP WIFI'}`;

    const qrBox = document.createElement('div');
    qrBox.className = 'print-thermal-qr';
    const qrCanvas = document.createElement('canvas');
    drawQrToCanvas(qrCanvas, qrMatrix, 200, 2);
    qrBox.appendChild(qrCanvas);

    const table = document.createElement('table');
    table.className = 'print-thermal-table';
    const addRow = (k, v) => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = k;
      const td2 = document.createElement('td');
      td2.textContent = v;
      tr.append(td1, td2);
      table.appendChild(tr);
    };

    addRow('SSID', config.wifi.ssid);
    if (config.wifi.security === 'nopass') {
      addRow('Password', 'Open WiFi');
    } else {
      addRow(
        'Password',
        config.designer.showPassword ? config.wifi.password || '-' : '••••••••'
      );
    }
    if (config.designer.packageName.trim()) addRow('Paket', config.designer.packageName);
    if (config.designer.duration.trim()) addRow('Durasi', config.designer.duration);
    if (config.designer.showPrice && config.designer.price.trim()) {
      addRow('Harga', config.designer.price);
    }
    if (config.designer.showCode && config.designer.voucherCode.trim()) {
      addRow('Kode', `#${config.designer.voucherCode}`);
    }

    const foot = document.createElement('div');
    foot.className = 'print-thermal-foot';
    foot.textContent =
      config.designer.description.trim() ||
      'Scan QR Code untuk terhubung otomatis · Connect Smarter, Stay Connected.';

    wrap.append(brand, sub, qrBox, table, foot);
    return wrap;
  }

  function executePrint() {
    if (!validateDesignerWifiForExport()) return;
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    clearElement(printArea);
    printArea.className = `print-area print-mode-${state.printFormat}`;

    if (state.printFormat === 'id1') {
      printArea.appendChild(renderVoucherCardElement(state, state.qrMatrix));
    } else if (state.printFormat === 'a4') {
      const copies = Number(state.printCopies) || 8;
      for (let i = 0; i < copies; i += 1) {
        const cell = document.createElement('div');
        cell.className = 'print-a4-cell';
        cell.appendChild(renderVoucherCardElement(state, state.qrMatrix));
        printArea.appendChild(cell);
      }
    } else {
      printArea.appendChild(buildThermalReceiptNode(state, state.qrMatrix));
    }

    closePrintModal();
    setTimeout(() => {
      window.print();
    }, 120);
  }

  function openPrintModal() {
    if (!validateDesignerWifiForExport()) return;
    const modal = document.getElementById('print-modal');
    if (modal) modal.hidden = false;
  }

  function closePrintModal() {
    const modal = document.getElementById('print-modal');
    if (modal) modal.hidden = true;
  }

  // =========================================================================
  // History View Rendering & Actions
  // =========================================================================

  function formatIndonesianDate(iso) {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch (_err) {
      return iso;
    }
  }

  function openConfirmationModal(title, message, onAccept) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    state.pendingConfirmAction = onAccept;
    if (modal) modal.hidden = false;
  }

  function closeConfirmationModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.hidden = true;
    state.pendingConfirmAction = null;
  }

  function refreshHistoryView() {
    const container = document.getElementById('history-list-container');
    const emptyEl = document.getElementById('history-empty-state');
    const searchEl = document.getElementById('history-search-input');
    const filterEl = document.getElementById('history-template-filter');
    const clearBtn = document.getElementById('clear-all-history-btn');
    if (!container || !emptyEl) return;

    const allItems = loadHistory();
    const query = (searchEl?.value || '').trim().toLowerCase();
    const tplFilter = filterEl?.value || 'all';

    if (clearBtn) clearBtn.disabled = allItems.length === 0;

    const filtered = allItems.filter((item) => {
      const matchTpl = tplFilter === 'all' || item.templateId === tplFilter;
      const haystack = `${item.designName} ${item.ssid} ${item.packageName} ${item.voucherCode}`.toLowerCase();
      const matchQuery = !query || haystack.includes(query);
      return matchTpl && matchQuery;
    });

    clearElement(container);

    if (filtered.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    filtered.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'history-card';

      const top = document.createElement('div');
      top.className = 'history-card-top';

      const titleWrap = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'history-card-title';
      title.textContent = item.designName;

      const meta = document.createElement('div');
      meta.className = 'history-card-meta';
      meta.textContent = `${formatIndonesianDate(item.createdAt)} · ${TEMPLATES[item.templateId]?.name || item.templateId}`;

      titleWrap.append(title, meta);

      const price = document.createElement('span');
      price.className = 'history-card-price tabular-nums';
      price.textContent = item.price || '-';

      top.append(titleWrap, price);

      const details = document.createElement('div');
      details.className = 'history-card-details';

      const addDetail = (lbl, val) => {
        const box = document.createElement('div');
        box.className = 'history-detail-item';
        const s = document.createElement('span');
        s.textContent = lbl;
        const st = document.createElement('strong');
        st.textContent = val;
        box.append(s, st);
        details.appendChild(box);
      };

      addDetail('SSID WiFi', item.ssid);
      addDetail('Paket', `${item.packageName} (${item.duration})`);

      const actions = document.createElement('div');
      actions.className = 'history-card-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn-primary btn-sm';
      openBtn.textContent = 'Buka Kembali';
      openBtn.addEventListener('click', () => reopenHistoryItem(item));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.textContent = 'Hapus';
      delBtn.addEventListener('click', () => {
        openConfirmationModal(
          'Hapus Desain',
          `Hapus desain "${item.designName}" dari riwayat lokal?`,
          () => {
            const next = loadHistory().filter((x) => x.id !== item.id);
            saveHistoryList(next);
            refreshHistoryView();
            refreshDashboardStats();
            showToast('Desain berhasil dihapus.', 'success');
          }
        );
      });

      actions.append(openBtn, delBtn);
      card.append(top, details, actions);
      container.appendChild(card);
    });
  }

  function reopenHistoryItem(item) {
    state.wifi.ssid = item.ssid || '';
    state.wifi.security = item.security || 'WPA';
    state.wifi.hidden = Boolean(item.hidden);
    // Password was never saved; clear it if protected so user re-enters intentionally
    state.wifi.password = state.wifi.security === 'nopass' ? '' : '';

    const cust = item.customization || {};
    const tpl = TEMPLATES[item.templateId] || TEMPLATES['modern-blue'];
    state.designer = {
      voucherName: item.designName || 'MY REP WIFI',
      packageName: item.packageName || 'Unlimited',
      duration: item.duration || '1 Hari',
      price: item.price || 'Rp5.000',
      voucherCode: item.voucherCode || '',
      description: item.description || DEFAULT_DESIGNER.description,
      templateId: tpl.id,
      customBg: cust.customBg || tpl.bg,
      customText: cust.customText || tpl.text,
      customAccent: cust.customAccent || tpl.accent,
      textSize: cust.textSize || 'md',
      qrPosition: cust.qrPosition || 'right',
      showPrice: cust.showPrice !== undefined ? cust.showPrice : true,
      showPassword: cust.showPassword !== undefined ? cust.showPassword : true,
      showCode: cust.showCode !== undefined ? cust.showCode : true,
    };

    regenerateActiveQrFromWifi();
    switchView('voucher-designer');

    if (state.wifi.security !== 'nopass') {
      showToast(
        'Desain dibuka! Demi keamanan, silakan masukkan ulang password WiFi.',
        'success'
      );
    } else {
      showToast('Desain berhasil dimuat kembali.', 'success');
    }
  }

  // =========================================================================
  // Event Binding & Initialization
  // =========================================================================

  function bindEvents() {
    // Sidebar Navigation & Quick Goto Buttons
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.goto));
    });

    document.querySelectorAll('[data-nav]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(link.dataset.nav);
      });
    });

    // Mobile Sidebar Drawer
    document.getElementById('mobile-menu-btn')?.addEventListener('click', openMobileSidebar);
    document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
    document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

    // Theme Switcher
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Dashboard Sample Button
    document.getElementById('dash-load-sample-btn')?.addEventListener('click', () => {
      state.wifi = { ...DEFAULT_SAMPLE_WIFI };
      state.designer = { ...DEFAULT_DESIGNER };
      regenerateActiveQrFromWifi();
      switchView('voucher-designer');
      showToast('Contoh voucher MY REP dimuat ke Designer.', 'success');
    });

    // QR Generator Form Events
    document.getElementById('qr-security')?.addEventListener('change', updateQrSecurityFieldState);

    document.getElementById('toggle-qr-password-btn')?.addEventListener('click', (e) => {
      const input = document.getElementById('qr-password');
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      e.currentTarget.textContent = isPass ? 'Sembunyikan' : 'Tampilkan';
    });

    document.getElementById('toggle-payload-mask-btn')?.addEventListener('click', (e) => {
      state.maskPayloadPassword = !state.maskPayloadPassword;
      e.currentTarget.textContent = state.maskPayloadPassword
        ? 'Tampilkan Password di Payload'
        : 'Sembunyikan Password di Payload';
      renderStandaloneQrPreview();
    });

    document.getElementById('load-qr-example-btn')?.addEventListener('click', () => {
      state.wifi = { ...DEFAULT_SAMPLE_WIFI };
      syncQrInputsFromState();
      regenerateActiveQrFromWifi();
      renderStandaloneQrPreview();
      showToast('Data contoh jaringan WiFi diisi.', 'success');
    });

    document.getElementById('qr-generator-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateQrForm()) {
        showToast('Periksa kembali SSID dan password WiFi Anda.', 'error');
        return;
      }

      state.wifi.ssid = document.getElementById('qr-ssid').value.trim();
      state.wifi.security = document.getElementById('qr-security').value;
      state.wifi.password =
        state.wifi.security === 'nopass'
          ? ''
          : document.getElementById('qr-password').value;
      state.wifi.hidden = document.getElementById('qr-hidden').checked;

      regenerateActiveQrFromWifi();
      renderStandaloneQrPreview();
      refreshDashboardStats();
      showToast('QR Code WiFi berhasil dibuat dan siap dipindai!', 'success');
    });

    document.getElementById('regenerate-qr-btn')?.addEventListener('click', () => {
      if (!validateQrForm()) {
        showToast('Lengkapi SSID & password sebelum regenerasi QR.', 'error');
        return;
      }
      state.wifi.ssid = document.getElementById('qr-ssid').value.trim();
      state.wifi.security = document.getElementById('qr-security').value;
      state.wifi.password =
        state.wifi.security === 'nopass'
          ? ''
          : document.getElementById('qr-password').value;
      state.wifi.hidden = document.getElementById('qr-hidden').checked;

      regenerateActiveQrFromWifi();
      renderStandaloneQrPreview();
      showToast('QR Code berhasil diregenerasi.', 'success');
    });

    document.getElementById('download-qr-only-btn')?.addEventListener('click', () => {
      if (!state.qrMatrix) regenerateActiveQrFromWifi();
      exportQrOnlyPng(state.wifi.ssid, state.qrMatrix);
      showToast('QR Code PNG berhasil diunduh.', 'success');
    });

    document.getElementById('send-to-designer-btn')?.addEventListener('click', () => {
      if (!validateQrForm()) {
        showToast('Generate QR Code yang valid terlebih dahulu.', 'error');
        return;
      }
      state.wifi.ssid = document.getElementById('qr-ssid').value.trim();
      state.wifi.security = document.getElementById('qr-security').value;
      state.wifi.password =
        state.wifi.security === 'nopass'
          ? ''
          : document.getElementById('qr-password').value;
      state.wifi.hidden = document.getElementById('qr-hidden').checked;
      regenerateActiveQrFromWifi();
      switchView('voucher-designer');
      showToast('Kredensial & QR WiFi ditransfer ke Voucher Designer.', 'success');
    });

    // Designer Tabs
    document.querySelectorAll('[data-designer-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.dataset.designerTab;
        document.querySelectorAll('[data-designer-tab]').forEach((b) => {
          const active = b.dataset.designerTab === target;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', String(active));
        });
        document.querySelectorAll('.designer-tab-panel').forEach((panel) => {
          panel.classList.toggle('is-active', panel.id === `tab-panel-${target}`);
        });
      });
    });

    // Quick Package Presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        state.designer.packageName = btn.dataset.pkg || '';
        state.designer.duration = btn.dataset.dur || '';
        state.designer.price = btn.dataset.price || '';
        syncDesignerInputsFromState();
        renderDesignerLivePreview();
      });
    });

    // Designer Info Live Inputs
    const bindInput = (id, handler) => {
      document.getElementById(id)?.addEventListener('input', handler);
    };

    bindInput('des-voucher-name', (e) => {
      state.designer.voucherName = e.target.value;
      renderDesignerLivePreview();
    });
    bindInput('des-code', (e) => {
      state.designer.voucherCode = e.target.value;
      renderDesignerLivePreview();
    });
    bindInput('des-package', (e) => {
      state.designer.packageName = e.target.value;
      renderDesignerLivePreview();
    });
    bindInput('des-duration', (e) => {
      state.designer.duration = e.target.value;
      renderDesignerLivePreview();
    });
    bindInput('des-price', (e) => {
      state.designer.price = e.target.value;
      renderDesignerLivePreview();
    });
    bindInput('des-description', (e) => {
      state.designer.description = e.target.value;
      renderDesignerLivePreview();
    });

    // WiFi fields inside Designer dynamically regenerate QR matrix cleanly
    bindInput('des-ssid', (e) => {
      state.wifi.ssid = e.target.value;
      if (state.wifi.ssid.trim()) regenerateActiveQrFromWifi();
      renderDesignerLivePreview();
    });
    bindInput('des-password', (e) => {
      state.wifi.password = e.target.value;
      if (state.wifi.ssid.trim()) regenerateActiveQrFromWifi();
      renderDesignerLivePreview();
    });
    document.getElementById('des-security')?.addEventListener('change', (e) => {
      state.wifi.security = e.target.value;
      if (state.wifi.security === 'nopass') state.wifi.password = '';
      syncDesignerInputsFromState();
      if (state.wifi.ssid.trim()) regenerateActiveQrFromWifi();
      renderDesignerLivePreview();
    });
    document.getElementById('des-hidden')?.addEventListener('change', (e) => {
      state.wifi.hidden = e.target.checked;
      if (state.wifi.ssid.trim()) regenerateActiveQrFromWifi();
      renderDesignerLivePreview();
    });
    document.getElementById('toggle-des-password-btn')?.addEventListener('click', (e) => {
      const input = document.getElementById('des-password');
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      e.currentTarget.textContent = isPass ? 'Sembunyikan' : 'Tampilkan';
    });

    // Templates & Colors (Never mutates QR matrix)
    document.querySelectorAll('.template-option').forEach((btn) => {
      btn.addEventListener('click', () => applyTemplatePreset(btn.dataset.template));
    });

    bindInput('des-color-bg', (e) => {
      state.designer.customBg = e.target.value;
      const hex = document.getElementById('hex-bg');
      if (hex) hex.textContent = e.target.value.toUpperCase();
      renderDesignerLivePreview();
    });
    bindInput('des-color-text', (e) => {
      state.designer.customText = e.target.value;
      const hex = document.getElementById('hex-text');
      if (hex) hex.textContent = e.target.value.toUpperCase();
      renderDesignerLivePreview();
    });
    bindInput('des-color-accent', (e) => {
      state.designer.customAccent = e.target.value;
      const hex = document.getElementById('hex-accent');
      if (hex) hex.textContent = e.target.value.toUpperCase();
      renderDesignerLivePreview();
    });

    document.getElementById('reset-colors-btn')?.addEventListener('click', () => {
      applyTemplatePreset(state.designer.templateId);
      showToast('Warna dikembalikan ke default template.', 'success');
    });

    // Text Size & QR Position & Visibility Toggles
    document.querySelectorAll('#text-size-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.designer.textSize = btn.dataset.textSize;
        syncDesignerInputsFromState();
        renderDesignerLivePreview();
      });
    });

    document.querySelectorAll('#qr-pos-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.designer.qrPosition = btn.dataset.qrPos;
        syncDesignerInputsFromState();
        renderDesignerLivePreview();
      });
    });

    document.getElementById('toggle-show-price')?.addEventListener('change', (e) => {
      state.designer.showPrice = e.target.checked;
      renderDesignerLivePreview();
    });
    document.getElementById('toggle-show-password')?.addEventListener('change', (e) => {
      state.designer.showPassword = e.target.checked;
      renderDesignerLivePreview();
    });
    document.getElementById('toggle-show-code')?.addEventListener('change', (e) => {
      state.designer.showCode = e.target.checked;
      renderDesignerLivePreview();
    });

    document.getElementById('reset-designer-example-btn')?.addEventListener('click', () => {
      state.wifi = { ...DEFAULT_SAMPLE_WIFI };
      state.designer = { ...DEFAULT_DESIGNER };
      regenerateActiveQrFromWifi();
      syncDesignerInputsFromState();
      renderDesignerLivePreview();
      showToast('Contoh voucher default dimuat ulang.', 'success');
    });

    // Export, Print & Save Actions
    document.getElementById('download-voucher-png-btn')?.addEventListener('click', () => {
      if (!validateDesignerWifiForExport()) return;
      if (!state.qrMatrix) regenerateActiveQrFromWifi();
      exportVoucherToPng(state, state.qrMatrix);
      showToast('Kartu voucher PNG resolusi tinggi berhasil diunduh.', 'success');
    });

    document.getElementById('designer-download-qr-btn')?.addEventListener('click', () => {
      if (!validateDesignerWifiForExport()) return;
      if (!state.qrMatrix) regenerateActiveQrFromWifi();
      exportQrOnlyPng(state.wifi.ssid, state.qrMatrix);
      showToast('QR Code PNG berhasil diunduh.', 'success');
    });

    document.getElementById('save-history-btn')?.addEventListener('click', saveCurrentDesignToHistory);

    // Print Modal Events
    document.getElementById('open-print-modal-btn')?.addEventListener('click', openPrintModal);
    document.getElementById('close-print-modal-btn')?.addEventListener('click', closePrintModal);
    document.getElementById('cancel-print-modal-btn')?.addEventListener('click', closePrintModal);
    document.getElementById('execute-print-btn')?.addEventListener('click', executePrint);

    document.querySelectorAll('.print-format-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.printFormat = btn.dataset.printFormat;
        document.querySelectorAll('.print-format-btn').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.printFormat === state.printFormat);
        });
        const copiesGroup = document.getElementById('print-copies-group');
        if (copiesGroup) copiesGroup.hidden = state.printFormat !== 'a4';
      });
    });

    document.getElementById('print-a4-copies')?.addEventListener('change', (e) => {
      state.printCopies = Number(e.target.value) || 8;
    });

    // History Search, Filter & Clear All
    document.getElementById('history-search-input')?.addEventListener('input', refreshHistoryView);
    document.getElementById('history-template-filter')?.addEventListener('change', refreshHistoryView);

    document.getElementById('clear-all-history-btn')?.addEventListener('click', () => {
      openConfirmationModal(
        'Hapus Seluruh Riwayat',
        'Semua desain yang tersimpan di penyimpanan lokal browser akan dihapus permanen. Lanjutkan?',
        () => {
          saveHistoryList([]);
          refreshHistoryView();
          refreshDashboardStats();
          showToast('Seluruh riwayat desain telah dihapus.', 'success');
        }
      );
    });

    document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirmationModal);
    document.getElementById('confirm-accept-btn')?.addEventListener('click', () => {
      const fn = state.pendingConfirmAction;
      closeConfirmationModal();
      if (typeof fn === 'function') fn();
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePrintModal();
        closeConfirmationModal();
        closeMobileSidebar();
      }
    });
  }

  function init() {
    let savedTheme = 'light';
    try {
      savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    } catch (_err) {
      savedTheme = 'light';
    }
    applyTheme(savedTheme);

    regenerateActiveQrFromWifi();
    bindEvents();
    syncQrInputsFromState();
    syncDesignerInputsFromState();
    renderStandaloneQrPreview();
    renderDesignerLivePreview();
    refreshDashboardStats();
    renderDashboardSample();
    refreshHistoryView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
