"""Execute original role attachment, RB-tree insertion/erase, lookup and iteration."""
from pathlib import Path
import json
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x10000)
uc.mem_map(0x2000000, 0x100000)
OWNER, HEAD, TABLE, ITERATOR, STACK, STOP = [0x2000000 + n * 0x1000 for n in range(6)]
DESTROY = STOP + 0x10
heap = 0x2020000
allocations = []
destructions = []
frees = []

def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def word(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, word(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

def hook(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        size = word(stack + 4)
        assert size == 24
        allocated = heap
        heap += 0x20
        uc.mem_write(allocated, bytes(24))
        allocations.append(allocated)
        finish(allocated)
    elif address == 0x57a6c7:
        frees.append(word(stack + 4))
        finish()
    elif address == DESTROY:
        assert word(stack + 4) == 1
        destructions.append(machine.reg_read(UC_X86_REG_ECX))
        finish(pop=4)
for address in (0x578620, 0x57a6c7, DESTROY):
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

def run(entry, this, *args):
    put(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(entry, STOP, count=20000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)

put(TABLE, DESTROY, 0x431d4d)
rows = []
for name, keys in [
    ('empty', []),
    ('ascending', [7, 19, 31]),
    ('descending', [31, 19, 7]),
    ('mixed', [19, 7, 31]),
    ('unsigned-boundary', [0xffffffff, 0x80000000, 0x7fffffff, 0]),
    ('replace-key', [31, 7, 19, 7]),
    ('null-role', []),
]:
    allocations.clear(); destructions.clear(); frees.clear()
    heap = 0x2020000
    uc.mem_write(OWNER, bytes(0x200))
    put(OWNER, 0x5c3a18)
    put(OWNER + 0x10, HEAD, 0)
    put(HEAD, HEAD, HEAD, HEAD)
    uc.mem_write(HEAD + 0x14, bytes([1, 1]))
    expected_roles = {}
    for index, key in enumerate(keys):
        role = 0x2040000 + index * 0x1000
        record = role + 0x800
        uc.mem_write(role, bytes(0x400))
        put(role, TABLE)
        put(role + 0x2a0, record)
        put(record + 0xc, key)
        run(0x421673, OWNER, role)
        expected_roles[key] = role
    if name == 'null-role':
        run(0x421673, OWNER, 0)
    observed = []
    put(ITERATOR, word(HEAD))
    for _ in range(len(keys) + 1):
        node = word(ITERATOR)
        if node == HEAD:
            break
        key, role = word(node + 0xc), word(node + 0x10)
        observed.append(dict(id=key, role=role))
        assert role == expected_roles[key]
        assert run(0x48a226, OWNER, key) == role
        run(0x42de86, ITERATOR)
    else:
        raise AssertionError('iterator did not reach sentinel')
    assert [row['id'] for row in observed] == sorted(set(keys))
    assert word(OWNER + 0x14) == len(set(keys))
    assert run(0x48a226, OWNER, 123456) == 0
    if name == 'replace-key':
        assert destructions == [0x2041000] and len(frees) == 1
    else:
        assert not destructions and not frees
    rows.append(dict(name=name, insertionIds=keys, orderedIds=[r['id'] for r in observed],
        latestRoleById=observed, count=word(OWNER + 0x14),
        allocatedNodes=len(allocations), freedNodes=len(frees), destroyedRoles=destructions[:]))
output = dict(status='PASS_ROLE_REGISTRY_ORDER_NATIVE', rows=rows,
    nativeScope=['421673 attachment', '431d4d role ID getter', '42162c remove existing key',
                 '421277/421117/420d4d/489f04 original node allocation and RB-tree insertion',
                 '421308 original erase and balancing', '48a226/4501fa/486351 lookup',
                 '42de86 native in-order successor'],
    supplied=['empty tree sentinel/layout', 'roles and records with actual uint32 ID',
              'allocator/free endpoint', 'removed-role deleting destructor sink'],
    limitations=['no original server ID producer or mapping from Web string IDs',
                 'no rerun of OBB/separation or live player acceptance',
                 'production room iteration order is unchanged'])
(ROOT / 'recovery/output/role-movement-registry-order-native.json').write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(output['status'], len(rows))
