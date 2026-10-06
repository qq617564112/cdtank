"""Execute original texture request codec and complete confirmed selection consumer."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x30000)
GAME, OWNER, OWNED, RECORD, NODE, SENTINEL, MESSAGE, LISTENER, PHASE, PHASE_VTABLE, PHASE_LIST = [0x2001000 + n * 0x1000 for n in range(11)]
STACK, RETURN, CALLBACK, PHASE_GET, STREAM, BUFFER, ROLE = [0x2010000 + n * 0x1000 for n in range(7)]
PROFILE = OWNED + 0x20
phase, found = 2, True
events = []
sent, lookups = [], []
TABLE = 0x2018000
table_rows = {row['recordId']: row['values'] for row in json.loads((ROOT / 'recovery/output/verified/tables/tanktexture.json').read_text())['rows']}
def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))
def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]
def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == PHASE_GET:
        value, pop = phase, 0
    elif address == 0x4501fa:
        assert machine.reg_read(UC_X86_REG_ECX) == OWNED + 4
        assert read(read(stack + 8)) == instance
        write(read(stack + 4), NODE if found else SENTINEL)
        value, pop = read(stack + 4), 8
    elif address == 0x411068:
        key = read(stack + 4); lookups.append(key)
        assert machine.reg_read(UC_X86_REG_ECX) == TABLE + 0xc
        row = table_rows[key]; pointer = TABLE + 0x200
        write(pointer + 0x48, int(row['稀有度']), int(row['购买金钱价']), int(row['购买代币价']))
        value, pop = pointer, 4
    elif address == 0x413ec4:
        assert machine.reg_read(UC_X86_REG_ECX) == GAME
        packet = read(stack + 4)
        assert read(packet) == 0x5cb1ec
        sent.append([read(packet + 0xc + n * 4) for n in range(4)])
        value, pop = 1, 4
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == LISTENER
        events.append(dict(result=read(stack + 4), textures=[read(RECORD + o) for o in [0x28, 0x2c, 0x30]],
                           balances=[read(PROFILE + 0x94), read(PROFILE + 0x90)]))
        value, pop = 0, 4
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
for address in [PHASE_GET, 0x4501fa, CALLBACK, 0x411068, 0x413ec4]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GAME); write(GAME + 0x118, OWNER); write(GAME + 0xac, 0); write(GAME + 0xe0, PHASE_LIST)
write(PHASE_LIST, PHASE); write(PHASE, PHASE_VTABLE); write(PHASE_VTABLE + 4, PHASE_GET)
write(OWNER + 0x3c, ROLE); write(OWNER + 0x40, OWNED); write(OWNED + 8, SENTINEL); write(NODE + 0x10, RECORD)
write(PROFILE, 0x5c4118); write(LISTENER, LISTENER + 0x100); write(LISTENER + 0x108, CALLBACK)
write(ROLE + 0x2a0, ROLE + 0x400); write(ROLE + 0x510, 991, 992, 993)
triples = [[0, 0, 0], [10011, 10012, 10013], [0xffffffff, 0x80000000, 0xf1234567]]
rows, codecs = [], []
def call(entry, this, *args):
    write(STACK, RETURN, *args); uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(entry, RETURN, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(args)
for instance, triple, alignment in itertools.product([73, 0x80000001], triples, range(8)):
    call(0x492a56, MESSAGE)
    call(0x492107, MESSAGE); assert uc.reg_read(UC_X86_REG_EAX) == 0x3f98
    write(MESSAGE + 0xc, instance, *triple)
    uc.mem_write(BUFFER, bytes(64)); write(STREAM, alignment, 0, BUFFER, 64)
    call(0x492a89, MESSAGE, STREAM)
    assert read(STREAM + 4) == 16
    payload = bytes(uc.mem_read(BUFFER, (alignment + 128 + 7) // 8))
    uc.mem_write(MESSAGE + 0xc, bytes(16)); write(STREAM, alignment, 0, BUFFER, 64)
    call(0x492ae6, MESSAGE, STREAM)
    assert [read(MESSAGE + o) for o in [0xc, 0x10, 0x14, 0x18]] == [instance, *triple]
    # Response reader: six unsigned DWORDs, then eight-bit status.
    values = [instance, *triple, 1234, 5678]
    bits = [0] * alignment + [(value >> bit) & 1 for value in values for bit in range(32)] + [(3 >> bit) & 1 for bit in range(8)]
    wire = bytearray((len(bits) + 7) // 8)
    for bit, value in enumerate(bits): wire[bit // 8] |= value << (bit % 8)
    uc.mem_write(BUFFER, bytes(wire)); write(STREAM, alignment, 0, BUFFER, 64)
    call(0x4993a4, MESSAGE, STREAM)
    call(0x49941d, MESSAGE); assert uc.reg_read(UC_X86_REG_EAX) == 0x3f99
    assert [read(MESSAGE + 0xc + n * 4) for n in range(7)] == [*values, 3]
    codecs.append(dict(instanceId=instance, textures=triple, startBit=alignment, requestBytes=list(payload), responseBytes=list(wire)))
for phase, result, found, callback, triple in itertools.product([1, 2, 3], range(6), [False, True], [False, True], triples):
    instance = 73
    write(RECORD + 0x1c, instance); write(RECORD + 0x28, 71, 72, 73)
    write(PROFILE + 0x94, 100); write(PROFILE + 0x90, 200)
    write(MESSAGE + 0xc, instance, *triple, 1234, 5678, result)
    write(OWNER + 0x7c, LISTENER if callback else 0)
    before = bytes(uc.mem_read(ROLE, 0x800)); events.clear()
    call(0x495a69, OWNER, MESSAGE, 0, 0)
    applied = phase == 2 and result == 3 and found
    selected = [read(RECORD + o) for o in [0x28, 0x2c, 0x30]]
    balances = [read(PROFILE + 0x94), read(PROFILE + 0x90)]
    assert selected == (triple if applied else [71, 72, 73])
    assert balances == ([1234, 5678] if applied else [100, 200])
    assert bytes(uc.mem_read(ROLE, 0x800)) == before
    assert events == ([dict(result=result, textures=selected, balances=balances)] if phase == 2 and callback else [])
    rows.append(dict(phase=phase, result=result, ownedFound=found, callback=callback, instanceId=instance,
                     incomingTextures=triple, textures=selected, balances=balances, events=list(events)))
# Complete original selection request: real rarity and currency costs from tanktexture.
write(GAME + 0x114, TABLE + 0x800); write(TABLE + 0x888, TABLE)
requests = []
phase, found, instance = 2, True, 73
write(OWNER + 0x7c, LISTENER)
for texture_id, row in table_rows.items():
    for affordable in [False, True]:
        write(RECORD + 0x28, 71, 72, 73)
        money = int(row['购买金钱价']) if affordable else 0
        tokens = int(row['购买代币价']) if affordable else 0
        write(PROFILE + 0x90, money, tokens)
        triple = [0, 0, 0]; triple[{1: 0, 2: 1, 3: 2}[texture_id % 10]] = texture_id
        events.clear(); sent.clear(); lookups.clear()
        before = bytes(uc.mem_read(RECORD, 0x70))
        call(0x493b5c, OWNER, instance, *triple)
        rarity = int(row['稀有度'])
        allowed = rarity != 0 and (rarity != 1 or money >= int(row['购买金钱价'])) and (rarity != 2 or tokens >= int(row['购买代币价']))
        assert sent == ([[instance, *triple]] if allowed else [])
        assert bool(uc.reg_read(UC_X86_REG_EAX)) == allowed
        assert bytes(uc.mem_read(RECORD, 0x70)) == before
        assert lookups == [texture_id]
        requests.append(dict(textureId=texture_id, rarity=rarity, moneyPrice=int(row['购买金钱价']), tokenPrice=int(row['购买代币价']),
                             money=money, tokens=tokens, sent=list(sent), events=list(events)))
for triple in [[0, 0, 0], [71, 72, 73]]:
    sent.clear(); events.clear(); lookups.clear()
    call(0x493b5c, OWNER, instance, *triple)
    assert not sent and not lookups and events[0]['result'] == 0
output = dict(status='PASS', requests=requests, codecs=codecs, confirmations=rows,
    scope='Complete493b5c request qualification/cost/construction/sending with actual table rarity/prices and transport/table lookup boundaries; complete492a56 request constructor, type492107, writer492a89, reader492ae6; full4993a4 response reader/type49941d; complete495a69 success callback with actual4269c4 profile provider,421f36 owned getter and42fdea/420551 scalar setters. Phase provider, owned map search4501fa and terminal notification boundaries supplied. No original owned-to-OdlPlayer property32 producer or server qualification inferred.')
(ROOT / 'recovery/output/role-texture-transfer-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'PASS: {len(codecs)} original request/response codecs, {len(rows)} complete confirmed texture selections, {len(requests)} real table request checks')
