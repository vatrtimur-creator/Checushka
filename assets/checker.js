import { init, t, el, flash, fmt, copy, settings, setError, showStorageError, fetchPlayer } from './common.js';
import { steamIdFromInput, extractSteamIds } from './engine.js';
import { loadPlayers, savePlayers, normalizePlayers, TRACKER_KEY } from './storage.js';
import { recognizeText } from './ocr.js';
let players = [];
let filter = 'all';
let currentPlayer = null;
let file = null;
let previewUrl = '';
let ocrController = null;
let recognizing = false;
let ocrRun = 0;
let checkRun = 0;
let storageBroken = false;
const pending = new Set();
const $ = id => document.getElementById(id);
function persist() {
  if (storageBroken) { showStorageError(); return; }
  try { savePlayers(localStorage, players); } catch { showStorageError(); }
}
function read() {
  try { players = loadPlayers(localStorage); }
  catch { storageBroken = true; showStorageError(); }
}
function addPlayer(steamid, info = {}) {
  if (players.some(player => player.steamid === steamid)) { flash(t('duplicate')); return; }
  if (players.length >= 1000) { flash(t('limitPlayers')); return; }
  players.push({steamid, nickname:'', notes:'', status:'unknown', addedAt:Date.now(), ...info});
  persist(); renderTracker(); flash(t('added'));
}
function renderResult() {
  if (!currentPlayer) return;
  const section = $('player-result'); section.replaceChildren(); section.hidden = false;
  const player = currentPlayer;
  const stamp = player.avatar_url ? el('img', {class:'avatar', src:player.avatar_url, alt:'', referrerpolicy:'no-referrer'}) : el('div', {class:'id-stamp', text:'ID64', 'aria-hidden':'true'});
  if (stamp.tagName === 'IMG') stamp.addEventListener('error', () => stamp.replaceWith(el('div',{class:'id-stamp',text:'ID64'})), {once:true});
  const heading = el('h2', {text:player.nickname || player.steamid});
  const info = el('div', {class:'result-info'}, [el('div',{class:'eyebrow',text:t(player.checkedAt ? 'identified' : 'notVerified')}), heading]);
  if (player.nickname) info.append(el('div', {class:'mono muted',text:player.steamid}));
  const links = el('div', {class:'result-links'}, [
    el('a',{href:`https://steamcommunity.com/profiles/${player.steamid}`,target:'_blank',rel:'noopener noreferrer',text:t('profile')}),
    el('a',{href:`https://steamcommunity.com/profiles/${player.steamid}/inventory/`,target:'_blank',rel:'noopener noreferrer',text:t('inventoryLink')})
  ]);
  info.append(links);
  const toolbar = el('div',{class:'toolbar'});
  const copyButton = el('button',{type:'button',text:t('copyId')}); copyButton.addEventListener('click',() => copy(player.steamid));
  const addButton = el('button',{type:'button',text:t('addTracked')}); addButton.addEventListener('click',() => addPlayer(player.steamid, player));
  toolbar.append(copyButton, addButton); info.append(toolbar);
  const stats = el('dl',{class:'stats'});
  const age = player.timecreated ? `${fmt((Date.now() / 1000 - player.timecreated) / (365.25*86400),1)} ${t('years')}` : '—';
  for (const [label, value] of [['hours',player.steam_hours === null || player.steam_hours === undefined ? '—' : fmt(player.steam_hours,1)],['accountAge',age],['status',t(player.status || 'unknown')]]) stats.append(el('div',{},[el('dt',{text:t(label)}),el('dd',{text:value})]));
  info.append(stats);
  if (player.checkedAt) info.append(el('p',{class:'hint',text:t('checkedAt',{time:new Date(player.checkedAt).toLocaleString(settings.language)})}));
  else info.append(el('p',{class:'hint',text:t('noApi')}));
  section.append(el('div',{class:'result-layout'},[stamp,info]));
}
async function check(value) {
  setError('checker-error','');
  const steamid = steamIdFromInput(value);
  if (!steamid) { setError('checker-error',t('invalidId')); return; }
  const run = ++checkRun;
  currentPlayer = {steamid,status:'unknown',steam_hours:null}; renderResult();
  const button = $('check-form').querySelector('button');
  button.disabled = false; button.textContent = t('check');
  if (settings.api) {
    button.disabled = true; button.textContent = t('checking');
    try { const info = await fetchPlayer(steamid); if (run === checkRun) { currentPlayer = info; renderResult(); } }
    catch (error) { if (run === checkRun) setError('checker-error',t(error.message === 'apiNotConfigured' ? error.message : 'apiFailed')); }
    finally { if (run === checkRun) { button.disabled = false; button.textContent = t('check'); } }
  }
}
function renderTracker() {
  $('tracker-count').textContent = String(players.length);
  const list = $('tracker-list'); list.replaceChildren();
  const matching = players.filter(player => filter === 'all' || player.status === filter);
  if (!matching.length) {
    list.append(el('div',{class:'empty'},[el('div',{class:'empty-mark','aria-hidden':'true',text:'[ — ]'}),el('h3',{text:t(players.length ? 'emptyFilter' : 'noneTracked')}),...(!players.length ? [el('p',{text:t('emptyTracker')})] : [])])); return;
  }
  for (const player of matching) {
    const row = el('article',{class:'player-row'});
    row.append(el('h3',{},[el('a',{href:`https://steamcommunity.com/profiles/${player.steamid}`,target:'_blank',rel:'noopener noreferrer',text:player.nickname || player.steamid})]));
    if (player.nickname) row.append(el('div',{class:'player-id',text:player.steamid}));
    const label = el('label',{for:`note-${player.steamid}`,text:t('note')});
    const note = el('textarea',{id:`note-${player.steamid}`,maxlength:'2000','aria-label':`${t('note')} ${player.steamid}`}); note.value = player.notes;
    const save = () => { if (player.notes !== note.value) { player.notes = note.value; persist(); } };
    note.addEventListener('input',save); note.addEventListener('blur',save);
    note.addEventListener('keydown',event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); save(); note.blur(); flash(t('saved')); } });
    row.append(label,note);
    const badge = el('span',{class:`badge ${player.status === 'online' ? 'status-online' : ''}`,text:t(player.status || 'unknown')});
    const actions = el('div',{class:'player-actions'});
    const refresh = el('button',{type:'button',text:t('refresh')}); refresh.disabled = !settings.api || pending.has(player.steamid); refresh.title = settings.api ? t('refresh') : t('apiNotConfigured');
    refresh.addEventListener('click',async () => {
      pending.add(player.steamid); refresh.disabled = true;
      try { Object.assign(player,await fetchPlayer(player.steamid)); persist(); }
      catch { player.status = 'unknown'; player.checkedAt = null; flash(t('apiFailed')); }
      finally { pending.delete(player.steamid); renderTracker(); }
    });
    const remove = el('button',{type:'button',class:'danger',text:t('remove'),'aria-label':`${t('remove')} ${player.steamid}`});
    remove.addEventListener('click',() => { players = players.filter(item => item.steamid !== player.steamid); persist(); renderTracker(); flash(t('deleted')); });
    actions.append(badge,refresh,remove); row.append(actions);
    if (player.checkedAt) row.append(el('p',{class:'hint',text:t('checkedAt',{time:new Date(player.checkedAt).toLocaleTimeString(settings.language)})}));
    list.append(row);
  }
}
async function selectFile(candidate) {
  const selection = ++ocrRun;
  file = null; $('ocr-button').disabled = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = ''; $('preview').hidden = true; $('filename').textContent = t('noFile');
  setError('checker-error',''); $('ocr-candidates').replaceChildren();
  if (!candidate || !['image/png','image/jpeg'].includes(candidate.type) || candidate.size > 16*1024*1024 || candidate.size === 0) { setError('checker-error',t('invalidFile')); return; }
  try {
    const image = await createImageBitmap(candidate);
    const pixels = image.width * image.height; image.close();
    if (selection !== ocrRun) return;
    if (pixels > 20000000) { setError('checker-error',t('largeImage')); return; }
    file = candidate; previewUrl = URL.createObjectURL(candidate);
    $('preview').src = previewUrl; $('preview').hidden = false; $('filename').textContent = candidate.name; $('ocr-button').disabled = false;
  } catch { if (selection === ocrRun) setError('checker-error',t('invalidFile')); }
}
let scriptPromise;
function loadOCR() {
  if (!scriptPromise) scriptPromise = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/tesseract.min.js',import.meta.url).href;
    const fail = () => { clearTimeout(timer); scriptPromise = null; script.remove(); reject(new Error('ocrFailed')); };
    const timer = setTimeout(fail,30000);
    script.onload = () => { clearTimeout(timer); resolve(); }; script.onerror = fail;
    document.head.append(script);
  });
  return scriptPromise;
}
function ocrUI(busy) {
  recognizing = busy;
  $('ocr-progress').hidden = !busy; $('ocr-button').disabled = busy || !file; $('dropzone').disabled = busy;
  $('file-input').disabled = busy;
}
async function recognize() {
  if (!file || recognizing) return;
  const run = ++ocrRun; ocrUI(true); setError('checker-error',''); $('ocr-candidates').replaceChildren(); $('ocr-meter').value = 0; $('ocr-status').textContent = t('ocrLoading');
  const controller = new AbortController(); ocrController = controller;
  const isCurrent = () => run === ocrRun;
  try {
    await loadOCR(); if (!isCurrent()) return;
    const text = await recognizeText(globalThis.Tesseract,file,{
      workerPath:new URL('./vendor/worker.min.js',import.meta.url).href,
      corePath:new URL('./vendor/core/',import.meta.url).href,
      langPath:new URL('./vendor/lang',import.meta.url).href,
      workerBlobURL:false, cacheMethod:'none',
      logger:message => { if (isCurrent()) { $('ocr-status').textContent = `${t(message.status === 'recognizing text' ? 'ocrRunning' : 'ocrLoading')} ${Math.round((message.progress || 0)*100)}%`; $('ocr-meter').value = message.progress || 0; } }
    },controller.signal);
    if (!isCurrent()) return;
    const ids = extractSteamIds(text);
    if (!ids.length) setError('checker-error',t('ocrNoId'));
    else if (ids.length === 1) { $('steamid').value = ids[0]; await check(ids[0]); }
    else {
      $('ocr-candidates').append(el('p',{class:'hint',text:t('chooseId')}));
      for (const steamid of ids) {
        const button = el('button',{type:'button',text:steamid});
        button.addEventListener('click',() => { $('steamid').value = steamid; check(steamid); });
        $('ocr-candidates').append(button);
      }
    }
  } catch { if (isCurrent()) setError('checker-error',t('ocrFailed')); }
  finally {
    if (ocrController === controller) ocrController = null;
    if (isCurrent()) ocrUI(false);
  }
}
init(); read(); renderTracker();
$('check-form').addEventListener('submit',event => { event.preventDefault(); check($('steamid').value); });
$('add-form').addEventListener('submit',event => {
  event.preventDefault(); const id = steamIdFromInput($('add-id').value);
  if (!id) { setError('checker-error',t('invalidId')); return; }
  setError('checker-error',''); addPlayer(id); $('add-id').value = '';
});
$('dropzone').addEventListener('click',() => $('file-input').click());
$('file-input').addEventListener('change',() => selectFile($('file-input').files[0]));
for (const name of ['dragenter','dragover']) $('dropzone').addEventListener(name,event => { event.preventDefault(); if (!recognizing) $('dropzone').classList.add('drag'); });
for (const name of ['dragleave','drop']) $('dropzone').addEventListener(name,event => { event.preventDefault(); $('dropzone').classList.remove('drag'); });
$('dropzone').addEventListener('drop',event => { if (!recognizing) selectFile(event.dataTransfer.files[0]); });
$('ocr-button').addEventListener('click',recognize);
$('ocr-cancel').addEventListener('click',() => { ++ocrRun; ocrController?.abort(); ocrController = null; ocrUI(false); });
$('export-tracker').addEventListener('click',() => {
  const data = {version:1, exportedAt:new Date().toISOString(),players};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link = el('a',{href:url,download:'rust-util-tracker.json'}); link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
});
$('import-tracker').addEventListener('click',() => $('import-file').click());
$('import-file').addEventListener('change',async () => {
  try {
    const uploaded = $('import-file').files[0]; if (!uploaded || uploaded.size > 2*1024*1024) throw new Error('invalidImport');
    const data = JSON.parse(await uploaded.text()); if (data.version !== 1) throw new Error('invalidImport');
    const imported = normalizePlayers(data.players); const newPlayers = imported.filter(player => !players.some(existing => existing.steamid === player.steamid));
    if (players.length + newPlayers.length > 1000) throw new Error('invalidImport');
    players.push(...newPlayers); persist(); renderTracker(); flash(t('importSuccess',{n:newPlayers.length}));
  } catch { flash(t('invalidImport')); }
  finally { $('import-file').value = ''; }
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',() => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  renderTracker();
}));
document.addEventListener('settingschange',() => { renderResult(); renderTracker(); });
window.addEventListener('storage',event => { if (event.key === TRACKER_KEY) { read(); renderTracker(); } });
window.addEventListener('pagehide',() => { if (previewUrl) URL.revokeObjectURL(previewUrl); ocrController?.abort(); });
