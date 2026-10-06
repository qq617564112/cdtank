"""Inventory original assets, loose files, patch candidates and CEGUI controls."""
import argparse
from collections import Counter
import configparser
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from patch_sol import decode_patch, original_key


def xml_document(path):
    try:
        return ET.fromstring(path.read_bytes())
    except ET.ParseError:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, default=Path('CDTank'))
    parser.add_argument('--extracted', type=Path, default=Path('recovery/output/verified/assets/data/Data'))
    parser.add_argument('--out', type=Path, default=Path('recovery/output/catalog'))
    args = parser.parse_args()
    versions = {}
    for layer, root in [('archive', args.extracted), ('loose', args.client / 'Data'),
                        ('download', args.client / 'download/Data')]:
        for path in sorted(root.rglob('*')):
            if not path.is_file() or path.suffix.lower() == '.cpk':
                continue
            relative = path.relative_to(root).as_posix()
            versions.setdefault(relative.lower(), []).append(dict(layer=layer, path=relative,
                source=str(path), bytes=path.stat().st_size))
    inventory, layouts, imagesets, actions = [], [], [], []
    patch_key = original_key(args.client / 'CPKUpdate.exe') if any(
        entry['layer'] == 'download' for entries in versions.values() for entry in entries) else None
    for key, entries in sorted(versions.items()):
        # The updater decodes transport bytes before installing them into CPK.
        usable = [entry for entry in entries if entry['layer'] != 'download']
        selected = usable[0] if len(usable) == 1 else None
        patches = [entry for entry in entries if entry['layer'] == 'download']
        for entry in patches:
            decoded = decode_patch(Path(entry['source']).read_bytes(), patch_key)
            entry['decoded'] = True
            entry['decodeBasis'] = 'CPKUpdate:438c50->43b330'
            entry['installedComparison'] = 'identical' if selected and decoded == Path(
                selected['source']).read_bytes() else 'different' if selected else 'missing-installed'
            if Path(key).suffix in ('.xml', '.imageset'):
                try:
                    ET.fromstring(decoded)
                    entry['decodedXmlReadable'] = True
                except ET.ParseError:
                    entry['decodedXmlReadable'] = False
        item = dict(key=key, versions=entries, selected=selected,
                    selectionBasis='only-decoded-source' if selected else 'unresolved',
                    patchPending=any(entry['installedComparison'] != 'identical' for entry in patches))
        inventory.append(item)
        for entry in entries:
            if Path(key).suffix in ('.xml', '.imageset'):
                root = xml_document(Path(entry['source']))
                entry['xmlReadable'] = root is not None
        if selected is None:
            continue
        path = Path(selected['source'])
        if key.startswith('ui/layouts/') and path.suffix.lower() == '.xml':
            root = xml_document(path)
            if root is None:
                continue
            windows = []
            def walk(element, parent=None):
                if element.tag == 'Window':
                    name = element.get('Name')
                    windows.append(dict(name=name, type=element.get('Type'), parent=parent,
                        properties={child.get('Name'): child.get('Value') for child in element
                                    if child.tag == 'Property'},
                        events=[dict(child.attrib) for child in element if child.tag == 'Event']))
                    parent = name
                for child in element:
                    walk(child, parent)
            walk(root)
            layouts.append(dict(path=selected['path'], source=selected['source'],
                                patchPending=item['patchPending'], windows=windows))
        elif path.suffix.lower() == '.imageset':
            root = xml_document(path)
            if root is not None:
                imagesets.append(dict(path=selected['path'], attributes=dict(root.attrib),
                    images=[dict(image.attrib) for image in root if image.tag == 'Image']))
        elif key.startswith('role/') and path.suffix.lower() == '.ini':
            ini = configparser.ConfigParser(interpolation=None, strict=False)
            ini.read_string(path.read_text(encoding='gbk'))
            actions.append(dict(path=selected['path'], sections={section: dict(ini[section]) for section in ini.sections()}))
    summary = dict(paths=len(inventory), selected=sum(item['selected'] is not None for item in inventory),
        patchCandidates=sum(any(entry['layer'] == 'download' for entry in item['versions']) for item in inventory),
        patchPending=sum(item['patchPending'] for item in inventory),
        installedIdenticalPatches=sum(entry.get('installedComparison') == 'identical'
            for entries in versions.values() for entry in entries),
        layers=dict(Counter(entry['layer'] for entries in versions.values() for entry in entries)),
        layouts=len(layouts), controls=sum(len(layout['windows']) for layout in layouts),
        imagesets=len(imagesets), images=sum(len(imageset['images']) for imageset in imagesets),
        actorConfigs=len(actions), extensions=dict(Counter(Path(item['key']).suffix for item in inventory)))
    args.out.mkdir(parents=True, exist_ok=True)
    for name, data in [('inventory', inventory), ('layouts', layouts), ('imagesets', imagesets),
                       ('actor-actions', actions), ('summary', summary)]:
        (args.out / f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
