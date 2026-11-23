# Visual retrieval feasibility

This experiment compares Kept's existing keyword search against caption-independent image
retrieval. The gallery has four public fixture photographs with descriptions that omit the
objects. Each record sits inside a named box in a disposable Kept location. The experiment
runs inference locally and does not write image vectors into Kept.

| Image | Fixture description | Recorded box | Source |
| --- | --- | --- | --- |
| Coffee cup and saucer | Kitchen spares | Blue tote | scikit-image `coffee`, CC0 |
| Wall clock | Hallway odds and ends | Top shelf | scikit-image `clock`, photographer's public-domain release |
| Coins | Tray from the attic | Red box | scikit-image `coins`, Brooklyn Museum, no known copyright restrictions |
| Motorcycle | Garage overflow | Bottom shelf | Middlebury Stereo 2014, left camera |

The cup, clock and coins give the gallery round shapes with different contents. Image queries
use the right stereo camera's view of the motorcycle, a crop of the indexed clock exposure,
and the public CC0 scikit-image `chelsea` cat photograph as an absent object. The clock crop is
a transform of an indexed image. The motorcycle's right camera captured the same scene from
a different viewpoint. These are limited stand-ins for photographs taken during later use.

[scikit-image data and attribution](https://scikit-image.org/docs/stable/api/skimage.data.html)
and [Middlebury dataset terms and citation](https://vision.middlebury.edu/stereo/data/).
The Middlebury fixtures come from D. Scharstein et al., *High-Resolution Stereo Datasets
with Subpixel-Accurate Ground Truth*, GCPR 2014.

## Run the experiment

Use Python 3.12. Install into an ignored environment. The model checkpoint is roughly
577 MiB and the evaluator verifies its SHA-256 before loading it.

```sh
mkdir -p .tmp/kept-visual
python3.12 -m venv .tmp/kept-visual/venv
.tmp/kept-visual/venv/bin/pip install -r scripts/visual-retrieval/requirements.txt
curl -fL -o .tmp/kept-visual/open_clip_model.safetensors \
  https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K/resolve/1a25a446712ba5ee05982a381eed697ef9b435cf/open_clip_model.safetensors
.tmp/kept-visual/venv/bin/python scripts/visual-retrieval/evaluate.py \
  --weights .tmp/kept-visual/open_clip_model.safetensors \
  --output .tmp/kept-visual/results.json
```

For the keyword comparison, start a disposable [Kept development server](../../CONTRIBUTING.md)
on loopback with local storage and text embeddings off. Set `KEPT_VISUAL_EMAIL` and
`KEPT_VISUAL_PASSWORD` to the disposable seeded account's credentials, then add
`--kept-origin http://localhost:8080` to the command. The evaluator creates a uniquely named
fixture location on each run. It uses Kept's actual authenticated search API for the keyword
baseline. An encoder-only run leaves the keyword columns empty.

## Measured run on November 22, 2026

OpenCLIP 3.2.0 ran ViT-B/32 with LAION-2B `s34B-b79K` weights at revision
`1a25a446712ba5ee05982a381eed697ef9b435cf`, checkpoint SHA-256
`ac4f8c4b88af6d963118cbf40ad93176d092abbedfcb752601ae1866352656e6`.
Images were converted to RGB, resized bicubically to a 224-pixel short edge, center cropped
to 224 × 224, and normalized with the model's RGB means and standard deviations.
Both encoders produced L2-normalized 512-dimensional vectors. Ranking used cosine similarity.

Run on Apple Silicon CPU with four PyTorch threads, PyTorch 2.8.0, and no paid inference.
The model loaded in 809 ms and the four-image gallery encoded in 73 ms. The process peaked
at 1,504 MiB RSS, including the model and libraries. Query encoding took 13–21 ms for text
and 26–30 ms for images. Kept keyword requests took 17–29 ms over loopback. These timings
come from one run with a four-image gallery and exclude download time.

| Query | Expected | Kept keyword matches | Image-vector ranking by cosine |
| --- | --- | --- | --- |
| a cup of coffee on a saucer | Blue tote | None | Coffee .328, clock .175, coins .064, motorcycle .049 |
| a round analog wall clock | Top shelf | None | Clock .229, coins .145, coffee .143, motorcycle .127 |
| old metal coins | Red box | None | Coins .287, motorcycle .147, clock .146, coffee .066 |
| a motorcycle | Bottom shelf | None | Motorcycle .314, clock .179, coffee .155, coins .127 |
| a folding stepladder | No match | None | Coffee .130, clock .104, coins .101, motorcycle .099 |
| Kitchen spares | Blue tote | Blue tote | Motorcycle .158, clock .142, coins .134, coffee .131 |
| Motorcycle, right camera | Bottom shelf | No image input | Motorcycle .950, coffee .369, coins .282, clock .242 |
| Clock, same-exposure crop | Top shelf | No image input | Clock .975, coins .489, coffee .416, motorcycle .235 |
| Chelsea cat | No match | No image input | Coffee .396, clock .342, motorcycle .334, coins .265 |

The encoder ranked the expected record first for all four caption-omitted text queries and
both matching image queries. It ranked the exact description “Kitchen spares” last, and
ranked candidates even for the two absent objects. Preserve keyword and text-semantic
search, and evaluate abstention thresholds on a larger held-out dataset. This run has too few
classes, viewpoints and near-identical objects to qualify thresholds or generalize accuracy.

## Production boundary for a follow-on experiment

Restrict candidate IDs to the caller's authorized, visible things and attachments before
computing any rank. The evaluator filters its fixture gallery against Kept's authenticated
thing list before embedding or ranking when a Kept server is supplied. A production worker
would index an authorized original in a separate, model-versioned image index, with metadata
for location, attachment ID, checksum and deletion. Keep the original file and Kept's text
embedding rows separate. Include membership revocation, hidden and trashed things, and
deletion in cross-household retrieval tests before serving any private image results.

[OpenCLIP model and inference](https://github.com/mlfoundations/open_clip),
[pinned weights](https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K/tree/1a25a446712ba5ee05982a381eed697ef9b435cf).

## Opt-in local encoder

Use the Python 3.12 environment and local checkpoint from the setup above. Start the sidecar as
a separate process in the same network namespace as the Kept server and worker. It listens on
IPv4 loopback only, verifies the checkpoint SHA-256 and pinned inference package versions at
startup, and uses the CPU. Keep port 8798 private.

```sh
.tmp/kept-visual/venv/bin/python scripts/visual-retrieval/serve.py \
  --weights .tmp/kept-visual/open_clip_model.safetensors
```

Set `KEPT_VISUAL_ENCODER_URL=http://127.0.0.1:8798` in the environments that start Kept's server
and worker. With the variable unset, visual inference is disabled. Kept checks that the sidecar
serves its expected generation before sending either kind of input. The sidecar decodes and
encodes requests in memory. Weight downloads are a separate setup step.

Generation `openclip-vit-b-32-laion2b-s34b-b79k-1a25a446-224-v1` uses the checkpoint above and
the OpenCLIP 3.2.0 ViT-B/32 tokenizer and encoders. Kept bounds source images to 20 megapixels,
auto-orients them, scales them to fit within 1024 × 1024 without enlargement, flattens
transparency against white and transcodes to JPEG at quality 85. The sidecar validates the JPEG
and its dimensions, decodes to RGB, resizes the short edge to 224 with bicubic interpolation,
center crops to 224 × 224, and applies the OpenCLIP RGB normalization constants. Each encoder
returns a normalized 512-dimensional vector. Both the backend and the sidecar validate sizes,
and the backend checks the generation, dimension, and norm before using a response.

## Real encoder smoke with independent image exposures

The [Columbia Object Image Library (COIL-20)](https://www.cs.columbia.edu/CAVE/software/softlib/coil-20.php)
contains distinct exposures of objects on a turntable. The smoke run uses five gallery frames
from 0°, separate query frames captured at 30–50°, and similar toy vehicles and cups assigned to
separate fixture boxes. The fixture names and box labels omit the visible objects. The script
reads a local ZIP and verifies its SHA-256. The ZIP and generated fixtures stay out of Git.

```sh
curl -fL -o .tmp/kept-visual/coil-20-proc.zip \
  https://www.cs.columbia.edu/CAVE/databases/SLAM_coil-20_coil-100/coil-20/coil-20-proc.zip
.tmp/kept-visual/venv/bin/python scripts/visual-retrieval/check-sidecar.py \
  --coil-archive .tmp/kept-visual/coil-20-proc.zip \
  --output .tmp/kept-visual/sidecar-smoke.json \
  --fixture-dir .tmp/kept-visual/coil-fixtures
```

The November 23, 2026 run used the provisional text cutoff of 0.20, photo cutoff of 0.58, and
an ambiguity margin of 0.035. The sidecar started in 3.15 s and encoded the five gallery images
in 200 ms over loopback. Its process used approximately 589 MiB resident memory after the run.

| Query type | Recall@1 | Recall@5 | False positives on absent objects | Median / maximum encode over loopback |
| --- | ---: | ---: | ---: | ---: |
| Caption-omitted words | 5/6 | 6/6 | 0/2 | 14.01 / 45.40 ms |
| Separate photo exposure | 5/5 | 5/5 | 1/2 | 20.12 / 20.76 ms |

The absent cat figurine matched the rubber duck at 0.630. The handle-less cup text query ranked
the other cup first. The corpus is a five-object, single-background turntable smoke test. The
provisional cutoffs and measured timings still need held-out household qualification. This
command measures the local inference interface. Kept's authorized search, indexing coverage and
attachment lifecycle are exercised separately by server tests.
