// app.js
(function(){
  const APP_VERSION = window.APP_VERSION || '1.2.1';

  const historyKey = 'uuid_converter_history';
  const prefsKey = 'uuid_converter_prefs';
  const inputSaveKey = 'uuid_converter_input';
  const versionKey = 'uuid_converter_version';

  const MAX_HISTORY = 200;

  // При изменении версии — миграция prefs, очистка временного ввода, notice
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
      setTimeout(()=> toast.remove(), 320);
    });

    setTimeout(()=>{
      if(toast && toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(()=> toast.remove(), 320);
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
    // одна проверка при загрузке
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

    // defaults
    const defaultAccent = '#2b7be4';
    const defaultAccent600 = '#1a5fc1';
    const presets = ['#2b7be4','#16a34a','#7c3aed','#f97316','#ef4444','#0ea5a4'];

    // show version in footer
    if(appVersionEl) appVersionEl.textContent = 'Версия: ' + APP_VERSION;

    const convertBtnOriginal = convertBtn ? convertBtn.innerHTML : '';
    const copyBtnOriginal = copyBtn ? copyBtn.innerHTML : '';

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

    // theme handling
    function savePrefs(){
      const prefs = {
        theme: document.documentElement.getAttribute('data-theme') || 'light',
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || defaultAccent
      };
      try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch(e){}
    }

    function setTheme(theme){
      if(theme === 'dark'){
        document.documentElement.setAttribute('data-theme','dark');
        if(themeToggle) themeToggle.setAttribute('aria-pressed','true');
      } else {
        document.documentElement.setAttribute('data-theme','light');
        if(themeToggle) themeToggle.setAttribute('aria-pressed','false');
      }
      savePrefs();
    }

    if(themeToggle){
      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark');
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
        btn.addEventListener('click', ()=> applyAccent(col));
        palettePresetsContainer.appendChild(btn);
      });
    }

    function markActiveSwatch(hex){
      document.querySelectorAll('.swatch').forEach(s=>{
        if(s.dataset.color && s.dataset.color.toLowerCase() === String(hex || '').toLowerCase()) s.classList.add('active');
        else s.classList.remove('active');
      });
    }

    function applyAccent(hex){
      if(!hex) return;
      const darker = darkenHex(hex, 18);
      document.documentElement.style.setProperty('--accent', hex);
      document.documentElement.style.setProperty('--accent-600', darker);
      const {r,g,b} = hexToRgb(hex);
      document.documentElement.style.setProperty('--accent-r', r);
      document.documentElement.style.setProperty('--accent-g', g);
      document.documentElement.style.setProperty('--accent-b', b);
      markActiveSwatch(hex);
      if(paletteColor && paletteColor.value.toLowerCase() !== hex.toLowerCase()) paletteColor.value = hex;
      savePrefs();
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
        if(expanded) closePalette();
        else openPalette();
      });
    }

    document.addEventListener('click', (ev) => {
      if(paletteControl && !paletteControl.contains(ev.target)){
        closePalette();
      }
    });

    paletteColor && paletteColor.addEventListener('input', (e) => applyAccent(e.target.value));
    paletteReset && paletteReset.addEventListener('click', () => applyAccent(defaultAccent));

    function loadPrefs(){
      try{
        const raw = localStorage.getItem(prefsKey);
        if(!raw) { applyAccent(defaultAccent); return; }
        const p = JSON.parse(raw);
        if(p.theme) setTheme(p.theme);
        if(p.accent) applyAccent(p.accent);
        else applyAccent(defaultAccent);
      }catch(e){
        applyAccent(defaultAccent);
        setTheme('light');
      }
    }

    // History helpers
    function escapeHtml(unsafe){
      return String(unsafe)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
    }

    function makeId(){
      try{
        if(crypto && crypto.randomUUID) return crypto.randomUUID();
      }catch(e){}
      return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    }

    function migrateHistoryItems(items){
      return (items || []).map(it => ({
        id: it.id || makeId(),
        time: it.time || new Date().toISOString(),
        name: it.name || 'Без названия',
        input: it.input ?? '',
        output: it.output ?? ''
      }));
    }

    function readHistory(){
      let history = [];
      try{ history = JSON.parse(localStorage.getItem(historyKey)) || []; }catch(e){ history = []; }
      history = migrateHistoryItems(history);
      return history;
    }

    function writeHistory(history){
      try{ localStorage.setItem(historyKey, JSON.stringify(history)); }catch(e){}
      updateHistoryBadge(history.length);
    }

    function addToHistory(inputText, outputText){
      const rec = {
        id: makeId(),
        time: new Date().toISOString(),
        name: 'Без названия',
        input: inputText,
        output: outputText
      };

      const history = readHistory();

      // дедуп одинаковых подряд
      const top = history[0];
      if(top && top.input === rec.input && top.output === rec.output) {
        updateHistoryBadge(history.length);
        return;
      }

      history.unshift(rec);
      if(history.length > MAX_HISTORY) history.length = MAX_HISTORY;

      writeHistory(history);
    }

    function updateHistoryBadge(len){
      const historyCountEl = document.getElementById('historyCount');
      if(!historyCountEl) return;
      historyCountEl.textContent = String(len || 0);
      if(len && len>0) historyCountEl.classList.add('visible');
      else historyCountEl.classList.remove('visible');
    }

    function renderHistory(){
      const history = readHistory();
      if(!historyContent) return;

      if(history.length === 0){
        historyContent.textContent = 'Нет записей';
        return;
      }

      // сохранить мигрированный формат обратно
      writeHistory(history);

      historyContent.innerHTML = history.map((it, idx)=>`
        <div class="history-item">
          <div class="history-header" data-idx="${idx}" tabindex="0" aria-expanded="false">
            <div class="hh-left">
              <div class="hh-name">${escapeHtml(it.name || 'Без названия')}</div>
              <div class="hh-time">${escapeHtml(new Date(it.time).toLocaleString())}</div>
            </div>
            <div class="hh-actions">
              <button type="button" class="hh-btn ghost small" data-action="rename" data-idx="${idx}">Переименовать</button>
              <button type="button" class="hh-btn ghost small danger" data-action="delete" data-idx="${idx}" aria-label="Удалить запись">Удалить</button>
            </div>
          </div>
          <div class="history-body" id="body-${idx}">
            <u>Ввод:</u><pre>${escapeHtml(it.input)}</pre>
            <u>Результат:</u><pre>${escapeHtml(it.output)}</pre>
          </div>
        </div>
      `).join('');
    }

    // Делегирование кликов по истории (rename/delete + toggle)
    if(historyContent){
      historyContent.addEventListener('click', (ev) => {
        const actionBtn = ev.target.closest('button[data-action]');
        const header = ev.target.closest('.history-header');

        // actions
        if(actionBtn){
          const action = actionBtn.dataset.action;
          const idx = Number(actionBtn.dataset.idx);
          const history = readHistory();
          if(Number.isNaN(idx) || idx < 0 || idx >= history.length) return;

          if(action === 'rename'){
            const current = history[idx].name || 'Без названия';
            const next = prompt('Название записи:', current);
            if(next === null) return;
            history[idx].name = String(next).trim() || 'Без названия';
            writeHistory(history);
            renderHistory();
            return;
          }

          if(action === 'delete'){
            if(!confirm('Удалить эту запись из истории?')) return;
            history.splice(idx, 1);
            writeHistory(history);
            renderHistory();
            return;
          }
        }

        // toggle body
        if(header){
          if(ev.target.closest('button')) return; // не раскрывать при клике по кнопкам

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

    // Modal helpers: open/close + focus restore
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
      setTimeout(()=> modal.style.display='none', 320);
      if(lastFocus && lastFocus.focus) setTimeout(()=> lastFocus.focus(), 0);
    }

    // history modal
    if(historyBtn){
      historyBtn.addEventListener('click', () => {
        renderHistory();
        openModal(historyModal, historyBtn, closeHistory || clearHistoryBtn);
      });
    }

    if(closeHistory){
      closeHistory.addEventListener('click', () => closeModal(historyModal, historyBtn));
    }

    if(clearHistoryBtn){
      clearHistoryBtn.addEventListener('click', () => {
        if(!confirm('Вы уверены, что хотите очистить историю?')) return;
        try{ localStorage.removeItem(historyKey); }catch(e){}
        renderHistory();
        updateHistoryBadge(0);
      });
    }

    if(exportHistoryBtn){
      exportHistoryBtn.addEventListener('click', () => {
        const history = readHistory();
        if(!history || history.length === 0){
          alert('Нет записей для экспорта.');
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
        }catch(e){
          alert('Не удалось экспортировать файл.');
        }
      });
    }

    // hotkeys modal
    if(hotkeysBtn){
      hotkeysBtn.addEventListener('click', () => {
        openModal(hotkeysModal, hotkeysBtn, closeHotkeys);
      });
    }
    if(closeHotkeys){
      closeHotkeys.addEventListener('click', () => closeModal(hotkeysModal, hotkeysBtn));
    }

    // Click outside to close modals
    [historyModal, hotkeysModal].forEach(mod => {
      if(!mod) return;
      mod.addEventListener('click', (e) => {
        if(e.target === mod){
          if(mod === historyModal) closeModal(historyModal, historyBtn);
          if(mod === hotkeysModal) closeModal(hotkeysModal, hotkeysBtn);
        }
      });
    });

    // normalize input lines (оставляем твою идею, просто аккуратно)
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

    // JSON escaping (фикс для backslash)
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
      convertBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 10-9 9" stroke="currentColor" stroke-width="1.4"/><path d="M21 3v6h-6" stroke="currentColor" stroke-width="1.4"/></svg></span>Сконвертировали!';

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

    // clear / copy
    clearBtn && clearBtn.addEventListener('click', () => {
      if(input) input.value = '';
      if(output) output.value = '';
      if(input) input.placeholder = 'Введите строки...';
      if(output) output.placeholder = 'Здесь появится результат...';
    });

    copyBtn && copyBtn.addEventListener('click', async () => {
      try{
        if(!navigator.clipboard || !navigator.clipboard.writeText){
          const ta = document.createElement('textarea');
          ta.value = output.value || '';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } else {
          await navigator.clipboard.writeText(output.value || '');
        }

        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="1.6"/></svg></span><span class="copy-label">Скопировано!</span>';

        setTimeout(()=> {
          copyBtn.classList.remove('copied');
          if(copyBtnOriginal) copyBtn.innerHTML = copyBtnOriginal;
        }, 1200);
      }catch(e){
        alert('Не удалось скопировать — используйте Ctrl+C.');
      }
    });

    // hotkeys
    window.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        if(palettePopover && palettePopover.classList.contains('open')) {
          closePalette();
          paletteToggle && paletteToggle.focus();
        }
        if(historyModal && historyModal.classList.contains('show')) closeModal(historyModal, historyBtn);
        if(hotkeysModal && hotkeysModal.classList.contains('show')) closeModal(hotkeysModal, hotkeysBtn);
      }
      if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault();
        convert();
      }
    });

    // init
    function init(){
      buildPalettePresets();

      try{ localStorage.removeItem(inputSaveKey); }catch(e){}
      if(input) input.value = '';
      if(output) output.value = '';

      document.documentElement.style.setProperty('--accent', defaultAccent);
      document.documentElement.style.setProperty('--accent-600', defaultAccent600);
      applyAccent(defaultAccent);
      loadPrefs();

      const hist = readHistory();
      updateHistoryBadge(hist.length);

      if(palettePopover) { palettePopover.setAttribute('aria-hidden','true'); palettePopover.classList.remove('open'); }
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      if(themeToggle) themeToggle.setAttribute('aria-pressed', currentTheme === 'dark' ? 'true' : 'false');
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
