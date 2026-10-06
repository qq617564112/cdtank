"""Bounded original kind5 quantity callback and Valuable source-consumer boundary."""
import json
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT=Path(__file__).resolve().parents[3]
p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
cs=Cs(CS_ARCH_X86,CS_MODE_32)
def trace(a,z):
 return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in cs.disasm(p.get_data(a-base,z-a),a)]
catalog=json.loads((ROOT/'recovery/output/web-assets/combat-catalog.json').read_text())
result={
 'status':'VALUABLE_KIND5_CALLBACK_SOURCE_PREPARED_CONSUMER_GATE_PENDING',
 'dispatcher':trace(0x495e90,0x495eb8),
 'sender':trace(0x494bad,0x494cf0),
 'quantityPredicate':trace(0x4396c2,0x4396e0),
 'quantityCallback':trace(0x4a0ac3,0x4a0b76),
 'wholeCallback':trace(0x49f4d0,0x49f4f2),
 'sourceFacts':[
  '495e90 kind5 carries nonzero instance and quantity to494bad; separate from kind3/kind4.',
  '494bad requires mode2, profile/definition provider and inventorycategory6.',
  '4396c2 is definitionID predicate: <=4000 or20001..21000; no inferred Break field.',
  'Quantity-predicate false forces senderquantity1; true looks up sameownedinstance43cd5b andchecksMyItem+10.',
  'Quote uses439947 uintItemMoney>>1 multipliedbyquantity, original unsignedmoneycap999999999.',
  '4a0ac3 category6 calls dispatcher kind5 with parsedpositivequantity;49f4d0 alternatecallback kind5 passes0 quantity, senderforces1 fornonquantitydefinitions.'
 ],
 'existingDefinitions':[{k:x.get(k) for k in ['itemTableId','name','moneyPrice','iconId','info']} for x in catalog['items'] if 20001<=x['itemTableId']<=22000],
 'formalConsumer':{'home':'HomeInventory categoryvaluable queries fullconfirmedInventory category6; source row/name/icon/count already formal.', 'shop':'Current Shop ownedlist supportedcategory1/2; source factory/tab actualcategory6 entry notqualified bythisboundedcallback.'},
 'proposedScope':'When root qualifies acquisition andstablekind5authority, consume confirmed realinstance/count/quote using originalquantity55 controls; no guessed grant, price orpeer inventory.',
 'gaps':['Normal Valuable acquisition producer remains unqualified here.','Original normal page category6 activation entry requires exactfactory/list qualification; callbackalone doesnotprovevisibleentry.','No formal ValuableSale protocol/serverAPI orreceiver resultcode qualified bythisslice.'],
 'productionChanged':False,'typeBuildExecuted':False,'chromeStarted':False,
}
(ROOT/'recovery/output/valuable-item-sale-consumer-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
