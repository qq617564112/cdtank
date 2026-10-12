import json
from pathlib import Path
import struct
from urllib.parse import quote, unquote


def rewrite_paths(value, mapping, output_prefix):
    if isinstance(value, str):
        if value in mapping:
            return mapping[value]
        if value.startswith('/') and value[1:] in mapping:
            return '/' + mapping[value[1:]]
        if value.startswith('art/hd/') and value[7:] in mapping:
            return output_prefix + '/' + mapping[value[7:]]
        return value
    if isinstance(value, list):
        return [rewrite_paths(item, mapping, output_prefix) for item in value]
    if isinstance(value, dict):
        result = {rewrite_paths(key, mapping, output_prefix): rewrite_paths(item, mapping, output_prefix)
            for key, item in value.items()}
        if result.get('asset') != value.get('asset'):
            result.pop('assetSha256', None)
        return result
    return value


def rewrite_resource(path, relative, destination, mapping, images, output_prefix):
    result = rewrite_paths(json.loads(path.read_text()), mapping, output_prefix)
    if relative == 'manifest.json':
        for texture in result['textures']:
            original = texture.get('original', '').removeprefix('art/original/')
            if original not in images:
                continue
            image = images[original]
            texture['source'] = original
            texture.pop('png', None)
            texture['asset'] = image['output_relative']
            texture['webp'] = output_prefix + '/' + image['output_relative']
            texture['outputSize'] = image.get('target_size', texture['outputSize'])
    destination.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')


def glb_chunks(payload):
    chunks = []
    offset = 12
    while offset < len(payload):
        length, kind = struct.unpack_from('<II', payload, offset)
        chunks.append((kind, payload[offset + 8:offset + 8 + length]))
        offset += 8 + length
    return chunks


def rewrite_model(path, relative, source, destination, mapping, embedded, encoder):
    chunks = glb_chunks(path.read_bytes())
    document = json.loads(chunks[0][1])
    binary = next((payload for kind, payload in chunks if kind == 0x004e4942), b'')
    replacements = {}
    webp_images = set()
    image_rows = []
    for index, image in enumerate(document.get('images', [])):
        if 'uri' in image:
            original = (path.parent / unquote(image['uri'])).resolve().relative_to(source).as_posix()
            target = mapping.get(original, original)
            if target.endswith('.webp'):
                image['uri'] = image['uri'][:image['uri'].rfind('/') + 1] + quote(Path(target).name, safe='')
                image['mimeType'] = 'image/webp'
                webp_images.add(index)
            continue
        if 'bufferView' not in image:
            continue
        plan = embedded[(relative, index)]
        view_index = image['bufferView']
        view = document['bufferViews'][view_index]
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        suffix = '.webp' if image['mimeType'] == 'image/webp' else '.png'
        encoded, row = encoder.image(payload, suffix, plan['target_size'], plan['encoding_profile'])
        replacements[view_index] = encoded
        image['mimeType'] = 'image/webp'
        webp_images.add(index)
        image_rows.append({**plan, **row, 'output_relative': f'{relative}#images/{index}'})
    for texture in document.get('textures', []):
        if texture.get('source') in webp_images:
            image_index = texture.pop('source')
            texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': image_index}
    if webp_images:
        for key in ('extensionsUsed', 'extensionsRequired'):
            document.setdefault(key, [])
            if 'EXT_texture_webp' not in document[key]:
                document[key].append('EXT_texture_webp')
    preserved = 0
    if replacements:
        rebuilt = bytearray()
        for index, view in enumerate(document['bufferViews']):
            rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
            start = view.get('byteOffset', 0)
            content = replacements.get(index, binary[start:start + view['byteLength']])
            preserved += index not in replacements
            view['byteOffset'] = len(rebuilt)
            view['byteLength'] = len(content)
            rebuilt.extend(content)
        document['buffers'][0]['byteLength'] = len(rebuilt)
        rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
        chunks = [(kind, bytes(rebuilt) if kind == 0x004e4942 else payload) for kind, payload in chunks]
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    json_bytes += b' ' * (-len(json_bytes) % 4)
    chunks[0] = (0x4e4f534a, json_bytes)
    payload = b''.join(struct.pack('<II', len(payload), kind) + payload for kind, payload in chunks)
    destination.write_bytes(struct.pack('<III', 0x46546c67, 2, len(payload) + 12) + payload)
    return {'model': relative, 'source_bytes': path.stat().st_size,
        'output_bytes': destination.stat().st_size, 'webp_images': len(webp_images),
        'embedded_images': image_rows, 'preserved_buffer_views': preserved}
