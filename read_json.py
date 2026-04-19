import json
from collections import Counter
from datetime import timedelta

# ===== ЗДЕСЬ ЗАДАЁТЕ ИМЯ ФАЙЛА =====
filename = "ex/res_5.json"  # поменяйте на нужное имя
# ===================================

with open(filename, 'r', encoding='utf-8') as f:
    data = json.load(f)

page = data.get('page', '?')
total_sec = data.get('total_duration_seconds', 0)
emotions = [e['emotion'] for e in data.get('emotion_log', [])]

if not emotions:
    print("Нет записей эмоций")
else:
    counter = Counter(emotions)
    total = len(emotions)
    print(f"Страница: {page}")
    print(f"Длительность: {timedelta(seconds=total_sec)} ({total_sec} с)")
    print("Эмоции:")
    for emo, cnt in counter.most_common():
        print(f"  {emo}: {cnt} ({cnt/total*100:.1f}%)")