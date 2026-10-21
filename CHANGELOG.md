# Changelog

Kept's releases, newest first. Written by `scripts/changelog.mjs` from the commits' conventional
subjects when a release is cut (`scripts/release.sh`).

## 1.12.2 (2026-10-21)

### Features

- **tags:** tags you can actually use (#220) (94854c0)
- stocktakes and kits with hand-overs (#219) (74bedbb)

### Fixes

- **security:** tighter tokens, OAuth revoke, webhook senders and origin checks (#221) (4945652)
- **ai:** the assistant fits small per-minute limits, every field for the assistant and MCP, live model lists and OpenRouter embeddings (#218) (5f55764)
- **labels:** the sheet preview shows what each label prints (#217) (e432b0d)

### Documentation

- **readme:** what's next after 1.12.1 (#214) (c9c22c9)
- **release:** the 1.12.1 record (#213) (8431f1f)

## 1.12.1 (2026-10-20)

### Features

- **import:** older Homebox: its spreadsheet, the right versions, and a clear refusal (#210) (722ebd5)
- **help:** one tour in chapters; Help at full page width (#211) (1918e79)
- **map:** shape library, request a shape, homelab shapes (#208) (c421571)

### Documentation

- **readme:** what's next after 1.12.0 (#206) (811827e)
- **release:** the 1.12.0 record (#205) (6e6f816)

## 1.12.0 (2026-10-20)

### Features

- **scan:** scan sessions: count, pack into and move to, many labels in one walk (#202) (d4342f3)
- Room photos: fill a room from 1–5 photos (#201) (5bd2276)

### Fixes

- **room:** room photos stay private until reviewed; the demo says no AI runs (#203) (90551aa)

### Documentation

- **release:** the 1.11.1 record (#200) (7b3c50d)

## 1.11.1 (2026-10-20)

### Fixes

- **map:** a place's own card, the map paints before WebGL, README what's next (#198) (fe12277)

### Documentation

- **release:** the 1.11.0 record (#196) (eb2a0a3)

## 1.11.0 (2026-10-20)

### Features

- **web:** Tours, a short walkthrough for every section (#193) (f5abfcd)
- **map:** a place's page has Map: a floor or a room on its own (#192) (9459300)

### Documentation

- **release:** the 1.10.8 record (#187) (d04b515)

## 1.10.8 (2026-10-20)

### Documentation

- **readme:** what's next, from the roadmap (#180) (d46247b)
- **release:** the 1.10.7 record (#179) (a9eb9b5)

## 1.10.7 (2026-10-20)

### Fixes

- **web:** two timers no longer outlive their screens (#165) (f50cfd1)

### Documentation

- **release:** the 1.10.6 record (#158) (c63a8bf)

### Other

- Kept 1.10.7: MCP moving tools, moves in exports, faster sheet saves, map card and walls, hang things on a wall (#164) (c2a5fd0)

## 1.10.6 (2026-10-17)

### Fixes

- **map:** rooms face their screens, arms clamp at the back edge, Add on it lists things not on the map yet (#150, #151, #152) (#156) (d11cd6b)

### Documentation

- **release:** the 1.10.5 record (#155) (bf68da1)

## 1.10.5 (2026-10-16)

### Fixes

- **reports:** lock email-only options when mail isn't set up (#141) (#153) (a0cc944)

### Documentation

- **release:** the 1.10.4 record (#149) (11c55c3)

## 1.10.4 (2026-10-16)

### Fixes

- **activity:** plain sentences, not JSON and event codes (#140) (#147) (571deab)

### Documentation

- **release:** the 1.10.3 record (#146) (6898875)

## 1.10.3 (2026-10-16)

### Features

- **map:** put small things on a desk or a monitor without dragging (#137) (#144) (7b5742f)

### Fixes

- **web:** grid keeps places and things apart, with tile sizes (#139) (#143) (13b77ee)

### Documentation

- **release:** the 1.10.2 record (#136) (557d296)

## 1.10.2 (2026-10-15)

### Fixes

- **map:** shapes for everyday electronics, word-start search, and a picker above the keyboard (#130) (#134) (56b51dc)

### Documentation

- **release:** the 1.10.1 record (#133) (9a6e02f)

## 1.10.1 (2026-10-15)

### Documentation

- a README with a quick hosting guide and more pictures; SEO for keptinventory.info (#131) (b5db189)
- **release:** the 1.10.0 record (#128) (8006f24)

## 1.10.0 (2026-10-15)

### Features

- **moving:** pack, track and unpack boxes (D251) (#126) (7b03c4c)
- **things:** a spreadsheet view with edit in place and bulk edit (D250) (#125) (8382d53)

### Documentation

- **release:** the 1.9.2 record (#124) (d56b066)

## 1.9.2 (2026-10-15)

### Documentation

- **site:** what Kept connects to, as one picture on the integrations page (#122) (cb12ee2)
- **release:** the 1.9.1 record (#121) (67e4090)

## 1.9.1 (2026-10-15)

### Documentation

- **site:** the map clip on the landing page, playing as the page loads (#119) (7143051)
- **release:** the 1.9.0 record (#118) (ca0c07d)

## 1.9.0 (2026-10-15)

### Features

- **map:** suggested shapes with pictures and search, picked for you when it's clear (D249) (#116) (390d845)
- **paperwork:** link things to their Paperless-ngx documents (D248) (#111) (0698962)

### Documentation

- **release:** the 1.8.1 record (#109) (e74b8e5)

## 1.8.1 (2026-10-15)

### Fixes

- **schedules:** a one-off schedule is done once it's completed (D247) (#105) (a14810e)

### Documentation

- **site:** try the whole app in the browser (D246) (#106) (f243db1)
- **release:** the 1.8.0 record (#104) (c541a3f)
- **screens:** showcase money in US dollars (#103) (56a7c97)

## 1.8.0 (2026-10-15)

### Features

- **api:** read what needs you from Home Assistant and dashboards (D244) (#100) (7df8f05)

### Documentation

- **release:** the 1.7.1 record (#99) (a5b029d)

## 1.7.1 (2026-10-15)

### Features

- **help:** a guided tour that matches today's screens, skippable and resumable (D242) (#96) (b270d40)

### Fixes

- **map:** Arabic on the map: its font, floor initials and two card words (#97) (943a31a)

### Documentation

- **site:** a landing page that fits on a phone, with Kept open on desktop and phone (D243) (#95) (b0846d6)
- **site:** try the 3D map in the browser (D241) (#94) (4a2d638)
- **release:** the 1.7.0 record (#93) (53b0abc)

## 1.7.0 (2026-10-15)

### Features

- **home:** see what needs you and where everything is at a glance (D240) (#91) (b5fdc1c)

### Documentation

- **release:** the 1.6.1 record (#90) (f667bb0)

## 1.6.1 (2026-10-15)

### Features

- **notify:** choose notifications once for all locations, override per location (D239) (#86) (4cf3075)

### Fixes

- **web:** the sidebar keeps the location you are in chosen (D224) (#87) (3ddd146)

### Documentation

- **site:** a landing page with the 3D map, what feeds into Kept, and SEO (D89, D199) (#88) (7910cab)
- **release:** the 1.6.0 record (#85) (6d64b61)

## 1.6.0 (2026-10-15)

### Features

- **map:** see a location as a 3D map, floor by floor, and arrange it (D237) (#83) (1fe8e44)

### Documentation

- **release:** the 1.5.1 record (#82) (3d1f65f)

## 1.5.1 (2026-10-15)

### Features

- **portability:** condition reports travel in a Kept export (D238) (#79) (9b44c67)

### Fixes

- the assistant logs a service from stock, the boards show Insights live, a swapped sheet stays open (D236, D234) (#80) (2fdbfd2)

### Documentation

- **release:** the 1.5.0 record (#78) (1f77811)

## 1.5.0 (2026-10-15)

### Features

- **insights:** see spending, value, vehicle costs and warranty cover across locations (D234) (#76) (bca2cc8)
- **services:** a service line can use stock from a consumable (D236) (#75) (08b1d82)
- **share:** read-only share links for a box, a place or a search (D233) (#74) (afa84ad)
- **condition:** record a rented home's condition at move-in and move-out (D235) (#73) (8b98e81)
- **notify:** Apprise channels, through the operator's Apprise API server (D232) (#72) (e9ad700)

### Documentation

- **release:** the 1.4.1 record (#71) (e298b1d)

## 1.4.1 (2026-10-14)

### Fixes

- **web:** a sheet closed while the page is leaving doesn't cancel the next load (#69) (416b604)
- **assistant:** size each request under the provider's per-minute token limit (#68) (ecf1bda)
- **reports:** a render that peaks past its memory limit between samples fails as memory (#66) (6f042bb)

### Documentation

- **release:** the 1.4.0 record (#65) (e30d437)

## 1.4.0 (2026-10-14)

### Features

- **capture:** email-in, receipts from a location's IMAP mailbox (D231) (#63) (591ae76)
- **capture:** several things in one photo, behind an admin switch (D230) (#62) (303a1a1)

### Documentation

- **release:** the 1.3.0 record (#61) (8ef336b)

## 1.3.0 (2026-10-14)

### Features

- **vehicles:** import a vehicle's history from LubeLogger (D229) (#59) (ac9249d)
- **reports:** email a report, or have it sent every week or month (D228) (#58) (b7ec8de)
- **notify:** ntfy and Telegram channels (D227) (#57) (62441b1)

### Documentation

- **release:** the 1.2.0 record (#55) (90bda97)

## 1.2.0 (2026-10-14)

### Features

- **auth:** Google sign-in, and linking outside sign-ins from Settings (D226) (#53) (5fc1b84)
- **accounts:** delete your own account, with 30 days to keep it (D225) (#52) (5956122)

### Documentation

- **release:** the 1.1.0 record (#51) (d034cdc)

## 1.1.0 (2026-10-14)

### Features

- **locations:** places panel and readable location addresses (D224) (#47) (d8fc0ff)
- **views:** the layout isn't part of a saved view (D223) (#46) (93bbe93)
- **web:** a location's contents as a grid (#45) (540a43a)
- **web:** a location's contents fold by section (#44) (138c46b)
- **labels:** print a location's unprinted labels from its page (#43) (d49129f)

### Documentation

- **release:** the 1.0.6 record (#49) (1584045)
- **design:** the screens board shows 1.1's places panel, grid and folding sections (#48) (556cb93)

## 1.0.6 (2026-10-14)

### Fixes

- **modules:** Moving mode isn't built yet: What to track shows it as Coming soon, and it can't be switched on (#41) (6ddd652)
- **release:** the README installs the release, and a tag must be new (#40) (9009f6f)
- **sync:** the op ledger lasts as long as an op may be resent (#39) (7f4b594)
- **import:** a CSV that isn't UTF-8 is refused, not imported as garbled names (#38) (18b8ce2)
- **backup:** problems the backups found no longer stay quiet (#37) (66a8fd9)
- **mcp:** update_thing files an alias by its script, not as English (#36) (c2f01b0)
- **imports:** a failed Homebox step forgets the brand it made, so the next item imports (#35) (54efa36)
- **web:** nothing follows you into another location or to the next person (#34) (113b924)
- **assistant:** confirmed cards send the thing's version only to tools that check it (#33) (347eee1)
- **auth:** tokens end with the account: a disabled user's stop, a claim revokes them (#32) (72a1c10)
- **sync:** the orphan purge keeps an upload whose queued op may still come (#31) (1306372)
- **test:** date fixtures count calendar days in Cairo, not 24-hour steps from UTC (#30) (47873b2)
- **web:** the guided tour no longer sends people off its own path (#27) (7288974)
- **web:** review fixes for #2, #3, #18 and the docs move; two flaky tests (#26) (c69c2ff)
- **mcp:** add_thing resolves a short-ID or container place_id, and a saved write never answers an error (#25) (6e2b15b)

### Documentation

- the images are public and releases are signed into the transparency log: the install, verify and security pages say so (#41) (6ddd652)
- **design:** the screens board catches up with 1.0.5 (#29) (6f18575)
- **release:** the 1.0.4 and 1.0.5 records, and fixes 1.0.1's changelog missed (#28) (a07ea9d)

## 1.0.5 (2026-10-11)

### Fixes

- **web:** tour Next/Got it hover stays amber instead of flipping gray (#23) (245b55e)

### Documentation

- README badge to keptinventory.info (#24) (fecbc77)

## 1.0.4 (2026-10-11)

No user-facing changes: tagged on 1.0.3's commit (3309837) before the README fix it was cut for
had merged, so it is 1.0.3 rebuilt. That fix shipped in 1.0.5.

## 1.0.3 (2026-10-11)

### Features

- **web:** full interactive guided tour with Keep/Discard (#21) (a234928)

## 1.0.2 (2026-10-10)

### Features

- **web:** "Show me around" tours seven stops, not four (#19) (5e4e5a1)
- **web:** navigate inside a location — back link, outline, readable URLs (#18) (2d5e6ab)
- **mcp:** add_thing says per item whether its place was found or made (#17) (c8705ef)
- **web:** location settings General gains timezone and currency (#16) (c0cda03)

### Fixes

- **web:** isolate subject names in notification headings and loan texts (#14) (2bc5637)
- **web:** a sheet closing must not traverse history while a navigation is in flight (#10) (86d069f)

### Documentation

- **release:** the 1.0.1 record, and the missing 1.0.0 one (#9) (f00a249)

### Other

- release: retry creating the GitHub release on server errors (#13) (8b3dc2d)

## 1.0.1 (2026-10-08)

### Features

- **web:** Get started asks the instance admin to set up email while mail is off (993698f)
- **contributing:** a CLA beside the DCO, signed once on a contributor's first pull request (74a625a)

### Fixes

- **capture:** photos named after AI is connected show their names without a reload (#4) (037e1b8)
- **assistant:** fit a free-tier plan's per-minute limit, and say so when a question doesn't (#3) (b697706)
- **web:** the sidebar expands while the assistant's panel is docked (#2) (12612db)
- **web:** a page left blank because the app's code failed to load reloads once by itself (#8) (d655b04)
- **web:** fuel trends opened offline before their first load show nothing instead of an error (#8) (d655b04)
- **inbox:** a receipt's shop and date fill in when its reading arrives after the review opened,
  unless you've typed your own (#8) (d655b04)

### Security

- **deps:** sharp 0.35.5, whose bundled librsvg renders uploaded brand logos; patched form-data,
  source-map-js, postcss-selector-parser and esbuild in the build tools (#6) (47d7d07)

## 1.0.0 (2026-10-07)

The first release.

- **Inventory:** locations, rooms, shelves, boxes and things, with photos, documents, tags,
  custom fields, quantities, saved views, search and a restorable trash.
- **Capture:** photograph a thing, a receipt or a label, online or offline; your AI provider
  suggests the details.
- **Labels:** printable sheets with a short ID and a QR code; scan one to open what it's on.
- **The household:** shared locations with roles, lending, schedules, warranties, paperwork, an
  insurance report, and reminders in the app, by mail, by push and in a calendar feed.
- **Vehicles and machines:** readings, services, fuel and running costs.
- **AI assistant and MCP server:** ask in plain words; Claude and other AI agents connect at
  `/mcp` with a personal token or OAuth.
- **Backups you can read:** nightly restic backups with a copy that opens in a browser; imports
  from Homebox and CSV; full exports.
- **Five languages:** English, Arabic (right to left), French, German and Italian; installs on a
  phone as an app.
- **Releases:** a multi-arch image (amd64, arm64) and a Helm chart, both signed with cosign.
