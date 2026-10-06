"""Read original owned Tank part-sheet attachment and source controls."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT=Path(__file__).resolve().parents[3]
b=(ROOT/'CDTank/CDTank.exe').read_bytes();p=pefile.PE(data=b);c=Cs(CS_ARCH_X86,CS_MODE_32)
def block(start,end):
    offset=p.get_offset_from_rva(start-p.OPTIONAL_HEADER.ImageBase)
    return [{'va':hex(i.address),'asm':f'{i.mnemonic} {i.op_str}'} for i in c.disasm(b[offset:offset+end-start],start)]
root=ET.parse(ROOT/'recovery/output/verified/assets/data/Data/ui/layouts/shop_tankpage_part.xml').getroot()
controls=[{'name':w.get('Name'),'type':w.get('Type'),'properties':{v.get('Name'):v.get('Value') for v in w.findall('Property')}} for w in root.iter('Window')]
result={'task':'UI58','status':'SOURCE_OWNED_TANK_PART_SHEET_ATTACHMENT_WITH_SLOT_PROVIDER_GAP','load':block(0x4b360a,0x4b364b),'ownedModeAttachment':block(0x4b5f36,0x4b5faa),'rootSource':'recovery/output/tank-shop-texture-parent-source.json','sameOwner':'LabPage this+84 part sheet attached to this+8 Tank root on mode1','offset':[0,36],'controls':controls,'consumerScope':'Original seven slot backgrounds on owned mode; seven dynamic image values remain unbound','providerGap':'Equipment QUERY represents active Tank, not selected OwnedRoles instance; no per-instance slot provider qualified','productionChanged':False,'chromeStarted':False}
table=json.loads((ROOT/'recovery/output/verified/tables/tank.json').read_text())
result['slotCountLoader']={'recordLoader':'43b62a','instructions':block(0x43b7a5,0x43b7c1),
    'zeroBasedColumn':23,'columnName':table['originalColumns'][23],
    'rows':[{'tankId':int(row['values']['ID']),'partSlotCount':int(row['values']['TankPartSlot'])} for row in table['rows']],
    'sameTableIdentity':'Existing role-shop-tank-name-provider-native.json qualifies43b62a; selectedOwned+24 resolves411068',
    'formalProviderGap':'CombatCatalog.tankTypes partSlotCount not published'}
result['slotVisibility']={'caller':block(0x4b7427,0x4b7447),'helper':block(0x4b2635,0x4b269e),
    'contract':'Show pairs pic90..a0/bgA4..B4 below sourcecount; hide remaining pairs to5',
    'remainingGap':'Await root full21 partSlotCount catalog field'}
result['dynamicControlBindings']={'instructions':block(0x4b366f,0x4b37ff),
    'slots':{'picHatIcon':'LabPage+88','picMarkIcon':'LabPage+8c','picInternalIcon0':'LabPage+90',
    'picInternalIcon1':'LabPage+94','picExternalIcon0':'LabPage+98','picExternalIcon1':'LabPage+9c','picExternalIcon2':'LabPage+a0'},
    'identityLimits':'Window pointers only; same offsets in other objects are not slot records. Image provider remains unqualified.'}
result['currentProviderEvidence']={'protocol':'PtlEquipment QUERY has no selected-candidate contract',
    'api':'accounts/api.ts QUERY calls accounts.equipment(accountId,catalog) without selected instance',
    'store':'account-store.ts equipment uses selectedRoleSources and readRoleProfileEquipment/profileCosmetics',
    'conclusion':'Active Equipment cannot prove candidate-instance dynamic slot images'}
(ROOT/'recovery/output/tank-shop-part-parent-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(result['status'])
