"""Original gbCrc32Compute string identifiers used for effect action lookup."""


def action_identifier(name):
    raw = name.encode('ascii').split(b'\0', 1)[0]
    if not raw:
        return 0
    initial = int.from_bytes(raw[:4].ljust(4, b'\0'), 'big')
    value = initial ^ 0xffffffff
    for byte in raw[4:]:
        top = value >> 24
        table = top << 24
        for _ in range(8):
            table = ((table << 1) ^ (0x04c11db7 if table & 0x80000000 else 0)) & 0xffffffff
        value = (((value << 8) | byte) ^ table) & 0xffffffff
    return value ^ 0xffffffff
