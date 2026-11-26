import { DATA_META } from './data.js';
import { readSettings, SETTINGS_KEY, validateApiUrl } from './storage.js';
const words = {
  checker:['Чекер','Checker'], raider:['Рейд','Raid'], recycler:['Переработка','Recycling'], raid:['Рейд','Raid'], recycle:['Переработка','Recycling'],
  checkerTitle:['Проверка игрока','Player identification'], raiderTitle:['Калькулятор рейда','Raid calculator'], recyclerTitle:['Калькулятор переработки','Recycling calculator'],
  checkerIntro:['SteamID из профиля или скриншота. Заметки по игрокам — локально, без регистрации.','Identify SteamIDs from profiles or screenshots. Keep local player notes without an account.'],
  raiderIntro:['Расход взрывчатки по типу цели. Сравнение по сере, а не по числу зарядов.','Compare explosive requirements for a target, ranked by sulfur rather than charge count.'],
  recyclerIntro:['Добавьте предметы в расчёт и выберите переработчик. Выход ресурсов суммируется.','Add items and select a recycler. Resource yields are aggregated across your inventory.'],
  manualTitle:['SteamID64','SteamID64'], manual:['Ручной ввод','Manual input'], idLabel:['Идентификатор или ссылка на профиль','ID or profile URL'], idHelp:['17 цифр или steamcommunity.com/profiles/…','17 digits or steamcommunity.com/profiles/…'], check:['Проверить ID','Check ID'],
  ocrTitle:['Из скриншота','From screenshot'], dropLabel:['Выберите или перетащите скриншот','Choose or drop a screenshot'], noFile:['Файл не выбран','No file selected'], recognize:['Распознать ID','Recognize ID'], cancel:['Отменить','Cancel'], previewAlt:['Выбранный скриншот','Selected screenshot'], ocrPrivacy:['Обработка в браузере. Скриншот не покидает устройство.','Processed in your browser. The screenshot stays on your device.'],
  tracker:['Локальный трекер','Local tracker'], trackerHelp:['Список и заметки хранятся в этом браузере. Steam не подключён по умолчанию.','Players and notes are stored in this browser. Steam is not connected by default.'], add:['Добавить','Add player'], all:['Все','All'], online:['Онлайн','Online'], offline:['Оффлайн','Offline'], unknown:['Неизвестно','Unknown'], statusFilter:['Фильтр статуса','Status filter'], export:['Экспорт JSON','Export JSON'], import:['Импорт','Import'],
  target:['Цель','Target'], structure:['Сооружение','Structure'], material:['Материал','Material'], quantity:['Количество','Quantity'], totalHp:['Суммарное здоровье','Total health'], allExplosives:['Все типы взрывчатки','Show all explosives'],
  raidMethod:['Твёрдая сторона, прямые попадания, полное здоровье. Округление отдельно для каждой цели.','Hard side, direct hits, full health. Requirements are rounded for each target separately.'], raidOptions:['Варианты расхода','Explosive requirements'], sortSulfur:['По расходу серы','Sorted by sulfur'], raidCaveat:['Чистые варианты: без комбинирования и урона по соседним целям. Модифицированные серверы могут отличаться.','Single explosive options, without mixed attacks or splash damage to adjacent targets. Modded servers may differ.'],
  inventory:['Предметы','Inventory'], searchItems:['Поиск по каталогу','Search catalog'], searchPlaceholder:['AK, rifle, metal…','AK, rifle, metal…'], item:['Предмет','Item'], recyclerType:['Переработчик','Recycler'], basketAdd:['В расчёт','Add to calculation'], resources:['Выход ресурсов','Resource output'], expected:['Ожидаемый','Expected'], resource:['Ресурс','Resource'], amount:['Количество','Amount'], estimatedTime:['Расчётное время','Estimated time'], recycleCaveat:['Полная прочность, базовая эффективность. Дробный выход — математическое ожидание: результат в игре может отличаться.','Full durability, base efficiency. Fractional yields are expected values; actual in-game results may vary.'], copyResult:['Скопировать расчёт','Copy calculation'],
  theme:['Тема','Theme'], dark:['Тёмная','Dark'], light:['Светлая','Light'], fontSize:['Размер текста','Text size'], small:['Мелкий','Small'], medium:['Обычный','Medium'], large:['Крупный','Large'], language:['Язык','Language'], apiSettings:['Внешний API Steam','External Steam API'], apiHint:['Необязательно. Только адрес вашего HTTPS-сервиса с CORS. Ключ Steam хранится на сервере, не здесь.','Optional: your HTTPS service with CORS. Keep the Steam key on the server, never here.'], apiUrl:['Адрес API','API URL'], apiPrivacy:['При проверке идентификатор будет отправлен этому сервису.','Player checks send the SteamID to this service.'],
  skip:['К содержимому','Skip to content'], navigation:['Навигация','Navigation'], collapse:['Свернуть','Collapse'], expand:['Развернуть','Expand'], localMode:['Локальный режим','Local mode'], settings:['Настройки','Settings'], dataSource:['Источник игровых данных','Game data source'], storageLabel:['Хранение','Storage'], storageHint:['Данные привязаны к браузеру и адресу сайта. Экспортируйте список перед очисткой хранилища.','Data belongs to this browser and site origin. Export your list before clearing storage.'], dataSnapshot:['Снимок данных','Data snapshot'], affiliation:['Независимый проект. Не связан с Facepunch Studios или Valve.','Independent project. Not affiliated with Facepunch Studios or Valve.'],
  storageMemory:['Изменения только в памяти этой вкладки и исчезнут после перезагрузки. Экспортируйте список JSON сейчас.','Changes exist only in this tab’s memory and will be lost on reload. Export the JSON list now.'],
  storageError:['Хранилище браузера недоступно или повреждено. Изменения не сохраняются; экспортируйте список.','Browser storage is unavailable or corrupted. Changes are not saved; export your list.'], invalidApi:['Нужен HTTPS-адрес без пароля, параметров и фрагмента. HTTP допустим только для localhost.','Use an HTTPS URL without credentials, query or fragment. HTTP is allowed only for localhost.'], copied:['Скопировано','Copied'], copyFail:['Буфер обмена недоступен. Скопируйте текст из открывшегося поля.','Clipboard unavailable. Copy the text from the opened field.'], invalidId:['Введите корректный SteamID64 индивидуального аккаунта или ссылку /profiles/. Короткие ссылки /id/ здесь не поддерживаются.','Enter an individual account SteamID64 or /profiles/ URL. Custom /id/ URLs are not supported here.'], added:['Игрок добавлен','Player added'], duplicate:['Этот игрок уже в списке','This player is already tracked'], deleted:['Игрок удалён','Player removed'], remove:['Удалить','Remove'], note:['Заметка','Note'], saveNote:['Сохранить заметку','Save note'], saved:['Заметка сохранена','Note saved'], refresh:['Обновить','Refresh'], profile:['Профиль Steam','Steam profile'], inventoryLink:['Инвентарь','Inventory'], copyId:['Копировать ID','Copy ID'], addTracked:['В трекер','Track player'], identified:['Идентификатор проверен','ID format verified'], notVerified:['Личность не подтверждена','Identity not verified'], noApi:['Steam API не подключён. Ник, аватар, часы, возраст и онлайн-статус не получены. Проверена только структура идентификатора.','Steam API is not connected. Name, avatar, hours, age and online status are unavailable. Only the ID structure was checked.'], hours:['Часы в Rust','Rust hours'], accountAge:['Возраст аккаунта','Account age'], status:['Статус','Status'], years:['лет','years'], noneTracked:['Список пуст','No tracked players'], emptyTracker:['Добавьте SteamID, чтобы сохранить заметку по игроку.','Add a SteamID to keep a player note.'], emptyFilter:['Нет игроков с таким статусом.','No players match this status.'], importSuccess:['Импортировано: {n}. Дубликаты пропущены.','Imported: {n}. Duplicates skipped.'], invalidImport:['Неверный JSON. Нужен экспорт Rust Util с корректными уникальными SteamID (до 1000 игроков, до 16 МБ).','Invalid JSON. Use a Rust Util export with valid unique SteamIDs (up to 1,000 players, 16 MB).'], exportName:['rust-util-tracker.json','rust-util-tracker.json'], limitPlayers:['Максимум 1000 игроков в локальном списке.','Local list limit: 1,000 players.'],
  invalidFile:['Выберите настоящий PNG/JPG размером до 16 МБ.','Choose a valid PNG/JPG up to 16 MB.'], largeImage:['Размер изображения слишком большой для OCR (не более 20 млн пикселей). Обрежьте область с ID.','Image is too large for OCR (20 million pixels maximum). Crop the SteamID area.'], ocrLoading:['Загрузка локального OCR','Loading local OCR'], ocrRunning:['Распознавание','Recognizing'], ocrNoId:['SteamID не найден. Обрежьте скриншот ближе к ID или введите его вручную.','No SteamID found. Crop closer to the ID or enter it manually.'], ocrFailed:['OCR не завершён. Попробуйте меньший скриншот или введите ID вручную.','OCR could not finish. Try a smaller screenshot or enter the ID manually.'], chooseId:['Найдено несколько ID. Выберите нужный:','Multiple IDs found. Select one:'], checking:['Проверка…','Checking…'], apiFailed:['Внешний API не ответил корректно. Данные Steam не получены.','External API did not respond correctly. Steam data is unavailable.'], apiNotConfigured:['Для живого статуса укажите внешний API в настройках.','Configure an external API in Settings for live status.'], checkedAt:['Проверено: {time}','Checked: {time}'],
  wood:['Дерево','Wood'], stone:['Камень','Stone'], metal:['Металл','Metal'], armored:['Бронированный','Armored'], sheet:['Листовой металл','Sheet metal'], wall:['Стена','Wall'], floor:['Перекрытие','Floor'], door:['Дверь','Door'], garage:['Гаражная дверь','Garage door'], external_wall:['Высокая внешняя стена','High external wall'], high_wall:['Высокая внешняя стена','High external wall'], sheet_door:['Металлическая дверь','Sheet metal door'], external:['Высокая внешняя стена','High external wall'],
  perTarget:['{hp} HP / цель × {qty}','{hp} HP / target × {qty}'], invalidQuantity:['Количество должно быть целым числом от 1 до 999.','Quantity must be an integer from 1 to 999.'], bestSulfur:['Мин. сера','Least sulfur'], sulfur:['Сера','Sulfur'], gunpowder:['Порох','Gunpowder'], damageEach:['Урон / ед.','Damage / unit'], components:['Компоненты крафта','Crafting components'], perTargetCount:['{n} / цель','{n} / target'], pieces:['шт.','units'], noItems:['Предметы не найдены','No matching items'], catalogCount:['{n} предметов','{n} items'], emptyBasket:['Добавьте предметы в расчёт.','Add items to the calculation.'], efficiency:['Эффективность {n}% · базовое время {s} сек','Efficiency {n}% · base interval {s} sec'], seconds:['сек','sec'], cycleTime:['Время — последовательная оценка по предметам, без параллельных слотов, очереди и перемещения.','Time is a sequential per-item estimate, excluding parallel slots, queues and inventory transfers.']
};
export let settings = {theme:'dark',font:'medium',language:'ru',collapsed:false,api:''};
let flashTimer;
export function t(key, values = {}) {
  let result = words[key]?.[settings.language === 'en' ? 1 : 0] || key;
  for (const [name, value] of Object.entries(values)) result = result.replaceAll(`{${name}}`, String(value));
  return result;
}
export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}
export function showStorageError() {
  const notice = document.getElementById('storage-error');
  notice.textContent = t('storageError'); notice.hidden = false;
}
export function flash(message) {
  const node = document.getElementById('flash');
  node.textContent = message; node.hidden = false;
  clearTimeout(flashTimer); flashTimer = setTimeout(() => { node.hidden = true; }, 4500);
}
export function fmt(value, digits = 2) {
  return new Intl.NumberFormat(settings.language === 'ru' ? 'ru-RU' : 'en-US', {maximumFractionDigits:digits}).format(value);
}
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); flash(t('copied')); }
  catch { window.prompt(t('copyFail'), text); }
}
export function setError(id, message) {
  const node = document.getElementById(id); node.textContent = message || ''; node.hidden = !message;
}
function apply() {
  document.documentElement.lang = settings.language;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.font = settings.font;
  document.body.classList.toggle('sidebar-collapsed', settings.collapsed);
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  for (const attr of ['title', 'placeholder', 'alt', 'aria']) {
    document.querySelectorAll(`[data-i18n-${attr}]`).forEach(node => node.setAttribute(attr === 'aria' ? 'aria-label' : attr, t(node.getAttribute(`data-i18n-${attr}`))));
  }
  document.querySelectorAll('[data-setting]').forEach(node => { node.value = settings[node.dataset.setting]; });
  const collapse = document.getElementById('collapse-sidebar');
  collapse.setAttribute('aria-expanded', String(!settings.collapsed));
  collapse.setAttribute('aria-label', t(settings.collapsed ? 'expand' : 'collapse'));
  collapse.title = t(settings.collapsed ? 'expand' : 'collapse');
  document.getElementById('collapse-glyph').textContent = settings.collapsed ? '[ → ]' : '[ ← ]';
  document.title = `${t(`${document.body.dataset.page}Title`)} — Rust Util`;
  document.dispatchEvent(new Event('settingschange'));
}
function persist() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch { showStorageError(); }
}
export function init() {
  try { settings = readSettings(localStorage); }
  catch { showStorageError(); }
  if (validateApiUrl(settings.api) === null) settings.api = '';
  document.querySelectorAll('[data-setting]').forEach(node => node.addEventListener('change', () => {
    const key = node.dataset.setting;
    const value = key === 'api' ? validateApiUrl(node.value) : node.value;
    if (value === null) { flash(t('invalidApi')); node.value = settings.api; return; }
    settings[key] = value;
    persist(); apply();
  }));
  document.getElementById('collapse-sidebar').addEventListener('click', () => { settings.collapsed = !settings.collapsed; persist(); apply(); });
  const version = DATA_META.buildId || DATA_META.build || DATA_META.version || DATA_META.commit?.slice(0, 7) || 'snapshot';
  document.getElementById('data-version').textContent = String(version);
  apply();
}
export async function fetchPlayer(steamid) {
  if (!settings.api) throw new Error('apiNotConfigured');
  const response = await fetch(`${settings.api}/players/${steamid}`, {signal:AbortSignal.timeout(12000), credentials:'omit', cache:'no-store', headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error('apiFailed');
  const data = await response.json();
  if (!data || data.steamid !== steamid || !['online','offline','unknown'].includes(data.status)) throw new Error('apiFailed');
  let avatar = '';
  try { const url = new URL(data.avatar_url); if (url.protocol === 'https:') avatar = url.href; } catch { /* Аватар необязателен. */ }
  return {
    steamid, nickname:typeof data.nickname === 'string' ? data.nickname.slice(0,128) : '', avatar_url:avatar,
    status:data.status, steam_hours:Number.isFinite(data.steam_hours) && data.steam_hours >= 0 ? data.steam_hours : null,
    timecreated:Number.isFinite(data.timecreated) && data.timecreated > 0 && data.timecreated * 1000 <= Date.now() ? data.timecreated : null,
    checkedAt:Date.now()
  };
}
