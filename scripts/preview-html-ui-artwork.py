"""Write an offline comparison of original UI images and live CSS/font artwork."""
import html
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def main():
    assets = ROOT / 'apps/web/src/assets'
    buttons = json.loads((assets / 'button-artwork.json').read_text())['assets']
    simple = json.loads((assets / 'simple-ui-artwork.json').read_text())['assets']
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    images = {image['asset']: image for sheet in ui['imagesets'] for image in sheet['images'] if image.get('asset')}
    relative = lambda path: Path(os.path.relpath(path, ART)).as_posix()
    css = []
    for name in ('simple-ui-artwork', 'button-artwork'):
        content = (assets / f'{name}.css').read_text()
        content = content.replace("url('/hd-ui/buttons/", "url('button-backgrounds/")
        css.append(content)
    rows = []
    for source in sorted(simple.keys() | buttons.keys(), key=lambda path: [int(part) for part in path.removesuffix('.png').split('/')[2:]]):
        image = images[source]
        name = html.escape(image['Name'].split('\\')[-1])
        width, height = int(image['Width']), int(image['Height'])
        background = buttons.get(source, {}).get('background')
        caption = html.escape(background.removeprefix('/hd-ui/buttons/') if background else 'CSS')
        original = html.escape(relative(ROOT / 'art/hd-assets/original' / source), quote=True)
        rows.append(f'<article><p>{source}<br>{name}</p><div class="pair">'
                    f'<div><small>原图</small><img src="{original}" width="{width}" height="{height}" alt="{name}"></div>'
                    f'<div><small>{caption}</small><span data-source-asset="{source}" '
                    f'style="display:block;width:{width}px;height:{height}px"></span></div></div></article>')
    font = relative(ROOT / 'recovery/output/web-assets/ui/fonts/xiangjiao-brush.ttf')
    page = f'''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>UI 图形与按钮对照</title>
<style>@font-face {{font-family:'CDTank-Xiangjiao';src:url('{font}');font-weight:700}}
body {{margin:24px;background:#202a3b;color:#edf0f6;font:14px sans-serif}}
main {{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}}
article {{padding:16px;background:#34415a;overflow:auto}} p {{margin:0 0 12px;font-size:12px;line-height:1.6}}
.pair {{display:flex;gap:24px;align-items:start}} .pair>div {{flex:0 0 auto}}
small {{display:block;margin-bottom:8px;color:#c3d5f4}} img {{display:block;image-rendering:pixelated}}
{''.join(css)}</style><h1>UI 图形与按钮对照</h1>
<p>{len(simple)} 个 CSS 图形 · {len(buttons)} 个字体按钮 · {len(set(entry['background'] for entry in buttons.values() if entry['background']))} 张共用底图</p>
<main>{''.join(rows)}</main></html>'''
    target = ART / 'html-ui-preview.html'
    target.write_text(page)
    print(target.relative_to(ROOT))


if __name__ == '__main__':
    main()
