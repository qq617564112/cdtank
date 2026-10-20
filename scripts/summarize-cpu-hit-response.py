import collections
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
state = json.load((root / 'status.json').open())
rounds = []
rooms = []
for round_state in state['rounds']:
    directory = root / f"{round_state['iteration']:02}"
    if not (directory / 'reactions.json').exists():
        continue
    finding = json.load((directory / 'finding.json').open())
    overview = {room['roomId']: room for room in json.load((directory / 'overview.json').open())}
    round_rooms = []
    for reaction in json.load((directory / 'reactions.json').open()):
        room_id = reaction['roomId']
        room_dir = directory / room_id
        finished = json.load((room_dir / 'finished.json').open())
        settlement = json.load((room_dir / 'settlement.json').open())
        analysis = json.load((room_dir / 'analysis.json').open())['rounds'][0]
        summary = overview[room_id]
        runs = [{'id': cpu['id'], **run} for cpu in reaction['cpus'] for run in cpu['reverseRuns']]
        responses = [response for cpu in reaction['cpus'] for response in cpu['hitResponses']]
        ignored = [response for response in responses
                   if response['survived'] and response.get('attackerDistance', 1000) < 400
                   and not response.get('attackerConcealedAtHit')
                   and response.get('targetAtHit') != response['attackerId']
                   and response.get('counterTargetSeconds') is None and response['shots'] == 0]
        row = dict(iteration=round_state['iteration'], roomId=room_id, mapId=reaction['mapId'],
                   mapName=next(match['name'] for match in round_state['matches'] if match['roomId'] == room_id),
                   players=len(reaction['cpus']), cpuOnly=all(p['cpu'] for p in settlement['participants']),
                   reason=finished['reason'], revisions=summary['revisions'], samples=summary['samples'],
                   gaps=summary['gaps'], dropped=summary['dropped'], skippedLines=analysis.get('skippedLines', 0),
                   hits=reaction['hits'], hitWindows=len(responses), ignoredCloseHitWindows=len(ignored),
                   attackerSwitches=sum(cpu.get('attackerSwitches', 0) for cpu in reaction['cpus']),
                   localBreachSelections=sum(cpu.get('localBreachSelections', 0) or 0 for cpu in reaction['cpus']),
                   maxReverse=max((cpu['maxReverse'] for cpu in reaction['cpus']), default=0),
                   longestReverse=sorted(runs, key=lambda run: -run['seconds'])[:3],
                   maxStall=max(cpu['maxStall'] for cpu in summary['cpus']), timing=summary['timing'])
        rooms.append(row)
        round_rooms.append(row)
    rounds.append(dict(iteration=round_state['iteration'], phase=round_state['phase'],
                       title=finding['title'], rooms=round_rooms))
source = pathlib.Path('apps/server/src/battle/cpu/controller.ts').read_text()
summary = dict(rounds=len(rounds), requestedRounds=state['limit'], matches=len(rooms),
               maps=len({room['mapId'] for room in rooms}),
               cpuParticipations=sum(room['players'] for room in rooms),
               samples=sum(room['samples'] for room in rooms),
               gaps=sum(room['gaps'] for room in rooms), dropped=sum(room['dropped'] for room in rooms),
               skippedLines=sum(room['skippedLines'] for room in rooms),
               allCompleted=all(r['phase'] == 'COMPLETE' for r in state['rounds']),
               cpuOnly=all(room['cpuOnly'] for room in rooms),
               hits=sum(room['hits'] for room in rooms),
               attackerSwitches=sum(room['attackerSwitches'] for room in rooms),
               localBreachSelections=sum(room['localBreachSelections'] for room in rooms),
               reasons=dict(collections.Counter(room['reason'] for room in rooms)),
               finalSourceRevision=int(re.search(r'policyRevision: (\d+)', source).group(1)),
               lastPlayedRevisions=rounds[-1]['rooms'][0]['revisions'] if rounds else [],
               maxStepMs=max((room['timing']['maxStepMs'] for room in rooms), default=0))
(root / 'summary.json').write_text(json.dumps(dict(summary=summary, rounds=rounds),
                                             ensure_ascii=False, indent=2) + '\n')
lines = ['# CPU 受击与倒车实战迭代', '',
         f"已归档 {summary['rounds']}/{summary['requestedRounds']} 轮、{summary['matches']} 场、"
         f"{summary['maps']} 张地图、{summary['cpuParticipations']} 车次。"
         f"记录 {summary['hits']} 次敌方正伤害命中、{summary['samples']} 个轨迹样本；"
         f"采样缺口 {summary['gaps']}、丢弃 {summary['dropped']}、跳过行 {summary['skippedLines']}。", '',
         f"全部轮次完成：{summary['allCompleted']}。全部参与者为 CPU：{summary['cpuOnly']}。"
         f"最终源码策略 {summary['finalSourceRevision']}，最后一轮参战策略 {summary['lastPlayedRevisions']}。", '',
         '每轮随机三张正式团队地图，各自运行独立房间，使用真实时钟、50ms 更新、正式角色与碰撞规则。'
         '每场正常上限300秒，达到胜负条件可以提前结束；三场全部结算归档后才决定本轮调整。', '',
         '## 逐轮结果', '',
         '| 轮 | 参战策略 | 有效命中 | 最长倒车／秒 | 分析与调整 |',
         '| --- | --- | ---: | ---: | --- |']
for round_row in rounds:
    round_rooms = round_row['rooms']
    revisions = sorted({v for room in round_rooms for v in room['revisions']})
    iteration = round_row['iteration']
    lines.append(f"| {iteration} | {revisions} | {sum(room['hits'] for room in round_rooms)} | "
                 f"{max(room['maxReverse'] for room in round_rooms)} | "
                 f"[{round_row['title']}]({iteration:02}/report.md) |")
lines += ['', '## 结算与负载', '',
          f"结算原因：{summary['reasons']}。记录到的最大单次更新耗时 {summary['maxStepMs']}ms。"
          '每个房间的均值、峰值和超预算次数见 summary.json，拥挤和原地转向仍按原始窗口核对。', '',
          '## 记录与限制', '',
          '每轮保存 before、after、changes.diff、逐车 overview.json、reactions.json、finding.json、'
          'report.md 与 evidence.json。每房保存正式结算、启动与结束信息、服务日志、完整轨迹、'
          'combat-events.json 和离线分析。第二轮 World 的受伤通知另存 world-before.ts、world-after.ts。', '',
          '受击窗口按真实敌方正伤害命中建立，五秒窗口可重叠；其中存活窗口不代表独立样本生存率。'
          '倒车段允许一秒以内短暂停顿，500ms采样不能覆盖所有帧间进退变化，需结合累计反转次数。', '',
          '近处受击后未瞄准攻击者且未开火属于筛查信号；仍须排除隐形、原目标交战、射线遮挡、'
          '装填、固定炮塔对齐、权限及死亡。前四轮未记录光学隐形，后续轮次已补充。'
          '不同随机地图和车型之间不构成固定场景的改善百分比。']
(root / 'report.md').write_text('\n'.join(lines) + '\n')
print(json.dumps(summary, ensure_ascii=False))
