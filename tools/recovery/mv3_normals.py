"""Decode MV3 v100 packed normals using gbengine.dll's angular encoding."""

import math
import struct


def _float32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def decode_packed_normal(packed):
    """Return the original decoder's XYZ vector for an unsigned 16-bit value."""
    if not 0 <= packed <= 0xffff:
        raise ValueError('MV3 packed normal must be an unsigned 16-bit value')
    azimuth_byte = packed >> 8
    if azimuth_byte >= 128:
        azimuth_byte -= 256
    azimuth = _float32(azimuth_byte * 2 * 0.003921568859368563 * 3.1415927410125732)
    polar = _float32((packed & 255) * 0.012319971807301044)
    sin_polar = _float32(math.sin(polar))
    return (_float32(math.cos(azimuth) * sin_polar),
            _float32(math.sin(azimuth) * sin_polar),
            _float32(math.cos(polar)))


def decode_frame_normals(mesh):
    """Decode each source vertex of each frame, retaining MV3 vertex ordering."""
    return [[decode_packed_normal(vertex[3]) for vertex in frame['vertices']]
            for frame in mesh['frames']]
