import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayers,loadPlayers,savePlayers,readSettings,validateApiUrl,SETTINGS_KEY,TRACKER_KEY} from '../assets/storage.js';
const id = '76561198755035987';
function memory() { const map = new Map(); return {getItem:key => map.get(key) ?? null,setItem:(key,value) => map.set(key,value)}; }
test('tracker validates and resets stale status without changing notes',() => {
  const storage = memory(); savePlayers(storage,[{steamid:id,notes:'hello',nickname:'<script>',status:'online',checkedAt:1}]);
  const [player] = loadPlayers(storage); assert.equal(player.status,'unknown'); assert.equal(player.notes,'hello'); assert.equal(player.nickname,'<script>');
});
test('import rejects duplicates, invalid identifiers and too many players',() => {
  assert.throws(() => normalizePlayers([{steamid:id},{steamid:id}]));
  assert.throws(() => normalizePlayers([{steamid:'123'}]));
  assert.throws(() => normalizePlayers({}));
  assert.throws(() => normalizePlayers(new Array(1001)));
});
test('notes and names have bounded length',() => {
  const [player] = normalizePlayers([{steamid:id,notes:'x'.repeat(3000),nickname:'y'.repeat(300)}]);
  assert.equal(player.notes.length,2000); assert.equal(player.nickname.length,128);
});
test('settings use valid defaults and fail visibly for malformed JSON',() => {
  const storage = memory(); assert.equal(readSettings(storage).language,'ru');
  storage.setItem(SETTINGS_KEY,JSON.stringify({language:'en',theme:'light',font:'large'}));
  assert.equal(readSettings(storage).theme,'light'); assert.equal(readSettings(storage).language,'en');
  storage.setItem(SETTINGS_KEY,'{broken'); assert.throws(() => readSettings(storage));
  storage.setItem(TRACKER_KEY,'{broken'); assert.throws(() => loadPlayers(storage));
});
test('API endpoint accepts HTTPS and localhost only; credentials and queries rejected',() => {
  assert.equal(validateApiUrl(''),''); assert.equal(validateApiUrl('https://example.com/'),'https://example.com');
  assert.equal(validateApiUrl('http://localhost:5000'),'http://localhost:5000');
  for (const url of ['http://example.com','javascript:alert(1)','https://user:pass@example.com','https://example.com?key=secret','https://example.com#key']) assert.equal(validateApiUrl(url),null);
});
