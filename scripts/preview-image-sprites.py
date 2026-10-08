"""Create an offline sprite-sheet directory and a representative image preview."""
from collections import defaultdict
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'recovery/output/web-assets'
ART = ROOT / 'art/hd-assets'


def main():
    directory = json.loads((RUNTIME / 'sprite-images.json').read_text())
    summary = json.loads((ART / 'sprite-packing.json').read_text())
    cells = defaultdict(dict)
    for path, cell in directory['images'].items():
        position = tuple(cell[key] for key in ('x', 'y', 'width', 'height'))
        cells[cell['atlas']].setdefault(position, []).append(path)
    thumbnails = ART / 'sprite-preview'
    thumbnails.mkdir(exist_ok=True)
    current = {Path(sheet['path']).name for sheet in directory['sheets']}
    for file in thumbnails.glob('*.png'):
        if file.name not in current:
            file.unlink()
    pages = []
    for sheet in directory['sheets']:
        name = Path(sheet['path']).name
        with Image.open(RUNTIME / sheet['path']) as source:
            source.thumbnail((640, 640))
            source.save(thumbnails / name)
        pages.append(dict(sheet, thumbnail='sprite-preview/' + name,
                          url='../../recovery/output/web-assets/' + sheet['path'],
                          regions=[dict(x=p[0], y=p[1], width=p[2], height=p[3], paths=paths)
                                   for p, paths in cells['/' + sheet['path']].items()]))
    page = '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>精灵图资源目录</title><style>
*{box-sizing:border-box}body{margin:0;padding:28px;background:#141820;color:#eef2f7;font:15px/1.6 system-ui,sans-serif}
h1{margin:0;font-size:26px}p{color:#c1c9d5}input,select,button{font:inherit;color:inherit;background:#222b39;border:1px solid #52637d;border-radius:6px;padding:7px 12px}
input{width:min(480px,100%)}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:22px}
.sheet{padding:12px;border:1px solid #374252;border-radius:10px;cursor:pointer;text-align:left}.sheet img{display:block;width:100%;height:220px;object-fit:contain;background-color:#aeb5c0;background-image:conic-gradient(#d4d9e1 25%,transparent 0 50%,#d4d9e1 0 75%,transparent 0);background-size:20px 20px}
.sheet strong{display:block;margin-top:8px}.sheet small{color:#b3bfd0}dialog{width:96vw;max-width:1400px;height:94vh;background:#141820;color:inherit;border:1px solid #52637d;border-radius:12px;padding:18px}
dialog::backdrop{background:#000b}header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}#close{margin-left:auto}.viewport{height:calc(100% - 122px);overflow:auto;margin-top:14px;background:#89909b;position:relative}
#picture{position:relative}#full{display:block;width:100%;height:100%}#outlines{position:absolute;inset:0;width:100%;height:100%}#detail{font:13px/1.5 monospace;white-space:pre-wrap;overflow:auto;height:66px;margin:8px 0}
</style></head><body><h1>精灵图资源目录</h1>
<p>__SUMMARY__</p><label>筛选资源 <input id="search" type="search" placeholder="地图编号、坦克编号或图片名称"></label>
<div id="grid"></div><dialog id="viewer"><header><strong id="title"></strong><label>缩放 <select id="zoom"><option value="fit">适应窗口</option><option value="0.25">25%</option><option value="0.5">50%</option><option value="1">100%</option><option value="2">200%</option></select></label><label><input id="bounds" type="checkbox" style="width:auto" checked> 显示格子</label><button id="close">关闭</button></header>
<div class="viewport" id="viewport"><div id="picture"><img id="full" alt="精灵图"><svg id="outlines"></svg></div></div><p id="detail">移动到格子查看原图片路径，点击格子固定显示。</p></dialog>
<script>
const pages=__PAGES__;
const grid=document.querySelector('#grid'), viewer=document.querySelector('#viewer'), picture=document.querySelector('#picture'), outlines=document.querySelector('#outlines');
let active;
function resize(){if(!active)return;const value=document.querySelector('#zoom').value;const scale=value==='fit'?Math.min(1,document.querySelector('#viewport').clientWidth/active.width):Number(value);picture.style.width=active.width*scale+'px';picture.style.height=active.height*scale+'px';}
function openPage(page){active=page;document.querySelector('#title').textContent=page.path;document.querySelector('#full').src=page.url;outlines.replaceChildren();outlines.setAttribute('viewBox',`0 0 ${page.width} ${page.height}`);let pinned=false;
 for(const cell of page.regions){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const key of ['x','y','width','height'])rect.setAttribute(key,cell[key]);rect.setAttribute('fill','transparent');rect.setAttribute('stroke','#00c8ff');rect.setAttribute('stroke-width','1');rect.setAttribute('vector-effect','non-scaling-stroke');const show=()=>{document.querySelector('#detail').textContent=`${cell.width}×${cell.height} @ ${cell.x}, ${cell.y}\n${cell.paths.join('\n')}`;};rect.addEventListener('mouseenter',()=>{if(!pinned)show();});rect.addEventListener('click',()=>{pinned=!pinned;show();});outlines.append(rect);}
 document.querySelector('#detail').textContent='移动到格子查看原图片路径，点击格子固定显示。';viewer.showModal();resize();}
function render(){const query=document.querySelector('#search').value.toLowerCase();grid.replaceChildren();for(const page of pages){if(query&&!page.path.toLowerCase().includes(query)&&!page.regions.some(cell=>cell.paths.some(path=>path.toLowerCase().includes(query))))continue;const button=document.createElement('button');button.className='sheet';const image=document.createElement('img');image.loading='lazy';image.src=page.thumbnail;image.alt=page.path;const title=document.createElement('strong');title.textContent=page.path;const detail=document.createElement('small');detail.textContent=`${page.width}×${page.height} · ${page.cells} 个格子 · ${page.references} 个引用`;button.append(image,title,detail);button.addEventListener('click',()=>openPage(page));grid.append(button);}}
document.querySelector('#search').addEventListener('input',render);document.querySelector('#zoom').addEventListener('change',resize);document.querySelector('#close').addEventListener('click',()=>viewer.close());document.querySelector('#bounds').addEventListener('change',event=>{outlines.style.display=event.target.checked?'':'none';});window.addEventListener('resize',resize);render();
</script></body></html>'''
    text = (f"{summary['packedImages']:,} 张图片合并为 {summary['sheets']} 张精灵图；"
            f"发布 PNG {summary['originalImages']:,} → {summary['publishedImages']}，减少 {summary['imageReductionPercent']}%。"
            '点击精灵图可放大并查看原图片路径。')
    cleanup_path = ART / 'image-cleanup.json'
    if cleanup_path.exists():
        cleanup = json.loads(cleanup_path.read_text())
        text = (f"{summary['packedImages']:,} 个图片路径共用 {summary['uniqueCells']:,} 个格子，"
                f"打包为 {summary['sheets']} 张精灵图。清理 {cleanup['unusedImages']:,} 个无引用路径；"
                f"发布图片 {cleanup['publishedImagesBefore']} → {cleanup['publishedImagesAfter']}。"
                '点击精灵图可放大并查看原图片路径。')
    page = page.replace('__SUMMARY__', html.escape(text)).replace('__PAGES__', json.dumps(pages, ensure_ascii=False).replace('</', '<\\/'))
    (ART / 'sprite-preview.html').write_text(page)
    selected = [next(page for page in pages if page['path'].startswith(prefix))
                for prefix in ('sprites/ui-', 'sprites/local-ui-', 'sprites/tank-001-',
                               'sprites/map-0001-', 'sprites/data-effect-', 'sprites/data-scnobj-')]
    montage = Image.new('RGB', (1500, 1050), '#141820')
    draw = ImageDraw.Draw(montage)
    for index, sheet in enumerate(selected):
        left, top = index % 3 * 500, index // 3 * 525
        with Image.open(thumbnails / Path(sheet['path']).name) as image:
            image.thumbnail((460, 460))
            background = Image.new('RGB', image.size, '#969faa')
            background.paste(image, mask=image.getchannel('A') if image.mode == 'RGBA' else None)
            montage.paste(background, (left + (500 - image.width) // 2, top + 24))
        draw.text((left + 20, top + 492), Path(sheet['path']).stem, fill='#eef2f7')
    montage.save(ART / 'previews/sprite-sheets.png')
    print(ART / 'sprite-preview.html')


if __name__ == '__main__':
    main()
