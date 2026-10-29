# What's new recipes

What's new in Kept shows a release's highlights as slides (`apps/web/src/components/whats-new.tsx`).
A highlight's picture or clip is named by a line `![icon](file)` under its bullet in
`.tmp/notes/highlights-X.Y.Z.md`, and made from the demo build by:

```sh
node scripts/record-whats-new.mjs --version X.Y.Z   # reads scripts/whats-new/X.Y.Z.json
node scripts/whats-new-keep.mjs --version X.Y.Z     # removes the earlier releases' folders and recipes
```

It writes `apps/web/public/whats-new/X.Y.Z/`: each `.mp4` clip with a `.webm` copy and a `.webp`
poster, each `.webp` picture, and `media.json`. `scripts/changelog.mjs` refuses a highlights file
that names a file the folder doesn't have, and a release build does too
(`apps/web/whats-new-plugin.ts`). Only one release's folder stays in the tree: git history keeps
the others.

## The recipe

`scripts/whats-new/X.Y.Z.json`, one entry per media file:

- `file`: the name the highlight's line gives. `.mp4` records a clip; `.webp` takes a picture
  of the screen once the steps are done.
- `path`: the page the demo opens (`?demo=owner&showcase=1` is added: the showcase household,
  invented data only).
- `setup`: steps done off camera; `steps`: the steps recorded (a picture runs them, then shoots).
- `crop`: `[x, y, width, height]` of the 1280×800 screen, in CSS pixels, 16:10. Every file is
  960×600, so a crop about 640–800 wide keeps the text readable in the card.
- `lead`, `hold`: the milliseconds a clip shows before the first step and after the last
  (600 and 1200); `poster: "start"` takes the clip's first frame in place of its last.

A step is one of `go` (a path), `click`, `hover`, `waitFor`, `clickAll` (a target), `wait`
(milliseconds), `press` (a key), `type` (text), `fill` (a target and `text`), `scroll` (a page
offset) and `glide` (`[x, y]`, the drawn pointer). A target is `{ "role", "name", "exact"?, "nth"?,
"in"? }`, `{ "text" }`, `{ "css" }` or `{ "option" }` (a segmented control's label, by its
radio's name); a `name` or `text` between slashes is a regular expression.

## An example

Two of the slides made for a trial of 1.14.1's highlights (that release shipped without media):
a clip of the furniture form turning on its side and switching to a bookcase, and a picture of a
thing's Paperwork list with two documents from Paperless.

```json
{
  "media": [
    {
      "file": "furniture.mp4",
      "path": "/p/01926f00-0000-7000-8000-0000000c0004",
      "setup": [
        {
          "click": {
            "role": "button",
            "name": "Room or spot"
          }
        },
        {
          "click": {
            "role": "button",
            "name": "Furniture with compartments…"
          }
        },
        {
          "waitFor": {
            "role": "dialog",
            "name": "/^Add furniture to/"
          }
        },
        {
          "wait": 600
        }
      ],
      "steps": [
        {
          "click": {
            "option": "On its side"
          }
        },
        {
          "wait": 1500
        },
        {
          "click": {
            "option": "Upright"
          }
        },
        {
          "wait": 900
        },
        {
          "click": {
            "role": "button",
            "name": "/Template$/"
          }
        },
        {
          "wait": 500
        },
        {
          "click": {
            "role": "option",
            "name": "Bookcase"
          }
        },
        {
          "wait": 1400
        }
      ],
      "crop": [
        304,
        40,
        672,
        420
      ]
    },
    {
      "file": "paperless.webp",
      "path": "/t/01926f00-0000-7000-8000-0000000d0005?tab=paperwork",
      "steps": [
        {
          "waitFor": {
            "text": "Bosch drill receipt"
          }
        },
        {
          "scroll": 300
        }
      ],
      "crop": [
        524,
        360,
        704,
        440
      ]
    }
  ]
}
```
