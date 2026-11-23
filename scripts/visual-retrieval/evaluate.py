#!/usr/bin/env python3
"""Compare Kept keyword search with local CLIP on public fixtures."""
import argparse
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import platform
import resource
import secrets
import struct
import time
import urllib.parse
import urllib.request
import uuid

import open_clip
from PIL import Image
from skimage import data
import torch

MODEL = "ViT-B-32"
WEIGHTS_REVISION = "1a25a446712ba5ee05982a381eed697ef9b435cf"
WEIGHTS_SHA = "ac4f8c4b88af6d963118cbf40ad93176d092abbedfcb752601ae1866352656e6"

CASES = [
    ("coffee", "Kitchen spares", "Blue tote", "a cup of coffee on a saucer"),
    ("clock", "Hallway odds and ends", "Top shelf", "a round analog wall clock"),
    ("coins", "Tray from the attic", "Red box", "old metal coins"),
    ("motorcycle", "Garage overflow", "Bottom shelf", "a motorcycle"),
]
TEXT_QUERIES = [(title, key) for key, _, _, title in CASES] + [
    ("a folding stepladder", None),
    ("Kitchen spares", "coffee"),
]


def fixture_images():
    rider_left, rider_right, _ = data.stereo_motorcycle()
    candidates = {
        "coffee": Image.fromarray(data.coffee()).convert("RGB"),
        "clock": Image.fromarray(data.clock()).convert("RGB"),
        "coins": Image.fromarray(data.coins()).convert("RGB"),
        "motorcycle": Image.fromarray(rider_left).convert("RGB"),
    }
    cropped = candidates["clock"].crop((45, 35, 345, 270))
    queries = [
        ("Motorcycle right camera", Image.fromarray(rider_right).convert("RGB"), "motorcycle"),
        ("Clock crop, same exposure", cropped, "clock"),
        ("Chelsea cat, outside the indexed set", Image.fromarray(data.chelsea()).convert("RGB"), None),
    ]
    return candidates, queries


def uuid7():
    value = (int(time.time() * 1000) << 80) | (7 << 76) | (secrets.randbits(12) << 64)
    value |= (2 << 62) | secrets.randbits(62)
    return str(uuid.UUID(int=value))


class KeptFixture:
    """Run only on a disposable loopback Kept database with a fixture account."""

    def __init__(self, origin):
        parts = urllib.parse.urlsplit(origin)
        if parts.hostname not in {"localhost", "127.0.0.1"} or parts.path or parts.scheme != "http":
            raise ValueError("Use a disposable loopback Kept HTTP server.")
        self.origin = origin
        self.http = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )
        self.request("/api/v1/auth/sign-in/email", {
            "email": os.environ["KEPT_VISUAL_EMAIL"], "password": os.environ["KEPT_VISUAL_PASSWORD"],
        })
        self.location = self.request("/api/v1/locations", {
            "name": "Visual retrieval fixtures " + secrets.token_hex(3),
            "kind": "home", "timezone": "UTC", "currency": "USD",
        })["id"]
        snapshot = self.request("/api/v1/sync/snapshot?limit=50")
        box_type = next(item["id"] for item in snapshot["types"]["items"] if item["builtinKey"] == "box_bin")
        self.ids = {}
        for key, caption, recorded_box, _ in CASES:
            box = self.request("/api/v1/captures", {
                "id": uuid7(), "locationId": self.location, "target": {"unplaced": True},
                "mode": "thing", "name": recorded_box, "typeId": box_type,
                "batchId": uuid7(), "files": [],
            }, {"Idempotency-Key": uuid7()})["thing"]["id"]
            record = self.request("/api/v1/captures", {
                "id": uuid7(), "locationId": self.location, "target": {"containerId": box},
                "mode": "thing", "name": caption, "batchId": uuid7(), "files": [],
            }, {"Idempotency-Key": uuid7()})["thing"]
            self.ids[key] = record["id"]

    def request(self, path, payload=None, headers=None):
        body = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(
            self.origin + path,
            data=body,
            headers={"Origin": self.origin, "Content-Type": "application/json", **(headers or {})},
        )
        with self.http.open(request, timeout=30) as answer:
            return json.load(answer)

    def authorized_ids(self):
        result = self.request("/api/v1/things?" + urllib.parse.urlencode({"locationId": self.location}))
        ids = {row["id"] for row in result["items"]}
        return {key for key, item in self.ids.items() if item in ids}

    def search(self, text):
        request = "/api/v1/search?" + urllib.parse.urlencode({
            "q": text, "kind": "things", "locationId": self.location,
        })
        results = self.request(request)
        by_id = {value: key for key, value in self.ids.items()}
        return [by_id[row["id"]] for row in results["things"]["items"] if row["id"] in by_id]


def timed(call, device):
    start = time.perf_counter()
    result = call()
    if device == "mps":
        torch.mps.synchronize()
    return result, round((time.perf_counter() - start) * 1000, 2)


def ranks(scores, keys, case):
    ranking = sorted(zip(keys, scores.detach().cpu().tolist()), key=lambda item: -item[1])
    return [{"id": key, "box": case[key], "cosine": round(score, 4)} for key, score in ranking]


def report(options):
    weights = Path(options.weights)
    with weights.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != WEIGHTS_SHA:
            raise ValueError("Unexpected weights for the pinned OpenCLIP model.")
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    fixture = KeptFixture(options.kept_origin) if options.kept_origin else None
    public_keys = fixture.authorized_ids() if fixture else {row[0] for row in CASES}
    if not public_keys:
        raise RuntimeError("No readable fixture candidates.")
    images, photo_queries = fixture_images()
    keys = [key for key in images if key in public_keys]
    boxes = {key: box for key, _, box, _ in CASES}
    (model, _, preprocess), model_ms = timed(
        lambda: open_clip.create_model_and_transforms(MODEL, pretrained=str(weights), device=options.device),
        options.device,
    )
    model.eval()
    tokenize = open_clip.get_tokenizer(MODEL)
    with torch.inference_mode():
        def image_vectors(examples):
            batch = torch.stack([preprocess(image) for image in examples]).to(options.device)
            return torch.nn.functional.normalize(model.encode_image(batch))

        gallery, index_ms = timed(lambda: image_vectors([images[key] for key in keys]), options.device)
        text = []
        for query, expected in TEXT_QUERIES:
            vector, latency = timed(
                lambda: torch.nn.functional.normalize(model.encode_text(tokenize([query]).to(options.device))),
                options.device,
            )
            keyword, keyword_ms = timed(lambda: fixture.search(query), "cpu") if fixture else (None, None)
            text.append({"query": query, "expected": expected, "kept": keyword,
                         "kept_ms": keyword_ms, "encode_ms": latency,
                         "clip": ranks((vector @ gallery.T)[0], keys, boxes)})
        photos = []
        for description, image, expected in photo_queries:
            vector, latency = timed(lambda: image_vectors([image]), options.device)
            photos.append({"query": description, "expected": expected, "encode_ms": latency,
                           "clip": ranks((vector @ gallery.T)[0], keys, boxes)})

    # ru_maxrss is bytes on Darwin and KiB on Linux.
    max_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if platform.system() == "Darwin":
        max_rss /= 1024
    return {
        "model": MODEL, "weights_revision": WEIGHTS_REVISION, "weights_sha256": WEIGHTS_SHA,
        "weights_bytes": weights.stat().st_size, "torch": torch.__version__,
        "device": options.device, "host": platform.machine(), "preprocess": str(preprocess),
        "model_ms": model_ms, "gallery_ms": index_ms, "peak_rss_mib": round(max_rss / 1024, 1),
        "authorized_fixture_ids": keys, "text": text, "photo": photos,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", required=True, help="Pinned local safetensors checkpoint")
    parser.add_argument("--device", choices=["cpu", "mps"], default="cpu")
    parser.add_argument("--kept-origin", help="Disposable local Kept server for the real keyword baseline")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.write_text(json.dumps(report(args), indent=2) + "\n")
