export const STORAGE_KEY = 'foodbliz_rider_restaurant';

export function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function isValidHttpsBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function buildDeliveryUrl(entry) {
  if (!entry || !isValidHttpsBaseUrl(entry.baseUrl)) {
    throw new Error('Invalid restaurant URL configuration');
  }
  const cleanBase = entry.baseUrl.replace(/\/+$/, '');
  const path = entry.deliveryPath && entry.deliveryPath.startsWith('/')
    ? entry.deliveryPath
    : '/delivery';
  return `${cleanBase}${path}`;
}

export function resolveRestaurant(directory, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code || !directory || typeof directory !== 'object') return null;
  const entry = directory[code];
  if (!entry || entry.active === false) return null;
  if (!isValidHttpsBaseUrl(entry.baseUrl)) return null;
  return {
    code,
    name: String(entry.name || code),
    baseUrl: entry.baseUrl.replace(/\/+$/, ''),
    deliveryPath: entry.deliveryPath || '/delivery'
  };
}

function getSavedRestaurant() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && isValidHttpsBaseUrl(parsed.baseUrl)) return parsed;
  } catch {}
  return null;
}

function saveRestaurant(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.AndroidNative && typeof window.AndroidNative.setRestaurantBaseUrl === 'function') {
      window.AndroidNative.setRestaurantBaseUrl(record.baseUrl);
    }
  } catch {}
}

function clearSavedRestaurant() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.AndroidNative && typeof window.AndroidNative.clearRestaurantBaseUrl === 'function') {
      window.AndroidNative.clearRestaurantBaseUrl();
    }
  } catch {}
}

async function fetchDirectory() {
  const res = await fetch(`/restaurants.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not load restaurant directory (${res.status})`);
  }
  return res.json();
}

function redirectToPortal(record) {
  saveRestaurant(record);
  window.location.replace(buildDeliveryUrl(record));
}

function initLauncher() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const form = document.getElementById('restaurant-code-form');
  const input = document.getElementById('restaurant-code-input');
  const errorEl = document.getElementById('form-error');
  const connectBtn = document.getElementById('btn-connect');
  const connectText = document.getElementById('btn-connect-text');
  const savedBanner = document.getElementById('saved-banner');
  const savedNameEl = document.getElementById('saved-restaurant-name');
  const btnContinueSaved = document.getElementById('btn-continue-saved');
  const btnResetSaved = document.getElementById('btn-reset-saved');

  if (!form || !input) return;

  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };

  const clearError = () => {
    errorEl.textContent = '';
    errorEl.hidden = true;
  };

  const params = new URLSearchParams(window.location.search);
  const isSwitching = params.get('switch') === 'true';
  const queryCode = normalizeCode(params.get('code') || '');

  if (isSwitching) {
    clearSavedRestaurant();
  }

  const saved = getSavedRestaurant();
  if (saved && !isSwitching && !queryCode) {
    // Auto-redirect returning riders straight to their saved restaurant
    redirectToPortal(saved);
    return;
  }

  if (saved && savedBanner && savedNameEl) {
    savedNameEl.textContent = `${saved.name} (${saved.code})`;
    savedBanner.hidden = false;
    if (btnResetSaved) btnResetSaved.hidden = false;
    if (btnContinueSaved) {
      btnContinueSaved.addEventListener('click', () => redirectToPortal(saved));
    }
  }

  if (btnResetSaved) {
    btnResetSaved.addEventListener('click', () => {
      clearSavedRestaurant();
      if (savedBanner) savedBanner.hidden = true;
      btnResetSaved.hidden = true;
      input.focus();
    });
  }

  async function submitCode(rawCode) {
    clearError();
    const cleaned = normalizeCode(rawCode);
    if (!cleaned) {
      showError('Please enter your restaurant code.');
      return;
    }

    connectBtn.disabled = true;
    connectText.textContent = 'Connecting...';

    try {
      const directory = await fetchDirectory();
      const match = resolveRestaurant(directory, cleaned);
      if (!match) {
        showError(`Code "${cleaned}" was not found. Please check with your manager.`);
        connectBtn.disabled = false;
        connectText.textContent = 'Continue to Rider Portal';
        return;
      }
      redirectToPortal(match);
    } catch (err) {
      showError('Could not connect right now. Check your internet and try again.');
      connectBtn.disabled = false;
      connectText.textContent = 'Continue to Rider Portal';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitCode(input.value);
  });

  if (queryCode) {
    input.value = queryCode;
    submitCode(queryCode);
  }
}

initLauncher();
