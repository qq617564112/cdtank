"""Export original tanktexture records and their exact installed DDS textures."""
import argparse
from collections import Counter
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PARTS = {1: 'U', 2: 'M', 3: 'XY'}


def build(out=ROOT / 'recovery/output/web-assets'):
    table = json.loads((ROOT / 'recovery/output/verified/tables/tanktexture.json').read_text())
    inventory = json.loads((ROOT / 'recovery/output/catalog/inventory.json').read_text())
    by_key = {item['key']: item for item in inventory}
    rows = []

    def texture(request):
        # The original loader replaces the requested suffix with .dds.
        key = Path(request).with_suffix('.dds').as_posix().lower()
        item = by_key.get(key)
        selected = item.get('selected') if item else None
        if not selected:
            return dict(request=request, source=key, asset=None,
                        status='unresolved-source' if item else 'missing-source')
        source = ROOT / selected['source']
        # No basename aliases: only the inventory's selected exact role DDS.
        if selected['path'].replace('\\', '/').lower() != key:
            raise ValueError(f'Selected DDS path differs from request: {key}')
        destination = Path('tank-textures') / Path(selected['path']).with_suffix('.png')
        target = out / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image.convert('RGBA').save(target)
        return dict(request=request, source=key, asset=destination.as_posix(),
                    status='resolved')

    for original in table['rows']:
        record_id = original['recordId']
        values = original['values']
        tank_id, part = record_id // 10000, PARTS[record_id % 10]
        filename = values['文件名称']
        request = f'role/{tank_id:03}/{filename}'
        a = texture(request)
        # The XY setter changes the fifth character from the end to B.
        b = texture(request[:-5] + 'B' + request[-4:]) if part == 'XY' else None
        rows.append(dict(recordId=record_id, tankId=tank_id, part=part,
                         filename=filename, name=values['贴图名称'],
                         rarity=int(values['稀有度']),
                         moneyPrice=int(values['购买金钱价']),
                         tokenPrice=int(values['购买代币价']),
                         selectable=int(values['稀有度']) != 0,
                         textures=dict(A=a, B=b)))
    statuses = Counter(texture['status'] for row in rows
                       for texture in row['textures'].values() if texture)
    return dict(schemaVersion=1, tableSource='table/tanktexture.dat',
                selectionBasis='owned-preview:recordId//10000,recordId%10,rarity!=0',
                initialXYVariant='A', rows=rows,
                summary=dict(rows=len(rows), requests=sum(statuses.values()), **statuses))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'recovery/output/web-assets')
    args = parser.parse_args()
    catalog = build(args.out)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'tank-textures.json').write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(catalog['summary'], ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    main()
