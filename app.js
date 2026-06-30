/* ==========================================================================
   HELIXA — Core App Logic
   Storage keys:
     helixa_settings        -> global settings object
     helixa_records         -> array of computation records
     helixa_theme           -> 'light' | 'dark'
   ========================================================================== */

const HELIXA = (() => {

  const STORAGE_KEYS = {
    settings: 'helixa_settings',
    records: 'helixa_records',
    theme: 'helixa_theme'
  };

  const DEFAULT_SETTINGS = {
    scoreStructure: { ca1Max: 20, ca2Max: 20, examMax: 60 },
    gradeBoundaries: [
      { label: 'Excellent', min: 75, max: 100, color: '#1FB87A' },
      { label: 'Very Good', min: 65, max: 74,  color: '#1E5FFF' },
      { label: 'Good',      min: 50, max: 64,  color: '#F5C518' },
      { label: 'Fair',      min: 40, max: 49,  color: '#F5A623' },
      { label: 'Fail',      min: 0,  max: 39,  color: '#E5484D' }
    ],
    autoSave: true
  };

  // ---- Settings ----

  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (!raw) return structuredCloneSafe(DEFAULT_SETTINGS);
      const parsed = JSON.parse(raw);
      // shallow-merge to guard against missing keys from older versions
      return {
        ...structuredCloneSafe(DEFAULT_SETTINGS),
        ...parsed,
        scoreStructure: { ...DEFAULT_SETTINGS.scoreStructure, ...(parsed.scoreStructure || {}) },
        gradeBoundaries: parsed.gradeBoundaries && parsed.gradeBoundaries.length
          ? parsed.gradeBoundaries
          : structuredCloneSafe(DEFAULT_SETTINGS.gradeBoundaries)
      };
    } catch (e) {
      return structuredCloneSafe(DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  function resetSettings() {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    return structuredCloneSafe(DEFAULT_SETTINGS);
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ---- Records (History) ----

  function getRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.records);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function getRecord(id) {
    return getRecords().find(r => r.id === id) || null;
  }

  function saveRecord(record) {
    const records = getRecords();
    const idx = records.findIndex(r => r.id === record.id);
    record.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      records[idx] = record;
    } else {
      record.createdAt = record.createdAt || new Date().toISOString();
      records.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
    return record;
  }

  function deleteRecord(id) {
    const records = getRecords().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
  }

  function clearAllRecords() {
    localStorage.removeItem(STORAGE_KEYS.records);
  }

  // find subject records matching a class/session/term, for import into class teacher sheet
  function findSubjectRecords(className, session, term) {
    return getRecords().filter(r =>
      r.type === 'subject' &&
      r.className === className &&
      r.session === session &&
      r.term === term
    );
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ---- Ranking (competition / "1224" ranking) ----
  // Equal totals share the same rank; the next distinct value skips ranks accordingly.
  function computeRanks(items, valueKey) {
    const sorted = [...items].sort((a, b) => b[valueKey] - a[valueKey]);
    let rank = 0;
    let lastValue = null;
    let seen = 0;
    const rankMap = new Map();
    sorted.forEach(item => {
      seen++;
      if (item[valueKey] !== lastValue) {
        rank = seen;
        lastValue = item[valueKey];
      }
      rankMap.set(item, rank);
    });
    return items.map(item => rankMap.get(item));
  }

  // ---- Grade / remark lookup ----

  function getGradeForScore(score, boundaries) {
    const b = boundaries.find(b => score >= b.min && score <= b.max);
    return b || boundaries[boundaries.length - 1];
  }

  function gradeBadgeClass(label) {
    const map = {
      'Excellent': 'badge-excellent',
      'Very Good': 'badge-verygood',
      'Good': 'badge-good',
      'Fair': 'badge-fair',
      'Fail': 'badge-fail'
    };
    return map[label] || 'badge-fail';
  }

  // ---- Validation ----

  function isValidNumber(val) {
    if (val === '' || val === null || val === undefined) return false;
    const n = Number(val);
    return !isNaN(n) && isFinite(n);
  }

  function validateScore(val, max) {
    if (!isValidNumber(val)) return { valid: false, message: 'Enter a valid number' };
    const n = Number(val);
    if (n < 0) return { valid: false, message: 'Cannot be negative' };
    if (n > max) return { valid: false, message: `Cannot exceed ${max}` };
    return { valid: true };
  }

  function validateRequired(val) {
    return val !== null && val !== undefined && String(val).trim() !== '';
  }

  // ---- Theme ----

  function getTheme() {
    return localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  }

  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function initTheme() {
    setTheme(getTheme());
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }

  // ---- Toast ----

  let toastTimeout;
  function showToast(message, type) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ` toast-${type}` : '');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  }

  // ---- Navbar / Drawer ----

  function initChrome(activePage) {
    initTheme();

    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => toggleTheme());
    }

    const menuBtn = document.querySelector('.menu-btn');
    const drawer = document.querySelector('.drawer');
    const overlay = document.querySelector('.drawer-overlay');
    const closeBtn = document.querySelector('.drawer-close');

    function openDrawer() {
      drawer.classList.add('open');
      overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }

    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) closeDrawer();
    });

    if (activePage) {
      document.querySelectorAll('.drawer-link').forEach(link => {
        if (link.dataset.page === activePage) link.classList.add('active');
      });
    }
  }

  // ---- Scroll reveal ----

  function initScrollReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(i => i.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach(i => observer.observe(i));
  }

  // ---- Date formatting ----

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return {
    DEFAULT_SETTINGS,
    getSettings, saveSettings, resetSettings,
    getRecords, getRecord, saveRecord, deleteRecord, clearAllRecords, findSubjectRecords,
    uuid, computeRanks, getGradeForScore, gradeBadgeClass,
    isValidNumber, validateScore, validateRequired,
    getTheme, setTheme, initTheme, toggleTheme,
    showToast, initChrome, initScrollReveal, formatDate
  };

})();

document.addEventListener('DOMContentLoaded', () => {
  HELIXA.initTheme();
});
