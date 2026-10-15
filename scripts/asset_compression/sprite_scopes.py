"""Resolve lobby and device-specific battle artwork from the compression recipe."""

import json
from pathlib import Path
import re


SCOPES = ('lobby', 'mobile-battle', 'desktop-battle')


def image_scopes(rows, recipe, manifests):
    definitions = recipe['ui_sprite_scopes']
    ui = json.loads((manifests / 'ui.json').read_text())
    fonts = json.loads((manifests / 'ui-fonts.json').read_text())
    emotes = json.loads((manifests / 'chat-emote-sequences.json').read_text())
    aliases = {item['source_relative']: item['output_relative'] for item in recipe['images']}
    for replacement in recipe['ui_replacements']:
        for name in (replacement['texture'], replacement['output_relative']):
            aliases[name] = replacement['replacement']
    # Recovered metadata can use either the source identifier or its public single-image path.
    from .public_layout import public_path
    for item in recipe['images']:
        for name in (item['source_relative'], item['output_relative']):
            aliases[public_path('sprites/standalone/' + name)] = item['output_relative']

    def resolve(asset):
        name = asset.split('#')[0].lstrip('/')
        return aliases.get(name, name)

    def select(definition):
        selected = set()

        def add(asset):
            name = resolve(asset)
            if name in rows:
                selected.add(name)

        for name in rows:
            if any(name.startswith(prefix) for prefix in definition.get('prefixes', [])):
                selected.add(name)
        for asset in definition.get('images', []):
            add(asset)
        for layout in ui['layouts']:
            suffix = Path(layout['path']).name
            if suffix not in definition.get('layouts', []) and not (
                definition.get('nonbattle_layouts') and not suffix.startswith('game_')):
                continue
            for control in layout['windows']:
                for reference in control['properties'].values():
                    match = re.fullmatch(r'set:(\S+) image:(.+)', reference)
                    if not match:
                        continue
                    candidates = [value for value in ui['imagesets'] if value['attributes']['Name'] == match[1]]
                    imageset = next((value for value in candidates if 'imagesets_dds/' in value['path']),
                        candidates[0] if candidates else None)
                    image = next((value for value in imageset['images'] if value['Name'] == match[2]), None) \
                        if imageset else None
                    if image and image.get('asset'):
                        add(image['asset'])
        for name in definition.get('imagesets', []):
            candidates = [value for value in ui['imagesets'] if value['attributes']['Name'] == name]
            imageset = next((value for value in candidates if 'imagesets_dds/' in value['path']),
                candidates[0] if candidates else None)
            for image in imageset['images'] if imageset else []:
                if image.get('asset'):
                    add(image['asset'])
        if definition.get('fonts'):
            for font in fonts['fonts']:
                for glyph in font.get('glyphs', []):
                    add(glyph['asset'])
        if definition.get('chat_emotes'):
            for sequence in emotes['sequences']:
                for frame in sequence['frames']:
                    add(frame['asset'])
        return {name for name in selected if not any(name.startswith(prefix)
            for prefix in definition.get('exclude_prefixes', []))}

    shared = select(definitions['shared'])
    return {scope: shared | select(definitions[scope]) for scope in SCOPES}


def deferred_image(relative):
    return bool(re.fullmatch(r'Data/ui/loading/[1-5]\.webp', relative)) \
        or relative.startswith('Data/effect/')
