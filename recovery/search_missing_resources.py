"""Audit archive, loose and downloaded sources for named missing resources.

The report keeps three evidence classes separate:

* indexed entities: files present in a CPK index or on disk;
* decoded patch entities: files produced by the original XXTEA decoder;
* visible payload references: printable references inside an entity, which are
  not evidence that the referenced file exists.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import re
import struct
from pathlib import Path

from patch_sol import decode_patch, original_key


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TERMS = [
    "bianfu.cvd",
    "bing_1.pol",
    "bing_2.pol",
    "bing_3.pol",
    "bing_4.pol",
    "bing_5.pol",
    "bing_6.pol",
    "bing_7.pol",
    "bing_8.pol",
    "bing_9.pol",
    "bing_10.pol",
    "bing_11.pol",
    "bing_12.pol",
    "bing_13.pol",
    "m120.tga",
    "m120.dds",
    "m120.png",
    "bg07.wav",
    "obj05438/c9.cvd",
    "obj05440/c9.cvd",
    "obj05441/c9.cvd",
]


def u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def read_cpk_index(path: Path) -> list[dict]:
    data = path.read_bytes()
    if data[:4] != b"RST\x1a" or u32(data, 4) != 1:
        raise ValueError(f"Unsupported CPK: {path}")
    start, count = u32(data, 8), u32(data, 32)
    if start + count * 28 > len(data):
        raise ValueError(f"Truncated CPK index: {path}")
    entries = {}
    for index in range(count):
        crc, flags, parent, offset, packed, original, extra = struct.unpack_from(
            "<7I", data, start + index * 28
        )
        if not extra or not flags & 1 or flags & 0x10:
            continue
        name_bytes = data[offset + packed : offset + packed + extra]
        name = name_bytes.split(b"\0", 1)[0].decode("gbk")
        entries[crc] = dict(
            index=index,
            crc=crc,
            flags=flags,
            parent=parent,
            offset=offset,
            packed=packed,
            original=original,
            name=name,
        )

    def full_path(crc: int, ancestors: tuple[int, ...] = ()) -> str:
        if crc in ancestors:
            raise ValueError("CPK directory cycle")
        entry = entries[crc]
        if not entry["parent"]:
            return entry["name"]
        return str(Path(full_path(entry["parent"], ancestors + (crc,))) / entry["name"])

    rows = []
    for crc, entry in entries.items():
        if entry["flags"] & 2:
            continue
        rows.append(dict(entry, path=full_path(crc).replace("\\", "/")))
    return rows


def read_cpk_names(path: Path) -> list[dict]:
    """Return every named index row, including stale/deleted entries."""
    data = path.read_bytes()
    if data[:4] != b"RST\x1a" or u32(data, 4) != 1:
        raise ValueError(f"Unsupported CPK: {path}")
    start, count = u32(data, 8), u32(data, 32)
    if start + count * 28 > len(data):
        raise ValueError(f"Truncated CPK index: {path}")
    rows = []
    for index in range(count):
        crc, flags, parent, offset, packed, original, extra = struct.unpack_from(
            "<7I", data, start + index * 28
        )
        if not extra or offset + packed + extra > len(data):
            continue
        name = data[offset + packed : offset + packed + extra].split(b"\0", 1)[0].decode("gbk")
        rows.append(
            dict(
                index=index,
                crc=crc,
                flags=flags,
                parent=parent,
                offset=offset,
                packed=packed,
                original=original,
                name=name,
                directory=bool(flags & 2),
                live=not bool(flags & 0x10),
            )
        )
    return rows


def printable_references(data: bytes, minimum: int = 4) -> list[dict]:
    rows = []
    for match in re.finditer(rb"[ -~]{%d,}" % minimum, data):
        text = match.group().decode("latin1")
        if any(character.isalpha() for character in text):
            rows.append(dict(offset=match.start(), text=text))
    return rows


def matches(term: str, path: str) -> bool:
    lowered = path.lower().replace("\\", "/")
    needle = term.lower().replace("\\", "/")
    return path == needle or path.endswith("/" + needle) or needle in lowered


def matches_name(term: str, name: str) -> bool:
    return Path(term).name.lower() == Path(name).name.lower()


def reference_needles(term: str) -> tuple[str, ...]:
    name = Path(term).name.lower()
    if name.endswith((".tga", ".dds", ".png", ".wav")):
        return name, Path(name).stem
    return (name,)


def audit_entries(entries: list[dict], terms: list[str], source: str) -> list[dict]:
    rows = []
    for entry in entries:
        for term in terms:
            if matches(term, entry["path"]):
                rows.append(
                    dict(
                        term=term,
                        source=source,
                        path=entry["path"],
                        bytes=entry.get("original", entry.get("bytes")),
                        packed=entry.get("packed"),
                        flags=entry.get("flags"),
                    )
                )
    return rows


def disk_entries(root: Path) -> list[dict]:
    return [
        dict(path=path.relative_to(root).as_posix(), bytes=path.stat().st_size, source=str(path))
        for path in sorted(root.rglob("*"))
        if path.is_file()
    ]


def audit_payloads(root: Path, key: tuple[int, ...], terms: list[str], limit: int) -> list[dict]:
    rows = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.stat().st_size > limit:
            continue
        raw = path.read_bytes()
        decoded = decode_patch(raw, key)
        for evidence, data in (("transport", raw), ("decoded", decoded)):
            for reference in printable_references(data):
                lowered = reference["text"].lower()
                for term in terms:
                    if not any(needle in lowered for needle in reference_needles(term)):
                        continue
                    rows.append(
                        dict(
                            term=term,
                            source="download-payload",
                            path=path.relative_to(root).as_posix(),
                            evidence=evidence,
                            offset=reference["offset"],
                            text=reference["text"],
                        )
                    )
    return rows


def audit_entity_references(entries: list[dict], terms: list[str], source: str, limit: int) -> list[dict]:
    rows = []
    for entry in entries:
        path = Path(entry["source"])
        if (not path.is_file() or entry["bytes"] > limit or
                path.suffix.lower() not in {".sav", ".obj", ".pol", ".cvd", ".ini", ".xml", ".imageset"}):
            continue
        for reference in printable_references(path.read_bytes()):
            lowered = reference["text"].lower()
            for term in terms:
                if not any(needle in lowered for needle in reference_needles(term)):
                    continue
                rows.append(
                    dict(
                        term=term,
                        source=source,
                        path=entry["path"],
                        evidence="entity",
                        offset=reference["offset"],
                        text=reference["text"],
                    )
                )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terms", nargs="*", default=DEFAULT_TERMS)
    parser.add_argument("--data-cpk", type=Path, default=ROOT / "CDTank/Data/data.cpk")
    parser.add_argument("--music-cpk", type=Path, default=ROOT / "CDTank/Data/music/music.cpk")
    parser.add_argument("--download", type=Path, default=ROOT / "CDTank/download")
    parser.add_argument("--decoded", type=Path, default=ROOT / "recovery/output/patch-sol-decoded")
    parser.add_argument("--verified", type=Path, default=ROOT / "recovery/output/verified/assets/data")
    parser.add_argument("--output", type=Path, default=ROOT / "recovery/output/resource-search-missing")
    parser.add_argument("--payload-bytes", type=int, default=16 * 1024 * 1024)
    args = parser.parse_args()

    terms = [term.lower() for term in args.terms]
    archives = []
    for name, path in (("data-cpk", args.data_cpk), ("music-cpk", args.music_cpk)):
        archive = dict(name=name, path=str(path), bytes=path.stat().st_size, entries=[])
        if path.is_file():
            archive["entries"] = read_cpk_index(path)
            archive["indexRows"] = read_cpk_names(path)
        archives.append(archive)

    loose_root = ROOT / "CDTank"
    loose = disk_entries(loose_root) if loose_root.is_dir() else []
    decoded = disk_entries(args.decoded) if args.decoded.is_dir() else []
    verified = disk_entries(args.verified) if args.verified.is_dir() else []
    key = original_key(ROOT / "CDTank/CPKUpdate.exe")
    payloads = audit_payloads(args.download, key, terms, args.payload_bytes) if args.download.is_dir() else []
    entity_references = audit_entity_references(verified, terms, "verified-entity", args.payload_bytes)

    indexed = [
        row
        for archive in archives
        for row in audit_entries(archive["entries"], terms, archive["name"])
    ]
    indexed_rows = []
    for archive in archives:
        named = [row for row in archive.get("indexRows", []) if row["name"].lower() == "c9.cvd"]
        for term in terms:
            if Path(term).name.lower() != "c9.cvd":
                continue
            indexed_rows.append(
                dict(
                    source=archive["name"],
                    term=term,
                    name="C9.CVD",
                    totalLiveC9Files=sum(row["live"] and not row["directory"] for row in named),
                    totalLiveC9Directories=sum(row["live"] and row["directory"] for row in named),
                    staleRows=sum(not row["live"] for row in named),
                )
            )
    loose_hits = audit_entries(loose, terms, "loose")
    decoded_hits = audit_entries(decoded, terms, "decoded-patch")
    result = dict(
        terms=terms,
        sources=dict(
            archives=[
                dict(name=row["name"], path=row["path"], bytes=row["bytes"], entries=len(row["entries"]))
                for row in archives
            ],
            loose=dict(root=str(loose_root), files=len(loose)),
            decoded=dict(root=str(args.decoded), files=len(decoded)),
            verified=dict(root=str(args.verified), files=len(verified)),
            download=dict(root=str(args.download), files=len(disk_entries(args.download)) if args.download.is_dir() else 0),
        ),
        indexedEntities=indexed,
        indexRows=indexed_rows,
        looseEntities=loose_hits,
        decodedEntities=decoded_hits,
        payloadReferences=payloads,
        entityReferences=entity_references,
        counts=dict(
            indexedEntities=len(indexed),
            indexRows=len(indexed_rows),
            looseEntities=len(loose_hits),
            decodedEntities=len(decoded_hits),
            payloadReferences=len(payloads),
            entityReferences=len(entity_references),
        ),
        entityCounts=dict(
            indexed=Counter(row["term"] for row in indexed),
            loose=Counter(row["term"] for row in loose_hits),
            decoded=Counter(row["term"] for row in decoded_hits),
        ),
    )
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "missing-battle-resources.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(result["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
