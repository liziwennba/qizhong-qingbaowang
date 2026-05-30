#!/usr/bin/env python3
from collections import defaultdict
from datetime import datetime
from openpyxl import load_workbook
import hashlib, json, os, sys

if len(sys.argv) < 3:
    print("用法: python convert_xlsx_to_player_data.py 输入.xlsx 输出/player-data.js [输出/player-data.json]")
    sys.exit(1)

xlsx = sys.argv[1]
out_js = sys.argv[2]
out_json = sys.argv[3] if len(sys.argv) >= 4 else os.path.splitext(out_js)[0] + '.json'
wb = load_workbook(xlsx, read_only=True, data_only=True)
ws = wb[wb.sheetnames[0]]
rows = ws.iter_rows(values_only=True)
headers = next(rows)
header_map = {str(v).strip(): i for i, v in enumerate(headers) if v is not None}

name_idx = header_map.get('名字', 0)
red_sum_idx = header_map.get('阵容红度')
main_idx = header_map['大营武将']
middle_idx = header_map['中军武将']
front_idx = header_map['前锋武将']
main_skill_idx = header_map.get('大营技能')
middle_skill_idx = header_map.get('中军技能')
front_skill_idx = header_map.get('前锋技能')
record_type_idx = header_map['记录类型']
time_idx = header_map['记录时间']


def clean_lines(cell):
    if cell is None:
        return []
    s = str(cell).replace('\r', '\n')
    return [p.strip() for p in s.split('\n') if p and str(p).strip()]


def extract_slot(general_cell, skill_cell):
    parts = clean_lines(general_cell)
    skills = clean_lines(skill_cell)
    red = ''
    level = ''
    name = ''
    if parts:
        if len(parts) >= 1 and '红' in parts[0]:
            red = parts[0]
        if len(parts) >= 2 and '级' in parts[1]:
            level = parts[1]
        name = parts[-1]
    return {
        'name': name,
        'red': red,
        'level': level,
        'skills': skills,
    }


def norm_time(value):
    if value is None:
        return ''
    if isinstance(value, datetime):
        return value.strftime('%Y/%m/%d %H:%M:%S')
    s = str(value).strip()
    for fmt in ['%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M', '%Y-%m-%d %H:%M']:
        try:
            return datetime.strptime(s, fmt).strftime('%Y/%m/%d %H:%M:%S')
        except Exception:
            pass
    return s


def sort_key_time(s):
    try:
        return datetime.strptime(s, '%Y/%m/%d %H:%M:%S')
    except Exception:
        return datetime.min


def source_signature(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()[:16]


def safe_value(row, idx):
    if idx is None or idx >= len(row):
        return None
    return row[idx]


def lineup_name_text(main_slot, middle_slot, front_slot):
    return ' / '.join([
        main_slot.get('name') or '-',
        middle_slot.get('name') or '-',
        front_slot.get('name') or '-',
    ])


player_records = defaultdict(list)
record_count = 0
latest_record_time = ''
for row in rows:
    if not row:
        continue
    name = row[name_idx] if name_idx < len(row) else None
    if name is None:
        continue
    name = str(name).strip()
    if not name:
        continue

    main_slot = extract_slot(safe_value(row, main_idx), safe_value(row, main_skill_idx))
    middle_slot = extract_slot(safe_value(row, middle_idx), safe_value(row, middle_skill_idx))
    front_slot = extract_slot(safe_value(row, front_idx), safe_value(row, front_skill_idx))
    team_red = safe_value(row, red_sum_idx)
    team_red_text = '' if team_red is None else str(team_red).strip()
    record_type = str(safe_value(row, record_type_idx) or '未知记录').strip() or '未知记录'
    t = norm_time(safe_value(row, time_idx))
    record_count += 1
    if sort_key_time(t) > sort_key_time(latest_record_time):
        latest_record_time = t
    player_records[name].append({
        'time': t,
        'recordType': record_type,
        'teamRed': team_red_text,
        'main': main_slot.get('name', ''),
        'middle': middle_slot.get('name', ''),
        'front': front_slot.get('name', ''),
        'mainSlot': main_slot,
        'middleSlot': middle_slot,
        'frontSlot': front_slot,
        'lineupText': lineup_name_text(main_slot, middle_slot, front_slot),
    })

players = {}
player_list = []
for name in sorted(player_records.keys(), key=lambda x: x.lower()):
    recs = sorted(player_records[name], key=lambda r: sort_key_time(r['time']), reverse=True)
    grouped = {}
    order = []
    for r in recs:
        key = (
            r['mainSlot'].get('name', ''), r['mainSlot'].get('red', ''), r['mainSlot'].get('level', ''), tuple(r['mainSlot'].get('skills', [])),
            r['middleSlot'].get('name', ''), r['middleSlot'].get('red', ''), r['middleSlot'].get('level', ''), tuple(r['middleSlot'].get('skills', [])),
            r['frontSlot'].get('name', ''), r['frontSlot'].get('red', ''), r['frontSlot'].get('level', ''), tuple(r['frontSlot'].get('skills', [])),
        )
        if key not in grouped:
            grouped[key] = {
                'lineupText': r['lineupText'],
                'main': r['main'],
                'middle': r['middle'],
                'front': r['front'],
                'mainSlot': r['mainSlot'],
                'middleSlot': r['middleSlot'],
                'frontSlot': r['frontSlot'],
                'teamRed': r['teamRed'],
                'count': 0,
                'latestTime': r['time'],
                'recordTypes': [],
            }
            order.append(key)
        g = grouped[key]
        g['count'] += 1
        if r['recordType'] not in g['recordTypes']:
            g['recordTypes'].append(r['recordType'])
        if sort_key_time(r['time']) > sort_key_time(g['latestTime']):
            g['latestTime'] = r['time']
            g['teamRed'] = r['teamRed']
    lineups = sorted([grouped[k] for k in order], key=lambda x: sort_key_time(x['latestTime']), reverse=True)
    recent_records = [{
        'time': r['time'],
        'recordType': r['recordType'],
        'teamRed': r['teamRed'],
        'lineupText': r['lineupText'],
        'mainSlot': r['mainSlot'],
        'middleSlot': r['middleSlot'],
        'frontSlot': r['frontSlot'],
    } for r in recs[:20]]
    latest = lineups[0] if lineups else None
    players[name] = {
        'name': name,
        'totalRecords': len(recs),
        'lineups': lineups,
        'lineupCount': len(lineups),
        'recentRecords': recent_records,
        'latestLineup': latest,
    }
    player_list.append({
        'name': name,
        'totalRecords': len(recs),
        'lineupCount': len(lineups),
        'latestLineupText': latest['lineupText'] if latest else '',
    })

payload = {
    'updatedAt': f'由 {os.path.basename(xlsx)} 自动生成（{record_count} 条记录）',
    'sourceFile': os.path.basename(xlsx),
    'sourceSignature': source_signature(xlsx),
    'sourceRecordCount': record_count,
    'sourceLatestRecordTime': latest_record_time,
    'playerCount': len(players),
    'players': players,
    'playerList': player_list,
}
with open(out_js, 'w', encoding='utf-8') as f:
    f.write('window.PLAYER_DB = ')
    json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print(f'已生成: {out_js}')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(f'已生成: {out_json}')
