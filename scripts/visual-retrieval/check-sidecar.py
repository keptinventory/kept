#!/usr/bin/env python3
"""Smoke-test the live local encoder with distinct COIL-20 exposures."""

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
from statistics import median
from time import perf_counter
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPRedirectHandler, ProxyHandler, Request
from zipfile import ZipFile

from PIL import Image

from serve import DIMENSIONS, GENERATION

CORPUS_SHA = "517c5594820eb40066ba0ff6842e7f09392bf7fde849bf9cb9c28445b0f29e88"
TEXT_CUTOFF = 0.20
PHOTO_CUTOFF = 0.58
AMBIGUITY_MARGIN = 0.035

# The labels describe fixture records and their boxes. They omit all visible object names.
RECORDS = {
    1: ("Seasonal spares", "Upper shelf"),
    3: ("Loose bits", "Lower cupboard"),
    6: ("Extra parts", "Rear shelf"),
    12: ("Old set", "Blue tote"),
    18: ("Spare set", "Top drawer"),
}
TEXT_QUERIES = [
    ("a rubber duck", [1]),
    ("a toy sports car with a closed roof", [3]),
    ("a convertible toy sports car", [6]),
    ("an earthenware cup without a handle", [12]),
    ("a teacup with a handle", [18]),
    ("a toy sports car", [3, 6]),
    ("a folding stepladder", []),
    ("a screwdriver", []),
]
PHOTO_QUERIES = [(1, 9), (3, 6), (6, 8), (12, 10), (18, 10), (4, 9), (20, 8)]


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, new_url):
        raise HTTPError(req.full_url, code, msg, headers, fp)


class Sidecar:
    def __init__(self, port):
        self.origin = f"http://127.0.0.1:{port}"
        self.http = build_opener(ProxyHandler({}), NoRedirect())
        assert self.call("/v1/status") == {"generation": GENERATION, "dimensions": DIMENSIONS}

    def call(self, path, body=None, content_type=None):
        headers = {"X-Kept-Visual-Generation": GENERATION}
        if content_type:
            headers["Content-Type"] = content_type
        request = Request(self.origin + path, data=body, headers=headers)
        with self.http.open(request, timeout=30) as response:
            return json.load(response)

    def encode(self, kind, body, content_type):
        start = perf_counter()
        answer = self.call(f"/v1/encode/{kind}", body, content_type)
        elapsed = (perf_counter() - start) * 1_000
        assert answer["generation"] == GENERATION and answer["dimensions"] == DIMENSIONS
        vector = answer["vector"]
        assert len(vector) == DIMENSIONS and abs(sum(x * x for x in vector) - 1) < 0.001
        return vector, elapsed

    def image(self, archive, object_id, exposure):
        return self.encode("image", jpeg_bytes(archive, object_id, exposure), "image/jpeg")


def jpeg_bytes(archive, object_id, exposure):
    original = archive.read(f"coil-20-proc/obj{object_id}__{exposure}.png")
    with Image.open(BytesIO(original)) as decoded, BytesIO() as jpeg:
        decoded.convert("RGB").save(jpeg, "JPEG", quality=85)
        return jpeg.getvalue()


def write_fixtures(archive, directory):
    directory.mkdir(parents=True)
    gallery = []
    photos = []
    for identity, (title, box) in RECORDS.items():
        name = f"gallery-{identity}.jpg"
        (directory / name).write_bytes(jpeg_bytes(archive, identity, 0))
        gallery.append({"identity": identity, "title": title, "box": box, "photo": name})
    for identity, exposure in PHOTO_QUERIES:
        name = f"query-{identity}.jpg"
        (directory / name).write_bytes(jpeg_bytes(archive, identity, exposure))
        photos.append({"photo": name, "expected": [identity] if identity in RECORDS else []})
    text = [{"query": query, "expected": expected} for query, expected in TEXT_QUERIES]
    manifest = {"gallery": gallery, "photos": photos, "text": text}
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def ranks(vector, gallery):
    return sorted(
        ((object_id, sum(x * y for x, y in zip(vector, candidate, strict=True)))
         for object_id, candidate in gallery.items()),
        key=lambda candidate: -candidate[1],
    )


def result(query, expected, embedding, gallery, cutoff):
    vector, elapsed = embedding
    ranking = ranks(vector, gallery)
    ready = [(identity, score) for identity, score in ranking if score >= cutoff]
    if not ready:
        outcome = "no_close_match"
    elif len(ready) > 1 and ready[0][1] - ready[1][1] <= AMBIGUITY_MARGIN:
        outcome = "ambiguous"
    else:
        outcome = "matches"
    return {
        "query": query,
        "expected": expected,
        "encode_ms": round(elapsed, 2),
        "ranking": [
            {"id": identity, "box": RECORDS[identity][1], "cosine": round(score, 4)}
            for identity, score in ranking
        ],
        "outcome": outcome,
        "returned_ids": [identity for identity, _ in ready],
    }


def metrics(results):
    positive = [row for row in results if row["expected"]]
    absent = [row for row in results if not row["expected"]]
    latency = [row["encode_ms"] for row in results]
    return {
        "queries": len(results),
        "recalled_at_1": sum(bool(set(row["returned_ids"][:1]) & set(row["expected"])) for row in positive),
        "recalled_at_5": sum(bool(set(row["returned_ids"][:5]) & set(row["expected"])) for row in positive),
        "positive_queries": len(positive),
        "absent_false_positives": sum(row["outcome"] != "no_close_match" for row in absent),
        "absent_queries": len(absent),
        "ambiguous_outcomes": sum(row["outcome"] == "ambiguous" for row in results),
        "median_encode_ms": round(median(latency), 2),
        "max_encode_ms": max(latency),
    }


def measure(archive, sidecar):
    started = perf_counter()
    gallery = {identity: sidecar.image(archive, identity, 0)[0] for identity in RECORDS}
    index_ms = (perf_counter() - started) * 1_000
    text = [
        result(
            query, expected,
            sidecar.encode("text", json.dumps({"text": query}).encode(), "application/json"),
            gallery, TEXT_CUTOFF,
        )
        for query, expected in TEXT_QUERIES
    ]
    photos = [
        result(
            {"object_id": identity, "exposure": exposure, "degrees": exposure * 5},
            [identity] if identity in RECORDS else [],
            sidecar.image(archive, identity, exposure), gallery, PHOTO_CUTOFF,
        )
        for identity, exposure in PHOTO_QUERIES
    ]
    return {
        "generation": GENERATION,
        "dimensions": DIMENSIONS,
        "corpus_sha256": CORPUS_SHA,
        "gallery": RECORDS,
        "ready_images": len(gallery),
        "index_ms": round(index_ms, 2),
        "text_cutoff": TEXT_CUTOFF,
        "photo_cutoff": PHOTO_CUTOFF,
        "ambiguity_margin": AMBIGUITY_MARGIN,
        "text_metrics": metrics(text),
        "photo_metrics": metrics(photos),
        "text": text,
        "photo": photos,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--coil-archive", type=Path, required=True, help="Local processed COIL-20 ZIP")
    parser.add_argument("--port", type=int, default=8798, help="Private encoder port (default 8798)")
    parser.add_argument("--output", type=Path, required=True, help="Path for the JSON smoke report")
    parser.add_argument("--fixture-dir", type=Path, help="New local directory for Kept test fixtures")
    args = parser.parse_args()
    with args.coil_archive.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != CORPUS_SHA:
            parser.error("COIL-20 archive does not match the pinned fixture digest")
    with ZipFile(args.coil_archive) as archive:
        report = measure(archive, Sidecar(args.port))
        if args.fixture_dir:
            write_fixtures(archive, args.fixture_dir)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
