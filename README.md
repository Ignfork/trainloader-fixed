# Train Loader ($LOADER)

A static site with no build step. Upload the whole folder to any static host (Vercel, Netlify, GitHub Pages).

## Files
- `index.html`: the page, its styles, and the site logic.
- `world.js`: the 3D world (map, trains, stations, scenery, lighting), drawn entirely in code.
- `vendor/three.min.js`, `vendor/OrbitControls.js`: three.js r128 (MIT, see `vendor/THREE-LICENSE.txt`). It's bundled, so the site doesn't depend on a CDN.

Keep these files together in the same folder structure.

## Edit before launch
Open `index.html` and find `CONFIG` at the top of the script:
- `xUrl` / `xHandle`: your X account. Until you set these, the X links show a "coming soon" toast.
- `ca`: the $LOADER mint address. Once set, it turns on the pump.fun link.

## What's in it
- **The 3D map:** it fills the whole first screen. A model-railway diorama with two lines, three steam trains (with smoke and gold coin wagons), five stations (halt, station, or terminal with a clock tower), a river with bridges, a park with a fountain, fields, a city, and a road with traffic. Trains pull in, wait at the platform, and coins fly into the station with a floating "+x $LOADER".
  - Day, Dusk and Night lighting. At night, windows, street lamps, headlights and signals light up.
  - Drag to orbit and scroll to zoom. It rotates on its own when idle. On phones, tap "Explore the map" to control it, so the page still scrolls normally.
  - Click a station to see its stats.
- **Station builder (with a rotating 3D preview):** connect a wallet (read-only, it only reads the public address), name your station, pick a roof colour, plot, level and sign style, then place it on the map. Trains start stopping there. It's saved in the visitor's browser.
- **Other sections:**
  - a departures board driven by the trains on the map;
  - top stations;
  - a grid of all 1,111 plots;
  - the fee split (70% stations, 20% burn, 10% upkeep);
  - an FAQ.

## Before launch
Everything is labelled SIMULATION or SAMPLE, and claiming opens at launch.
Real station ownership, fee distribution and claiming need an on-chain program or a backend, which this static build doesn't include.
