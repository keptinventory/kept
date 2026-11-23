#!/usr/bin/env python3
"""Serve Kept's pinned visual encoder over private loopback HTTP."""

import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
from importlib.metadata import version
from io import BytesIO
import json
import os
from pathlib import Path
from time import perf_counter

GENERATION = "openclip-vit-b-32-laion2b-s34b-b79k-1a25a446-224-v1"
DIMENSIONS = 512
MODEL = "ViT-B-32"
WEIGHTS_SHA = "ac4f8c4b88af6d963118cbf40ad93176d092abbedfcb752601ae1866352656e6"
MAX_TEXT_BYTES = 4_096
MAX_TEXT_BODY = MAX_TEXT_BYTES * 6 + 64
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_IMAGE_EDGE = 1_024
MODEL_VERSIONS = {
    "open-clip-torch": "3.2.0",
    "torch": "2.8.0",
    "torchvision": "0.23.0",
    "pillow": "13.0.0",
}
METADATA = {"generation": GENERATION, "dimensions": DIMENSIONS}


class InvalidInput(ValueError):
    """The supplied text or JPEG could not be encoded."""


class Encoder:
    def __init__(self, weights):
        for package, pinned in MODEL_VERSIONS.items():
            if version(package).split("+", 1)[0] != pinned:
                raise ValueError(f"Install the pinned {package} version {pinned}.")

        if weights.suffix != ".safetensors" or not weights.is_file():
            raise ValueError("Provide the pinned local safetensors checkpoint.")
        with weights.open("rb") as checkpoint:
            if hashlib.file_digest(checkpoint, "sha256").hexdigest() != WEIGHTS_SHA:
                raise ValueError("The checkpoint SHA-256 does not match the visual generation.")

        # Everything the model needs is local. Never fetch weights or send inputs from this process.
        os.environ["HF_HUB_OFFLINE"] = "1"
        import open_clip
        import torch
        from torchvision.transforms import (
            CenterCrop,
            Compose,
            InterpolationMode,
            Normalize,
            Resize,
            ToTensor,
        )

        torch.set_num_threads(min(4, os.cpu_count() or 1))
        self.torch = torch
        self.model = open_clip.create_model(MODEL, pretrained=str(weights), device="cpu")
        self.model.eval()
        self.tokenize = open_clip.get_tokenizer(MODEL)
        self.preprocess = Compose([
            Resize(224, interpolation=InterpolationMode.BICUBIC, antialias=True),
            CenterCrop((224, 224)),
            ToTensor(),
            Normalize(
                (0.48145466, 0.4578275, 0.40821073),
                (0.26862954, 0.26130258, 0.27577711),
            ),
        ])

    def encode_text(self, body):
        try:
            value = json.loads(body.decode("utf-8"))
            text = value.get("text") if isinstance(value, dict) and set(value) == {"text"} else None
            if (
                not isinstance(text, str)
                or not text.strip()
                or len(text.encode("utf-8")) > MAX_TEXT_BYTES
            ):
                raise InvalidInput()
        except (UnicodeError, ValueError, RecursionError):
            raise InvalidInput() from None
        with self.torch.inference_mode():
            return self.vector(self.model.encode_text(self.tokenize([text])))

    def encode_image(self, body):
        from PIL import Image, ImageOps

        try:
            with Image.open(BytesIO(body), formats=("JPEG",)) as original:
                if not 0 < min(original.size) <= max(original.size) <= MAX_IMAGE_EDGE:
                    raise InvalidInput()
                with ImageOps.exif_transpose(original) as oriented:
                    with oriented.convert("RGB") as rgb:
                        pixels = self.preprocess(rgb).unsqueeze(0)
        except (OSError, ValueError, Image.DecompressionBombError):
            raise InvalidInput() from None
        with self.torch.inference_mode():
            return self.vector(self.model.encode_image(pixels))

    def vector(self, embedding):
        vector = self.torch.nn.functional.normalize(embedding, dim=-1)[0]
        if vector.shape != (DIMENSIONS,) or not self.torch.isfinite(vector).all():
            raise RuntimeError("Invalid encoder output")
        return vector.tolist()


class EncoderServer(HTTPServer):
    # One model, one active encode. Keep the socket queue and partial reads bounded.
    request_queue_size = 8

    def __init__(self, port, encoder):
        self.encoder = encoder
        super().__init__(("127.0.0.1", port), EncoderRequest)

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)
        return connection, address

    def handle_error(self, request, client_address):
        # Request values and framework tracebacks can contain private input.
        pass


class EncoderRequest(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def reply(self, code, value):
        data = json.dumps(value, allow_nan=False, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def permitted(self):
        host = f"127.0.0.1:{self.server.server_port}"
        return (
            self.headers.get_all("Host") == [host]
            and "Origin" not in self.headers
            and "Transfer-Encoding" not in self.headers
        )

    def do_GET(self):
        if not self.permitted() or self.path != "/v1/status":
            self.reply(404, {"error": "not_found"})
            return
        self.reply(200, METADATA)

    def do_POST(self):
        if (
            not self.permitted()
            or self.headers.get_all("X-Kept-Visual-Generation") != [GENERATION]
        ):
            self.reply(404, {"error": "not_found"})
            return
        if self.path == "/v1/encode/text":
            encode = self.server.encoder.encode_text
            content_type, max_bytes = "application/json", MAX_TEXT_BODY
        elif self.path == "/v1/encode/image":
            encode = self.server.encoder.encode_image
            content_type, max_bytes = "image/jpeg", MAX_IMAGE_BYTES
        else:
            self.reply(404, {"error": "not_found"})
            return
        if self.headers.get_all("Content-Type") != [content_type]:
            self.reply(415, {"error": "unsupported_media_type"})
            return
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
            self.reply(400, {"error": "invalid_input"})
            return
        length = lengths[0]
        if len(length) > len(str(max_bytes)) or not 0 < int(length) <= max_bytes:
            self.reply(413, {"error": "input_size"})
            return
        try:
            body = self.rfile.read(int(length))
            if len(body) != int(length):
                raise InvalidInput()
            vector = encode(body)
        except InvalidInput:
            self.reply(400, {"error": "invalid_input"})
            return
        except Exception:
            # A failed inference is recoverable. Keep request content and errors private.
            self.reply(503, {"error": "unavailable"})
            return
        self.reply(200, {**METADATA, "vector": vector})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", type=Path, required=True, help="Local safetensors checkpoint")
    parser.add_argument("--port", type=int, default=8798, help="Local listening port (default 8798)")
    args = parser.parse_args()
    if not 1_024 <= args.port <= 65_535:
        parser.error("--port must be from 1024 to 65535")
    start = perf_counter()
    try:
        encoder = Encoder(args.weights)
    except (ImportError, OSError, ValueError) as error:
        parser.exit(1, f"Visual encoder startup failed. {error}\n")
    with EncoderServer(args.port, encoder) as server:
        print(
            f"Visual encoder ready on loopback port {args.port} in {perf_counter() - start:.2f}s",
            flush=True,
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
