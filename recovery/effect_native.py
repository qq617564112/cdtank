"""Map supplied original binaries and bind imports between those images."""
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32


def map_original_binaries(paths):
    machine = Uc(UC_ARCH_X86, UC_MODE_32)
    images = {}
    for path in paths:
        path = Path(path)
        pe = pefile.PE(str(path))
        base = pe.OPTIONAL_HEADER.ImageBase
        machine.mem_map(base, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
        machine.mem_write(base, pe.get_memory_mapped_image())
        images[path.name.lower()] = pe
    for pe in images.values():
        for entry in pe.DIRECTORY_ENTRY_IMPORT:
            dependency = images.get(entry.dll.decode().lower())
            if dependency is None:
                continue
            exports = dependency.DIRECTORY_ENTRY_EXPORT.symbols
            for symbol in entry.imports:
                matches = [export for export in exports
                           if (symbol.name and export.name == symbol.name) or
                              (not symbol.name and export.ordinal == symbol.ordinal)]
                if len(matches) != 1 or matches[0].forwarder:
                    raise ValueError(f'unsupported supplied import {entry.dll!r}/{symbol.name!r}')
                address = dependency.OPTIONAL_HEADER.ImageBase + matches[0].address
                machine.mem_write(symbol.address, struct.pack('<I', address))
    return machine, images
