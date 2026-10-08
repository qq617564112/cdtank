"""Publish type5 source model vertices, materials and CVD tracks."""
import json
from pathlib import Path
import re
import struct
from PIL import Image
from pol import read_pol
from cvd import read_cvd

ROOT = Path(__file__).resolve().parents[1]


def export_models(controls, source_root, web_root):
    paths = {p.relative_to(source_root).as_posix().lower(): p
             for p in source_root.rglob('*') if p.is_file()}
    resources = []
    def missing_m120(model_path, reference):
        if reference.replace('\\', '/').casefold() != 'm120.tga' or \
                model_path.name.casefold() != 'youlincat.pol':
            return None
        from reconstruct_battle_media import M120_PROVENANCE, export_m120
        asset = export_m120(model_path, web_root)
        return asset, dict(M120_PROVENANCE)

    def texture(model_path, reference):
        relative = (model_path.parent / reference.replace('\\', '/')).relative_to(source_root).as_posix()
        source = paths.get(relative.lower())
        if not source:
            source = paths.get(str(Path(relative).with_suffix('.dds')).lower())
        if not source:
            return missing_m120(model_path, reference) or (None, None)
        asset = source.relative_to(source_root).with_suffix('.png').as_posix()
        destination = web_root / asset
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image.convert('RGBA').save(destination)
        return asset, None
    for reference in sorted({row['reference'] for row in controls}):
        path = paths.get(reference.replace('\\', '/').lower())
        resource = dict(reference=reference, resolution='missing', nodes=[])
        if path:
            resource['resolution'] = 'published'
            if path.suffix.lower() == '.pol':
                for mesh in read_pol(path)['meshes']:
                    vertices, colors = [], []
                    for raw in mesh['vertices']:
                        position = struct.unpack_from('<3f', raw)
                        normal = struct.unpack_from('<3f', raw, 12) if mesh['fvf'] & 2 else (0,0,0)
                        offset = 24 if mesh['fvf'] & 2 else 12
                        if mesh['fvf'] & 4:
                            b,g,r,a = raw[offset:offset+4]
                            colors.append([r/255,g/255,b/255,a/255]); offset += 4
                        uv = struct.unpack_from('<2f', raw, offset)
                        vertices.append([*position, *normal, *uv])
                    parts = []
                    for part in mesh['parts']:
                        asset, texture_provenance = texture(path, part['textures'][0])
                        entry = dict(kind=part['kind'], properties=part['properties'], asset=asset,
                            indices=[i for face in part['faces'] for i in face])
                        if texture_provenance:
                            entry['textureProvenance'] = texture_provenance
                        parts.append(entry)
                    resource['nodes'].append(dict(name=mesh['name'], fvf=mesh['fvf'], vertices=vertices,
                        colors=colors or None, parts=parts))
            else:
                for node in read_cvd(path)['nodes']:
                    if not node['present']:
                        resource['nodes'].append(dict(fvf=19, parent=node['parent'], parts=[]))
                        continue
                    parts = []
                    for part in node['parts']:
                        raw = bytes.fromhex(part['material']); properties = []
                        for offset in range(0, 16, 4):
                            b,g,r,a = raw[offset:offset+4]; properties.extend([r/255,g/255,b/255,a/255])
                        properties.append(struct.unpack_from('<f', raw, 16)[0])
                        asset, texture_provenance = texture(path, part['texture'])
                        entry = dict(kind=part['kind'], properties=properties,
                            asset=asset, indices=[i for face in part['faces'] for i in face])
                        if texture_provenance:
                            entry['textureProvenance'] = texture_provenance
                        parts.append(entry)
                    duration = max([*node['times'], *[track['keys'][-1][0]-track['keys'][0][0]
                        for track in [node['position'],node['rotation'],node['scale']]]])
                    resource['nodes'].append(dict(fvf=19, parent=node['parent'],
                        animation={key:node[key] for key in ['position','rotation','scale','value']},
                        duration=duration, frames=node['frames'], times=node['times'], parts=parts))
        else:
            from reconstruct_effect_models import build_reconstructed_model
            reconstructed = build_reconstructed_model(reference, source_root, web_root)
            if reconstructed:
                resource = reconstructed
        resources.append(resource)
    scripts = []
    for name in ['default','newgeom','geom_t','geom_c1','geom_t_c1']:
        path = source_root / f'Data/gfxscript/{name}.gbf'
        text = re.sub(r'//[^\n]*', '', path.read_text()).split('technique',1)[1]
        states = [dict(name=match[1],value=re.sub(r'\s+','',match[2]).upper())
            for match in re.finditer(r'(\w+(?:\[\d+\])?)\s*=\s*([\w|]+)\s*;',text)]
        scripts.append(dict(name=name, states=states))
    result = dict(resources=resources, scripts=scripts,
        graphics=dict(ambient=[.2,.2,.2,1],emissive=0))
    (web_root/'effect-models.json').write_text(json.dumps(result,ensure_ascii=False)+'\n')
    return result


if __name__ == '__main__':
    library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
    result=export_models(library['modelControls'],ROOT/'recovery/output/verified/assets/data',ROOT/'recovery/output/web-assets')
    original=sum(row['resolution']=='published' and row.get('provenance',{}).get('kind')!='reconstructed' for row in result['resources'])
    reconstructed=sum(row.get('provenance',{}).get('kind')=='reconstructed' for row in result['resources'])
    print('Published',sum(row['resolution']=='published' for row in result['resources']),'of',len(result['resources']),
          f'type5 models ({original} original, {reconstructed} reconstructed)')
