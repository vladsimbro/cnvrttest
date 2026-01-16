(function(){
  const APP_VERSION = window.APP_VERSION || '1.2.4';

  const historyKey = 'uuid_converter_history';
  const prefsKey = 'uuid_converter_prefs';
  const inputSaveKey = 'uuid_converter_input';
  const versionKey = 'uuid_converter_version';

  const MAX_HISTORY = 200;

  // Version migration notice
  try {
    const prev = localStorage.getItem(versionKey);
    if (prev !== APP_VERSION) {
      localStorage.setItem(versionKey, APP_VERSION);
      try { localStorage.removeItem(inputSaveKey); } catch (e) {}

      try {
        const raw = localStorage.getItem(prefsKey);
        if (raw) {
          const obj = JSON.parse(raw);
          const safe = { theme: obj.theme || 'light', accent: obj.accent || '#2b7be4' };
          localStorage.setItem(prefsKey, JSON.stringify(safe));
        }
      } catch (e) {}

      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('updateNotice');
        if(!el) return;
        el.style.display = 'block';
        el.innerHTML = 'Обновление: загружена версия ' + APP_VERSION +
          '. Если интерфейс отображается некорректно — <button id="reloadForUpdate" type="button">Перезагрузить</button>.';
        const btn = document.getElementById('reloadForUpdate');
        if(btn) btn.addEventListener('click', () => location.reload());
      });
    }
  } catch (e) {}

  // semver
  function compareSemver(a,b){
    if(!a || !b) return 0;
    const pa = String(a).split('.').map(n=>parseInt(n,10)||0);
    const pb = String(b).split('.').map(n=>parseInt(n,10)||0);
    for(let i=0;i<Math.max(pa.length,pb.length);i++){
      const na = pa[i]||0, nb = pb[i]||0;
      if(na>nb) return 1;
      if(na<nb) return -1;
    }
    return 0;
  }

  function showUpdateToast(remoteVer){
    const root = document.getElementById('updateToastRoot');
    if(!root) return;
    if(root.querySelector('.update-toast')) return;

    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.innerHTML = `
      <div class="ut-message">Доступна новая версия: <strong>${remoteVer}</strong>. Обновить интерфейс?</div>
      <div class="ut-actions">
        <button class="ut-btn primary" id="updateNow" type="button">Обновить</button>
        <button class="ut-btn ghost" id="dismissUpdate" type="button" aria-label="Закрыть">Закрыть</button>
      </div>
    `;

    root.appendChild(toast);
    requestAnimationFrame(()=> toast.classList.add('show'));

    const btn = toast.querySelector('#updateNow');
    const dismiss = toast.querySelector('#dismissUpdate');

    if(btn) btn.addEventListener('click', ()=> location.reload());
    if(dismiss) dismiss.addEventListener('click', ()=>{
      toast.classList.remove('show');
      setTimeout(()=> toast.remove(), 220);
    });

    setTimeout(()=>{
      if(toast && toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(()=> toast.remove(), 220);
      }
    }, 120000);
  }

  async function checkRemoteVersion(){
    try{
      const res = await fetch('version.js?cb=' + Date.now(), { cache: 'no-store' });
      if(!res.ok) return;
      const text = await res.text();
      let parsed;
      try{ parsed = JSON.parse(text); }catch(e){ return; }
      const remote = parsed && parsed.version ? String(parsed.version) : null;
      if(!remote) return;
      if(compareSemver(remote, APP_VERSION) > 0){
        showUpdateToast(remote);
      }
    }catch(e){}
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(checkRemoteVersion, 1500);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // DOM refs
    const input = document.getElementById('input');
    const output = document.getElementById('output');
    const convertBtn = document.getElementById('convert');
    const clearBtn = document.getElementById('clear');
    const copyBtn = document.getElementById('copy');

    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistory = document.getElementById('closeHistory');
    const historyContent = document.getElementById('historyContent');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');

    const mainPanel = document.getElementById('mainPanel');

    const hotkeysBtn = document.getElementById('hotkeysBtn');
    const hotkeysModal = document.getElementById('hotkeysModal');
    const closeHotkeys = document.getElementById('closeHotkeys');

    const paletteControl = document.getElementById('paletteControl');
    const paletteToggle = document.getElementById('paletteToggle');
    const palettePopover = document.getElementById('palettePopover');
    const paletteColor = document.getElementById('paletteColor');
    const palettePresetsContainer = document.getElementById('palettePresets');
    const paletteReset = document.getElementById('paletteReset');

    const themeToggle = document.getElementById('themeToggle');
    const appVersionEl = document.getElementById('appVersion');

    // confirm modal
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmClose = document.getElementById('confirmClose');

    // defaults
    const defaultAccent = '#2b7be4';
    const defaultAccent600 = '#1a5fc1';
    const presets = ['#2b7be4','#16a34a','#7c3aed','#f97316','#ef4444','#0ea5a4'];

    if(appVersionEl) appVersionEl.textContent = 'Версия: ' + APP_VERSION;

    const convertBtnOriginal = convertBtn ? convertBtn.innerHTML : '';
    const copyBtnOriginal = copyBtn ? copyBtn.innerHTML : '';

    // toast (no alert)
    function toast(message, kind='info'){
      const root = document.getElementById('appToastRoot');
      if(!root) return;

      const t = document.createElement('div');
      t.className = 'app-toast ' + (kind || 'info');
      t.textContent = message;
      root.appendChild(t);

      requestAnimationFrame(()=> t.classList.add('show'));
      setTimeout(()=>{
        t.classList.remove('show');
        setTimeout(()=> t.remove(), 240);
      }, 1700);
    }

    // utilities
    function hexToRgb(hex){
      hex = String(hex || '').replace('#','');
      if(hex.length === 3) hex = hex.split('').map(ch=>ch+ch).join('');
      const bigint = parseInt(hex,16) || 0;
      return { r: (bigint>>16)&255, g: (bigint>>8)&255, b: bigint&255 };
    }
    function rgbToHex(r,g,b){
      const toHex = n => ('0'+Math.round(n).toString(16)).slice(-2);
      return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    function rgbToHsl(r,g,b){
      r/=255; g/=255; b/=255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      let h=0, s=0, l=(max+min)/2;
      if(max!==min){
        const d = max-min;
        s = l>0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
          case r: h = (g-b)/d + (g<b?6:0); break;
          case g: h = (b-r)/d + 2; break;
          case b: h = (r-g)/d + 4; break;
        }
        h /= 6;
      }
      return { h: h*360, s: s*100, l: l*100 };
    }
    function hslToRgb(h,s,l){
      h/=360; s/=100; l/=100;
      if(s===0){ const v = Math.round(l*255); return { r:v,g:v,b:v }; }
      function hue2rgb(p,q,t){
        if(t<0) t+=1; if(t>1) t-=1;
        if(t<1/6) return p+(q-p)*6*t;
        if(t<1/2) return q;
        if(t<2/3) return p+(q-p)*(2/3-t)*6;
        return p;
      }
      const q = l<0.5 ? l*(1+s) : l+s - l*s;
      const p = 2*l - q;
      const r = hue2rgb(p,q,h+1/3);
      const g = hue2rgb(p,q,h);
      const b = hue2rgb(p,q,h-1/3);
      return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
    }
    function darkenHex(hex, amountPercent=15){
      const {r,g,b} = hexToRgb(hex);
      const hsl = rgbToHsl(r,g,b);
      hsl.l = Math.max(0, hsl.l - amountPercent);
      const rgb = hslToRgb(hsl.h,hsl.s,hsl.l);
      return rgbToHex(rgb.r,rgb.g,rgb.b);
    }

    // prefs
    let suspendSave = false;

    function savePrefs(){
      if(suspendSave) return;
      const prefs = {
        theme: document.documentElement.getAttribute('data-theme') || 'light',
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || defaultAccent
      };
      try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch(e){}
    }

    function setTheme(theme, persist=true){
      if(theme === 'dark'){
        document.documentElement.setAttribute('data-theme','dark');
        if(themeToggle) themeToggle.setAttribute('aria-pressed','true');
      } else {
        document.documentElement.setAttribute('data-theme','light');
        if(themeToggle) themeToggle.setAttribute('aria-pressed','false');
      }
      if(persist) savePrefs();
    }

    function applyAccent(hex, persist=true){
      if(!hex) return;
      const darker = darkenHex(hex, 18);
      document.documentElement.style.setProperty('--accent', hex);
      document.documentElement.style.setProperty('--accent-600', darker);
      const {r,g,b} = hexToRgb(hex);
      document.documentElement.style.setProperty('--accent-r', r);
      document.documentElement.style.setProperty('--accent-g', g);
      document.documentElement.style.setProperty('--accent-b', b);

      document.querySelectorAll('.swatch').forEach(s=>{
        if(s.dataset.color && s.dataset.color.toLowerCase() === String(hex || '').toLowerCase()) s.classList.add('active');
        else s.classList.remove('active');
      });

      if(paletteColor && paletteColor.value.toLowerCase() !== hex.toLowerCase()) paletteColor.value = hex;
      if(persist) savePrefs();
    }

    function loadPrefs(){
      suspendSave = true;
      try{
        const raw = localStorage.getItem(prefsKey);
        if(!raw){
          setTheme('light', false);
          applyAccent(defaultAccent, false);
        } else {
          const p = JSON.parse(raw);
          setTheme(p?.theme || 'light', false);
          applyAccent(p?.accent || defaultAccent, false);
        }
      }catch(e){
        setTheme('light', false);
        applyAccent(defaultAccent, false);
      }finally{
        suspendSave = false;
        savePrefs();
      }
    }

    if(themeToggle){
      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark', true);
        toast(document.documentElement.getAttribute('data-theme') === 'dark' ? 'Тема: тёмная' : 'Тема: светлая');
      });
    }

    // palette
    function buildPalettePresets(){
      if(!palettePresetsContainer) return;
      palettePresetsContainer.innerHTML = '';
      presets.forEach(col=>{
        const btn = document.createElement('button');
        btn.className = 'swatch';
        btn.style.background = col;
        btn.dataset.color = col;
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Выбрать ' + col);
        btn.addEventListener('click', ()=> { applyAccent(col, true); toast('Цвет акцента сохранён'); });
        palettePresetsContainer.appendChild(btn);
      });
    }

    function openPalette(){
      if(!palettePopover) return;
      palettePopover.classList.add('open');
      palettePopover.setAttribute('aria-hidden','false');
      paletteToggle && paletteToggle.setAttribute('aria-expanded','true');
    }
    function closePalette(){
      if(!palettePopover) return;
      palettePopover.classList.remove('open');
      palettePopover.setAttribute('aria-hidden','true');
      paletteToggle && paletteToggle.setAttribute('aria-expanded','false');
    }

    if(paletteToggle){
      paletteToggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const expanded = paletteToggle.getAttribute('aria-expanded') === 'true';
        expanded ? closePalette() : openPalette();
      });
    }

    document.addEventListener('click', (ev) => {
      if(paletteControl && !paletteControl.contains(ev.target)){
        closePalette();
      }
    });

    paletteColor && paletteColor.addEventListener('input', (e) => { applyAccent(e.target.value, true); });
    paletteReset && paletteReset.addEventListener('click', () => { applyAccent(defaultAccent, true); toast('Цвет сброшен'); });

    // history helpers
    function escapeHtml(unsafe){
      return String(unsafe)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
    }

    function makeId(){
      try{ if(crypto?.randomUUID) return crypto.randomUUID(); }catch(e){}
      return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    }

    function parseNumberedName(name){
      const m = String(name || '').match(/^Запись\s+(\d+)$/i);
      if(!m) return null;
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    function nextFreeIndex(history){
      const used = new Set();
      for(const it of (history || [])){
        const n = parseNumberedName(it?.name);
        if(n) used.add(n);
      }
      let i = 1;
      while(used.has(i)) i++;
      return i;
    }

    function migrateHistoryItems(items){
      const history = (items || []).map(it => ({
        id: it?.id || makeId(),
        time: it?.time || new Date().toISOString(),
        name: (it?.name && String(it.name).trim()) ? String(it.name).trim() : 'Без названия',
        input: it?.input ?? '',
        output: it?.output ?? ''
      }));

      // Migrate old "Без названия" -> "Запись N" without gaps
      const used = new Set();
      for(const it of history){
        const n = parseNumberedName(it.name);
        if(n) used.add(n);
      }
      let counter = 1;
      function getNext(){
        while(used.has(counter)) counter++;
        used.add(counter);
        return counter++;
      }

      for(const it of history){
        if(!it.name || it.name === 'Без названия'){
          const n = getNext();
          it.name = 'Запись ' + n;
        }
      }

      return history;
    }

    function readHistory(){
      let history = [];
      try{ history = JSON.parse(localStorage.getItem(historyKey)) || []; }catch(e){ history = []; }
      return migrateHistoryItems(history);
    }

    function writeHistory(history){
      try{ localStorage.setItem(historyKey, JSON.stringify(history)); }catch(e){}
      updateHistoryBadge(history.length);
    }

    function updateHistoryBadge(len){
      const el = document.getElementById('historyCount');
      if(!el) return;
      el.textContent = String(len || 0);
      if(len && len>0) el.classList.add('visible'); else el.classList.remove('visible');
    }

    function formatTime(t){
      const d = new Date(t);
      if(Number.isNaN(d.getTime())) return String(t || '');
      return d.toLocaleString();
    }

    // modals helpers (focus restore)
    let lastFocus = null;
    function openModal(modal, openerBtn, focusEl){
      if(!modal) return;
      lastFocus = openerBtn || document.activeElement;
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden','false');
        openerBtn && openerBtn.setAttribute('aria-expanded','true');
        (focusEl || modal.querySelector('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'))?.focus();
      });
    }
    function closeModal(modal, openerBtn){
      if(!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden','true');
      openerBtn && openerBtn.setAttribute('aria-expanded','false');
      setTimeout(()=> modal.style.display='none', 220);
      if(lastFocus && lastFocus.focus) setTimeout(()=> lastFocus.focus(), 0);
    }

    function confirmUI({ title='Подтверждение', message='Вы уверены?', okText='Ок', cancelText='Отмена', danger=false }){
      return new Promise(resolve => {
        if(!confirmModal) return resolve(false);

        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmOk.textContent = okText;
        confirmCancel.textContent = cancelText;

        // quick danger hint (no extra CSS)
        if(danger){
          confirmOk.style.background = 'linear-gradient(90deg,#ef4444,#f97316)';
        } else {
          confirmOk.style.background = '';
        }

        const cleanup = () => {
          confirmOk.removeEventListener('click', onOk);
          confirmCancel.removeEventListener('click', onCancel);
          confirmClose.removeEventListener('click', onCancel);
          confirmModal.removeEventListener('click', onOverlay);
          window.removeEventListener('keydown', onKey);
        };

        const onOk = () => { cleanup(); closeModal(confirmModal); resolve(true); };
        const onCancel = () => { cleanup(); closeModal(confirmModal); resolve(false); };
        const onOverlay = (e) => { if(e.target === confirmModal) onCancel(); };
        const onKey = (e) => { if(e.key === 'Escape' && confirmModal.classList.contains('show')) onCancel(); };

        confirmOk.addEventListener('click', onOk);
        confirmCancel.addEventListener('click', onCancel);
        confirmClose.addEventListener('click', onCancel);
        confirmModal.addEventListener('click', onOverlay);
        window.addEventListener('keydown', onKey);

        openModal(confirmModal, document.activeElement, confirmCancel);
      });
    }

    // history operations
    function addToHistory(inputText, outputText){
      const history = readHistory();

      // dedupe same as last
      const top = history[0];
      if(top && top.input === inputText && top.output === outputText){
        updateHistoryBadge(history.length);
        return;
      }

      // get next free index for "Запись N"
      const n = nextFreeIndex(history);
      const rec = {
        id: makeId(),
        time: new Date().toISOString(),
        name: 'Запись ' + n,
        input: inputText,
        output: outputText
      };

      history.unshift(rec);
      if(history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      writeHistory(history);

      toast('Добавлено в историю: ' + rec.name, 'success');
    }

    function renderHistory(){
      const history = readHistory();
      writeHistory(history);

      if(!historyContent) return;
      if(history.length === 0){
        historyContent.textContent = 'Нет записей';
        return;
      }

      historyContent.innerHTML = history.map((it, idx)=>`
        <div class="history-item" data-id="${escapeHtml(it.id)}">
          <div class="history-header" data-idx="${idx}" tabindex="0" aria-expanded="false">
            <div class="hh-left">
              <div class="hh-name" data-role="name">${escapeHtml(it.name || '')}</div>
              <div class="hh-time">${escapeHtml(formatTime(it.time))}</div>
            </div>
            <div class="hh-actions">
              <button type="button" class="hh-btn ghost small" data-action="rename" data-idx="${idx}">Переименовать</button>
              <button type="button" class="hh-btn ghost small danger" data-action="delete" data-idx="${idx}">Удалить</button>
            </div>
          </div>
          <div class="history-body" id="body-${idx}">
            <u>Ввод:</u><pre>${escapeHtml(it.input)}</pre>
            <u>Результат:</u><pre>${escapeHtml(it.output)}</pre>
          </div>
        </div>
      `).join('');
    }

    // Inline rename UI helpers
    function startInlineRename(idx){
      const history = readHistory();
      if(idx < 0 || idx >= history.length) return;

      const header = historyContent.querySelector(`.history-header[data-idx="${idx}"]`);
      if(!header) return;

      // avoid double edit
      if(header.dataset.editing === '1') return;
      header.dataset.editing = '1';

      const actions = header.querySelector('.hh-actions');
      const left = header.querySelector('.hh-left');
      if(!left || !actions) return;

      const currentName = history[idx].name || '';

      // build edit UI
      left.innerHTML = `
        <div class="hh-edit">
          <input class="hh-input" type="text" value="${escapeHtml(currentName).replace(/&quot;/g,'\"')}" aria-label="Название записи" />
          <button type="button" class="hh-btn ghost small" data-action="rename-save" data-idx="${idx}">Сохранить</button>
          <button type="button" class="hh-btn ghost small" data-action="rename-cancel" data-idx="${idx}">Отмена</button>
        </div>
      `;

      // hide right actions while editing
      actions.style.display = 'none';

      const inputEl = left.querySelector('input.hh-input');
      if(inputEl){
        inputEl.focus();
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
      }
    }

    function finishInlineRename(idx, commit){
      const history = readHistory();
      if(idx < 0 || idx >= history.length) return;

      if(commit){
        const header = historyContent.querySelector(`.history-header[data-idx="${idx}"]`);
        const inputEl = header ? header.querySelector('input.hh-input') : null;
        const nextName = (inputEl ? String(inputEl.value).trim() : '').slice(0, 64);
        if(nextName.length === 0){
          toast('Название не изменено (пусто)', 'danger');
        }else{
          history[idx].name = nextName;
          writeHistory(history);
          toast('Название сохранено', 'success');
        }
      }

      // re-render to restore normal layout
      renderHistory();
    }

    if(historyBtn){
      historyBtn.addEventListener('click', () => {
        renderHistory();
        openModal(historyModal, historyBtn, closeHistory || clearHistoryBtn);
      });
    }

    if(closeHistory){
      closeHistory.addEventListener('click', () => closeModal(historyModal, historyBtn));
    }

    if(exportHistoryBtn){
      exportHistoryBtn.addEventListener('click', () => {
        const history = readHistory();
        if(!history || history.length === 0){
          toast('Нет записей для экспорта', 'danger');
          return;
        }
        const json = JSON.stringify(history, null, 2);
        try{
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'uuid-converter-history.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast('Экспорт готов', 'success');
        }catch(e){
          toast('Не удалось экспортировать', 'danger');
        }
      });
    }

    if(clearHistoryBtn){
      clearHistoryBtn.addEventListener('click', async () => {
        const ok = await confirmUI({
          title: 'Очистить историю',
          message: 'Удалить все записи истории? Это действие нельзя отменить.',
          okText: 'Удалить всё',
          cancelText: 'Отмена',
          danger: true
        });
        if(!ok) return;

        try{ localStorage.removeItem(historyKey); }catch(e){}
        renderHistory();
        updateHistoryBadge(0);
        toast('История очищена', 'success');
      });
    }

    // history interactions (toggle / rename / delete)
    if(historyContent){
      historyContent.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('button[data-action]');
        if(btn){
          const action = btn.dataset.action;
          const idx = Number(btn.dataset.idx);
          if(!Number.isFinite(idx)) return;

          if(action === 'rename'){
            startInlineRename(idx);
            return;
          }
          if(action === 'rename-cancel'){
            finishInlineRename(idx, false);
            return;
          }
          if(action === 'rename-save'){
            finishInlineRename(idx, true);
            return;
          }
          if(action === 'delete'){
            const history = readHistory();
            if(idx < 0 || idx >= history.length) return;

            const ok = await confirmUI({
              title: 'Удалить запись',
              message: `Удалить "${history[idx].name}" из истории?`,
              okText: 'Удалить',
              cancelText: 'Отмена',
              danger: true
            });
            if(!ok) return;

            history.splice(idx, 1);
            writeHistory(history);
            renderHistory();
            toast('Запись удалена', 'success');
            return;
          }
        }

        const header = ev.target.closest('.history-header');
        if(!header) return;

        // don't toggle when clicking buttons inside header
        if(ev.target.closest('button')) return;

        const idx = header.dataset.idx;
        const body = document.getElementById('body-'+idx);
        if(!body) return;

        if(body.classList.contains('open')){
          body.style.maxHeight = null;
          body.classList.remove('open');
          header.setAttribute('aria-expanded','false');
        } else {
          body.classList.add('open');
          body.style.maxHeight = body.scrollHeight + 'px';
          header.setAttribute('aria-expanded','true');
        }
      });

      historyContent.addEventListener('keydown', (ev) => {
        const header = ev.target.closest('.history-header');
        if(!header) return;
        if(ev.key === 'Enter' || ev.key === ' '){
          ev.preventDefault();
          header.click();
        }
      });
    }

    // hotkeys modal
    if(hotkeysBtn){
      hotkeysBtn.addEventListener('click', () => openModal(hotkeysModal, hotkeysBtn, closeHotkeys));
    }
    if(closeHotkeys){
      closeHotkeys.addEventListener('click', () => closeModal(hotkeysModal, hotkeysBtn));
    }

    // click outside to close modals
    [historyModal, hotkeysModal].forEach(mod => {
      if(!mod) return;
      mod.addEventListener('click', (e) => {
        if(e.target === mod){
          if(mod === historyModal) closeModal(historyModal, historyBtn);
          if(mod === hotkeysModal) closeModal(hotkeysModal, hotkeysBtn);
        }
      });
    });

    // normalize input lines
    function normalizeLine(s){
      let str = String(s || '').replace(/\r/g,'').trim();
      if(str.length >= 2){
        const first = str[0], last = str[str.length-1];
        if((first === '"' && last === '"') || (first === "'" && last === "'")) return str.slice(1,-1);
        if(str.startsWith('\\"') && str.endsWith('\\"')) return str.slice(2,-2);
        if(str.startsWith("\\'") && str.endsWith("\\'")) return str.slice(2,-2);
      }
      return str;
    }

    function linesFromInput(text){
      if(text == null) return [];
      const raw = String(text).replace(/\r/g,'').split(/\n/);
      return raw.map(s => normalizeLine(s)).filter(s => s.length > 0);
    }

    // JSON escaping
    function jsonEscape(s){
      return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
    }

    function showConvertSuccess(){
      if(!mainPanel || !convertBtn) return;
      mainPanel.classList.remove('converted');
      void mainPanel.offsetWidth;
      mainPanel.classList.add('converted');

      convertBtn.classList.add('success');
      convertBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 10-9 9" stroke="currentColor" stroke-width="1.4"/><path d="M21 3v6h-6" stroke="currentColor" stroke-width="1.4"/></svg></span>Готово!';

      setTimeout(()=> {
        convertBtn.classList.remove('success');
        if(convertBtnOriginal) convertBtn.innerHTML = convertBtnOriginal;
      }, 900);
    }

    function convert(){
      if(!input || !output) return;
      const arr = linesFromInput(input.value);
      const content = arr.map(s => `"${jsonEscape(s)}"`).join(',\n');
      output.value = '[\n' + content + '\n]';
      output.placeholder = '';
      addToHistory(input.value, output.value);
      showConvertSuccess();
    }

    convertBtn && convertBtn.addEventListener('click', convert);

    clearBtn && clearBtn.addEventListener('click', () => {
      if(input) input.value = '';
      if(output) output.value = '';
      if(input) input.placeholder = 'Введите строки...';
      if(output) output.placeholder = 'Здесь появится результат...';
      toast('Очищено', 'success');
    });

    copyBtn && copyBtn.addEventListener('click', async () => {
      try{
        if(!output) return;
        const text = output.value || '';
        if(text.trim().length === 0){
          toast('Нечего копировать', 'danger');
          return;
        }

        if(!navigator.clipboard || !navigator.clipboard.writeText){
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } else {
          await navigator.clipboard.writeText(text);
        }

        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="1.6"/></svg></span><span class="copy-label">Скопировано!</span>';

        setTimeout(()=> {
          copyBtn.classList.remove('copied');
          if(copyBtnOriginal) copyBtn.innerHTML = copyBtnOriginal;
        }, 1200);

        toast('Результат скопирован', 'success');
      }catch(e){
        toast('Не удалось скопировать', 'danger');
      }
    });

    // global hotkeys
    window.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        if(palettePopover && palettePopover.classList.contains('open')) {
          closePalette();
          paletteToggle && paletteToggle.focus();
        }
        if(historyModal && historyModal.classList.contains('show')) closeModal(historyModal, historyBtn);
        if(hotkeysModal && hotkeysModal.classList.contains('show')) closeModal(hotkeysModal, hotkeysBtn);
        if(confirmModal && confirmModal.classList.contains('show')) {
          // confirm handles its own Escape, but this is a safe fallback
          closeModal(confirmModal);
        }
      }
      if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault();
        convert();
      }
    });

    // init
    function init(){
      buildPalettePresets();
      loadPrefs();

      const hist = readHistory();
      writeHistory(hist);

      if(palettePopover) { palettePopover.setAttribute('aria-hidden','true'); palettePopover.classList.remove('open'); }
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      if(themeToggle) themeToggle.setAttribute('aria-pressed', currentTheme === 'dark' ? 'true' : 'false');

      const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if(!currentAccent){
        document.documentElement.style.setProperty('--accent', defaultAccent);
        document.documentElement.style.setProperty('--accent-600', defaultAccent600);
      }
    }

    init();
  });
})();

// loader hide
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if(!loader) return;
  loader.classList.add("hidden");
  setTimeout(() => {
    loader.style.display = "none";
  }, 500);
});
