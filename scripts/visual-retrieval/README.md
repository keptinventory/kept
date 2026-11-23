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
