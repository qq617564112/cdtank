"""Publish reconstructed battle media for source resources that are absent."""

import math
import random
import struct
import sys
import wave
from array import array
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from pol import read_pol


TEXTURE_SIZE = 256
M120_ASSET = "reconstructed/battle/m120.png"
M120_PREVIEW_ASSET = "reconstructed/battle/m120-preview.png"
BG07_ASSET = "reconstructed/battle/BG07.wav"
BG07_SOURCE = "recovery/reconstruct_battle_media.py"
BG07_SEED = 1207
BG07_SAMPLE_RATE = 22050
BG07_DURATION = 18.0
WW051_ASSET = "reconstructed/battle/ww051.wav"
WW051_SOURCE = "recovery/reconstruct_battle_media.py"
WW051_SEED = 5107
WW051_SAMPLE_RATE = 22050
WW051_DURATION = 0.45
TREE_SOUND_SOURCE = "recovery/reconstruct_battle_media.py"
TREE_SOUND_SAMPLE_RATE = 22050
TREE_SOUND_PROFILES = {
    "ww101": {
        "seed": 10107,
        "duration": 0.52,
        "rms": 0.032,
        "peak": 0.17,
        "description": "soft petal shimmer over a fine breeze",
        "method": "seeded two-note petal shimmer over fine filtered air with zeroed attack and release",
    },
    "ww102": {
        "seed": 10211,
        "duration": 0.58,
        "rms": 0.030,
        "peak": 0.17,
        "description": "icy glints drifting through a quiet snow air layer",
        "method": "seeded descending crystal partials over layered high air with zeroed attack and release",
    },
    "ww077": {
        "seed": 7707,
        "duration": 0.38,
        "rms": 0.038,
        "peak": 0.17,
        "description": "short firework whistle rising into a light air tail",
        "method": "seeded rising whistle with filtered spray and zeroed attack and release",
    },
    "ww078": {
        "seed": 7807,
        "duration": 0.46,
        "rms": 0.040,
        "peak": 0.18,
        "description": "compact firework burst with a low pop",
        "method": "seeded bright noise burst, filtered body and low pop with zeroed attack and release",
    },
    "ww079": {
        "seed": 7907,
        "duration": 0.62,
        "rms": 0.027,
        "peak": 0.16,
        "description": "scattered high firework star dust",
        "method": "seeded high-frequency grain cloud over a short air tail with zeroed attack and release",
    },
    "ww053": {
        "seed": 5307,
        "duration": 0.42,
        "rms": 0.028,
        "peak": 0.14,
        "description": "short coin ring with a light double strike",
        "method": "seeded bell partials and double transient strike with zeroed attack and release",
    },
    "ww154": {
        "seed": 15407,
        "duration": 0.78,
        "rms": 0.040,
        "peak": 0.18,
        "description": "low impact body with a long restrained decay",
        "method": "seeded low oscillator, damped noise body and long dust tail with zeroed attack and release",
    },
    "ww098": {
        "seed": 9807,
        "duration": 0.46,
        "rms": 0.015,
        "peak": 0.070,
        "description": "quiet rubble impact with short scattered debris taps",
        "method": "seeded low rubble thump, filtered debris and sparse taps with zeroed attack and release",
    },
    "ww137": {
        "seed": 13707,
        "duration": 0.42,
        "rms": 0.032,
        "peak": 0.16,
        "description": "short descending electronic flash with a soft airflow exit",
        "method": "seeded descending electronic partials over a fading filtered air layer with zeroed attack and release",
    },
}


M120_PROVENANCE = {
    "kind": "reconstructed",
    "reference": "m120.TGA",
    "model": "Data/effect/effect/youlincat.POL",
    "asset": M120_ASSET,
    "source": "recovery/reconstruct_battle_media.py",
    "method": "Pillow triangle rasterization of the original POL UV islands with XYZ-driven cartoon palette and lighting",
    "surface": {"vertices": 346, "triangles": 408, "fvf": 19},
}

BG07_PROVENANCE = {
    "kind": "reconstructed",
    "reference": "BG07.wav",
    "asset": BG07_ASSET,
    "source": BG07_SOURCE,
    "method": "seeded circular low-pass noise, low rumble and gentle environmental hum",
    "seed": BG07_SEED,
}

WW051_PROVENANCE = {
    "kind": "reconstructed",
    "reference": "ww051.wav",
    "asset": WW051_ASSET,
    "source": WW051_SOURCE,
    "method": "seeded rising electronic chirp with shaped airflow noise and zeroed attack/release envelope",
    "seed": WW051_SEED,
}


def _clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def _lerp(left, right, amount):
    return left + (right - left) * amount


def _mix(left, right, amount):
    return tuple(round(_lerp(a, b, amount)) for a, b in zip(left, right))


def _normalize(vector, fallback=(0.0, 1.0, 0.0)):
    length = math.sqrt(sum(value * value for value in vector))
    if length < 0.005:
        return fallback
    return tuple(value / length for value in vector)


def _dot(left, right):
    return sum(a * b for a, b in zip(left, right))


def _decode_mesh(mesh):
    vertices = []
    for raw in mesh["vertices"]:
        xyz = struct.unpack_from("<3f", raw)
        offset = 12
        normal = (0.0, 1.0, 0.0)
        if mesh["fvf"] & 2:
            normal = struct.unpack_from("<3f", raw, offset)
            offset += 12
        if mesh["fvf"] & 4:
            offset += 4
        uv = struct.unpack_from("<2f", raw, offset)
        vertices.append((xyz, normal, uv))
    faces = [face for part in mesh["parts"] for face in part["faces"]]
    return vertices, faces


def _face_components(faces):
    parent = list(range(len(faces)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left, right):
        left = find(left)
        right = find(right)
        if left != right:
            parent[right] = left

    by_vertex = {}
    for face_index, face in enumerate(faces):
        for vertex in face:
            by_vertex.setdefault(vertex, []).append(face_index)
    for face_indices in by_vertex.values():
        for face_index in face_indices[1:]:
            union(face_indices[0], face_index)
    grouped = {}
    for face_index in range(len(faces)):
        grouped.setdefault(find(face_index), []).append(face_index)
    return list(grouped.values())


def _component_summary(vertices, faces, component):
    face_vertices = {index for face_index in component for index in faces[face_index]}
    positions = [vertices[index][0] for index in face_vertices]
    uvs = [vertices[index][2] for index in face_vertices]
    count = len(face_vertices)
    center = tuple(sum(position[index] for position in positions) / count for index in range(3))
    return {
        "faces": component,
        "vertices": face_vertices,
        "center": center,
        "uv_center": (
            sum(uv[0] for uv in uvs) / count,
            sum(uv[1] for uv in uvs) / count,
        ),
        "uv_bounds": (
            min(uv[0] for uv in uvs),
            min(uv[1] for uv in uvs),
            max(uv[0] for uv in uvs),
            max(uv[1] for uv in uvs),
        ),
    }


def _region(summary):
    x, y, z = summary["center"]
    u, v = summary["uv_center"]
    if u > 0.80 and v < 0.25 and y > 8.4 and z > 6.4:
        return "eye"
    if 0.34 < u < 0.52 and 0.60 < v < 0.80 and z > 7.4:
        return "nose"
    if u < 0.15 and 0.25 < v < 0.57 and z > 6.0:
        return "cheek"
    if y > 12.0 and z > 2.5 and u > 0.50:
        return "ear"
    if len(summary["faces"]) > 100 and y > 7.0:
        return "head"
    if len(summary["faces"]) > 100:
        return "body"
    if summary["uv_bounds"][1] < 0.08 and len(summary["faces"]) < 4:
        return "paw"
    return "accent"


def _base_color(region, position, summary):
    x, y, z = position
    if region == "head":
        level = _clamp((y + 1.57) / (14.74 + 1.57))
        color = _mix((188, 179, 211), (235, 238, 247), level)
        eye_distance = min(
            math.hypot(x - 1.86, y - 9.85),
            math.hypot(x + 1.91, y - 9.76),
        )
        if z > 6.2:
            color = _mix(color, (198, 186, 220), 0.30 * (1.0 - _clamp(eye_distance / 2.2)))
        return color
    if region == "body":
        level = _clamp((y + 1.57) / (7.35 + 1.57))
        color = _mix((179, 171, 207), (222, 229, 241), level)
        ripple = 0.5 + 0.5 * math.sin(x * 0.85 + z * 0.55 + y * 0.20)
        return _mix(color, (205, 198, 224), 0.10 * ripple)
    if region == "ear":
        level = _clamp((y - 12.1) / (14.74 - 12.1))
        if len(summary["faces"]) <= 3:
            return _mix((161, 148, 196), (197, 187, 221), level)
        return _mix((211, 181, 207), (229, 205, 220), level)
    if region == "cheek":
        return _mix((210, 203, 224), (226, 216, 229), _clamp((z - 6.4) / 1.2))
    if region == "nose":
        return (103, 80, 108) if z > 7.8 else (125, 97, 122)
    if region == "eye":
        return (48, 54, 70) if z > 7.0 else (57, 61, 77)
    if region == "paw":
        return (190, 168, 181) if _clamp((z + 1.0) / 8.0) > 0.45 else (175, 155, 169)
    level = _clamp((y + 1.57) / 9.0)
    return _mix((176, 166, 204), (207, 202, 224), level)


def _shade(color, normal):
    light = _normalize((-0.35, 0.67, 0.72))
    factor = 0.91 + 0.18 * max(0.0, _dot(_normalize(normal), light))
    return tuple(min(255, max(0, round(channel * factor))) for channel in color)


def _draw_triangle(image, uv, colors):
    width, height = image.size
    points = [(uv_value[0] * width, uv_value[1] * height) for uv_value in uv]
    (x0, y0), (x1, y1), (x2, y2) = points
    area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
    if abs(area) < 1e-9:
        return
    min_x = max(0, math.floor(min(x0, x1, x2)))
    max_x = min(width - 1, math.ceil(max(x0, x1, x2)))
    min_y = max(0, math.floor(min(y0, y1, y2)))
    max_y = min(height - 1, math.ceil(max(y0, y1, y2)))
    pixels = image.load()
    for py in range(min_y, max_y + 1):
        sample_y = py + 0.5
        for px in range(min_x, max_x + 1):
            sample_x = px + 0.5
            w0 = ((x1 - sample_x) * (y2 - sample_y) - (y1 - sample_y) * (x2 - sample_x)) / area
            w1 = ((x2 - sample_x) * (y0 - sample_y) - (y2 - sample_y) * (x0 - sample_x)) / area
            w2 = 1.0 - w0 - w1
            if w0 < -1e-6 or w1 < -1e-6 or w2 < -1e-6:
                continue
            pixels[px, py] = tuple(
                round(w0 * colors[0][channel] + w1 * colors[1][channel] + w2 * colors[2][channel])
                for channel in range(3)
            ) + (255,)


def _draw_eye_overlay(image, components):
    draw = ImageDraw.Draw(image)
    for summary in components:
        if _region(summary) != "eye":
            continue
        u0, v0, u1, v1 = summary["uv_bounds"]
        center_u = (u0 + u1) * 0.5
        center_v = (v0 + v1) * 0.5
        radius_u = (u1 - u0) * 0.18
        radius_v = (v1 - v0) * 0.18
        draw.ellipse((
            (center_u - radius_u) * image.width,
            (center_v - radius_v) * image.height,
            (center_u + radius_u) * image.width,
            (center_v + radius_v) * image.height,
        ), fill=(47, 53, 69, 255))
        glint_u = radius_u * 0.28
        glint_v = radius_v * 0.28
        draw.ellipse((
            (center_u - glint_u) * image.width,
            (center_v - glint_v) * image.height,
            (center_u - glint_u * 0.20) * image.width,
            (center_v - glint_v * 0.20) * image.height,
        ), fill=(232, 238, 244, 255))


def _render_m120_texture(vertices, faces, components):
    work_size = TEXTURE_SIZE * 2
    image = Image.new("RGBA", (work_size, work_size), (229, 233, 242, 255))
    summaries = [_component_summary(vertices, faces, component) for component in components]
    face_summary = {}
    for summary in summaries:
        for face_index in summary["faces"]:
            face_summary[face_index] = summary
    order = {"body": 0, "head": 1, "accent": 2, "paw": 2, "cheek": 3, "ear": 4, "nose": 5, "eye": 6}
    for face_index in sorted(range(len(faces)), key=lambda index: order[_region(face_summary[index])]):
        face = faces[face_index]
        summary = face_summary[face_index]
        region = _region(summary)
        uvs = [vertices[index][2] for index in face]
        colors = [
            _shade(_base_color(region, vertices[index][0], summary), vertices[index][1])
            for index in face
        ]
        _draw_triangle(image, uvs, colors)
    image = image.filter(ImageFilter.GaussianBlur(0.65))
    image = image.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.Resampling.LANCZOS)
    _draw_eye_overlay(image, summaries)
    return image


def _sample_texture(texture, uv):
    u = _clamp(uv[0], 0.0, 0.999999)
    v = _clamp(uv[1], 0.0, 0.999999)
    return texture.getpixel((int(u * texture.width), int(v * texture.height)))


def _render_model_view(texture, vertices, faces, camera, size):
    camera = _normalize(camera)
    up = (0.0, 1.0, 0.0)
    right = _normalize((
        up[1] * camera[2] - up[2] * camera[1],
        up[2] * camera[0] - up[0] * camera[2],
        up[0] * camera[1] - up[1] * camera[0],
    ), (1.0, 0.0, 0.0))
    screen_up = _normalize((
        camera[1] * right[2] - camera[2] * right[1],
        camera[2] * right[0] - camera[0] * right[2],
        camera[0] * right[1] - camera[1] * right[0],
    ))
    projected = []
    depths = []
    for position, normal, _uv in vertices:
        projected.append((_dot(position, right), _dot(position, screen_up)))
        depths.append(_dot(position, camera))
    min_x = min(point[0] for point in projected)
    max_x = max(point[0] for point in projected)
    min_y = min(point[1] for point in projected)
    max_y = max(point[1] for point in projected)
    span = max(max_x - min_x, max_y - min_y)
    padding = 18
    image = Image.new("RGBA", (size, size), (244, 245, 248, 255))
    draw = ImageDraw.Draw(image)

    def screen(point):
        return (
            padding + (point[0] - min_x) / span * (size - 2 * padding),
            padding + (max_y - point[1]) / span * (size - 2 * padding),
        )

    light = _normalize((-0.35, 0.67, 0.72))
    sorted_faces = sorted(
        enumerate(faces),
        key=lambda item: sum(depths[index] for index in item[1]) / 3.0,
    )
    for face_index, face in sorted_faces:
        uvs = [vertices[index][2] for index in face]
        center_uv = tuple(sum(uv[index] for uv in uvs) / 3.0 for index in range(2))
        color = _sample_texture(texture, center_uv)
        face_normal = _normalize(tuple(
            sum(vertices[index][1][axis] for index in face) / 3.0 for axis in range(3)
        ))
        factor = 0.78 + 0.36 * max(0.0, _dot(face_normal, light))
        shaded = tuple(min(255, max(0, round(channel * factor))) for channel in color[:3])
        draw.polygon([screen(projected[index]) for index in face], fill=shaded + (255,))
    return image


def _m120_preview(texture, vertices, faces):
    panels = 4
    panel = 336
    gap = 12
    width = panels * panel + (panels + 1) * gap
    height = panel + 54
    preview = Image.new("RGBA", (width, height), (247, 247, 250, 255))
    preview.alpha_composite(texture.resize((panel, panel), Image.Resampling.NEAREST), (gap, 36))
    uv_panel = texture.resize((panel, panel), Image.Resampling.NEAREST).convert("RGBA")
    uv_draw = ImageDraw.Draw(uv_panel)
    for face in faces:
        points = [
            (
                vertices[index][2][0] * panel,
                vertices[index][2][1] * panel,
            )
            for index in face
        ]
        uv_draw.polygon(points, outline=(58, 65, 82, 210))
    preview.alpha_composite(uv_panel, (gap * 2 + panel, 36))
    preview.alpha_composite(
        _render_model_view(texture, vertices, faces, (0.0, 0.0, 1.0), panel),
        (gap * 3 + panel * 2, 36),
    )
    preview.alpha_composite(
        _render_model_view(texture, vertices, faces, (1.0, 0.0, 0.0), panel),
        (gap * 4 + panel * 3, 36),
    )
    draw = ImageDraw.Draw(preview)
    labels = ["m120 texture", "UV islands", "front", "side"]
    for index, label in enumerate(labels):
        draw.text((gap + index * (panel + gap), 12), label, fill=(42, 47, 60, 255))
    return preview


def export_m120(model_path: Path, web_root: Path) -> str:
    """Publish the reconstructed m120 texture and offline UV/model preview."""
    model_path = Path(model_path)
    web_root = Path(web_root)
    model = read_pol(model_path)
    if len(model["meshes"]) != 1:
        raise ValueError(f"Unexpected youlincat mesh count: {len(model['meshes'])}")
    mesh = model["meshes"][0]
    if not any(texture.lower() == "m120.tga" for part in mesh["parts"] for texture in part["textures"]):
        raise ValueError(f"{model_path} does not reference m120.TGA")
    vertices, faces = _decode_mesh(mesh)
    components = _face_components(faces)
    texture = _render_m120_texture(vertices, faces, components)
    asset = web_root / M120_ASSET
    asset.parent.mkdir(parents=True, exist_ok=True)
    texture.save(asset)
    preview = web_root / M120_PREVIEW_ASSET
    _m120_preview(texture, vertices, faces).save(preview)
    return M120_ASSET


def _circular_box_blur(values, radius, passes):
    result = list(values)
    count = len(result)
    width = radius * 2 + 1
    for _ in range(passes):
        prefix = [0.0] * (count + 1)
        for index, value in enumerate(result):
            prefix[index + 1] = prefix[index] + value
        total = prefix[count]
        blurred = [0.0] * count
        for index in range(count):
            start = index - radius
            end = index + radius
            if start >= 0 and end < count:
                value = prefix[end + 1] - prefix[start]
            elif start < 0:
                value = prefix[end + 1] + (total - prefix[start + count])
            else:
                value = (total - prefix[start]) + prefix[end - count + 1]
            blurred[index] = value / width
        result = blurred
    return result


def _bg07_pcm():
    sample_count = round(BG07_SAMPLE_RATE * BG07_DURATION)
    randomizer = random.Random(BG07_SEED)
    wind_noise = [randomizer.uniform(-1.0, 1.0) for _ in range(sample_count)]
    rumble_noise = [randomizer.uniform(-1.0, 1.0) for _ in range(sample_count)]
    wind = _circular_box_blur(wind_noise, 26, 3)
    rumble = _circular_box_blur(rumble_noise, 190, 4)
    signal = []
    tau = math.tau
    for index in range(sample_count):
        time = index / sample_count
        gust = 1.0 + 0.16 * math.sin(tau * 3.0 * time) + 0.06 * math.sin(tau * 5.0 * time + 0.4)
        low_hum = (
            0.045 * math.sin(tau * 43.0 * time)
            + 0.024 * math.sin(tau * 67.0 * time + 0.3)
            + 0.012 * math.sin(tau * 101.0 * time + 0.7)
        )
        value = (
            0.92 * wind[index] * gust
            + 0.42 * rumble[index] * (1.0 + 0.08 * math.sin(tau * 2.0 * time + 0.2))
            + low_hum
        )
        signal.append(math.tanh(value * 1.35))
    rms = math.sqrt(sum(value * value for value in signal) / sample_count)
    scale = 0.038 / rms
    peak = max(abs(value) for value in signal) * scale
    if peak > 0.23:
        scale *= 0.23 / peak
    return [round(_clamp(value * scale, -1.0, 1.0) * 32767.0) for value in signal]


def _ww051_pcm():
    sample_count = round(WW051_SAMPLE_RATE * WW051_DURATION)
    randomizer = random.Random(WW051_SEED)
    airflow = _circular_box_blur(
        [randomizer.uniform(-1.0, 1.0) for _ in range(sample_count)],
        7,
        2,
    )
    signal = []
    phase = 0.0
    timeline = (sample_count - 1) / WW051_SAMPLE_RATE
    for index in range(sample_count):
        time = index / WW051_SAMPLE_RATE
        progress = index / (sample_count - 1)
        attack = _clamp(time / 0.045)
        release = _clamp((timeline - time) / 0.22)
        envelope = attack * attack * (3.0 - 2.0 * attack)
        envelope *= release * release * (3.0 - 2.0 * release)
        frequency = 540.0 + 1180.0 * progress ** 0.72
        phase += math.tau * frequency / WW051_SAMPLE_RATE
        flash = math.exp(-((progress - 0.28) / 0.15) ** 2)
        electronic = (
            0.71 * math.sin(phase)
            + 0.21 * math.sin(2.01 * phase + 0.35)
            + 0.08 * math.sin(3.03 * phase + 0.70)
        )
        electronic *= 0.62 + 0.38 * flash
        airflow_voice = airflow[index] * (0.32 + 0.68 * progress)
        signal.append(envelope * (0.62 * electronic + 0.48 * airflow_voice))
    rms = math.sqrt(sum(value * value for value in signal) / sample_count)
    scale = 0.052 / rms
    peak = max(abs(value) for value in signal) * scale
    if peak > 0.24:
        scale *= 0.24 / peak
    return [round(_clamp(value * scale, -1.0, 1.0) * 32767.0) for value in signal]


def export_bg07(web_root: Path) -> dict:
    """Publish the reconstructed BG07 loop and return its catalog entry."""
    web_root = Path(web_root)
    asset = web_root / BG07_ASSET
    asset.parent.mkdir(parents=True, exist_ok=True)
    pcm = _bg07_pcm()
    samples = array("h", pcm)
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(str(asset), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(BG07_SAMPLE_RATE)
        output.writeframes(samples.tobytes())
    peak = max(abs(value) for value in pcm) / 32767.0
    rms = math.sqrt(sum((value / 32767.0) ** 2 for value in pcm) / len(pcm))
    return {
        "name": "BG07",
        "asset": BG07_ASSET,
        "source": BG07_SOURCE,
        "provenance": dict(BG07_PROVENANCE),
        "format": {
            "container": "wav",
            "encoding": "PCM",
            "sampleRate": BG07_SAMPLE_RATE,
            "channels": 1,
            "sampleWidth": 2,
            "bitsPerSample": 16,
        },
        "duration": BG07_DURATION,
        "style": {
            "description": "neutral low wind with a quiet distant environmental hum",
            "loop": True,
            "seed": BG07_SEED,
            "peak": round(peak, 6),
            "rms": round(rms, 6),
        },
    }


def export_ww051(out: Path) -> dict:
    """Publish the reconstructed Type4 cue and return its catalog entry."""
    out = Path(out)
    asset = out / WW051_ASSET
    asset.parent.mkdir(parents=True, exist_ok=True)
    pcm = _ww051_pcm()
    samples = array("h", pcm)
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(str(asset), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(WW051_SAMPLE_RATE)
        output.writeframes(samples.tobytes())
    peak = max(abs(value) for value in pcm) / 32767.0
    rms = math.sqrt(sum((value / 32767.0) ** 2 for value in pcm) / len(pcm))
    return {
        "name": "ww051",
        "asset": WW051_ASSET,
        "source": WW051_SOURCE,
        "resolution": "reconstructed",
        "provenance": dict(WW051_PROVENANCE),
        "format": {
            "container": "wav",
            "encoding": "PCM",
            "sampleRate": WW051_SAMPLE_RATE,
            "channels": 1,
            "sampleWidth": 2,
            "bitsPerSample": 16,
        },
        "duration": WW051_DURATION,
        "style": {
            "description": "quiet rising electronic flash with a short airflow tail",
            "seed": WW051_SEED,
            "peak": round(peak, 6),
            "rms": round(rms, 6),
        },
    }


def _tree_envelope(time, duration, attack, release):
    attack_gain = _clamp(time / attack)
    release_gain = _clamp((duration - time) / release)
    attack_gain = attack_gain * attack_gain * (3.0 - 2.0 * attack_gain)
    release_gain = release_gain * release_gain * (3.0 - 2.0 * release_gain)
    return attack_gain * release_gain


def _tree_noise(randomizer, count, radius, passes=1):
    return _circular_box_blur(
        [randomizer.uniform(-1.0, 1.0) for _ in range(count)],
        radius,
        passes,
    )


def _scale_tree_signal(signal, profile):
    rms = math.sqrt(sum(value * value for value in signal) / len(signal))
    if rms < 1e-9:
        raise ValueError("Tree sound generator produced silence")
    scale = profile["rms"] / rms
    peak = max(abs(value) for value in signal) * scale
    if peak > profile["peak"]:
        scale *= profile["peak"] / peak
    pcm = [round(_clamp(value * scale, -1.0, 1.0) * 32767.0) for value in signal]
    pcm[0] = 0
    pcm[-1] = 0
    return pcm


def _ww101_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    air = _tree_noise(randomizer, sample_count, 6, 2)
    dust = _tree_noise(randomizer, sample_count, 23, 3)
    signal = []
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        progress = index / (sample_count - 1)
        envelope = _tree_envelope(time, profile["duration"], 0.055, 0.25)
        petal = (
            0.72 * math.sin(tau * (1830.0 + 145.0 * progress) * time)
            * math.exp(-((time - 0.10) / 0.075) ** 2)
            + 0.46 * math.sin(tau * (2670.0 - 210.0 * progress) * time + 0.35)
            * math.exp(-((time - 0.24) / 0.090) ** 2)
        )
        signal.append(envelope * (0.82 * petal + 0.24 * air[index] + 0.16 * dust[index]))
    return _scale_tree_signal(signal, profile)


def _ww102_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    air = _tree_noise(randomizer, sample_count, 4, 1)
    drift = _tree_noise(randomizer, sample_count, 19, 2)
    signal = []
    phase = 0.0
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        progress = index / (sample_count - 1)
        envelope = _tree_envelope(time, profile["duration"], 0.050, 0.24)
        frequency = 1550.0 - 390.0 * progress
        phase += tau * frequency / TREE_SOUND_SAMPLE_RATE
        crystal = math.sin(phase) + 0.25 * math.sin(2.02 * phase + 0.18) + 0.11 * math.sin(3.91 * phase + 0.55)
        flashes = (
            math.exp(-((progress - 0.18) / 0.13) ** 2)
            + 0.55 * math.exp(-((progress - 0.43) / 0.16) ** 2)
        )
        signal.append(envelope * (0.48 * crystal * (0.30 + 0.70 * flashes) + 0.27 * air[index] + 0.20 * drift[index]))
    return _scale_tree_signal(signal, profile)


def _ww077_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    air = _tree_noise(randomizer, sample_count, 3, 2)
    signal = []
    phase = 0.0
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        progress = index / (sample_count - 1)
        envelope = _tree_envelope(time, profile["duration"], 0.030, 0.085)
        frequency = 620.0 + 1500.0 * progress ** 1.25
        phase += tau * frequency / TREE_SOUND_SAMPLE_RATE
        whistle = math.sin(phase) + 0.18 * math.sin(2.0 * phase + 0.22)
        signal.append(envelope * (0.84 * whistle + 0.20 * air[index] * progress))
    return _scale_tree_signal(signal, profile)


def _ww078_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    burst = _tree_noise(randomizer, sample_count, 1, 1)
    body = _tree_noise(randomizer, sample_count, 14, 2)
    signal = []
    phase = 0.0
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        progress = index / (sample_count - 1)
        envelope = _tree_envelope(time, profile["duration"], 0.018, 0.12)
        frequency = 118.0 - 35.0 * progress
        phase += tau * frequency / TREE_SOUND_SAMPLE_RATE
        pop = math.sin(phase) + 0.28 * math.sin(2.0 * phase + 0.18)
        impact = math.exp(-time / 0.18)
        signal.append(envelope * impact * (0.50 * pop + 0.48 * burst[index] + 0.24 * body[index]))
    return _scale_tree_signal(signal, profile)


def _ww079_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    air = _tree_noise(randomizer, sample_count, 7, 2)
    grains = [
        (
            randomizer.uniform(0.025, 0.43),
            randomizer.uniform(1900.0, 4200.0),
            randomizer.uniform(0.045, 0.11),
            randomizer.uniform(0.45, 1.0),
            randomizer.uniform(0.0, math.tau),
        )
        for _ in range(24)
    ]
    signal = []
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        envelope = _tree_envelope(time, profile["duration"], 0.025, 0.17)
        grain_sum = 0.0
        for start, frequency, decay, amplitude, phase in grains:
            if time < start:
                continue
            elapsed = time - start
            grain_sum += amplitude * math.sin(tau * frequency * elapsed + phase) * math.exp(-elapsed / decay)
        signal.append(envelope * (0.42 * grain_sum + 0.065 * air[index]))
    return _scale_tree_signal(signal, profile)


def _ww053_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    clink_noise = _tree_noise(randomizer, sample_count, 1, 1)
    signal = []
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        envelope = _tree_envelope(time, profile["duration"], 0.006, 0.16)
        value = 0.0
        for start, base, amplitude in ((0.0, 1320.0, 1.0), (0.055, 1760.0, 0.55)):
            elapsed = time - start
            if elapsed < 0.0:
                continue
            strike = (1.0 - math.exp(-elapsed / 0.0018)) * math.exp(-elapsed / 0.18)
            partials = (
                math.sin(tau * base * elapsed)
                + 0.34 * math.sin(tau * base * 1.48 * elapsed + 0.12)
                + 0.18 * math.sin(tau * base * 2.25 * elapsed + 0.35)
                + 0.09 * math.sin(tau * base * 3.10 * elapsed + 0.60)
            )
            value += amplitude * strike * partials
        value += 0.18 * clink_noise[index] * math.exp(-time / 0.018)
        signal.append(envelope * value)
    return _scale_tree_signal(signal, profile)


def _ww154_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    low_body = _tree_noise(randomizer, sample_count, 17, 2)
    dust = _tree_noise(randomizer, sample_count, 4, 1)
    signal = []
    phase = 0.0
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        progress = index / (sample_count - 1)
        envelope = _tree_envelope(time, profile["duration"], 0.012, 0.30)
        frequency = 76.0 - 20.0 * progress
        phase += tau * frequency / TREE_SOUND_SAMPLE_RATE
        thump = (math.sin(phase) + 0.22 * math.sin(2.0 * phase + 0.18)) * math.exp(-time / 0.18)
        body = low_body[index] * math.exp(-time / 0.23)
        tail = dust[index] * math.exp(-time / 0.34)
        signal.append(envelope * (0.68 * thump + 0.55 * body + 0.22 * tail))
    return _scale_tree_signal(signal, profile)


def _ww098_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    debris = _tree_noise(randomizer, sample_count, 2, 1)
    soft_debris = _tree_noise(randomizer, sample_count, 9, 2)
    grains = [
        (
            randomizer.uniform(0.012, 0.24),
            randomizer.uniform(170.0, 620.0),
            randomizer.uniform(0.025, 0.070),
            randomizer.uniform(0.35, 1.0),
        )
        for _ in range(14)
    ]
    signal = []
    phase = 0.0
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        envelope = _tree_envelope(time, profile["duration"], 0.008, 0.10)
        phase += tau * (104.0 - 18.0 * (index / (sample_count - 1))) / TREE_SOUND_SAMPLE_RATE
        thump = math.sin(phase) * math.exp(-time / 0.070)
        grain_sum = 0.0
        for start, frequency, decay, amplitude in grains:
            if time < start:
                continue
            elapsed = time - start
            grain_sum += amplitude * math.sin(tau * frequency * elapsed) * math.exp(-elapsed / decay)
        signal.append(envelope * (
            0.48 * thump
            + 0.38 * debris[index] * math.exp(-time / 0.12)
            + 0.18 * soft_debris[index] * math.exp(-time / 0.20)
            + 0.34 * grain_sum
        ))
    return _scale_tree_signal(signal, profile)


def _ww137_pcm(profile):
    sample_count = round(TREE_SOUND_SAMPLE_RATE * profile["duration"])
    randomizer = random.Random(profile["seed"])
    air = _tree_noise(randomizer, sample_count, 5, 2)
    tail = _tree_noise(randomizer, sample_count, 21, 2)
    signal = []
    phase = 0.0
    tau = math.tau
    for index in range(sample_count):
        time = index / TREE_SOUND_SAMPLE_RATE
        progress = index / (sample_count - 1)
        envelope = _tree_envelope(time, profile["duration"], 0.012, 0.18)
        frequency = 2080.0 - 1120.0 * progress
        phase += tau * frequency / TREE_SOUND_SAMPLE_RATE
        electronic = (
            math.sin(phase)
            + 0.27 * math.sin(1.50 * phase + 0.24)
            + 0.11 * math.sin(2.97 * phase + 0.58)
        ) * math.exp(-time / 0.16)
        airflow = (0.78 * air[index] + 0.22 * tail[index]) * math.exp(-time / 0.21)
        signal.append(envelope * (0.74 * electronic + 0.30 * airflow))
    return _scale_tree_signal(signal, profile)


def _tree_sound_pcm(name):
    profile = TREE_SOUND_PROFILES[name]
    if name == "ww101":
        return _ww101_pcm(profile)
    if name == "ww102":
        return _ww102_pcm(profile)
    if name == "ww077":
        return _ww077_pcm(profile)
    if name == "ww078":
        return _ww078_pcm(profile)
    if name == "ww079":
        return _ww079_pcm(profile)
    if name == "ww053":
        return _ww053_pcm(profile)
    if name == "ww154":
        return _ww154_pcm(profile)
    if name == "ww137":
        return _ww137_pcm(profile)
    return _ww098_pcm(profile)


def export_tree_sounds(out: Path, published_names=()) -> list:
    """Publish reconstructed cues only when their names are absent from source WAVs."""
    out = Path(out)
    published = {name.lower() for name in published_names}
    entries = []
    for name, profile in TREE_SOUND_PROFILES.items():
        if name.lower() in published:
            continue
        asset = f"reconstructed/battle/{name}.wav"
        target = out / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        pcm = _tree_sound_pcm(name)
        samples = array("h", pcm)
        if sys.byteorder != "little":
            samples.byteswap()
        with wave.open(str(target), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(TREE_SOUND_SAMPLE_RATE)
            output.writeframes(samples.tobytes())
        peak = max(abs(value) for value in pcm) / 32767.0
        rms = math.sqrt(sum((value / 32767.0) ** 2 for value in pcm) / len(pcm))
        entries.append({
            "name": name,
            "asset": asset,
            "source": TREE_SOUND_SOURCE,
            "resolution": "reconstructed",
            "provenance": {
                "kind": "reconstructed",
                "reference": f"{name}.wav",
                "asset": asset,
                "source": TREE_SOUND_SOURCE,
                "method": profile["method"],
                "seed": profile["seed"],
            },
            "format": {
                "container": "wav",
                "encoding": "PCM",
                "sampleRate": TREE_SOUND_SAMPLE_RATE,
                "channels": 1,
                "sampleWidth": 2,
                "bitsPerSample": 16,
            },
            "duration": profile["duration"],
            "style": {
                "description": profile["description"],
                "loop": False,
                "seed": profile["seed"],
                "peak": round(peak, 6),
                "rms": round(rms, 6),
            },
        })
    return entries


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    web = root / "recovery/output/web-assets"
    texture = export_m120(root / "recovery/output/verified/assets/data/Data/effect/effect/youlincat.POL", web)
    sound = export_bg07(web)
    print(f"Published {texture} and {sound['asset']} ({sound['duration']:.1f}s)")
