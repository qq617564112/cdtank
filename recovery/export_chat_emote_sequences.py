"""Export the 30 original RichEditbox emotion sequences using existing atlas crops."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
out = ROOT / 'recovery/output/web-assets'
ui = json.loads((out / 'ui.json').read_text())
sequences = []
for identifier in range(1, 31):
    name = f'{identifier:03d}'
    source = ROOT / f'recovery/output/verified/assets/data/Data/ui/sequence_images/{name}.seqimage'
    sequence = ET.fromstring(source.read_bytes())
    assert sequence.attrib['Name'] == name
    frames = []
    for frame in sorted(sequence, key=lambda frame: int(frame.attrib['Index'])):
        sets = [entry for entry in ui['imagesets'] if entry['attributes']['Name'] == frame.attrib['Imageset']]
        imageset = next((entry for entry in sets if 'imagesets_dds/' in entry['path']), sets[0])
        image = next(image for image in imageset['images'] if image['Name'] == frame.attrib['Image'])
        assert image.get('asset') and (out / image['asset']).is_file()
        frames.append(dict(index=int(frame.attrib['Index']), duration=float(frame.attrib['Duration']),
                           imageset=frame.attrib['Imageset'], image=frame.attrib['Image'],
                           asset=image['asset'], width=int(image['Width']), height=int(image['Height'])))
    assert len(frames) == int(sequence.attrib['FrameCount'])
    assert [frame['index'] for frame in frames] == list(range(len(frames)))
    sequences.append(dict(id=identifier, name=name, source=source.relative_to(ROOT).as_posix(),
                          sourceLoopCount=int(sequence.attrib['LoopCount']), frames=frames))
(out / 'chat-emote-sequences.json').write_text(json.dumps(dict(sequences=sequences),ensure_ascii=False,indent=2)+'\n')
print(f'PASS: {len(sequences)} original sequences; {sum(len(s["frames"]) for s in sequences)} source frames and resolved PNGs')
