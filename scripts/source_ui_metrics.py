"""Measure source UI silhouettes, palettes and font ink coordinates."""
from collections import Counter
import json
from pathlib import Path

from PIL import ImageFont

ROOT = Path(__file__).resolve().parents[1]


def css_colour(pixel):
    red, green, blue, alpha = pixel
    return f'#{red:02x}{green:02x}{blue:02x}' if alpha == 255 else f'rgb({red} {green} {blue} / {alpha / 255:.6f})'


def palette(image):
    return Counter(pixel for pixel in image.getdata() if pixel[3] > 0)


def inset(image):
    left, top, right, bottom = image.getchannel('A').getbbox()
    return f'{top / image.height * 100:.6f}% {(image.width - right) / image.width * 100:.6f}% ' \
           f'{(image.height - bottom) / image.height * 100:.6f}% {left / image.width * 100:.6f}%'


def polygon(mask):
    """Describe disconnected source shapes and holes with one CSS polygon."""
    import cv2
    import numpy as np
    height, width = mask.shape
    enlarged = cv2.resize(mask.astype(np.uint8), (width * 4, height * 4), interpolation=cv2.INTER_NEAREST)
    contours, _ = cv2.findContours(enlarged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for contour in contours:
        if cv2.contourArea(contour) < 2:
            continue
        points = cv2.approxPolyDP(contour, 4, True).reshape(-1, 2)
        paths.append([(x / (width * 4) * 100, y / (height * 4) * 100) for x, y in points])
    if not paths:
        return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
    pivot = paths[0][0]
    points = [pivot]
    for path in paths:
        points.extend([*path, path[0], pivot])
    return 'polygon(evenodd, ' + ', '.join(f'{x:.4f}% {y:.4f}%' for x, y in points) + ')'


def fit_text(image, label, ink_bounds, fill, outline, stroke, face='brush'):
    """Fit a manually read caption to its recorded source ink rectangle."""
    left, top, right, bottom = ink_bounds
    path = ROOT / {
        'brush': 'recovery/output/web-assets/ui/fonts/xiangjiao-brush.ttf',
        'sans': 'art/hd-assets/font-sources/NotoSansSC-ui-bold.ttf',
        'latin': 'art/hd-assets/font-sources/Arimo-ui-bold.ttf',
        'digits': 'art/hd-assets/font-sources/ArchivoBlack-ui-bold.ttf',
        'serif': 'art/hd-assets/font-sources/SourceSerif-ui-bold.ttf',
    }[face]
    font = ImageFont.truetype(str(path), 1000)
    x0, y0, x1, y1 = font.getbbox(label, anchor='ls')
    size = (bottom - top) * 1000 / (y1 - y0)
    ascent, descent = font.getmetrics()
    scale_x = (right - left) * 1000 / ((x1 - x0) * size)
    return {'text': label, 'width': image.width, 'height': image.height, 'face': face,
            'size': round(size, 5), 'lineHeight': round((ascent + descent) * size / 1000, 5),
            'x': round(left - x0 * size / 1000 * scale_x, 5),
            'y': round(top - (ascent + y0) * size / 1000, 5), 'scaleX': round(scale_x, 7),
            'colour': fill, 'outline': outline, 'stroke': stroke,
            'inkBounds': [int(left), int(top), int(right), int(bottom)]}


def manual_catalogue():
    result = {'assets': {}, 'textAssets': {}, 'drawings': {}, 'reviewed': []}
    for path in sorted((ROOT / 'scripts').glob('ui-manual-*.json')):
        data = json.loads(path.read_text())
        for category in ('assets', 'textAssets', 'drawings'):
            for source, entry in data.get(category, {}).items():
                result[category].setdefault(source, {}).update(entry)
        result['reviewed'].extend(data.get('reviewed', []))
    for source in result['assets'].keys() & result['drawings'].keys():
        if result['assets'][source].get('plain'):
            result['textAssets'].setdefault(source, result['assets'][source])
    return result


def manual_style(image, entry):
    style = fit_text(image, entry['text'], entry['inkBounds'], entry['colour'],
                     entry.get('outline', '#000'), entry.get('stroke', 0), entry.get('face', 'sans'))
    style.update((key, entry[key]) for key in ('shadow', 'shadowX', 'shadowY') if key in entry)
    if entry.get('runs'):
        style['runs'] = [manual_style(image, {**entry, 'runs': None, **run}) for run in entry['runs']]
    return style
