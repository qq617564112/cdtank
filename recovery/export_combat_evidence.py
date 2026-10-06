"""Export original client fire selection and cooldown call paths."""
import json
from pathlib import Path
import struct

import capstone
import pefile
from inspect_assets import read_table

ROOT = Path(__file__).resolve().parents[1]


def export():
    pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
    base = pe.OPTIONAL_HEADER.ImageBase
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

    def data(address, size):
        return pe.get_data(address - base, size)

    def instructions(start, end):
        return [{'va': hex(row.address), 'bytes': row.bytes.hex(),
                 'instruction': f'{row.mnemonic} {row.op_str}'.strip()}
                for row in decoder.disasm(data(start, end - start), start)]

    assert data(0x428CB2, 5) == bytes.fromhex('68d1070000')
    assert data(0x428C94, 4) == bytes.fromhex('ff7487f8')
    assert data(0x428CA7, 3) == bytes.fromhex('ff700c')
    assert data(0x4230AE, 2) == bytes.fromhex('6a04')
    assert data(0x4230B6, 3) == bytes.fromhex('83f801')
    assert data(0x4230BD, 2) == bytes.fromhex('6a17')
    assert data(0x4230E0, 2) == bytes.fromhex('6a18')
    assert data(0x4230D1, 6) == bytes.fromhex('d9989c000000')
    assert data(0x4230F4, 6) == bytes.fromhex('d9989c000000')
    # The actual instruction reads double game-instance +0x30.
    assert data(0x422F1F, 3) == bytes.fromhex('dc6030')
    assert data(0x428C61, 3) == bytes.fromhex('ff5018')
    assert data(0x4230B0, 3) == bytes.fromhex('ff5018')
    assert struct.unpack('<I', data(0x5C41B8 + 0x18, 4))[0] == 0x432349
    assert data(0x432398, 3) == bytes.fromhex('8b403c')
    assert data(0x43239D, 3) == bytes.fromhex('8b4044')
    assert data(0x5D8568, 19) == b'm_iCurrentBulletId\0'
    assert data(0x5D8548, 10) == b'm_iBullet\0'
    getters = []
    for index, offset in [(23, 0x54), (24, 0x50)]:
        address = struct.unpack('<I', data(0x4322AB + index * 4, 4))[0]
        assert data(address, 3) == bytes([0xD9, 0x41, offset])
        getters.append({'index': index, 'branch': hex(address), 'roleFloatOffset': hex(offset),
                        'instructions': instructions(address, address + 8)})
    assert data(0x43358E, 3) == bytes.fromhex('894e50')
    assert data(0x426539, 6) == bytes.fromhex('8987a8020000')
    assert data(0x428E8C, 3) == bytes.fromhex('d95354')
    assert data(0x433CD2, 3) == bytes.fromhex('d95650')
    constants = {hex(address): struct.unpack('<f', data(address, 4))[0]
                 for address in [0x61E4FC, 0x61E53C, 0x5C3370, 0x5C4634]}
    assert constants['0x61e4fc'] == 30 and constants['0x61e53c'] == 6
    tank_table = read_table(ROOT / 'CDTank/Data/table/tank.dat')
    assert tank_table['columns'][20] == 'TankDelay'
    assert data(0x43B76D, 4) == bytes.fromhex('6a016a14')
    assert data(0x43B785, 6) == bytes.fromhex('89868c000000')
    assert data(0x4354A7, 2) == bytes.fromhex('84c0')
    assert data(0x4354AF, 6) == bytes.fromhex('d89e9c000000')
    assert data(0x4354B7, 3) == bytes.fromhex('f6c401')
    skills = read_table(ROOT / 'CDTank/Data/table/skill.dat')
    assert skills['columns'][34] == 'Delay' and skills['columns'][36] == 'LoadTime'
    assert data(0x43AE10, 6) == bytes.fromhex('898624010000')
    assert data(0x43AE34, 6) == bytes.fromhex('89862c010000')
    assert data(0x43296E, 6) == bytes.fromhex('2b8788010000')
    getter9 = struct.unpack('<I', data(0x4324D4 + 9 * 4, 4))[0]
    assert getter9 == 0x43246F and data(getter9, 3) == bytes.fromhex('8b4124')
    assert data(0x4334FF, 2) == bytes.fromhex('6a04')
    assert struct.unpack('<I', data(0x5C41B8 + 0x20, 4))[0] == 0x4327AC
    assert struct.unpack('<I', data(0x5C41B8 + 0x54, 4))[0] == 0x4227D8
    items = read_table(ROOT / 'CDTank/Data/table/item.dat')
    assert items['columns'][27:30] == ['ItemSkill1', 'ItemSkill2', 'ItemSkill3']
    assert struct.unpack('<I', data(0x5C41B8 + 0x1C, 4))[0] == 0x432196
    assert struct.unpack('<I', data(0x5C41B8 + 0x74, 4))[0] == 0x433466
    assert data(0x431DF2, 2) == bytes.fromhex('fe00')
    assert data(0x43290F, 7) == bytes.fromhex('c686b402000001')
    assert data(0x433D0E, 7) == bytes.fromhex('c686b402000000')
    result = {
        'source': 'CDTank/CDTank.exe',
        'scope': 'Client dispatch, role duration bounds/conversion and network override; upstream table/equipment/skill construction, authoritative damage, inventory consumption and complete server cooldown formula remain unresolved.',
        'fireSelection': {'selectionGetter': 11, 'getterVirtualOffset': '0x18',
                          'getter': '0x432349', 'recordSelectionOffset': '0x3c',
                          'recordField': 'm_iCurrentBulletId',
                          'defaultSelections': [0, 1], 'defaultItemTableId': 2001,
                          'otherSelectionLookup': 'roleArray[selection-2] -> 0x43d186 -> result+0x0c',
                          'missingLookupDispatchesNoItem': True},
        'cooldown': {'localRoleMustMatch': True, 'typeGetter': 4,
                     'typeGetterVirtualOffset': '0x18', 'typeRecordOffset': '0x44',
                     'typeRecordField': 'm_iBullet',
                     'type1DurationGetter': 23, 'otherTypeDurationGetter': 24,
                     'nextAvailableRoleOffset': '0x9c',
                     'clock': '0x40607b(globalGame+0x10) minus instance double+0x30',
                     'getters': getters},
        'durationRecompute': {
            'tableColumn20': tank_table['columns'][20],
            'recordLoader': '0x43b76d calls 0x4391c4(column20, mode1), stores float bits at record+0x8c',
            'baseInput': 'table record through role+0x2a8, record+0x8c copied into role+0x50',
            'type1FactorInitial': 0,
            'baseBounds': [6, 30], 'constants': constants,
            'normal': 'f32(bounded accumulated role+0x50 * f32(0.1))',
            'type1': 'f32(unrounded normal product * accumulated role+0x54 * f32(0.03))',
            'skillAdditions': '0x4329fd: signed32(record+0x124 * multiplier) into +0x50; +0x12c into +0x54',
            'skillColumns': {'34': 'Delay -> record+0x124', '36': 'LoadTime -> record+0x12c'},
            'skillMultiplier': 'triggerType14 and signed32(role getter9 (+0x24) minus FuncZ1 (+0x188)) > 0 uses difference; all other cases use1',
            'networkOverride': '0x428e85 copies message+0x14 into role+0x54, then relativeClock+duration into +0x9c',
        },
        'fireReadiness': {
            'entry': '0x435499', 'roleFlagIndex': 11, 'flagReader': '0x431d92',
            'flagStorage': 'role+0x2a0 record byte+0x127, absent record returns false',
            'comparison': 'f32(currentSeconds) >= role f32 nextAvailable+0x9c',
            'equalityAllowsFire': True,
            'localPresentationExpiry': '0x42b60a tests status0x41; timer notification requires strictly greater time',
        },
        'skillReloadFields': [dict(skillId=int(row['values']['SkillTableID']),
                                  triggerType=int(row['values']['TriggerType']),
                                  delay=int(row['values']['Delay']), loadTime=int(row['values']['LoadTime']),
                                  funcZ1=int(row['values']['FuncZ1'])) for row in skills['rows']],
        'roleSkillSelection': {
            'currentArray': 'getter4 -> role+0x2a0 record+0xd0,16 entries',
            'fireSelectionArray': 'getter0 -> role+0x2a0 record+0x94, setter copies7 entries',
            'equipmentStorage': 'getter+0x54 -> role+0xa0; six base/rank pairs at+0x44..0x58 and+0x18',
            'rankedKey': 'signed32(base+rank-1)',
            'extraStorage': 'role+0x2a0 record+0x88/+0x8c',
            'passivePredicate': 'TriggerType0 and any of three(FuncType1,FuncT65535)',
            'itemSlots': 'profile+0x58/0x5c/0x60, role record+0xbc..0xcc, then+0x70,+0x6c',
            'itemSkillFields': 'columns27..29 -> record+0x108/0x10c/0x110',
            'duplicates': 'current16 retained; equipment/extra/item candidates skipped only if their skill ID is in current16, not globally deduplicated',
            'arrayUpdate': '0x432826 setter4 copies16 into record+0xd0, notifies31 and sets role dirty+0x2b4',
        },
        'roleStateUpdates': {
            'flagSetter': '0x431dbf: nonzero low argument byte increments record+0x11c+index with byte wrap; zero clears it',
            'specialFlag12': 'role+0x308 stores the raw argument byte, no record notification',
            'flag8Timer': 'nonzero record flag8 after update assigns role+0x304 float0.5',
            'flagNotification': 33,
            'arrayCopies': {'0': 7, '1': 3, '2': 5, '4': 16},
            'arrayNotifications': {'0': 28, '1': 29, '2': 30, '4': 31},
            'arrayDirtyOrdering': 'record notification precedes role dirty+0x2b4=1',
            'dirtyGetter': 'role virtual+0x1c index3 reads dirty only when record is present',
            'dirtyCaller': '0x42b645 accumulates update argument at0x6351f8; when >15 and getter3==1, calls role virtual+0x74 recompute0x433466, then clears accumulator',
            'recomputeCompletion': 'notify13, notify5, then clear dirty+0x2b4',
            'lifecycleDispatch': '0x4259ae maps record status0/1/2/3 to role virtual+0x44/+0x48/+0x4c/+0x50',
            'status2': '0x432ecc: notify27, clear16 record flag bytes/notify33, enable9/10/11 each notify33, clear special12/action selection/fire deadline',
            'otherStatuses': 'clear flags9/10/11 and action selection; statuses0/1 notify27, status3 does not',
            'integration': 'World now uses status2 at start/respawn, status3 on ordinary projectile death, flag11 and inclusive relative f32 fire deadline; duration still prototype until actual inventory sources are restored',
        },
        'currentSkillMutation': {
            'add': '0x431e22 virtual+0x5c: dirty first, scan/delete matching slots; insert first zero without notify31, else evict first/shift/append and notify31; return evicted ID or0',
            'remove': '0x431ee5 virtual+0x60: dirty first, scan/delete matching slots, unconditional final notify31 when record exists',
            'removeAt': '0x431f38 virtual+0x64: dirty first; negative logs/no array write; positions0..14 shift/clear15, positions>=15 clear15; notify31',
            'scanSemantics': 'deletion shifts then scan advances; adjacent duplicates can survive',
            'arrayBinding': 'OdlPlayer original field registration0x5226b1 maps m_arraySkillTableId/type14/count16 to+0xd0; old schema wrapper+4 returns backend via0x522ba2',
            'recordArrayBindings': [
                {'name': 'm_arrayItemHotkey', 'offset': '0x94', 'count': 7},
                {'name': 'm_arrayTankMark', 'offset': '0xb0', 'count': 3},
                {'name': 'm_arrayTankPart', 'offset': '0xbc', 'count': 5},
                {'name': 'm_arraySkillTableId', 'offset': '0xd0', 'count': 16},
                {'name': 'm_arrayTexture', 'offset': '0x110', 'count': 3},
                {'name': 'm_arrayActState', 'offset': '0x11c', 'count': 16},
            ],
            'notify31Listener': '0x42f76e compares prior role+0x320 array against current record+0xd0, cancels absent trigger2/3 skills, copies current16; current local role then dirty/recompute immediately',
            'transportRegistration': '0x52278d registers nameOdlPlayer constructor0x522748/classIDsetter0x522781; runtime classID not assumed from static zero',
        },
        'paths': {'fireSelection': instructions(0x428C55, 0x428CC1),
                  'fireCallback': instructions(0x423092, 0x423146),
                  'relativeClock': instructions(0x422F0D, 0x422F25),
                  'skillLookup': instructions(0x43D186, 0x43D1A5),
                  'roleSourceBinding': instructions(0x426524, 0x42653F),
                  'baseDurationCopy': instructions(0x43352F, 0x433591),
                  'skillDurationAdditions': instructions(0x4329FD, 0x432A2D),
                  'durationUpperBound': instructions(0x4338E7, 0x4338FE),
                  'durationLowerBound': instructions(0x433A4B, 0x433A62),
                  'durationConversion': instructions(0x433CC9, 0x433CE1),
                  'networkDurationOverride': instructions(0x428E85, 0x428EB4)},
    }
    result['paths'].update({
        'tankRecordDelayLoader': instructions(0x43B766, 0x43B78B),
        'floatColumnParser': instructions(0x439211, 0x43923A),
        'fireReadiness': instructions(0x435499, 0x4354C7),
        'roleFlagReader': instructions(0x431D92, 0x431DBF),
        'localPresentationExpiry': instructions(0x42B607, 0x42B645),
        'skillNumericFieldLoader': instructions(0x43ACF2, 0x43AF5C),
        'skillTriggerLoader': instructions(0x43AC31, 0x43AC45),
        'skillMultiplier': instructions(0x432951, 0x432987),
        'multiplierRoleGetter9': instructions(0x43246F, 0x432474),
        'currentSkillTraversal': instructions(0x4335B5, 0x4335FD),
        'equipmentSkillTraversal': instructions(0x4335FD, 0x43366C),
        'extraRoleSkillTraversal': instructions(0x43366C, 0x4336DF),
        'itemSourceTraversal': instructions(0x4336DF, 0x4337D7),
        'itemSkillExpansion': instructions(0x432FE8, 0x433073),
        'passiveSkillPredicate': instructions(0x432B29, 0x432B78),
        'roleArrayGetter': instructions(0x4327AC, 0x432826),
        'roleArraySetter': instructions(0x432826, 0x43291E),
        'recomputeArrayArgument': instructions(0x4334FF, 0x4335B5),
        'equipmentGetter': instructions(0x4227D8, 0x4227DF),
        'itemSkillColumnLoader': instructions(0x439CD9, 0x439D04),
        'roleFlagSetter': instructions(0x431DBF, 0x431E22),
        'roleDirtyGetter': instructions(0x432196, 0x4321E3),
        'dirtyRecomputeCaller': instructions(0x42B645, 0x42B68D),
        'roleRecomputeCompletion': instructions(0x433CF4, 0x433D15),
        'roleLifecycle': instructions(0x432E2A, 0x432F91),
        'roleLifecycleDispatcher': instructions(0x4259AE, 0x425AAD),
        'roleActionSelectionSetter': instructions(0x4320C7, 0x432107),
        'roleAddSkill': instructions(0x431E22, 0x431EE5),
        'roleRemoveSkill': instructions(0x431EE5, 0x431F38),
        'roleRemoveSkillAt': instructions(0x431F38, 0x431FBA),
        'currentSkillNotifyListener': instructions(0x42F76E, 0x42F84E),
        'playerArraySchema': instructions(0x52262A, 0x522739),
        'playerTransportClassRegistration': instructions(0x52278D, 0x5227DA),
        'playerSchemaBackendGetter': instructions(0x522BA2, 0x522BA6),
    })
    destination = ROOT / 'recovery/output/combat-client-evidence.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('PASS: original client item selection, two duration getters and relative cooldown timestamp exported')


if __name__ == '__main__':
    export()
