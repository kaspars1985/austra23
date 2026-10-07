// Austra ERP Auto-Rezervācija & Ražošana Content Script
// Integrēts labās puses sānu panelis (Docked Sidebar - No Overlap)
(() => {
  if (window.__AUSTRA_AUTOMATION_LOADED__) {
    // Ja skripts jau ir ielādēts, vienkārši atveram paneli
    if (window.__AUSTRA_OPEN_SIDEBAR__) {
      window.__AUSTRA_OPEN_SIDEBAR__();
    }
    return;
  }
  window.__AUSTRA_AUTOMATION_LOADED__ = true;

  console.log('[Austra Addon] Ielādēts Austra ERP sānu paneļa automatizācijas skripts.');

  // Configuration & State
  const CURRENT_VERSION = '1.2.9';
  const GITHUB_REPO_URL = 'https://github.com/kaspars1985/austra23';
  const GITHUB_RAW_MANIFEST = 'https://raw.githubusercontent.com/kaspars1985/austra23/main/extension/manifest.json';

  const CONFIG = {
    maxTimeoutMs: 15 * 60 * 1000, // 15 minūtes
    pollIntervalMs: 1000,          // viegla pārbaude ik pēc 1 sekundes
    targetUrlRegex: /\/order_management\/orders\/\d+|mock_austra_page/i
  };

  const STATE = {
    status: 'IDLE', // IDLE, RESERVING, WAITING, CHANGING_STATUS, COMPLETED, ERROR
    isSidebarOpen: true,
    startTime: null,
    timerInterval: null,
    pollInterval: null,
    observer: null,
    soundEnabled: true,
    notificationsEnabled: true
  };

  // --- SESSION PERSISTENCE (Pāri lapas pārlādēm) ---
  function getSessionStorageKey() {
    const code = getOrderCode();
    return `austra_auto_session_${code}`;
  }

  function saveSessionState() {
    try {
      const key = getSessionStorageKey();
      sessionStorage.setItem(key, JSON.stringify({
        status: STATE.status,
        startTime: STATE.startTime
      }));
    } catch (e) {}
  }

  function loadSessionState() {
    try {
      const key = getSessionStorageKey();
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.startTime && (Date.now() - data.startTime < CONFIG.maxTimeoutMs)) {
        return data;
      }
      clearSessionState();
    } catch (e) {}
    return null;
  }

  function clearSessionState() {
    try {
      const key = getSessionStorageKey();
      sessionStorage.removeItem(key);
    } catch (e) {}
  }

  // --- DARBĪBU ŽURNĀLA SAGLABĀŠANA (Pāri lapas pārlādēm) ---
  function getLogSessionKey() {
    const code = getOrderCode();
    return `austra_log_${code}`;
  }

  function saveLogToSession(logText) {
    try {
      const key = getLogSessionKey();
      sessionStorage.setItem(key, logText);
    } catch (e) {}
  }

  function loadLogFromSession() {
    try {
      const key = getLogSessionKey();
      return sessionStorage.getItem(key) || '';
    } catch (e) {}
    return '';
  }

  function clearLogSession() {
    try {
      const key = getLogSessionKey();
      sessionStorage.removeItem(key);
    } catch (e) {}
  }

  function formatTimestamp(timestamp) {
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function getOrderCompletedTimestamp() {
    const orderCode = getOrderCode();
    try {
      const raw = sessionStorage.getItem(`austra_completed_${orderCode}`);
      if (raw) {
        const num = parseInt(raw, 10);
        if (!isNaN(num)) return num;
      }
    } catch (e) {}
    return null;
  }

  function getInitialLogContent() {
    const existing = loadLogFromSession();
    if (existing && existing.trim().length > 0) {
      return existing;
    }
    const completedTs = getOrderCompletedTimestamp();
    if (completedTs) {
      return `ℹ️ Šis pasūtījums jau ir palaists ražoties plkst. ${formatTimestamp(completedTs)}`;
    }
    return 'Gaidu palaišanu...';
  }

  // --- VERSION CHECKER & COMPARISON ---
  function compareSemver(v1, v2) {
    const p1 = (v1 || '0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const p2 = (v2 || '0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  async function checkForUpdates(isManual = false) {
    try {
      const checkBtn = document.getElementById('austra-btn-check-update');
      if (isManual && checkBtn) {
        checkBtn.innerText = 'Pārbauda...';
      }

      const res = await fetch(GITHUB_RAW_MANIFEST, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const remoteVer = data.version;

      if (remoteVer && compareSemver(remoteVer, CURRENT_VERSION) > 0) {
        showUpdateBanner(remoteVer);
        logActivity(`🚀 Pieejams atjauninājums: v${remoteVer} (pašreizējā v${CURRENT_VERSION})`);
        if (isManual) {
          sendNotification(
            'Austra ERP: Pieejams atjauninājums!',
            `Ir pieejama jaunāka versija v${remoteVer}. Klikšķiniet, lai atvērtu GitHub.`
          );
        }
      } else {
        if (isManual) {
          if (checkBtn) checkBtn.innerText = 'Jaunākā versija! ✓';
          setTimeout(() => { if (checkBtn) checkBtn.innerText = 'Pārbaudīt atjauninājumu'; }, 3000);
          logActivity(`Jums ir jaunākā versija (v${CURRENT_VERSION}).`);
        }
      }
    } catch (e) {
      console.warn('[Austra Addon] Atjauninājumu pārbaudes kļūda:', e);
      const checkBtn = document.getElementById('austra-btn-check-update');
      if (isManual && checkBtn) {
        checkBtn.innerText = 'Neizdevās pārbaudīt';
        setTimeout(() => { if (checkBtn) checkBtn.innerText = 'Pārbaudīt atjauninājumu'; }, 3000);
      }
    }
  }

  function showUpdateBanner(newVersion) {
    if (document.getElementById('austra-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'austra-update-banner';
    banner.className = 'austra-update-banner';
    banner.innerHTML = `
      <div class="austra-update-title">
        <span>🚀</span> Pieejams atjauninājums v${newVersion}!
      </div>
      <div class="austra-update-desc">
        Ir izlaista jaunāka paplašinājuma versija (Jums ir v${CURRENT_VERSION}).
      </div>
      <a href="${GITHUB_REPO_URL}" target="_blank" class="austra-btn-update-link">
        Atvērt GitHub un atjaunināt ↗
      </a>
    `;

    const body = document.querySelector('.austra-sidebar-body');
    if (body) {
      body.insertBefore(banner, body.firstChild);
    }
  }

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  function playSound(type) {
    if (!STATE.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'success') {
        // Melodic success chime (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

          gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.12);
          osc.stop(ctx.currentTime + idx * 0.12 + 0.55);
        });
      } else if (type === 'error') {
        // Low 2-tone warning chime
        const notes = [440, 311.13];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.2);

          gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.2);
          gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.2 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.2 + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.2);
          osc.stop(ctx.currentTime + idx * 0.2 + 0.65);
        });
      }
    } catch (e) {
      console.warn('[Austra Addon] Audio error:', e);
    }
  }

  function sendNotification(title, message) {
    if (!STATE.notificationsEnabled) return;
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'notify', title, message });
      }
    } catch (e) {
      console.warn('[Austra Addon] Paziņojuma kļūda:', e);
    }
  }

  // --- DOM SELECTORS & INSPECTORS ---
  function findReserveButton() {
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
    const btn = buttons.find(b => {
      const text = (b.innerText || b.value || '').trim();
      return /rezervēt materiālus/i.test(text);
    });
    if (btn) return btn;

    const reactContainer = document.querySelector('div[data-react-component="ExternalServiceButton"]');
    if (reactContainer) {
      const b = reactContainer.querySelector('button');
      if (b) return b;
    }
    return null;
  }

  function findExactDot(keywords) {
    for (const kw of keywords) {
      // Meklējam elementu ar precīzo tooltip tekstu
      const selector = `[aria-label*="${kw}" i], [data-bs-original-title*="${kw}" i], [data-original-title*="${kw}" i], [title*="${kw}" i]`;
      const matches = Array.from(document.querySelectorAll(selector)).filter(el => {
        // Stingri izslēdzam sānu paneli, tā cilni, apstiprinājumu dialogus un modālos logus
        if (el.closest('#austra-sidebar') || el.closest('#austra-sidebar-tab') || el.closest('#austra-alert-overlay') || el.closest('.modal, [role="dialog"]')) {
          return false;
        }
        return true;
      });
      // Prioritāte 1: mazais aplītis (bērnu nav, teksta garums <= 3)
      const dot = matches.find(el => el.children.length === 0 && (el.innerText || '').trim().length <= 3);
      if (dot) return dot;
      // Prioritāte 2: jebkurš mačs bez daudziem bērniem
      const candidate = matches.find(el => el.children.length <= 1);
      if (candidate) return candidate;
    }
    return null;
  }

  function getIndicatorElements() {
    return {
      // 1. CutRite aplītis
      cutrite: findExactDot(['Nosūtīts uz CutRite', 'CutRite faili', 'CutRite']),
      // 2. BOM aplītis
      bom: findExactDot(['BOM izveidoti', 'BOM']),
      // 3. Montāžas pasūtījums aplītis
      assembly: findExactDot(['Montāžas pasūtījums izveidots', 'Montāžas pasūtījums', 'Montāž', 'Montaz'])
    };
  }

  function parseRgb(colorStr) {
    if (!colorStr) return null;
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10)
    };
  }

  function evaluateDot(el) {
    if (!el) return { exists: false, isGreen: false, isRed: false, isPending: true };

    const className = String(el.className || '');
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor || '';
    const rgb = parseRgb(bg);

    // 1. Klases pārbaude (Austra ERP testa lapas zaļā klase ir jfxJkt vai Bootstrap klases)
    if (className.includes('jfxJkt') || /\b(bg-success|text-success|is-success)\b/i.test(className)) {
      return { exists: true, isGreen: true, isRed: false, isPending: false };
    }
    if (/\b(bg-danger|text-danger|is-invalid|is-error)\b/i.test(className)) {
      return { exists: true, isGreen: false, isRed: true, isPending: false };
    }

    // 2. RGB krāsu pārbaude (Austra zaļais: rgb(138, 209, 107), tukšais pelēkais: rgb(231, 234, 239))
    if (rgb) {
      // Pārbaudām, vai krāsa ir pelēka (r, g, b ļoti tuvu viens otram)
      const maxDiff = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
      const isGrey = (maxDiff < 25) ||
                     (Math.abs(rgb.r - 231) < 18 && Math.abs(rgb.g - 234) < 18 && Math.abs(rgb.b - 239) < 18);

      // Austra zaļais (rgb ap 138, 209, 107) vai vispārējs izteikts zaļais tonis
      const isAustraGreen = (Math.abs(rgb.r - 138) < 30 && Math.abs(rgb.g - 209) < 30 && Math.abs(rgb.b - 107) < 30);
      const isGenericGreen = (rgb.g >= 125 && rgb.g > rgb.r + 25 && rgb.g > rgb.b + 25);

      if ((isAustraGreen || isGenericGreen) && !isGrey) {
        return { exists: true, isGreen: true, isRed: false, isPending: false };
      }

      if (rgb.r > 160 && rgb.r > rgb.g + 35 && rgb.r > rgb.b + 35 && !isGrey) {
        return { exists: true, isGreen: false, isRed: true, isPending: false };
      }
    }

    return { exists: true, isGreen: false, isRed: false, isPending: true };
  }

  function checkAllIndicators() {
    const els = getIndicatorElements();
    const cutrite = evaluateDot(els.cutrite);
    const bom = evaluateDot(els.bom);
    const assembly = evaluateDot(els.assembly);

    const allGreen = cutrite.isGreen && bom.isGreen && assembly.isGreen;
    const anyRed = cutrite.isRed || bom.isRed || assembly.isRed;

    return {
      allGreen,
      anyRed,
      states: {
        cutrite,
        bom,
        assembly
      }
    };
  }

  // --- ORDER STATUS DETECTION & VALIDATION ---
  function getCurrentOrderStatus() {
    // 1. Meklējam tabulas vai definīciju laukos ar nosaukumu "Statuss"
    const allLabels = Array.from(document.querySelectorAll('td, th, dt, label, div, span, p')).filter(el => {
      if (el.closest('#austra-sidebar') || el.closest('#austra-alert-overlay')) return false;
      const t = (el.innerText || '').trim();
      return /^statuss:?$/i.test(t);
    });

    for (const label of allLabels) {
      // A. Tabulas rinda <tr>
      const tr = label.closest('tr');
      if (tr) {
        const cells = Array.from(tr.querySelectorAll('td, th'));
        const valCell = cells.find(c => c !== label && (c.innerText || '').trim().length > 0);
        if (valCell) {
          const text = (valCell.innerText || '').trim();
          if (text) return text;
        }
      }

      // B. Definīciju saraksts <dt> -> <dd>
      if (label.tagName === 'DT' && label.nextElementSibling) {
        const text = (label.nextElementSibling.innerText || '').trim();
        if (text) return text;
      }

      // C. Konteinera bērni (flex vai grid rinda)
      const parent = label.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c !== label && (c.innerText || '').trim().length > 0);
        if (siblings.length > 0) {
          const text = (siblings[0].innerText || '').trim();
          if (text) return text;
        }
      }
    }

    // 2. Meklējam elementu ar tekstu "Statuss: ..."
    const statusWithPrefix = Array.from(document.querySelectorAll('*')).find(el => {
      if (el.children.length > 2) return false;
      if (el.closest('#austra-sidebar') || el.closest('#austra-alert-overlay')) return false;
      const t = (el.innerText || '').trim();
      return /^statuss:\s*.+/i.test(t);
    });
    if (statusWithPrefix) {
      const match = statusWithPrefix.innerText.trim().match(/^statuss:\s*(.+)/i);
      if (match && match[1]) return match[1].trim();
    }

    // 3. Meklējam badge / statusa elementus
    const badgeCandidates = Array.from(document.querySelectorAll('.badge, .label, [class*="badge" i], [class*="status" i], .status')).filter(el => {
      if (el.closest('#austra-sidebar') || el.closest('#austra-alert-overlay')) return false;
      return (el.innerText || '').trim().length > 0;
    });

    const priceBadge = badgeCandidates.find(b => /cenu\s+saskaņo/i.test(b.innerText || ''));
    if (priceBadge) {
      return priceBadge.innerText.trim();
    }

    const drawingBadge = badgeCandidates.find(b => /ras[eē]jum/i.test(b.innerText || ''));
    if (drawingBadge) {
      return drawingBadge.innerText.trim();
    }

    // 4. Meklējam lapas pamattekstā
    const bodyText = document.body ? document.body.innerText : '';
    if (/cenu\s+saskaņošana\s+ar\s+klientu/i.test(bodyText)) {
      return 'Cenu saskaņošana ar klientu';
    }
    if (/cenu\s+saskaņo/i.test(bodyText)) {
      return 'Cenu saskaņošana';
    }
    if (/ras[eē]jumu\s+saskaņošana\s+ar\s+klientu/i.test(bodyText)) {
      return 'Rasējumu saskaņošana ar klientu';
    }
    if (/ras[eē]jumu\s+saskaņo/i.test(bodyText)) {
      return 'Rasējumu saskaņošana';
    }

    return null;
  }

  function isPriceAgreedStatus(statusStr) {
    const status = statusStr !== undefined ? statusStr : getCurrentOrderStatus();
    if (!status) return false;
    return /cenu\s+saskaņo/i.test(status);
  }

  function isDrawingStatus(statusStr) {
    const status = statusStr !== undefined ? statusStr : getCurrentOrderStatus();
    if (!status) return false;
    return /ras[eē]jum/i.test(status);
  }

  function resetSidebarStatusMsg() {
    const statusMsg = document.getElementById('austra-sidebar-status-msg');
    const statusIcon = document.getElementById('austra-sidebar-status-icon');
    if (statusMsg) statusMsg.innerText = 'Gatavs darbam';
    if (statusIcon) statusIcon.innerText = '⚪';
  }

  function showStatusWarningDialog(message, currentStatus) {
    if (document.getElementById('austra-alert-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'austra-alert-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.65);backdrop-filter:blur(2px);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;animation:austraFadeIn 0.2s ease-out;';

    const box = document.createElement('div');
    box.id = 'austra-alert-box';
    box.style.cssText = 'background:#ffffff;border-radius:12px;width:100%;max-width:480px;box-shadow:0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(239,68,68,0.2);overflow:hidden;display:flex;flex-direction:column;';

    box.innerHTML = `
      <div style="background:#fef2f2;border-bottom:1px solid #fee2e2;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;line-height:1;">⚠️</span>
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:700;color:#991b1b;">Brīdinājums par pasūtījuma statusu</h3>
            <span style="font-size:11.5px;color:#b91c1c;">Austra ERP drošības pārbaude</span>
          </div>
        </div>
        <button id="austra-alert-close-x" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;line-height:1;padding:4px;">&times;</button>
      </div>

      <div style="padding:20px;font-size:13.5px;color:#334155;line-height:1.5;">
        <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:10px;">
          ${message}
        </div>
        <p style="margin:0 0 14px 0;color:#475569;">
          Auto-rezervāciju drīkst palaist tikai tad, kad pasūtījuma cenas ir saskaņotas un statuss sistēmā ir nomainīts uz <strong>"Cenu saskaņošana ar klientu"</strong>.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;font-size:12.5px;">
          <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#64748b;">Pašreizējais statuss:</span>
            <span style="font-weight:700;color:#dc2626;background:#fee2e2;padding:3px 8px;border-radius:4px;border:1px solid #fca5a5;">
              ${currentStatus || 'Nezināms'}
            </span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#64748b;">Nepieciešamais statuss:</span>
            <span style="font-weight:700;color:#059669;background:#dcfce7;padding:3px 8px;border-radius:4px;border:1px solid #86efac;">
              Cenu saskaņošana ar klientu
            </span>
          </div>
        </div>
      </div>

      <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px;">
        <button id="austra-alert-btn-ok" style="background:linear-gradient(135deg, #059669 0%, #10b981 100%);color:#ffffff;border:none;padding:8px 24px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(5,150,105,0.28);transition:all 0.2s ease;">
          Labi, sapratu
        </button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const closeDialog = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      resetSidebarStatusMsg();
    };

    overlay.querySelector('#austra-alert-close-x').addEventListener('click', closeDialog);
    overlay.querySelector('#austra-alert-btn-ok').addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    const escListener = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', escListener);
      }
    };
    document.addEventListener('keydown', escListener);
  }

  function showDrawingConfirmationDialog(currentStatus, onConfirm) {
    if (document.getElementById('austra-alert-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'austra-alert-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.65);backdrop-filter:blur(2px);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;animation:austraFadeIn 0.2s ease-out;';

    const box = document.createElement('div');
    box.id = 'austra-alert-box';
    box.style.cssText = 'background:#ffffff;border-radius:12px;width:100%;max-width:500px;box-shadow:0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(37,99,235,0.2);overflow:hidden;display:flex;flex-direction:column;';

    box.innerHTML = `
      <div style="background:#eff6ff;border-bottom:1px solid #dbeafe;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;line-height:1;">📐</span>
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e40af;">Pasūtījums ar rasējumiem</h3>
            <span style="font-size:11.5px;color:#3b82f6;">Austra ERP rasējumu apstiprinājums</span>
          </div>
        </div>
        <button id="austra-alert-close-x" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;line-height:1;padding:4px;">&times;</button>
      </div>

      <div style="padding:20px;font-size:13.5px;color:#334155;line-height:1.5;">
        <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:8px;">
          Vai klients ir apstiprinājis rasējumus?
        </div>
        <p style="margin:0 0 14px 0;color:#475569;">
          Šim pasūtījumam pašreizējais statuss ir <strong>"${currentStatus}"</strong>.<br>
          Ja klients rasējumus jau ir saskaņojis un pasūtījums jānodod ražošanā, apstipriniet, lai sāktu auto-rezervāciju kā izņēmumu.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;font-size:12.5px;">
          <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#64748b;">Pašreizējais statuss:</span>
            <span style="font-weight:700;color:#1d4ed8;background:#dbeafe;padding:3px 8px;border-radius:4px;border:1px solid #bfdbfe;">
              ${currentStatus}
            </span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#64748b;">Nepieciešamais nosacījums:</span>
            <span style="font-weight:700;color:#059669;background:#dcfce7;padding:3px 8px;border-radius:4px;border:1px solid #86efac;">
              Rasējumi saskaņoti ar klientu
            </span>
          </div>
        </div>
      </div>

      <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:12px 20px;display:flex;justify-content:flex-end;gap:10px;">
        <button id="austra-alert-btn-cancel">
          Atcelt
        </button>
        <button id="austra-alert-btn-confirm">
          Rasējumi saskaņoti – Turpināt 🚀
        </button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const closeDialog = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    const handleCancel = () => {
      closeDialog();
      resetSidebarStatusMsg();
      logActivity('Auto-rezervācija atcelta (gaida rasējumu saskaņošanu).');
    };

    overlay.querySelector('#austra-alert-close-x').addEventListener('click', handleCancel);
    overlay.querySelector('#austra-alert-btn-cancel').addEventListener('click', handleCancel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleCancel();
    });

    const escListener = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
        document.removeEventListener('keydown', escListener);
      }
    };
    document.addEventListener('keydown', escListener);

    overlay.querySelector('#austra-alert-btn-confirm').addEventListener('click', () => {
      closeDialog();
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });
  }

  function updateOrderStatusDisplay() {
    const el = document.getElementById('austra-display-status');
    if (!el) return;
    const currentStatus = getCurrentOrderStatus();
    if (!currentStatus) {
      el.innerText = 'Nav atrasts';
      el.style.color = '#94a3b8';
      el.style.background = '#f1f5f9';
      el.style.border = '1px solid #e2e8f0';
      return;
    }
    const isAgreed = isPriceAgreedStatus(currentStatus);
    const isDrawing = isDrawingStatus(currentStatus);
    el.innerText = currentStatus;
    if (isAgreed) {
      el.style.color = '#059669';
      el.style.background = '#dcfce7';
      el.style.border = '1px solid #86efac';
      el.title = 'Statuss ir pareizs, auto-rezervāciju drīkst palaist';
    } else if (isDrawing) {
      el.style.color = '#1d4ed8';
      el.style.background = '#eff6ff';
      el.style.border = '1px solid #bfdbfe';
      el.title = 'Pasūtījums ar rasējumiem. Var palaist, ja klients ir apstiprinājis rasējumus.';
    } else {
      el.style.color = '#b45309';
      el.style.background = '#fef3c7';
      el.style.border = '1px solid #fde68a';
      el.title = 'Pirms Sākt auto-rezervāciju, saskaņo cenas ar klientu!';
    }
  }

  function dispatchClick(el) {
    if (!el) return;
    try {
      el.focus();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.click();
    } catch (e) {
      el.click();
    }
  }

  function findModalConfirmButton() {
    // 1. Meklējam aktīvos modālos dialogu konteinerus
    const modalSelectors = [
      '.modal',
      '.modal-dialog',
      '.modal-content',
      '[role="dialog"]',
      '.dialog',
      '.popup',
      '.sweet-alert',
      '.swal2-container',
      '.swal2-modal',
      'div[class*="modal" i]',
      'div[class*="dialog" i]',
      'div[class*="popup" i]'
    ];

    const modals = Array.from(document.querySelectorAll(modalSelectors.join(', '))).filter(el => {
      if (el.closest('#austra-sidebar') || el.id === 'austra-sidebar' || el.closest('#austra-pull-tab')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });

    // A. Prioritāte: poga iekš modālā loga ar tekstu "Uz ražošanu"
    for (const modal of modals) {
      const btns = Array.from(modal.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, [role="button"], .btn'));
      for (const btn of btns) {
        if (btn.closest('#austra-sidebar')) continue;
        const text = (btn.innerText || btn.value || '').trim();
        if (/uz ražošanu/i.test(text)) {
          return btn;
        }
      }
    }

    // B. Prioritāte: jebkura poga uz lapas ar tekstu "Uz ražošanu", kas NAV dropdown izvēlnē un NAV sidebarā
    const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, [role="button"], .btn'));
    for (const btn of allButtons) {
      if (btn.closest('#austra-sidebar') || btn.closest('#austra-pull-tab')) continue;
      if (btn.closest('.dropdown-menu') || btn.closest('#status-dropdown-menu') || btn.classList.contains('dropdown-item')) continue;
      if (btn.getAttribute('data-action') === 'manufacturing' && btn.tagName === 'A' && !btn.classList.contains('btn')) continue;

      const text = (btn.innerText || btn.value || '').trim();
      if (/uz ražošanu/i.test(text)) {
        return btn;
      }
    }

    // C. Prioritāte: ja modālis ir atvērts (virsraksts satur ražošanu/statusu), meklējam apstiprinājuma pogu
    for (const modal of modals) {
      const modalText = (modal.innerText || '').toLowerCase();
      if (modalText.includes('ražošanu') || modalText.includes('apstiprin')) {
        const actionBtns = Array.from(modal.querySelectorAll('.modal-footer button, .modal-footer input, .modal-footer .btn, button[type="submit"], .btn-success, .btn-primary, .btn-info'));
        for (const btn of actionBtns) {
          if (btn.closest('#austra-sidebar')) continue;
          const text = (btn.innerText || btn.value || '').trim();
          if (!/atcelt|cancel|aizvērt|close|atpakaļ/i.test(text)) {
            return btn;
          }
        }
      }
    }

    return null;
  }

  function checkModalForErrors() {
    const modalSelectors = [
      '.modal',
      '.modal-dialog',
      '.modal-content',
      '[role="dialog"]',
      '.dialog',
      '.popup',
      '.sweet-alert',
      '.swal2-container',
      '.swal2-modal',
      'div[class*="modal" i]',
      'div[class*="dialog" i]',
      'div[class*="popup" i]'
    ];

    const modals = Array.from(document.querySelectorAll(modalSelectors.join(', '))).filter(el => {
      if (el.closest('#austra-sidebar') || el.id === 'austra-sidebar' || el.closest('#austra-sidebar-tab') || el.closest('#austra-alert-overlay')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });

    for (const modal of modals) {
      const text = (modal.innerText || '').trim();
      if (/nevar nosūtīt/i.test(text) || /nav veikts/i.test(text) || /nav veikta rezervācija/i.test(text)) {
        const errorLines = text.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 5 && (/nevar nosūtīt/i.test(l) || /nav veikts/i.test(l) || /nav veikta/i.test(l)));
        return errorLines.length > 0 ? errorLines.join('; ') : text.slice(0, 200);
      }
    }
    return null;
  }

  async function waitForAndConfirmModal(timeoutMs = 4500) {
    logActivity('Gaida apstiprinājuma logu...');
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // 1. Pārbaudām, vai nav atvēries bloķējošs kļūdas/brīdinājuma logs
      const errorMsg = checkModalForErrors();
      if (errorMsg) {
        logActivity(`⚠️ Austra ERP bloķēja: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // 2. Meklējam apstiprinājuma pogu
      const confirmBtn = findModalConfirmButton();
      if (confirmBtn) {
        logActivity('Apstiprina modālo logu "Uz ražošanu"...');
        await new Promise(r => setTimeout(r, 250));
        dispatchClick(confirmBtn);
        confirmBtn.click();
        await new Promise(r => setTimeout(r, 400));

        // Pārbaudām, vai pēc apstiprināšanas neparādījās kļūda
        const postError = checkModalForErrors();
        if (postError) {
          logActivity(`⚠️ Austra ERP bloķēja: ${postError}`);
          throw new Error(postError);
        }

        logActivity('Modālais logs veiksmīgi apstiprināts!');
        return true;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    const finalError = checkModalForErrors();
    if (finalError) {
      logActivity(`⚠️ Austra ERP bloķēja: ${finalError}`);
      throw new Error(finalError);
    }

    logActivity('Modālais logs netika konstatēts (varbūt nav nepieciešams).');
    return false;
  }

  async function triggerStatusChangeToManufacturing() {
    logActivity('Meklē izvēlni "Mainīt statusu"...');

    // 1. Meklējam pogu "Mainīt statusu"
    const dropdownBtns = Array.from(document.querySelectorAll('button.dropdown-toggle, .dropdown-toggle, button'));
    const changeStatusBtn = dropdownBtns.find(b => {
      if (b.closest('#austra-sidebar')) return false;
      return /mainīt statusu/i.test(b.innerText || '');
    });

    if (changeStatusBtn) {
      logActivity('Atver statusa izvēlni...');
      dispatchClick(changeStatusBtn);
      await new Promise(r => setTimeout(r, 250));
    }

    // 2. Meklējam statusa opciju "Uz ražošanu" dropdown izvēlnē
    let manufacturingLink = null;
    const dropdownMenu = changeStatusBtn ? changeStatusBtn.closest('.btn-group, .dropdown, div')?.querySelector('.dropdown-menu') : document.querySelector('.dropdown-menu');
    if (dropdownMenu) {
      const items = Array.from(dropdownMenu.querySelectorAll('a, button, .dropdown-item'));
      manufacturingLink = items.find(a => {
        const action = a.getAttribute('data-action') || '';
        const text = (a.innerText || '').trim();
        return action === 'manufacturing' || /uz ražošanu/i.test(text);
      });
    }

    if (!manufacturingLink) {
      const menuLinks = Array.from(document.querySelectorAll('a[data-action="manufacturing"], .dropdown-item, a, button'));
      manufacturingLink = menuLinks.find(a => {
        if (a.closest('#austra-sidebar')) return false;
        const action = a.getAttribute('data-action') || '';
        const text = (a.innerText || '').trim();
        return action === 'manufacturing' || (a.closest('.dropdown-menu') && /uz ražošanu/i.test(text));
      });
    }

    if (!manufacturingLink) {
      throw new Error('Neizdevās atrast izvēles opciju "Uz ražošanu" izvēlnē!');
    }

    logActivity('Izvēlas "Uz ražošanu"...');
    dispatchClick(manufacturingLink);
    manufacturingLink.click();

    // 3. Gaidām un apstiprinām modālo logu (ja ERP izmet atteikuma logu, šeit tiks izmests Error)
    await waitForAndConfirmModal(4500);

    // Saglabājam pabeigšanas marķieri TIKAI tad, ja modālis ir veiksmīgi apstiprināts bez kļūdām
    const orderCode = getOrderCode();
    const now = Date.now();
    try {
      sessionStorage.setItem(`austra_completed_${orderCode}`, String(now));
    } catch (e) {}

    const timeStr = formatTimestamp(now);
    logActivity('Statuss nomainīts uz "Uz ražošanu"!');
    logActivity(`✅ Pasūtījums veiksmīgi palaists ražoties plkst. ${timeStr}`);
  }

  function getOrderCode() {
    const match = document.title.match(/LPA\d+/i) || document.body.innerText.match(/LPA\d+/i);
    return match ? match[0] : 'Pasūtījums';
  }

  // --- SIDEBAR UI CREATION & TOGGLING ---
  let sidebarEl = null;
  let pullTabEl = null;

  function openSidebar() {
    STATE.isSidebarOpen = true;
    document.body.classList.add('austra-sidebar-open');
    if (sidebarEl) sidebarEl.classList.add('open');
    if (pullTabEl) pullTabEl.classList.add('hidden');
    updateIndicatorBadges();
  }

  function closeSidebar() {
    STATE.isSidebarOpen = false;
    document.body.classList.remove('austra-sidebar-open');
    if (sidebarEl) sidebarEl.classList.remove('open');
    if (pullTabEl) pullTabEl.classList.remove('hidden');
  }

  function toggleSidebar() {
    if (STATE.isSidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  window.__AUSTRA_OPEN_SIDEBAR__ = openSidebar;

  function createSidebarUI() {
    if (document.getElementById('austra-sidebar')) return;

    const logoUrl = (chrome && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('icons/icon48.png')
      : 'icons/icon48.png';

    // 1. Labās malas cilne (Pull-Tab)
    pullTabEl = document.createElement('div');
    pullTabEl.id = 'austra-sidebar-tab';
    pullTabEl.className = 'hidden'; // sākotnēji paslēpta, jo panelis atvērsies uzreiz
    pullTabEl.innerHTML = `<img src="${logoUrl}" class="austra-tab-logo-img" alt="Logo" /><span>LPAxxx palaidējs ◀</span>`;
    pullTabEl.title = 'Atvērt Austra LPAxxx auto palaidēja sānu paneli';
    pullTabEl.addEventListener('click', openSidebar);
    document.body.appendChild(pullTabEl);

    // 2. Dokotais sānu panelis
    sidebarEl = document.createElement('div');
    sidebarEl.id = 'austra-sidebar';
    sidebarEl.className = 'open';

    const orderCode = getOrderCode();

    sidebarEl.innerHTML = `
      <div class="austra-sidebar-header">
        <div class="austra-sidebar-title">
          <img src="${logoUrl}" class="austra-header-logo-img" alt="Austra" />
          <span>Austra LPAxxx auto palaidējs</span>
        </div>
        <div class="austra-sidebar-header-btns">
          <button class="austra-header-btn" id="austra-btn-collapse" title="Sakļaut paneli un atjaunot pilnu lapas platumu">
            Sakļaut ▶
          </button>
        </div>
      </div>

      <div class="austra-sidebar-body">
        <div class="austra-order-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div>
              <div class="austra-order-label">Aktīvais pasūtījums</div>
              <div class="austra-order-code" id="austra-display-order">${orderCode}</div>
            </div>
            <div style="text-align: right;">
              <div class="austra-order-label">Statuss</div>
              <div class="austra-order-status-badge" id="austra-display-status">Pārbauda...</div>
            </div>
          </div>
        </div>

        <button class="austra-btn-action-main btn-start" id="austra-sidebar-action-btn">
          🚀 Sākt auto-rezervāciju
        </button>

        <div class="austra-status-box">
          <div class="austra-status-text">
            <span id="austra-sidebar-status-icon">⚪</span> <span id="austra-sidebar-status-msg">Gatavs darbam</span>
          </div>
          <div class="austra-timer" id="austra-sidebar-timer">00:00</div>
        </div>

        <div class="austra-indicators-section">
          <div class="austra-section-title">Rezervācijas indikatori</div>
          <div class="austra-indicators-list">
            <div class="austra-indicator-item">
              <span class="austra-indicator-name">✂️ CutRite faili</span>
              <span class="austra-dot-badge pending" id="austra-sidebar-dot-cutrite"></span>
            </div>
            <div class="austra-indicator-item">
              <span class="austra-indicator-name">📋 BOM izveidoti</span>
              <span class="austra-dot-badge pending" id="austra-sidebar-dot-bom"></span>
            </div>
            <div class="austra-indicator-item">
              <span class="austra-indicator-name">🔨 Montāžas pasūtījums</span>
              <span class="austra-dot-badge pending" id="austra-sidebar-dot-assembly"></span>
            </div>
          </div>
        </div>

        <div class="austra-log-card">
          <div class="austra-section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Darbību žurnāls</span>
            <button id="austra-btn-clear-log" class="austra-btn-clear-log" type="button" title="Notīrīt šī pasūtījuma žurnālu">Notīrīt</button>
          </div>
          <div class="austra-log-view" id="austra-sidebar-log">${getInitialLogContent()}</div>
        </div>
      </div>

      <div class="austra-sidebar-footer">
        <div class="austra-footer-controls">
          <label class="austra-checkbox-label">
            <input type="checkbox" id="austra-check-sound" checked /> Skaņa
          </label>
          <label class="austra-checkbox-label">
            <input type="checkbox" id="austra-check-notif" checked /> Paziņojumi
          </label>
          <button class="austra-btn-sound-test" id="austra-btn-test-sound" title="Pārbaudīt melodisko čaimu">🔔 Testēt</button>
        </div>
        <div class="austra-version-row">
          <span>kasparsciematnieks@amf.lv &copy; 2026 • v${CURRENT_VERSION}</span>
          <button class="austra-btn-check-update" id="austra-btn-check-update" title="Pārbaudīt, vai GitHub ir pieejama jaunāka versija">Pārbaudīt atjauninājumu</button>
        </div>
      </div>
    `;

    document.body.appendChild(sidebarEl);

    // Event Listeners
    sidebarEl.querySelector('#austra-btn-collapse').addEventListener('click', closeSidebar);

    const clearLogBtn = sidebarEl.querySelector('#austra-btn-clear-log');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearLogSession();
        const logBox = document.getElementById('austra-sidebar-log');
        if (logBox) logBox.innerText = 'Gaidu palaišanu...';
      });
    }

    const actionBtn = sidebarEl.querySelector('#austra-sidebar-action-btn');
    actionBtn.addEventListener('click', handleActionClick);

    const checkUpdateBtn = sidebarEl.querySelector('#austra-btn-check-update');
    if (checkUpdateBtn) {
      checkUpdateBtn.addEventListener('click', () => checkForUpdates(true));
    }

    const soundCheck = sidebarEl.querySelector('#austra-check-sound');
    soundCheck.addEventListener('change', (e) => {
      STATE.soundEnabled = e.target.checked;
      logActivity(STATE.soundEnabled ? 'Skaņa ieslēgta' : 'Skaņa izslēgta');
    });

    const notifCheck = sidebarEl.querySelector('#austra-check-notif');
    notifCheck.addEventListener('change', (e) => {
      STATE.notificationsEnabled = e.target.checked;
    });

    const testSoundBtn = sidebarEl.querySelector('#austra-btn-test-sound');
    testSoundBtn.addEventListener('click', () => {
      playSound('success');
    });

    // Pēc noklusējuma atveram un pabīdām lapas saturu pa kreisi!
    openSidebar();
  }

  function logActivity(text) {
    console.log('[Austra Addon]', text);
    const logBox = document.getElementById('austra-sidebar-log');
    const time = new Date().toLocaleTimeString('lv-LV', { hour12: false });
    const line = `[${time}] ${text}`;

    if (logBox) {
      const current = (logBox.innerText || '').trim();
      const existing = (current === 'Gaidu palaišanu...') ? '' : current;
      const updated = existing ? `${line}\n${existing}` : line;
      logBox.innerText = updated.slice(0, 8000);
      saveLogToSession(logBox.innerText);
    } else {
      const existing = loadLogFromSession();
      const updated = existing ? `${line}\n${existing}` : line;
      saveLogToSession(updated.slice(0, 8000));
    }
  }

  function updateIndicatorBadges() {
    const res = checkAllIndicators();
    const updateBadge = (id, dotState) => {
      const el = document.getElementById(id);
      if (!el) return;
      const targetClass = dotState.isGreen ? 'austra-dot-badge green' : (dotState.isRed ? 'austra-dot-badge error' : 'austra-dot-badge pending');
      if (el.className !== targetClass) {
        el.className = targetClass;
      }
    };

    updateBadge('austra-sidebar-dot-cutrite', res.states.cutrite);
    updateBadge('austra-sidebar-dot-bom', res.states.bom);
    updateBadge('austra-sidebar-dot-assembly', res.states.assembly);

    updateOrderStatusDisplay();

    return res;
  }

  function updateTimer() {
    if (!STATE.startTime) return;
    const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    const timerDisplay = document.getElementById('austra-sidebar-timer');
    if (timerDisplay) {
      timerDisplay.innerText = `${min}:${sec}`;
    }

    if (Date.now() - STATE.startTime > CONFIG.maxTimeoutMs) {
      handleTimeout();
    }
  }

  // --- AUTOMATION CONTROLLER ---
  async function handleActionClick() {
    if (STATE.status === 'WAITING' || STATE.status === 'RESERVING') {
      stopAutomation('Lietotājs manuāli apturēja procesu.');
    } else {
      startAutomation();
    }
  }

  async function executeAutomation(isException = false) {
    if (isException) {
      logActivity('⚠️ Izņēmums: Rasējumi saskaņoti ar klientu. Uzsākta auto-rezervācija!');
    } else {
      logActivity('Auto-rezervācijas process uzsākts!');
    }
    const currentCode = getOrderCode();
    try {
      sessionStorage.removeItem(`austra_completed_${currentCode}`);
    } catch (e) {}

    STATE.status = 'WAITING';
    STATE.startTime = Date.now();
    saveSessionState();

    updateUIState();

    if (STATE.timerInterval) clearInterval(STATE.timerInterval);
    STATE.timerInterval = setInterval(updateTimer, 1000);
    updateTimer();

    // 1. Prioritāte: Ja poga "Rezervēt materiālus" ir pieejama lapā, OBLIGĀTI to nospiežam un sākam novērošanu!
    const reserveBtn = findReserveButton();
    if (reserveBtn) {
      logActivity('Nospiež "Rezervēt materiālus"...');
      reserveBtn.click();
      startMonitoring();
      return;
    }

    // 2. Ja rezervēšanas pogas lapā nav, pārbaudām, vai visi indikatori jau ir zaļi
    const initialCheck = updateIndicatorBadges();
    if (initialCheck.allGreen) {
      logActivity('Visi 3 indikatori jau ir zaļi! Mainām statusu...');
      await completeStatusChange();
      return;
    }

    // 3. Ja poga netika atrasta un visi indikatori vēl nav zaļi, turpinām novērošanu
    logActivity('Poga "Rezervēt materiālus" netika atrasta (iespējams, jau nospiesta). Turpinu novērošanu.');
    startMonitoring();
  }

  async function startAutomation() {
    // 1. Drošības pārbaude: statuss "Cenu saskaņošana ar klientu" vai izņēmums rasējumiem
    const currentStatus = getCurrentOrderStatus();

    // A. Parastais atļautais ceļš: statuss "Cenu saskaņošana ar klientu"
    if (isPriceAgreedStatus(currentStatus)) {
      await executeAutomation(false);
      return;
    }

    // B. Izņēmums pasūtījumiem ar rasējumiem: piedāvā apstiprināt un palaist procesu
    if (isDrawingStatus(currentStatus)) {
      const displayStatus = currentStatus || 'Rasējumu saskaņošana ar klientu';
      showDrawingConfirmationDialog(displayStatus, async () => {
        await executeAutomation(true);
      });
      return;
    }

    // C. Cits neatļauts statuss (bloķēts)
    const displayStatus = currentStatus || 'Nav "Cenu saskaņošana ar klientu"';
    const warningMsg = 'Pirms Sākt auto-rezervāciju, saskaņo cenas ar klientu!';

    logActivity(`⚠️ ${warningMsg}`);
    if (currentStatus) {
      logActivity(`(Pašreizējais statuss: "${currentStatus}")`);
    }
    playSound('error');
    sendNotification('Austra ERP: Brīdinājums', warningMsg);

    const statusMsg = document.getElementById('austra-sidebar-status-msg');
    const statusIcon = document.getElementById('austra-sidebar-status-icon');
    if (statusMsg) statusMsg.innerText = 'Jāsaskaņo cenas ar klientu!';
    if (statusIcon) statusIcon.innerText = '⚠️';

    showStatusWarningDialog(warningMsg, displayStatus);
  }

  function startMonitoring() {
    if (STATE.pollInterval) clearInterval(STATE.pollInterval);

    STATE.pollInterval = setInterval(async () => {
      if (STATE.status !== 'WAITING' && STATE.status !== 'RESERVING') return;

      const res = updateIndicatorBadges();

      if (res.anyRed) {
        handleError('Kāds no indikatoriem uzrāda kļūdu!');
        return;
      }

      if (res.allGreen) {
        logActivity('🎉 Visi 3 indikatori ir zaļi! Mainu statusu...');
        clearInterval(STATE.pollInterval);
        STATE.pollInterval = null;
        await completeStatusChange();
      }
    }, CONFIG.pollIntervalMs);
  }

  async function completeStatusChange() {
    STATE.status = 'CHANGING_STATUS';
    clearSessionState();
    updateUIState();

    try {
      await triggerStatusChangeToManufacturing();

      STATE.status = 'COMPLETED';
      clearSessionState();
      updateUIState();
      stopTimer();

      const orderCode = getOrderCode();
      logActivity(`Veiksmīgi pabeigts pasūtījumam ${orderCode}!`);
      playSound('success');
      sendNotification(
        'Austra ERP: Statuss nomainīts!',
        `Pasūtījums ${orderCode} ir veiksmīgi rezervēts un nodots "Uz ražošanu".`
      );
    } catch (err) {
      handleError(err.message || 'Kļūda, mainot statusu uz ražošanu.');
    }
  }

  function stopAutomation(reason) {
    logActivity(reason || 'Process apturēts.');
    clearSessionState();
    STATE.status = 'IDLE';
    stopTimer();
    updateUIState();
  }

  function handleTimeout() {
    stopTimer();
    clearSessionState();
    STATE.status = 'ERROR';
    updateUIState();
    logActivity('⚠️ Taimauts (15 min) pārsniegts!');
    playSound('error');
    sendNotification(
      'Austra ERP: Taimauts!',
      'Materiālu rezervācija netika pabeigta 15 minūšu laikā. Lūdzu, pārbaudiet manuāli.'
    );
  }

  function handleError(msg) {
    stopTimer();
    clearSessionState();
    STATE.status = 'ERROR';
    updateUIState();
    logActivity(`⚠️ ${msg}`);
    playSound('error');
    sendNotification('Austra ERP Kļūda', msg);
  }

  function stopTimer() {
    if (STATE.timerInterval) {
      clearInterval(STATE.timerInterval);
      STATE.timerInterval = null;
    }
    if (STATE.pollInterval) {
      clearInterval(STATE.pollInterval);
      STATE.pollInterval = null;
    }
  }

  function updateUIState() {
    const actionBtn = document.getElementById('austra-sidebar-action-btn');
    const statusMsg = document.getElementById('austra-sidebar-status-msg');
    const statusIcon = document.getElementById('austra-sidebar-status-icon');

    if (!actionBtn || !statusMsg) return;

    switch (STATE.status) {
      case 'IDLE':
        actionBtn.className = 'austra-btn-action-main btn-start';
        actionBtn.innerText = '🚀 Sākt auto-rezervāciju';
        statusMsg.innerText = 'Gatavs darbam';
        statusIcon.innerText = '⚪';
        break;
      case 'RESERVING':
        actionBtn.className = 'austra-btn-action-main btn-stop';
        actionBtn.innerText = '⏹ Apturēt';
        statusMsg.innerText = 'Rezervē...';
        statusIcon.innerText = '⏳';
        break;
      case 'WAITING':
        actionBtn.className = 'austra-btn-action-main btn-stop';
        actionBtn.innerText = '⏹ Apturēt';
        statusMsg.innerText = 'Gaida 3 zaļos punktus...';
        statusIcon.innerText = '🔄';
        break;
      case 'CHANGING_STATUS':
        actionBtn.className = 'austra-btn-action-main btn-stop';
        actionBtn.innerText = 'Maina statusu...';
        statusMsg.innerText = 'Liek "Uz ražošanu"...';
        statusIcon.innerText = '⚙️';
        break;
      case 'COMPLETED':
        actionBtn.className = 'austra-btn-action-main btn-done';
        actionBtn.innerText = '✅ Pabeigts! (Palaist atkal)';
        statusMsg.innerText = 'Nodots ražošanā!';
        statusIcon.innerText = '🎉';
        break;
      case 'ERROR':
        actionBtn.className = 'austra-btn-action-main btn-start';
        actionBtn.innerText = '🔄 Mēģināt vēlreiz';
        statusMsg.innerText = 'Radās kļūda!';
        statusIcon.innerText = '⚠️';
        break;
    }
  }

  // --- MESSAGE LISTENER FROM EXTENSION TOOLBAR ---
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'toggleSidebar') {
        toggleSidebar();
        sendResponse({ open: STATE.isSidebarOpen });
        return true;
      } else if (req.action === 'openSidebar') {
        openSidebar();
        sendResponse({ open: true });
        return true;
      } else if (req.action === 'closeSidebar') {
        closeSidebar();
        sendResponse({ open: false });
        return true;
      } else if (req.action === 'start') {
        openSidebar();
        startAutomation();
        sendResponse({ status: STATE.status });
        return true;
      } else if (req.action === 'stop') {
        stopAutomation('Apturēts no rīkjoslas.');
        sendResponse({ status: STATE.status });
        return true;
      } else if (req.action === 'getState') {
        const ind = checkAllIndicators();
        const elapsed = STATE.startTime ? Math.floor((Date.now() - STATE.startTime) / 1000) : 0;
        sendResponse({
          status: STATE.status,
          elapsed: elapsed,
          isSidebarOpen: STATE.isSidebarOpen,
          orderCode: getOrderCode(),
          states: ind.states
        });
        return true;
      }
    });
  }

  // --- INITIALIZATION ---
  function init() {
    if (!CONFIG.targetUrlRegex.test(window.location.href)) {
      return;
    }

    createSidebarUI();
    console.log(`[Austra Addon v${CURRENT_VERSION}] Sānu panelis sekmīgi inicializēts.`);

    // 1. Pārbaudām, vai šis pasūtījums tikko tika pabeigts pirms lapas pārlādes!
    const currentCode = getOrderCode();
    let justCompleted = null;
    try {
      justCompleted = sessionStorage.getItem(`austra_completed_${currentCode}`);
    } catch (e) {}

    if (justCompleted && (Date.now() - parseInt(justCompleted, 10) < 60000)) {
      try {
        sessionStorage.removeItem(`austra_completed_${currentCode}`);
      } catch (e) {}
      clearSessionState();
      STATE.status = 'COMPLETED';
      updateUIState();
      updateIndicatorBadges();
      logActivity(`Veiksmīgi pabeigts pasūtījumam ${currentCode}!`);
      playSound('success');
      sendNotification(
        'Austra ERP: Statuss nomainīts!',
        `Pasūtījums ${currentCode} ir veiksmīgi rezervēts un nodots "Uz ražošanu".`
      );
    } else {
      // 2. Pārbaudām, vai šim pasūtījumam jau bija aktīvs process pirms lapas pārlādes!
      const savedSession = loadSessionState();
      if (savedSession && (savedSession.status === 'WAITING' || savedSession.status === 'RESERVING')) {
        STATE.status = 'WAITING';
        STATE.startTime = savedSession.startTime;
        saveSessionState();

        updateUIState();
        updateIndicatorBadges();

        if (STATE.timerInterval) clearInterval(STATE.timerInterval);
        STATE.timerInterval = setInterval(updateTimer, 1000);
        updateTimer();

        logActivity('Turpinu uzraudzību pēc lapas pārlādes...');

        const check = updateIndicatorBadges();
        if (check.allGreen) {
          logActivity('🎉 Visi 3 indikatori jau ir zaļi! Mainu statusu...');
          completeStatusChange();
        } else {
          startMonitoring();
        }
      }
    }

    // Automātiska atjauninājumu pārbaude fonā (pēc 2.5 sekundēm)
    setTimeout(() => {
      checkForUpdates(false);
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
