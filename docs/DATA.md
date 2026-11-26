# Данные и контракт движка

Локальный каталог содержит **все 1001 предмет с непустым `recycle`** из 1307 предметов единого snapshot `bobosneefdev/rust-items-json`. Скрытые (`hidden: true`) записи сохранены, а не выданы за обычные доступные игроку предметы. Это одно преобразование пяти bulk JSON, без отдельного исследования страниц предметов. Источник извлекает настройки непосредственно из файлов Rust; игровые данные принадлежат **Facepunch Studios**, код upstream-экстрактора распространяется по MIT. Проект не связан с Facepunch и не одобрен ею. [1]

Snapshot: commit **`1204329518584db8e7f242e0f5671edeebf9d18e`**, commit date `2026-10-12T05:43:40Z`. Независимые поля upstream `meta.json`: build **`25824447`**, `updated: 2026-10-10T00:04:54Z`, `checked: 2026-10-12T05:43:40Z`. Ни дата генерации страницы, ни текущий календарь не заменяют номер build. Это проверенный snapshot репозитория, **не обещание постоянно последних данных игры**. SHA сначала получен через GitHub public API `GET /repos/bobosneefdev/rust-items-json/commits/master`; все пять файлов скачаны по полученному SHA, а не по изменяемому `master`. [2] [3]

**Рейд — модель прямого урона snapshot, а не подтверждённые игровые raid counts.** На 26 ноября 2026 используется build с upstream updated 10 октября, не последний ноябрьский build. Проверена одна модельная несогласованность: stone wall в snapshot имеет `satchel.hardDamage = 38.90000019073483`, поэтому 13 satchel; Rust Wiki указывает урон 51.5 и 10 satchel. Для explosive ammo snapshot содержит только урон 2.5 и 200 выстрелов, тогда как wiki различает оружие: SAR 2.704 / 185, AK 2.755 / 182. Для beancan wiki отдельно задаёт stuck/right click 11 / 46. Upstream README предупреждает об отсутствии weapon acquisition, attachments, special entity overrides, динамического состояния и fire ticks. Зависимость ammo от оружия подтверждена; точную причину satchel-различия одним сравнением установить нельзя. Нельзя объявлять все расхождения «изменением патча». [1] [6] [8]

Чтобы сохранить требуемый единый snapshot, цифры wiki не подмешаны в локальные raid данные и `hardDamage` не подменён `softDamage`. UI должен показывать название **«Модель прямого урона»** и видимое `calculateRaid(...).warning`. Без этого предупреждения выдавать 13 satchel за реальное требование игры некорректно. `DATA_META.raidModel = 'snapshot-direct-impact'`, `raidWarning` содержит текст расхождения, `raidComparisonSource` указывает единственную проверенную страницу. Тесты доказывают соответствие формуле и snapshot, **не** точность игровой симуляции.

## Экспорты `assets/data.js`

Все пять экспортов — обычные JSON-совместимые JS значения. Они предназначены для чтения: вызывающий код не должен их изменять. Runtime не обращается к API и не требует зависимостей.

`DATA_META` — объект с `schemaVersion: 1`, `repository`, `commit`, `commitDate`, `build`, `buildId`, `checked`, `updated`, `readme`, `sources`, `sha256`, `upstreamItemCount`, `recyclableItemCount`, `ownership`, `conditions`, `craftingItems`. `buildId` — строковый alias исходного `build` для UI. `sources` и `sha256` имеют ключи `items`, `recyclers`, `raid`, `building`, `meta`. SHA256 относятся к исходным байтам JSON. `conditions` содержит английские описания допущений для `recycle`, `raid`, `crafting`; UI может показывать русские пояснения из этого документа.

`ITEMS` — массив в порядке `shortname`. Каждая запись:

```js
{
  id: 'techparts',              // ID выбора в UI: shortname, НЕ числовой game ID
  shortname: 'techparts',
  itemId: 73681876,             // настоящий числовой Rust item ID
  name: 'Tech Trash',           // английское имя источника
  category: 'Component',
  hidden: false,
  condition: { enabled: false, max: 0 },
  crafting: {                  // null, если рецепта в snapshot нет
    batch: 1, craftable: false, workbench: 3, seconds: 1,
    ingredients: [{ shortname: 'metal.refined', name: 'High Quality Metal', amount: 2 },
                  { shortname: 'scrap', name: 'Scrap', amount: 50 }]
  },
  output: [{ shortname: 'scrap', name: 'Scrap', amount: 40 },
           { shortname: 'metal.refined', name: 'High Quality Metal', amount: 2 }],
  source: 'https://raw.githubusercontent.com/bobosneefdev/rust-items-json/<commit>/data/items.json'
}
```

`crafting.ingredients` — ингредиенты **одной партии**, `crafting.batch` — число произведённых предметов партии. `output.amount` — выход **одного перерабатываемого предмета при efficiency = 1**, до умножения на tier. Наличие сериализованного рецепта при `craftable: false` не означает, что компонент можно крафтить: такие компоненты остаются закупаемыми/добываемыми листьями расчёта. [1] [4]

`RECYCLERS` — массив объектов `{ id, name, efficiency, seconds, powergrid, source }`. ID: `green`, `yellow`, `red`. Базовые пары efficiency/seconds: green `0.5 / 5`, yellow `0.4 / 8`, red `0.75 / 4`. `powergrid` без изменения сохраняет `requiredStage`, `efficiencyStage`, `efficiency`, `durationStage`, `seconds` источника. Red требует powergrid stage **4**. У green efficiency-бонус на stage **2** даёт **0.6**, а duration-бонус на stage **4** — **4.5 секунды**. Движок не принимает stage и **не применяет бонусы автоматически**: green всегда базовые 0.5 и 5; red допустим только там, где выполнено требование stage 4. Нулевые поля бонусов означают отсутствие соответствующего бонуса в записи, а не мгновенную переработку. [5]

`RAID_TARGETS` — массив `{ id, name, category, grade, hp, prefab, itemShortname, damage, upstreamHits, buildingCost, source, buildingSource }`. `damage` — словарь `explosiveShortname → hardDamage`, без округления извлечённых float. `upstreamHits` сохраняет опубликованный `hard` для контроля формулы. `buildingCost` — стоимость одной постройки/улучшения grade из `building.json`, **не** стоимость рейда; для дверей пустой массив. `prefab`, `itemShortname`, `grade`, `buildingSource` могут быть `null` в зависимости от типа цели. [6] [7]

ID целей в стабильном порядке:

```text
wall.wood      wall.stone      wall.metal      wall.armored
floor.wood     floor.stone     floor.metal     floor.armored
door.wood      door.metal      door.armored    garage
external.wood  external.stone
```

Walls/floors используют полные HP `250 / 500 / 1000 / 2000`. Двери — одиночные hinged wood / sheet metal / armored (`200 / 250 / 1000 HP`); garage — `wall.frame.garagedoor`, **600 HP в этом snapshot**. External wood/stone — `wall.external.high` / `wall.external.high.stone`, обе 500 HP. Эти значения не заменены привычными числами из старых сторонних таблиц. [6] [7]

`EXPLOSIVES` — массив `{ id, shortname, itemId, name, crafting, source }` из шести реальных shortname:

```text
explosive.timed       Timed Explosive Charge / C4
ammo.rocket.basic    Rocket — обычная, НЕ подмена HV
ammo.rocket.hv       High Velocity Rocket
explosive.satchel    Satchel Charge
grenade.beancan      Beancan Grenade
ammo.rifle.explosive Explosive 5.56 Rifle Ammo
```

Все шесть подтверждены и в `items.json`, и фактическим уроном в `raid.json`. Если при обновлении данных обязательная запись отсутствует, генератор останавливается, а не дописывает выдуманный урон. `DATA_META.craftingItems` — словарь минимального замыкания их **крафтабельных** рецептов, включая именованные конечные ресурсы: `{ [shortname]: { name, category, crafting } }`. `crafting` имеет ту же форму, что в `ITEMS`. [4] [6]

## Экспорты `assets/engine.js`

```js
import {
  calculateRaid, calculateRecycle, validQuantity,
  steamIdFromInput, extractSteamIds
} from './assets/engine.js';
```

`validQuantity(value) → boolean`: только JS `number`, целое, от **1 до 999 включительно**. Строки `'1'`, `NaN`, `Infinity`, дроби, `BigInt`, boolean недопустимы. UI должен явно преобразовать значение поля ввода через `Number` перед валидацией. Входящие quantity в вычислительных функциях проверяются повторно; неверное количество вызывает `RangeError`.

### Рейд

`calculateRaid(targetId, quantity, { all = true } = {})` возвращает:

```js
{
  target, quantity, totalHp, minSulfur,
  options: [{
    id, shortname, name, damage, unitsPerTarget, units,
    sulfur, craftedUnits, surplus,
    rawResources: [{ shortname, name, amount }],
    components: [{ shortname, name, amount }],
    crafted: [{ shortname, name, requested, batches, produced,
                surplus, batch, ingredients: [{ shortname, name, amount }] }],
    gunpowder, // строка из crafted для gunpowder либо null
    source
  }],
  conditions, craftingAssumptions,
  model: 'snapshot-direct-impact', warning
}
```

Для каждого типа боеприпаса `unitsPerTarget = Math.ceil(target.hp / damage)`, `units = unitsPerTarget * quantity`. **Сначала округляется каждая отдельная цель**, поэтому избыточный урон по одной стене не переносится на следующую. Полные HP, vanilla, hard side, каждое попадание в центре взрыва. Soft side не используется, fire ticks и splash по соседним целям не суммируются; оружие/launcher, стоимость приобретения оружия, перезарядка, осечки и время рейда в модель не включены. Float урона не округляется перед `ceil`. Поэтому, например, sheet door требует **5 satchel** и **63 explosive ammo**, а armored door — **251 explosive ammo**, согласно именно этому snapshot. [1] [6]

`options` отсортированы **по суммарной сере `sulfur` по возрастанию**, затем по `units`, затем по ID. `minSulfur` — минимальная стоимость среди всех доступных способов (либо `null`, если способов нет). `all: false` оставляет **все равные по minSulfur варианты**, а не первый вариант по минимальному числу боеприпасов. Неверный target ID вызывает `RangeError`.

Крафт стартует с пустого склада. Для каждого действительно крафтабельного предмета агрегируется потребность всех родительских рецептов, затем один раз вычисляется `batches = ceil(requested / batch)`. Расходы партии рекурсивно раскрываются до записей без крафтабельного рецепта. `components` показывает непосредственные ингредиенты всего крафта выбранного боеприпаса; `crafted` — каждую изготовленную позицию, включая все промежуточные материалы и излишки. `gunpowder.requested` — **весь использованный порох**, включая потребность промежуточного `explosives`, а `produced` — изготовленный с учётом партии. `rawResources` — конечные материалы/компоненты, не дополнительный расход поверх `components`: их **нельзя складывать друг с другом**.

Термин «raw» здесь значит лист **дерева крафта**, не дерево плавки/добычи: sulfur, metal fragments и high quality metal не переводятся в ore, а charcoal — в дрова. Некрафтабельные techparts и rope остаются компонентами, даже если upstream имеет для них сериализованные некрафтабельные рецепты. Крафтабельный metalpipe раскрывается в HQM и scrap; lowgradefuel — в animal fat и cloth с batch 4. Не включены затраты на изучение blueprint и строительство workbench. [4]

Контрольный пример: `calculateRaid('door.metal', 1)` имеет `minSulfur: 1600`; первый вариант — **63 explosive 5.56**, изготовить **64**, surplus **1**, gunpowder **640**, sulfur **1600**, charcoal **1920**, metal fragments **320**. Одна обычная rocket требует суммарно **650 gunpowder** и **1400 sulfur**; из 30 требуемых lowgradefuel крафтится 32, два остаются. Это расчёт партий из фактических рецептов, а не справочная цена единицы, умноженная без проверки batch. [4] [6]

### Переработка

`calculateRecycle(lines, tierId)` принимает **массив** `[{ id: itemShortname, quantity: integer }]`. `id` совпадает с `ITEMS[].id`, а не `itemId`. Допускаются повторные строки и пустой массив. Пустой массив даёт нулевой timeSeconds и outputs `[]`. Неверный tier/item ID вызывает `RangeError`; неверный тип lines или строка `null` — `TypeError`.

Результат:

```js
{
  tier, inputs: [{ id, name, quantity }], totalQuantity,
  outputs: [{ shortname, name, amount, expected: true }],
  expected: true, timeSeconds, timeModel, conditions
}
```

Выход агрегируется по `shortname`: **`Σ baseOutputAtEfficiency1 × tier.efficiency × quantity`**. `amount` — математическое ожидание, не гарантированная целая выдача. **Не применять `floor`, `ceil` или округление до целого к результату**. В игре дробные части разыгрываются как вероятности. Для одного techparts у red ожидается scrap 30 и HQM **1.5**, а не гарантированно 1 либо 2. UI должен подписать результат «Ожидаемый выход». Предполагается **полная прочность**, без коррекции damaged предметов, серверных модификаторов и powergrid-бонусов green. [1] [4] [5]

`timeSeconds = totalQuantity * tier.seconds` — оценка **последовательной обработки по одному предмету**, использующая настоящую длительность tier из snapshot. Это не измеренное время обработки игровых стаков/слотов: snapshot не задаёт алгоритм количества предметов за один inventory cycle. UI обязан подписать время как **оценку**, а не гарантированный таймер. `timeModel` явно содержит это ограничение. Все оригинальные `powergrid`-условия доступны в `tier.powergrid`; red stage 4 должен быть пояснён рядом с выбором tier.

### SteamID64

`steamIdFromInput(input) → string | null` принимает **только строку**: голые 17 цифр либо строго `http(s)://steamcommunity.com/profiles/<17 digits>` с необязательным завершающим `/`. Пробелы по краям убираются, регистр схемы/домена нечувствителен. Отсутствие схемы, vanity `/id/…`, `www`, credentials, port, query, hash, extra path и любые иные домены отклоняются. URL нигде не открывается и не загружается.

Проверка через `BigInt` извлекает universe/type/instance/accountId: **public universe 1, individual type 1, desktop instance 1, accountId 1…2³²−1**. Это не проверка префикса `7656119`. Принятое значение остаётся строкой без потери точности; `number` отклоняется. Проверка структуры не доказывает существование аккаунта и не определяет приватность профиля.

`extractSteamIds(text) → string[]`: разбивает строку по пробелам, переводам строк, запятым и точкам с запятой; каждый **целый токен** проходит `steamIdFromInput`. Дубликаты убираются с сохранением порядка первого появления. Возвращает `[]` для нестрокового ввода. **Не** извлекает похожие цифры из произвольных URL или их query. Это сознательно строгий parser списков: произвольная пунктуация внутри токена не удаляется.

## Обновление и тесты

Требуется Python 3 standard library (`urllib`), без `pip install`. Генератор меняет только выходной `assets/data.js`, по умолчанию относительно своего расположения; исходники загружает в память.

```sh
python3 scripts/update-data.py
# Сначала commits/master, затем пять raw URL только по одному полученному SHA.

python3 scripts/update-data.py --commit 1204329518584db8e7f242e0f5671edeebf9d18e
# Воспроизводимый rebuild конкретного commit.

python3 scripts/update-data.py --snapshot-dir /tmp/rustutil-snapshot \
  --commit 1204329518584db8e7f242e0f5671edeebf9d18e --output /tmp/rebuilt-data.js
# Офлайн: директория содержит commit.json и items/recyclers/raid/building/meta.json.

node --test tests/engine.test.js
```

Генератор фиксирует полный SHA до загрузки, сохраняет SHA256 пяти оригинальных файлов, сверяет HP block целей между `raid.json` и `building.json`, не использует текущее время в output, детерминированно сортирует каталог и closure рецептов. Повторная генерация тех же байтов даёт тот же `data.js`. Офлайн-кэш должен содержать именно байты одного commit; cache SHA проверяется при явном `--commit`.

Тесты — `node:test`/`node:assert`, без сторонних зависимостей. Проверены все 1001 × 3 комбинации item/tier, все 14 raid targets при quantity 1/3/999, сравнение counts с upstream, ожидания дробей, запрет неверных quantity и ID, рекурсивные расходы/партии, sulfur sorting, отсутствие мутаций, корректные/опасные SteamID и URL. Контрольные числа snapshot в тестах намеренно закреплены: после обновления build нужно сверить изменившиеся upstream значения и обновить соответствующие assertions, а не ослаблять проверки ради зелёного статуса.

На этом snapshot: **19 тестов, 19 pass, 0 fail** (`node --test tests/engine.test.js`, Node v22.23.4).

## References

[1]: https://raw.githubusercontent.com/bobosneefdev/rust-items-json/1204329518584db8e7f242e0f5671edeebf9d18e/README.md "Upstream README: формулы, условия и правообладатель"
[2]: https://api.github.com/repos/bobosneefdev/rust-items-json/commits/master "GitHub public API: разрешение master в полный commit SHA"
[3]: https://raw.githubusercontent.com/bobosneefdev/rust-items-json/1204329518584db8e7f242e0f5671edeebf9d18e/data/meta.json "Закреплённый snapshot: Rust build и времена upstream"
[4]: https://raw.githubusercontent.com/bobosneefdev/rust-items-json/1204329518584db8e7f242e0f5671edeebf9d18e/data/items.json "Все предметы, рецепты и выходы efficiency 1"
[5]: https://raw.githubusercontent.com/bobosneefdev/rust-items-json/1204329518584db8e7f242e0f5671edeebf9d18e/data/recyclers.json "Recycler efficiency, длительности и powergrid"
[6]: https://raw.githubusercontent.com/bobosneefdev/rust-items-json/1204329518584db8e7f242e0f5671edeebf9d18e/data/raid.json "HP, фактический hard-side damage и число попаданий"
[7]: https://raw.githubusercontent.com/bobosneefdev/rust-items-json/1204329518584db8e7f242e0f5671edeebf9d18e/data/building.json "Строительные grades, HP и стоимость"
[8]: https://wiki.rustclash.com/building/stone-wall "Stone Wall: сравнение satchel и weapon-specific explosive ammo"
