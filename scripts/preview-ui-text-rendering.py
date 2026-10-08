"""Create an offline source-image / outline-font comparison sheet."""
import base64
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCALE = 4


def render_ink(style):
    name = {'sans': 'NotoSansSC', 'latin': 'Arimo', 'digits': 'ArchivoBlack'}[style['face']]
    font = ImageFont.truetype(str(ROOT / f'art/hd-assets/font-sources/{name}-ui-bold.ttf'),
                              round(style['size'] * SCALE))
    ascent, _ = font.getmetrics()
    box = font.getbbox(style['text'], anchor='ls')
    layer = Image.new('RGBA', (max(1, box[2] + 20), max(1, ascent + box[3] + 20)))
    ImageDraw.Draw(layer).text((0, ascent), style['text'], font=font, anchor='ls',
                              fill=style['colour'], stroke_fill=style['outline'],
                              stroke_width=round(style['stroke'] * SCALE / 2))
    layer = layer.resize((round(layer.width * style['scaleX']), layer.height), Image.Resampling.LANCZOS)
    return layer


def render(style):
    output = Image.new('RGBA', (style['width'] * SCALE, style['height'] * SCALE))
    for run in style.get('runs', [style]):
        layer = render_ink(run)
        if run.get('shadow'):
            shadow = Image.new('RGBA', layer.size, run['shadow'])
            shadow.putalpha(layer.getchannel('A'))
            output.alpha_composite(shadow, (round((run['x'] + run['shadowX'] * run['scaleX']) * SCALE),
                                            round((run['y'] + run['shadowY']) * SCALE)))
        output.alpha_composite(layer, (round(run['x'] * SCALE), round(run['y'] * SCALE)))
    return output


def write_gallery(catalogue, originals):
    fonts = []
    for face in ('sans', 'latin', 'digits'):
        data = base64.b64encode((ROOT / f'recovery/output/web-assets/ui/fonts/source-{face}-bold.woff').read_bytes()).decode()
        fonts.append(f"@font-face {{font-family: 'source-{face}'; src: url(data:font/woff;base64,{data}); font-weight: 700;}}")
    rows = []
    for asset, style in catalogue['assets'].items():
        if asset.split('/')[2] in ('60', '67', '69'):
            continue
        original = base64.b64encode((ROOT / originals[asset]).read_bytes()).decode()
        width, height = style['width'], style['height']
        lettering = []
        for run in style.get('runs', [style]):
            shadow = f"{run['shadowX']}px {run['shadowY']}px 0 {run['shadow']}" if run.get('shadow') else 'none'
            css = (f"left:{run['x']}px;top:{run['y']}px;font-family:source-{run['face']};"
                   f"font-size:{run['size']}px;line-height:{run['lineHeight']}px;color:{run['colour']};"
                   f"-webkit-text-stroke:{run['stroke']}px {run['outline']};"
                   f"transform:scaleX({run['scaleX']});text-shadow:{shadow}")
            lettering.append(f'<span class="ink" style="{css}">{html.escape(run["text"])}</span>')
        group = 'numeric' if asset.split('/')[2] in ('0', '2', '3', '5', '6', '11') else 'labels'
        frames = (f'<div class="frame" data-width="{width}" data-height="{height}">'
                  f'<div class="coordinates" style="width:{width}px;height:{height}px">')
        rows.append(f'<tr data-group="{group}"><td>{html.escape(style["text"])}<small>{asset}</small></td>'
                    f'<td>{frames}<img src="data:image/png;base64,{original}" width="{width}" height="{height}"></div></div></td>'
                    f'<td>{frames}{"".join(lettering)}</div></div></td></tr>')
    document = '''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>普通文字与数字字体对照</title><style>__FONTS__
body {margin:24px;background:#183648;color:#edf7fa;font-family:sans-serif;}
h1 {font-size:22px;} p {color:#bdd0da;} label {margin-right:24px;}
select {padding:6px;border:1px solid #91a8b6;background:#244c60;color:white;}
table {border-collapse:collapse;width:100%;margin-top:24px;}
th,td {text-align:left;padding:12px;border-bottom:1px solid #385363;vertical-align:middle;}
small {display:block;margin-top:4px;color:#91a8b6;}
.frame {position:relative;overflow:visible;}
.coordinates {position:absolute;left:0;top:0;transform-origin:left top;}
.coordinates img {image-rendering:pixelated;}
.ink {position:absolute;font-weight:700;font-style:normal;letter-spacing:0;white-space:pre;
  width:max-content;transform-origin:left top;paint-order:stroke fill;}
[hidden] {display:none;}
</style><h1>普通文字与数字字体对照</h1>
<p>左列保留原图片，右列直接使用轮廓字体。两列占位尺寸相同，可切换倍率查看。</p>
<label>倍率 <select id="scale"><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option></select></label>
<label>分类 <select id="group"><option value="all">全部</option><option value="labels">普通标签</option><option value="numeric">数字与符号</option></select></label>
<table><thead><tr><th>内容</th><th>原图片</th><th>字体渲染</th></tr></thead><tbody>__ROWS__</tbody></table>
<script>
const scale = document.getElementById('scale');
const group = document.getElementById('group');
function resize() {
  for (const frame of document.querySelectorAll('.frame')) {
    frame.style.width = Number(frame.dataset.width) * Number(scale.value) + 'px';
    frame.style.height = Number(frame.dataset.height) * Number(scale.value) + 'px';
    frame.firstElementChild.style.transform = 'scale(' + scale.value + ')';
  }
}
scale.addEventListener('change', resize);
group.addEventListener('change', () => {
  for (const row of document.querySelectorAll('[data-group]')) {
    row.hidden = group.value !== 'all' && row.dataset.group !== group.value;
  }
});
resize();
</script></html>'''
    output = ROOT / 'art/hd-assets/font-rendering-preview.html'
    output.write_text(document.replace('__FONTS__', '\n'.join(fonts)).replace('__ROWS__', '\n'.join(rows)))
    print(output)


def main():
    catalogue = json.loads((ROOT / 'apps/web/src/interface/resources/source-text-artwork.json').read_text())
    inventory = json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())
    originals = {entry['source']: entry['original'] for entry in inventory['textures']}
    assets = catalogue['assets']
    selection = ['ui/regions/27/96.png', 'ui/regions/27/97.png', 'ui/regions/27/130.png',
                 'ui/regions/34/16.png', 'ui/regions/34/14.png', 'ui/regions/34/33.png',
                 'ui/regions/36/154.png', 'ui/regions/36/182.png', 'ui/regions/36/199.png',
                 'ui/regions/2/1.png', 'ui/regions/3/2.png', 'ui/regions/5/0.png',
                 'ui/regions/11/8.png', 'ui/regions/0/11.png', 'ui/regions/6/7.png']
    sheet = Image.new('RGB', (1040, (len(selection) + 1) * 100), '#183648')
    draw = ImageDraw.Draw(sheet)
    draw.text((30, 20), 'Original (4x pixel view)', fill='white')
    draw.text((540, 20), 'Outline font (4x)', fill='white')
    for index, asset in enumerate(selection):
        y = (index + 1) * 100
        draw.text((30, y), asset, fill='#91a8b6')
        original = Image.open(ROOT / originals[asset]).convert('RGBA')
        original = original.resize((original.width * SCALE, original.height * SCALE), Image.Resampling.NEAREST)
        sheet.paste(original, (30, y + 18), original)
        replacement = render(assets[asset])
        sheet.paste(replacement, (540, y + 18), replacement)
    output = ROOT / 'art/hd-assets/previews/font-rendering-comparison.png'
    sheet.save(output)
    print(output)
    write_gallery(catalogue, originals)


if __name__ == '__main__':
    main()
