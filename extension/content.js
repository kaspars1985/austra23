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
  const CURRENT_VERSION = '1.2.0';
  const GITHUB_REPO_URL = 'https://github.com/kaspars1985/austra23';
  const GITHUB_RAW_MANIFEST = 'https://raw.githubusercontent.com/kaspars1985/austra23/main/extension/manifest.json';

  const CONFIG = {
    maxTimeoutMs: 15 * 60 * 1000, // 15 minūtes
    pollIntervalMs: 1500,          // pārbaude ik pēc 1.5 sekundēm
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
      const matches = Array.from(document.querySelectorAll(selector));
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

    const className = el.className || '';
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor || '';
    const rgb = parseRgb(bg);

    // 1. Klases pārbaude (Austra ERP zaļās klases nosaukums ir jfxJkt)
    if (className.includes('jfxJkt') || className.includes('bg-success') || className.includes('text-success') || className.includes('success')) {
      return { exists: true, isGreen: true, isRed: false, isPending: false };
    }
    if (className.includes('bg-danger') || className.includes('is-invalid') || className.includes('error') || className.includes('danger')) {
      return { exists: true, isGreen: false, isRed: true, isPending: false };
    }

    // 2. RGB krāsu pārbaude (Austra zaļais: rgb(138, 209, 107), tukšais pelēkais: rgb(231, 234, 239))
    if (rgb) {
      // Tukšais punkts ir pelēks (r, g, b ļoti tuvu viens otram ap 230)
      const isGrey = (Math.abs(rgb.r - 231) < 18 && Math.abs(rgb.g - 234) < 18 && Math.abs(rgb.b - 239) < 18) ||
                     (Math.abs(rgb.r - rgb.g) < 12 && Math.abs(rgb.g - rgb.b) < 12);

      // Zaļā krāsa (Austra zaļais vai vispārējs zaļais ar g dominanci)
      const isAustraGreen = (Math.abs(rgb.r - 138) < 30 && Math.abs(rgb.g - 209) < 30 && Math.abs(rgb.b - 107) < 30);
      const isGenericGreen = (rgb.g > 105 && rgb.g > rgb.r * 1.1 && rgb.g > rgb.b * 1.1);

      if ((isAustraGreen || isGenericGreen) && !isGrey) {
        return { exists: true, isGreen: true, isRed: false, isPending: false };
      }

      if (rgb.r > 150 && rgb.r > rgb.g * 1.3 && rgb.r > rgb.b * 1.3) {
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

  async function triggerStatusChangeToManufacturing() {
    logActivity('Meklē izvēlni "Mainīt statusu"...');

    // 1. Meklējam pogu "Mainīt statusu"
    const dropdownBtns = Array.from(document.querySelectorAll('button.dropdown-toggle, .dropdown-toggle, button'));
    const changeStatusBtn = dropdownBtns.find(b => /mainīt statusu/i.test(b.innerText || ''));

    if (changeStatusBtn) {
      logActivity('Atver statusa izvēlni...');
      dispatchClick(changeStatusBtn);
      await new Promise(r => setTimeout(r, 200));
    }

    // 2. Meklējam statusa opciju "Uz ražošanu"
    const menuLinks = Array.from(document.querySelectorAll('a[data-action="manufacturing"], a, button, .dropdown-item'));
    const manufacturingLink = menuLinks.find(a => {
      const action = a.getAttribute('data-action') || '';
      const text = (a.innerText || '').trim();
      return action === 'manufacturing' || /uz ražošanu/i.test(text);
    });

    if (!manufacturingLink) {
      throw new Error('Neizdevās atrast izvēles opciju "Uz ražošanu"!');
    }

    logActivity('Nospiež "Uz ražošanu"...');
    dispatchClick(manufacturingLink);
    manufacturingLink.click();
    logActivity('Statuss nomainīts uz "Uz ražošanu"!');
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

    // 1. Labās malas cilne (Pull-Tab)
    pullTabEl = document.createElement('div');
    pullTabEl.id = 'austra-sidebar-tab';
    pullTabEl.className = 'hidden'; // sākotnēji paslēpta, jo panelis atvērsies uzreiz
    pullTabEl.innerHTML = `<span>⚡</span><span>Auto-Ražošana ◀</span>`;
    pullTabEl.title = 'Atvērt Austra Auto-Ražošanas sānu paneli';
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
          <span>⚡</span> Austra Auto-Ražošana
        </div>
        <div class="austra-sidebar-header-btns">
          <button class="austra-header-btn" id="austra-btn-collapse" title="Sakļaut paneli un atjaunot pilnu lapas platumu">
            Sakļaut ▶
          </button>
        </div>
      </div>

      <div class="austra-sidebar-body">
        <div class="austra-order-card">
          <div class="austra-order-label">Aktīvais pasūtījums</div>
          <div class="austra-order-code" id="austra-display-order">${orderCode}</div>
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
          <div class="austra-section-title">Darbību žurnāls</div>
          <div class="austra-log-view" id="austra-sidebar-log">Gaidu palaišanu...</div>
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
    if (logBox) {
      const time = new Date().toLocaleTimeString('lv-LV', { hour12: false });
      logBox.innerText = `[${time}] ${text}\n` + logBox.innerText.slice(0, 300);
    }
  }

  function updateIndicatorBadges() {
    const res = checkAllIndicators();
    const updateBadge = (id, dotState) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'austra-dot-badge';
      if (dotState.isGreen) el.classList.add('green');
      else if (dotState.isRed) el.classList.add('error');
      else el.classList.add('pending');
    };

    updateBadge('austra-sidebar-dot-cutrite', res.states.cutrite);
    updateBadge('austra-sidebar-dot-bom', res.states.bom);
    updateBadge('austra-sidebar-dot-assembly', res.states.assembly);

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

  async function startAutomation() {
    logActivity('Auto-rezervācijas process uzsākts!');
    STATE.status = 'RESERVING';
    STATE.startTime = Date.now();

    updateUIState();

    if (STATE.timerInterval) clearInterval(STATE.timerInterval);
    STATE.timerInterval = setInterval(updateTimer, 1000);

    const initialCheck = updateIndicatorBadges();
    if (initialCheck.allGreen) {
      logActivity('Visi 3 indikatori jau ir zaļi! Mainām statusu...');
      await completeStatusChange();
      return;
    }

    const reserveBtn = findReserveButton();
    if (reserveBtn) {
      logActivity('Nospiež "Rezervēt materiālus"...');
      reserveBtn.click();
    } else {
      logActivity('Poga "Rezervēt materiālus" netika atrasta (iespējams, jau nospiesta). Turpinu novērošanu.');
    }

    STATE.status = 'WAITING';
    updateUIState();
    startMonitoring();
  }

  function startMonitoring() {
    if (STATE.pollInterval) clearInterval(STATE.pollInterval);

    STATE.pollInterval = setInterval(async () => {
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

    if (!STATE.observer) {
      STATE.observer = new MutationObserver(() => {
        const res = updateIndicatorBadges();
        if (res.allGreen && STATE.status === 'WAITING') {
          logActivity('🎉 Indikatoru izmaiņas pamanītas! Mainu statusu...');
          if (STATE.pollInterval) clearInterval(STATE.pollInterval);
          STATE.pollInterval = null;
          completeStatusChange();
        }
      });
      STATE.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  async function completeStatusChange() {
    STATE.status = 'CHANGING_STATUS';
    updateUIState();

    try {
      await triggerStatusChangeToManufacturing();

      STATE.status = 'COMPLETED';
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
    STATE.status = 'IDLE';
    stopTimer();
    updateUIState();
  }

  function handleTimeout() {
    stopTimer();
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
    if (STATE.observer) {
      STATE.observer.disconnect();
      STATE.observer = null;
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
