---
title: Add a shape
description: Add a shape to the location map - the files it touches, its words in five languages, its drawing or detailed model, the thumbnail script and the tests.
---

A shape is one entry in the location map's catalogue: a size, a group, the words that find it,
and a way to draw it. The [shape library](/users/map-shapes/) and the shape picker read the same
catalogue, so a new shape shows up in both once these steps are done. To ask for one instead,
[open a shape request](https://github.com/keptinventory/kept/issues/new?template=shape-request.yml).

## The files a shape touches

| File | What goes in it |
|---|---|
| `packages/shared/src/map.ts` | The shape's entry in `MAP_MODELS`: its key, size and kind (see below) |
| `packages/shared/src/map-shapes.ts` | Its group in `SHAPE_GROUP`, its words in `SHAPE_WORDS`, its French, German and Italian words again in `SHAPE_WORD_LANGS`; optionally a built-in type that suggests it in `TYPE_SHAPES` |
| `apps/web/src/map/labels.ts` | Its name in the picker, a `` t`…` `` string |
| `apps/web/src/locales/*/messages.po` | That name in all five catalogues ([adding a string](/developers/i18n-rtl/#adding-a-string)) |
| `apps/docs/src/components/try-map/strings.ts` | Its English and Arabic name for Try the map and the shape library |
| `apps/web/src/map/engine/draw.ts` | Its drawing, for a shape drawn in code |
| `apps/web/src/map/models/` | Its `.glb` file and a line in `NOTICE.txt`, for a detailed model |
| `apps/web/src/map/thumbs/` | The regenerated picture sprite (below) |

TypeScript holds most of this together: `SHAPE_GROUP`, `SHAPE_WORDS`, the names and the sprite are
records over every key, so a key missing from one fails `tsc`.

## The catalogue entry

Sizes are metres, width (`w`) along the front, depth (`d`) front to back, height (`h`), before a
turn. Use a typical size of the real thing; a thing keeps its shape's size on the map.

```ts title="packages/shared/src/map.ts"
nas: { w: 0.2, d: 0.22, h: 0.17, kind: 'thing', small: true },
```

- `kind`: `furniture`, `storage` or `thing`.
- `holds: true`: storage with contents (a shelf, a box, a rack): its card counts what is in it.
- `top`: the height small things stand on (a desk, a counter); leave it out when nothing stands on it.
- `small: true`: it can stand on a desk or shelf, and moves a centimetre at a time.
- `wall`: it hangs on a wall; the number is where its middle hangs, in metres. Keep it shallow
  (`d` 0.4 or less).
- `mount`: it carries things another way (a screen's top edge, a monitor arm, hooks); see the
  comment above `MapMount`.
- `glb`, `rotFix`, `simple`: a detailed model's file name, the turn that makes it face the front,
  and the drawn stand-in used when detailed models are off.

The key is stored in a location's layout, so never rename or remove one once it has shipped.

## A shape sized by its numbers

The cube shelf sized by its grid (`cube_grid`) and the bookcase with levels (`bookcase`) are drawn
from numbers someone sets on the card, not from one size. A node's stored model carries them after
the key, so the layout's format, the API and the database stay as they were:

| Model | Means |
|---|---|
| `cube_grid` | 2 cubes across, 2 up: its catalogue entry's size |
| `cube_grid_4x1` | 4 across, 1 up (a 1 × 4 lying down) |
| `bookcase` | 80 × 28 × 202 cm, 6 levels |
| `bookcase_60x28x150_4` | 60 × 28 × 150 cm (width, depth, height), 4 levels |

`sizedOf` reads the numbers (null for anything else, out of range, or spelled another way: the
first size is only ever the bare key), `sizedKey` writes them, `mapModel` gives the size and
`baseModel` the catalogue key, which the names, the groups and the pictures use.
`apps/web/src/map/engine/sized.ts` turns the numbers into boards and the spaces between them, and
`apps/web/src/map/size.tsx` is the card's fields. A new sized shape goes in all of these, and in
`isMapModel`'s tests and the server's layout test.

## Words in five languages

`SHAPE_WORDS` lists what people call the thing, lower case, in English, Arabic, French, German and
Italian, written as people type them (accents and Arabic letter forms are folded when matching).
They do two jobs: **Find a shape** searches them, and a thing's name is read against them to give
it its shape.

- Prefer phrases to single words that mean several things: the network switch answers to
  "network switch", "PoE switch" and "port switch", never plain "switch", which is as often a
  Nintendo Switch or a light switch.
- A word several shapes share (a family's word, such as "server rack" or "speaker") suggests all
  of them and gives none by itself; a word only one has ("42U", "Echo") picks that one.
- Every French, German and Italian word goes into `SHAPE_WORD_LANGS` too; a word not listed there
  counts as English.
- Add cases to `packages/shared/src/map-shapes.test.ts`: names that should get the shape by
  themselves, in several languages, and names that must not.

## Drawn in code or a detailed model

Most shapes are drawn in code in `apps/web/src/map/engine/draw.ts`: a builder in `drawnModels`
under the shape's key, made of boxes and cylinders at the catalogue's size, with its corner at the
origin, its width along x, its depth along z and its front towards +z. Nothing is downloaded.

A detailed model is a `.glb` file under `apps/web/src/map/models/`, fetched only when a floor in
view needs it and never precached. The rules:

- **CC0 only.** Today's models are from [Poly Haven](https://polyhaven.com).
- **150 KB at most** (150 KiB). `apps/web/src/map/models.test.ts` fails for any file over that,
  for a `glb` name with no file, and for a file `NOTICE.txt` doesn't name.
- **Credited in `NOTICE.txt`**, with how it was shrunk: the current files were simplified, had
  their normal and occlusion maps removed and their colour maps resized to WebP, and were
  compressed with meshopt, with glTF Transform.
- Give it a drawn `simple` stand-in where one exists, for when detailed models are off.

## The picture

The picker and the shape library show one picture per shape, cells of a sprite rendered from the
map's own drawing. After adding or changing a shape, run:

```sh
node apps/web/scripts/render-map-thumbs.mjs
```

It renders every shape in headless Chromium and rewrites `apps/web/src/map/thumbs/shapes.webp` and
`sprite.ts` (each shape's cell, and the height it is drawn at). Commit both. Look at the sprite:
the new shape should read as what it is at 52 pixels, the size the picker shows it.

## The tests

```sh
pnpm vitest run packages/shared/src/map-shapes.test.ts packages/shared/src/map.test.ts
pnpm vitest run apps/web/src/map apps/docs/src/components
node scripts/check-i18n.mjs
```

The shared tests check every shape has a group and words; the web tests check the sprite has a
cell and a height for every shape and that detailed models stay under their size; the docs test
checks the shape library lists every shape. `pnpm docs:build` shows the library page.

## The map's controls and Try the map

A change to the map's controls, its card or What's in also updates
[Try the map](/try/map/) (`apps/docs/src/components/try-map/demo.ts`): it draws the same engine,
with those parts again in plain DOM, and `demo.test.ts` checks it still shows what the app shows.
