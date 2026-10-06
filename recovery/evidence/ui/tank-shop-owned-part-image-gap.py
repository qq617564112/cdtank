"""Keep the bounded selected-owned refresh evidence for unresolved part images."""
from pathlib import Path
import json
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT = Path(__file__).resolve().parents[3]
binary = (ROOT/'CDTank/CDTank.exe').read_bytes()
pe = pefile.PE(data=binary)
cs = Cs(CS_ARCH_X86, CS_MODE_32)
def block(start, end):
    offset = pe.get_offset_from_rva(start-pe.OPTIONAL_HEADER.ImageBase)
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'}
            for i in cs.disasm(binary[offset:offset+end-start], start)]
result = {
    'task': 'UI58', 'status': 'SELECTED_INSTANCE_PART_IMAGE_PROVIDER_UNQUALIFIED',
    'sameTableSlotCount': block(0x4b7427, 0x4b7447),
    'selectedOwnedRoleData': block(0x4b75c2, 0x4b75f4),
    'windowArrayInitialization': block(0x4b4eac, 0x4b4ece),
    'existingWindowBindingSource': 'recovery/output/tank-shop-part-parent-source.json',
    'facts': ['Selected refresh resolves same TankTable and passes record+98 to source visibility helper4b2635',
              'Separate role data resolution calls4269c4/427ba2/429e41; no qualified part-image formatter contract in these blocks',
              'LabPage+88..a0 were bound XML window pointers, and +90/+a4 arrays are initialized by memset'],
    'requiredNextEvidence': 'Original selected-instance slot/icon getter and caller feeding an Image setter for the named pic controls',
    'currentProviderGap': 'Equipment QUERY reads active selected role; it is not parameterized by Shop-owned candidate instance',
    'consumer': 'Conditional backgrounds prepared; seven dynamic images remain blank',
    'limits': ['Static instruction evidence only', 'No assertion that the original client never writes these images',
               'No per-instance image provider or original ownership policy invented'],
    'productionChanged': False, 'chromeStarted': False,
}
(ROOT/'recovery/output/tank-shop-owned-part-image-gap.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
