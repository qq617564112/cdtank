"""Prepare the owned consumer patch without changing imported production files."""
from pathlib import Path
import difflib
ROOT=Path(__file__).resolve().parents[3]
changes={}
def edit(path,fn):
 old=(ROOT/path).read_text();new=fn(old);assert old!=new;changes[path]=(old,new)
def shop(s):
 s=s.replace("import {classifyItemId} from '../../../../shared/combat/item-hotkeys';", "import {sourceShopItemCategory} from './shop-item-category';")
 s=s.replace("owner.pending && classifyItemId(owner.pending.itemTableId!) === 3 ? 'Weapon' : 'Item'", "sourceShopItemCategory(owner.pending?.itemTableId ?? 0) ?? 'Item'")
 s=s.replace("const products = confirmed?.items.filter(value => {\n    const type = classifyItemId(value.itemTableId);\n    return !(type >= 8 && type <= 12) && (type === 3 ? 'Weapon' : 'Item') === category;\n  }) ?? [];", "const products = confirmed?.items.filter(value => sourceShopItemCategory(value.itemTableId) === category) ?? [];")
 s=s.replace("value !== undefined && classifyItemId(value) === 3 ? 'Weapon' : 'Item'", "sourceShopItemCategory(value ?? 0) ?? 'Item'")
 s=s.replace("const available = result.items.filter(product => {\n            const type = classifyItemId(product.itemTableId);\n            return !(type >= 8 && type <= 12) && (type === 3 ? 'Weapon' : 'Item') === currentCategory;\n          });", "const available = result.items.filter(product => sourceShopItemCategory(product.itemTableId) === currentCategory);")
 s=s.replace("confirmed?.items.find(product => {\n          const type = classifyItemId(product.itemTableId);\n          return !(type >= 8 && type <= 12) && (type === 3 ? 'Weapon' : 'Item') === kind;\n        })", "confirmed?.items.find(product => sourceShopItemCategory(product.itemTableId) === kind)")
 s=s.replace("detail: `${product.moneyPrice}金币 / ${product.tokenPrice}软星币`", "detail: '', product")
 s=s.replace('    <label className="shop-quantity">', '    {item && <output className="shop-selected-query-prices" data-shop-selected-query-prices=""\n      data-price-provider="shop-query-both-prices">{item.moneyPrice}金币 / {item.tokenPrice}软星币</output>}\n    <label className="shop-quantity">')
 assert 'classifyItemId' not in s
 return s
edit('apps/web/src/interface/account/shop.tsx',shop)
edit('apps/web/src/interface/account/shop-item-source-list.tsx',lambda s:s.replace("import {SourceFeedbackText}","import type {ShopItem} from '../../../../shared/protocols/PtlShop';\nimport {sourceShopOfferedQuantity, sourceShopPrice} from './shop-item-display';\nimport {SourceFeedbackText}").replace('itemTableId?: number; ownedQuantity?: number;', 'itemTableId?: number; ownedQuantity?: number; product?: ShopItem;').replace('mode="product" secondaryQueryPrices={entry.detail}', 'mode="product" offeredQuantity={entry.product && sourceShopOfferedQuantity(entry.product)}\n            sourcePrice={entry.product ? sourceShopPrice(entry.product) : \'\' }'))
edit('apps/web/src/interface/account/shop-item-row-content.tsx',lambda s:s.replace('secondaryQueryPrices','sourcePrice').replace("mode = 'owned', sourcePrice", "mode = 'owned', sourcePrice, offeredQuantity").replace('sourcePrice?: string;', 'sourcePrice?: string; offeredQuantity?: number;').replace('data-price-provider="shop-query-both-prices"','data-price-provider="original-item-getmethod"').replace("data-source-quantity-field={mode === 'owned' ? 'MyItem+0x10' : undefined}>{ownedQuantity ?? ''}","data-source-quantity-field={mode === 'owned' ? 'MyItem+0x10' : 'Item+0xf8/439950'}>{(mode === 'owned' ? ownedQuantity : offeredQuantity) ?? ''}"))
edit('apps/web/src/interface/account/shop.css',lambda s:s+'\n#account-shop [data-shop-active-page=\'Item\'] .shop-selected-query-prices {\n  left: 12px;\n  top: 444px;\n  width: 270px;\n  min-height: 20px;\n}\n')
patch=''.join(''.join(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='a/'+p,tofile='b/'+p)) for p,(a,b) in changes.items())
(ROOT/'recovery/output/shop-original-display-consumer.patch').write_text(patch)
print('PREPARED_ONLY_4_EXISTING_FILES; imported production files unchanged')
