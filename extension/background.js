// Fona servisa darbinieks (Background service worker)
// Saglabājam paziņojuma un cilnes (tab) sasaisti, lai, uzklikšķinot uz paziņojuma, atvērtu konkrēto pasūtījumu
const notificationTabs = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'notify') {
    const iconUrl = chrome.runtime.getURL('icons/icon128.png');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: request.title || 'Austra ERP',
      message: request.message || '',
      priority: 2
    }, (notificationId) => {
      if (sender && sender.tab && sender.tab.id) {
        notificationTabs[notificationId] = {
          tabId: sender.tab.id,
          windowId: sender.tab.windowId
        };
      }
      sendResponse({ status: 'ok', id: notificationId });
    });
    return true; // Keep message channel open for async response
  }
});

// Kad lietotājs uzklikšķina uz Windows/Edge paziņojuma, uzreiz aktivizējam tieši to cilni!
chrome.notifications.onClicked.addListener((notificationId) => {
  const info = notificationTabs[notificationId];
  if (info) {
    if (info.windowId) {
      chrome.windows.update(info.windowId, { focused: true }).catch(() => {});
    }
    chrome.tabs.update(info.tabId, { active: true }).catch(() => {});
    delete notificationTabs[notificationId];
  }
});

// Klikšķis uz paplašinājuma ikonas rīkjoslā tieši atver/aizver sānu paneli lapā
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) return;

  const isOrderPage = tab.url.includes('/order_management/orders/') || tab.url.includes('mock_austra_page');
  if (!isOrderPage) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Austra ERP',
      message: 'Lūdzu, atveriet pasūtījuma lapu: https://austra.amfurnitura.lv/order_management/orders/...',
      priority: 1
    });
    return;
  }

  // Mēģinām nosūtīt ziņu uz content script
  chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      // Skripts vēl nebija ielādēts – dinamiski injicējam un atveram paneli
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles.css']
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // Pēc injekcijas nosūtām toggle
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'openSidebar' });
        }, 150);
      } catch (err) {
        console.warn('Script injection failed:', err);
      }
    }
  });
});
