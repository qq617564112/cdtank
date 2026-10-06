"""Observe original role constructor writes and retain named identity evidence."""
import json
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
ROLE, STACK, STOP, OBB_CONSTRUCTOR = 0x2001000, 0x2010000, 0x2011000, 0x2012000
uc.mem_write(ROLE, b'\xaa' * 0x370)
uc.mem_write(0x5c0ba0, struct.pack('<I', OBB_CONSTRUCTOR))
uc.mem_write(STACK, struct.pack('<I', STOP))
writes = []


def boundary(machine, address, size, data):
    assert machine.reg_read(UC_X86_REG_ECX) == ROLE + 0x2b8
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, struct.unpack('<I', machine.mem_read(stack, 4))[0])
    machine.reg_write(UC_X86_REG_ESP, stack + 4)


def watch(machine, access, address, size, value, data):
    if address < ROLE + 0xa8 and address + size > ROLE + 0xa0:
        writes.append({'pc': hex(machine.reg_read(UC_X86_REG_EIP)),
                       'offset': hex(address - ROLE), 'size': size, 'value': value})


uc.hook_add(UC_HOOK_CODE, boundary, begin=OBB_CONSTRUCTOR, end=OBB_CONSTRUCTOR)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)
uc.reg_write(UC_X86_REG_ECX, ROLE)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x42275e, STOP, count=10000)
assert uc.reg_read(UC_X86_REG_EIP) == STOP
assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
assert uc.reg_read(UC_X86_REG_EAX) == ROLE
assert writes == [{'pc': '0x431c24', 'offset': '0xa0', 'size': 4, 'value': 0},
                  {'pc': '0x431c30', 'offset': '0xa4', 'size': 4, 'value': 0}]
assert bytes(uc.mem_read(ROLE + 0xa0, 8)) == bytes(8)
pe = images['cdtank.exe']
cs = Cs(CS_ARCH_X86, CS_MODE_32)
source = [{'entry': hex(a), 'instructions': [{'address': hex(i.address),
           'instruction': f'{i.mnemonic} {i.op_str}'.strip(), 'bytes': i.bytes.hex()}
           for i in cs.disasm(pe.get_data(a - 0x400000, z - a), a)]}
          for a, z in ((0x42275e, 0x4227e6), (0x431bcf, 0x431d4d),
                       (0x433de7, 0x433f3c), (0x4234d7, 0x423500),
                       (0x435c7c, 0x435dc0))]
result = {'status': 'PASS_ROLE_CONSTRUCTOR_BOUND_POINTER_WRITE_WATCH',
          'writes': writes, 'source': source,
          'scope': 'Complete42275e and base431bcf execute with original CRT frame, '
                   'vector and memset calls. Imported OBB constructor is supplied and '
                   'cannot write the watched binding fields. No original GUI selection, '
                   'room/start runtime or claim that later binding writes do not exist.',
          'identities': {
              'roleConstructor': '42275e installs5c2c28, base431bcf installs5c41b8',
              'roleDestructor': '433de7 retires+a0 via41e9c7 and+a4 via421f61 then zeros',
              'managerSetter4234d7': 'Owns deletable callback+ a0, not established as role object',
              'copy435c7c': 'Copies record+4..+b4 including+a0; caller435f30, identity must be established before treating it as role pointer producer'},
          'next': 'Track role-object identity through copy/decoder/vinit and runtime write observation; constructor zero is not proof of permanent absence.'}
(ROOT / 'recovery/output/role-bound-source-write-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: original derived/base role constructor binding-field write watch')
