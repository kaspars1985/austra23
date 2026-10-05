document.addEventListener('DOMContentLoaded', async () => {
  const statusIcon = document.getElementById('tab-status-icon');
  const statusText = document.getElementById('tab-status-text');
  const statusDesc = document.getElementById('tab-status-desc');
  const soundBtn = document.getElementById('btn-test-sound');
  const actionBtn = document.getElementById('btn-popup-action');
  const timerEl = document.getElementById('popup-timer');
  const indicatorsList = document.getElementById('popup-indicators');

  const dotCutrite = document.getElementById('pop-dot-cutrite');
  const dotBom = document.getElementById('pop-dot-bom');
  const dotAssembly = document.getElementById('pop-dot-assembly');

  let activeTab = null;
  let pollInterval = null;

  async function getActiveTab() {
    if (!chrome || !chrome.tabs) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function isOrderUrl(url) {
    if (!url) return false;
    return url.includes('/order_management/orders/') || url.includes('mock_austra_page');
  }

  async function ensureContentScriptInjected(tabId) {
    try {
      if (chrome.scripting) {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['styles.css']
        }).catch(() => {});

        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Script injection failed:', e);
    }
  }

  function sendMessageToTab(message) {
    return new Promise((resolve) => {
      if (!activeTab || !activeTab.id) return resolve(null);
      chrome.tabs.sendMessage(activeTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  function updatePopupUI(state) {
    if (!state) return;

    actionBtn.style.display = 'flex';
    indicatorsList.style.display = 'flex';
    timerEl.style.display = 'inline-block';

    // Format timer
    const elapsed = state.elapsed || 0;
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    timerEl.innerText = `${m}:${s}`;

    // Update dots
    const updateDot = (el, dotState) => {
      if (!el || !dotState) return;
      el.className = 'dot-badge';
      if (dotState.isGreen) el.classList.add('green');
      else if (dotState.isRed) el.classList.add('error');
      else el.classList.add('pending');
    };

    if (state.states) {
      updateDot(dotCutrite, state.states.cutrite);
      updateDot(dotBom, state.states.bom);
      updateDot(dotAssembly, state.states.assembly);
    }

    // Status state
    switch (state.status) {
      case 'IDLE':
        statusIcon.innerText = '⚪';
        statusText.innerText = state.orderCode ? `${state.orderCode}: Gatavs` : 'Gatavs darbam';
        statusDesc.innerText = 'Spiediet zaļo pogu, lai sāktu automātisko rezervāciju un nodošanu ražošanā.';
        actionBtn.className = 'btn-main btn-start';
        actionBtn.innerText = '🚀 Sākt auto-rezervāciju';
        break;
      case 'RESERVING':
      case 'WAITING':
        statusIcon.innerText = '🔄';
        statusText.innerText = 'Gaida 3 zaļos punktus...';
        statusDesc.innerText = 'Process norit fonā. Kad visi kļūs zaļi, statuss tiks nomainīts.';
        actionBtn.className = 'btn-main btn-stop';
        actionBtn.innerText = '⏹ Apturēt procesu';
        break;
      case 'CHANGING_STATUS':
        statusIcon.innerText = '⚙️';
        statusText.innerText = 'Maina statusu...';
        statusDesc.innerText = 'Tiek uzlikts "Uz ražošanu"...';
        actionBtn.className = 'btn-main btn-stop';
        actionBtn.innerText = 'Maina statusu...';
        break;
      case 'COMPLETED':
        statusIcon.innerText = '🎉';
        statusText.innerText = 'Nodots ražošanā!';
        statusDesc.innerText = 'Viss veiksmīgi pabeigts!';
        actionBtn.className = 'btn-main btn-done';
        actionBtn.innerText = '✅ Pabeigts! (Palaist atkal)';
        break;
      case 'ERROR':
        statusIcon.innerText = '⚠️';
        statusText.innerText = 'Radās kļūda vai taimauts';
        statusDesc.innerText = 'Pārbaudiet pasūtījuma stāvokli lapā.';
        actionBtn.className = 'btn-main btn-start';
        actionBtn.innerText = '🔄 Mēģināt vēlreiz';
        break;
    }
  }

  async function checkAndSync() {
    activeTab = await getActiveTab();
    if (!activeTab || !isOrderUrl(activeTab.url)) {
      statusIcon.innerText = 'ℹ️';
      statusText.innerText = 'Nav pasūtījuma lapa';
      statusDesc.innerText = 'Atveriet pasūtījumu: https://austra.amfurnitura.lv/order_management/orders/...';
      actionBtn.style.display = 'none';
      indicatorsList.style.display = 'none';
      timerEl.style.display = 'none';
      return;
    }

    // Try getting state
    let state = await sendMessageToTab({ action: 'getState' });
    if (!state) {
      // Content script was not injected yet; inject dynamically
      await ensureContentScriptInjected(activeTab.id);
      // Wait a moment and retry
      await new Promise(r => setTimeout(r, 200));
      state = await sendMessageToTab({ action: 'getState' });
    }

    if (state) {
      updatePopupUI(state);
    } else {
      statusIcon.innerText = '🔄';
      statusText.innerText = 'Pasūtījuma lapa atvērta';
      statusDesc.innerText = 'Pārlādējiet pasūtījuma lapu (F5), lai aktivizētu paplašinājumu.';
      actionBtn.style.display = 'none';
    }
  }

  // Action button click
  actionBtn.addEventListener('click', async () => {
    let state = await sendMessageToTab({ action: 'getState' });
    if (!state) {
      await ensureContentScriptInjected(activeTab.id);
      state = await sendMessageToTab({ action: 'getState' });
    }

    if (state && (state.status === 'WAITING' || state.status === 'RESERVING')) {
      await sendMessageToTab({ action: 'stop' });
    } else {
      await sendMessageToTab({ action: 'start' });
    }

    // Immediately refresh state
    const newState = await sendMessageToTab({ action: 'getState' });
    updatePopupUI(newState);
  });

  // Sound test button
  soundBtn.addEventListener('click', () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.55);
      });
    } catch (e) {
      console.warn('Audio test failed:', e);
    }
  });

  // Initial sync and polling
  await checkAndSync();
  pollInterval = setInterval(async () => {
    if (activeTab && isOrderUrl(activeTab.url)) {
      const state = await sendMessageToTab({ action: 'getState' });
      if (state) updatePopupUI(state);
    }
  }, 1000);
});
