import { initDB } from './db.js';
import { state } from './state.js';
import { setupCanvas } from './canvas.js';
import { setupColorPicker } from './colorpicker.js';
import { renderCalendar } from './calendar.js';
import { renderGallery } from './gallery.js';

const fallbackThemes = ["笑っている人", "猫", "犬", "ラーメン", "古い建物", "サイバーパンク"];

const DEFAULT_THEMES_KEY = 'custom_themes';

async function loadThemes() {
  const saved = localStorage.getItem(DEFAULT_THEMES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved themes", e);
    }
  }

  try {
    const res = await fetch('/themes.json');
    if (!res.ok) throw new Error('Network response was not ok');
    const fetched = await res.json();
    localStorage.setItem(DEFAULT_THEMES_KEY, JSON.stringify(fetched));
    return fetched;
  } catch(e) {
    console.warn("Failed to load themes.json, using fallback", e);
    localStorage.setItem(DEFAULT_THEMES_KEY, JSON.stringify(fallbackThemes));
    return fallbackThemes;
  }
}

function initThemesUI() {
  const editor = document.getElementById('themes-editor');
  const btnReset = document.getElementById('btn-reset-themes');
  const btnSave = document.getElementById('btn-save-themes');

  if (editor) {
    editor.value = themeList.join('\n');
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (confirm("お題リストを初期状態（デフォルト）に戻します。よろしいですか？")) {
        localStorage.removeItem(DEFAULT_THEMES_KEY);
        themeList = await loadThemes();
        usedThemes = [];
        if (editor) editor.value = themeList.join('\n');
        alert("初期化しました！");
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if (!editor) return;
      const lines = editor.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        alert("エラー：お題は最低でも1つ以上入力してください。");
        return;
      }
      themeList = lines;
      usedThemes = [];
      localStorage.setItem(DEFAULT_THEMES_KEY, JSON.stringify(lines));
      alert("お題リストを保存しました！");
    });
  }
}

let themeList = [];
let usedThemes = [];

export async function getRandomTheme() {
  if (themeList.length === 0) {
    themeList = await loadThemes();
  }
  
  let availableThemes = themeList.filter(t => !usedThemes.includes(t));
  if (availableThemes.length === 0) {
    // 全て消費した場合はリセット
    usedThemes = [];
    availableThemes = [...themeList];
  }
  
  const index = Math.floor(Math.random() * availableThemes.length);
  const selectedTheme = availableThemes[index];
  usedThemes.push(selectedTheme);
  return selectedTheme;
}

function applyChaoticTheme(text) {
  const container = document.querySelector('#current-theme span');
  container.innerHTML = '';
  text.split('').forEach((char, i) => {
    if (char.trim() === '') {
      container.appendChild(document.createTextNode(char));
      return;
    }
    const span = document.createElement('span');
    span.textContent = char;
    const y = (i % 2 === 0 ? -1 : 1) * (Math.floor(Math.random() * 6) + 3); // 3 to 8px
    const r = (i % 2 === 0 ? 1 : -1) * (Math.floor(Math.random() * 8) + 3); // 3 to 10deg
    span.style.display = 'inline-block';
    span.style.transform = `translateY(${y}px) rotate(${r}deg)`;
    container.appendChild(span);
  });
}

async function requestPersist() {
  if (navigator.storage && navigator.storage.persist) {
    const persisted = await navigator.storage.persisted();
    if (!persisted) {
      const granted = await navigator.storage.persist();
      if (!granted && !localStorage.getItem('persist_warned')) {
        alert("【お知らせ】ご使用の端末では、ストレージ容量が不足すると自動的にデータが消去される可能性があります。端末の空き容量に余裕を持たせてください。");
        localStorage.setItem('persist_warned', 'true');
      }
    }
  }
}

async function init() {
  await requestPersist();
  await initDB();
  const theme = await getRandomTheme();
  applyChaoticTheme(theme);
  state.theme = theme;

  setupCanvas();
  setupColorPicker();
  initThemesUI();
  
  // Tab handling
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
      });
      
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const targetView = document.getElementById('view-' + tabId);
      targetView.classList.remove('hidden');
      targetView.classList.add('active');
      
      state.currentTab = tabId;
      if (tabId === 'calendar') renderCalendar();
      if (tabId === 'gallery') renderGallery();
    });
  });

  // Refresh theme button
  document.getElementById('refresh-theme-btn').addEventListener('click', async () => {
    const newTheme = await getRandomTheme();
    applyChaoticTheme(newTheme);
    state.theme = newTheme;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(e => {
    console.error("Initialization failed:", e);
    
    const container = document.createElement('div');
    container.style.cssText = 'padding: 20px; color: red;';
    
    const h1 = document.createElement('h1');
    h1.textContent = 'アプリの起動に失敗しました';
    
    const p = document.createElement('p');
    p.textContent = 'ページをリロードしてください。データが壊れている場合はIndexedDBをクリアしてください。';
    
    const pre = document.createElement('pre');
    pre.textContent = e.message;
    
    container.appendChild(h1);
    container.appendChild(p);
    container.appendChild(pre);
    
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });
});
