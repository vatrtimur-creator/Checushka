#!/usr/bin/env python3
"""Пересобрать локальный каталог из одного закреплённого snapshot GitHub."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.request

REPO = 'bobosneefdev/rust-items-json'
FILES = ('items', 'recyclers', 'raid', 'building', 'meta')
EXPLOSIVE_IDS = ('explosive.timed', 'ammo.rocket.basic', 'ammo.rocket.hv',
                 'explosive.satchel', 'grenade.beancan', 'ammo.rifle.explosive')


def download(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'rustutil-snapshot-builder',
                                               'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def build(commit, blobs):
    sha = commit['sha']
    data = {name: json.loads(blob) for name, blob in blobs.items()}
    index = {item['shortname']: item for item in data['items']}
    raw_root = f'https://raw.githubusercontent.com/{REPO}/{sha}'
    sources = {name: f'{raw_root}/data/{name}.json' for name in FILES}

    def materials(values):
        return [{'shortname': v['item'], 'name': index[v['item']]['name'],
                 'amount': v['amount']} for v in values]

    def recipe(item):
        c = item.get('crafting')
        if not c:
            return None
        return {'batch': c['amount'], 'craftable': c['craftable'],
                'workbench': c['workbench'], 'seconds': c['time'],
                'ingredients': materials(c['ingredients'])}

    items = []
    for item in sorted(index.values(), key=lambda item: item['shortname']):
        if not item.get('recycle'):
            continue
        items.append({'id': item['shortname'], 'shortname': item['shortname'],
                      'itemId': item['id'], 'name': item['name'],
                      'category': item['category'], 'hidden': item['hidden'],
                      'condition': item['condition'], 'crafting': recipe(item),
                      'output': materials(item['recycle']), 'source': sources['items']})
    if len(items) < 60:
        raise ValueError('Недостаточный каталог переработки')

    crafting_items = {}

    def collect(shortname):
        if shortname in crafting_items:
            return
        item = index[shortname]
        crafting_items[shortname] = {'name': item['name'], 'category': item['category'],
                                    'crafting': recipe(item)}
        c = item.get('crafting')
        if c and c['craftable']:
            for ingredient in c['ingredients']:
                collect(ingredient['item'])

    explosives = []
    for shortname in EXPLOSIVE_IDS:
        if shortname not in index or not any(shortname in r['explosives'] for r in data['raid']):
            raise ValueError(f'Нет подтверждённой взрывчатки: {shortname}')
        item = index[shortname]
        collect(shortname)
        explosives.append({'id': shortname, 'shortname': shortname, 'itemId': item['id'],
                           'name': item['name'], 'crafting': recipe(item),
                           'source': sources['items']})

    buildings = {b['prefab']: b for b in data['building']}
    targets = []

    def target(target_id, row, name, category, grade=None, cost=None):
        damage = {shortname: row['explosives'][shortname]['hardDamage']
                  for shortname in EXPLOSIVE_IDS
                  if shortname in row['explosives'] and row['explosives'][shortname]['hardDamage'] > 0}
        if not damage:
            raise ValueError(f'Нет урона для {target_id}')
        targets.append({'id': target_id, 'name': name, 'category': category,
                        'grade': grade, 'hp': row['health'],
                        'prefab': row.get('prefab'), 'itemShortname': row.get('item'),
                        'damage': damage,
                        'upstreamHits': {n: row['explosives'][n]['hard'] for n in damage},
                        'buildingCost': materials(cost) if cost else [],
                        'source': sources['raid'],
                        'buildingSource': sources['building'] if cost else None})

    for kind in ('wall', 'floor'):
        prefab = f'assets/prefabs/building core/{kind}/{kind}.prefab'
        building = buildings[prefab]
        for grade in ('wood', 'stone', 'metal', 'armored'):
            row = next(r for r in data['raid'] if r.get('prefab') == prefab and r.get('grade') == grade)
            bgrade = next(g for g in building['grades'] if g['grade'] == grade)
            if bgrade['health'] != row['health']:
                raise ValueError(f'Несогласованное HP {kind}.{grade}')
            target(f'{kind}.{grade}', row, f'{grade.title()} {building["name"]}',
                   kind, grade, bgrade['cost'])
    for target_id, shortname, category in (
        ('door.wood', 'door.hinged.wood', 'door'),
        ('door.metal', 'door.hinged.metal', 'door'),
        ('door.armored', 'door.hinged.toptier', 'door'),
        ('garage', 'wall.frame.garagedoor', 'door'),
        ('external.wood', 'wall.external.high', 'external'),
        ('external.stone', 'wall.external.high.stone', 'external'),
    ):
        row = next(r for r in data['raid'] if r.get('item') == shortname)
        target(target_id, row, index[shortname]['name'], category)

    recyclers = [{'id': r['type'], 'name': r['type'].title(), 'efficiency': r['efficiency'],
                  'seconds': r['seconds'], 'powergrid': r['powergrid'],
                  'source': sources['recyclers']} for r in data['recyclers']]
    meta = {'schemaVersion': 1, 'repository': f'https://github.com/{REPO}',
            'commit': sha, 'commitDate': commit['commit']['committer']['date'],
            'build': data['meta']['build'], 'buildId': data['meta']['build'],
            'checked': data['meta']['checked'],
            'updated': data['meta']['updated'], 'readme': f'{raw_root}/README.md',
            'sources': sources,
            'sha256': {n: hashlib.sha256(blobs[n]).hexdigest() for n in FILES},
            'upstreamItemCount': len(index), 'recyclableItemCount': len(items),
            'ownership': 'Rust data belongs to Facepunch Studios; extractor code is MIT. Unaffiliated.',
            'raidModel': 'snapshot-direct-impact',
            'raidWarning': 'Модель прямого урона snapshot, не подтверждённое число для рейда в игре. Stone wall: модель 13 satchel / 200 explosive ammo; Rust Wiki 10 satchel / 185 ammo из SAR. Оружие и способ применения влияют на урон.',
            'raidComparisonSource': 'https://wiki.rustclash.com/building/stone-wall',
            'conditions': {'recycle': 'Expected fractional outputs; full durability; base powergrid stages.',
                           'raid': 'Direct-impact snapshot model, not verified full in-game raid requirements. Vanilla asset settings; full HP; hard side; blast centre; separate targets; weapon and entity overrides excluded.',
                           'crafting': 'Craftable recipes only; aggregate shared intermediates; whole batches; no stock.'},
            'craftingItems': {k: crafting_items[k] for k in sorted(crafting_items)}}
    exports = {'DATA_META': meta, 'ITEMS': items, 'RECYCLERS': recyclers,
               'RAID_TARGETS': targets, 'EXPLOSIVES': explosives}
    return '// Создан scripts/update-data.py; snapshot закреплён по commit SHA.\n' + ''.join(
        f'export const {name} = {json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)};\n'
        for name, value in exports.items())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', help='40-символьный SHA; по умолчанию commits/master')
    parser.add_argument('--snapshot-dir', type=Path, help='Офлайн: commit.json и пять JSON из одного snapshot')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/data.js')
    args = parser.parse_args()
    if args.commit and not re.fullmatch(r'[0-9a-f]{40}', args.commit):
        parser.error('--commit должен быть полным SHA')
    if args.snapshot_dir:
        commit = json.loads((args.snapshot_dir / 'commit.json').read_bytes())
        blobs = {name: (args.snapshot_dir / f'{name}.json').read_bytes() for name in FILES}
        if args.commit and commit['sha'] != args.commit:
            parser.error('SHA офлайн snapshot не совпадает')
    else:
        ref = args.commit or 'master'
        commit = json.loads(download(f'https://api.github.com/repos/{REPO}/commits/{ref}'))
        sha = commit['sha']
        blobs = {name: download(f'https://raw.githubusercontent.com/{REPO}/{sha}/data/{name}.json')
                 for name in FILES}
    output = build(commit, blobs)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding='utf-8')
    print(f'{args.output}: commit {commit["sha"]}, {len(output.encode("utf-8"))} bytes')


if __name__ == '__main__':
    main()
