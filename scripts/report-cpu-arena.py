import json
import pathlib
import re
import sys

directory = pathlib.Path(sys.argv[1])
finding = json.load((directory / 'finding.json').open())
overview = json.load((directory / 'overview.json').open())
source = pathlib.Path('apps/server/src/battle/cpu/controller.ts').read_text()
revision = int(re.search(r'policyRevision: (\d+)', source).group(1))
lines = [f"# 第 {int(directory.name)} 轮：{finding['title']}", '',
         '三张地图的正式纯 CPU 对局均已自然结算并退出。时间按各局正式开局后的秒数记录。', '',
         '## 对局与逐车数据', '']
for room in overview:
    lines += [f"### {room['roomId']}：地图 {room['mapId']}", '',
              f"策略版本 {room['revisions']}；{room['samples']} 个采样，缺口 {room['gaps']}，丢弃 {room['dropped']}。"
              f"更新均值 {room['timing']['meanStepMs']}ms，最大 {room['timing']['maxStepMs']}ms。", '',
              '| 实体 | 车型 | 最大物理停滞／秒 | 时刻／秒 | 分支 | 前后反转 | 重规划 |',
              '| --- | ---: | ---: | ---: | --- | ---: | ---: |']
    for cpu in room['cpus']:
        lines.append(f"| {cpu['id']} | {cpu['tankId']} | {cpu['maxStall']} | {cpu['at']} | "
                     f"{cpu['source']} | {cpu['reversals']} | {cpu['replans']} |")
    lines.append('')
    reactions_file = directory / room['roomId'] / 'reactions.json'
    if reactions_file.exists():
        reactions = json.load(reactions_file.open())
        lines += ['| 实体 | 敌方命中次数 | 受击后存活5秒窗口 | 最长倒车段／秒 | 受击目标切换 | 就地破障选择 |',
                  '| --- | ---: | ---: | ---: | ---: | ---: |']
        for cpu in reactions['cpus']:
            lines.append(f"| {cpu['id']} | {cpu['hitsReceived']} | {cpu['survivedWindows']} | {cpu['maxReverse']} | "
                         f"{cpu.get('attackerSwitches', '未汇总')} | "
                         f"{cpu.get('localBreachSelections') if cpu.get('localBreachSelections') is not None else '未记录'} |")
        lines += ['', '命中按真实事件记录，5秒窗口可以重叠；倒车段允许不超过一秒的短暂停顿，死亡与重新前进会结束该段。', '']
lines += ['## 原始证据', ''] + [f'- {item}' for item in finding['evidence']]
lines += ['', f'## 本轮调整：revision={revision}', ''] + [f'- {item}' for item in finding['change']]
state = json.load((directory.parent / 'status.json').open())
application = '三个旧房间进程已退出；下一轮新建进程读取更新后的源码。' if int(directory.name) < state['limit'] else '最后三个房间进程已退出；本批达到轮次上限，停止开局。'
lines += ['', '## 应用与观察', '', application +
          '不同地图和随机车型的统计用于发现行为，不构成固定场景的改善百分比。']
if finding.get('notes'):
    lines += ['', finding['notes']]
(directory / 'report.md').write_text('\n'.join(lines)+'\n')
evidence = []
for window in finding.get('windows', []):
    trace = directory / window['roomId'] / 'trace.ndjson'
    for line in trace.open():
        record = json.loads(line)
        seconds = (record['at']-record['startedAt'])/1000
        if window['from'] <= seconds <= window['to']:
            tank = next(tank for tank in record['tanks'] if tank['id'] == window['id'])
            evidence.append(dict(roomId=window['roomId'], seconds=round(seconds, 3),
                                 tank=tank, peers=[other for other in record['tanks'] if other['id'] != tank['id']]))
(directory / 'evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
print(directory / 'report.md')
