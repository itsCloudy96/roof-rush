# Roof Rush

A free, mobile-first **roofing business tycoon** by **Cloudy**. Win bids, hire crews, survive hail storms, and grow a one-truck outfit into a roofing empire worth $1,000,000.

Play: https://itscloudy96.github.io/roof-rush/

## How to play
- **Leads tab:** customers post roofing jobs. Pick your price. Cheap wins more bids but earns less; pricey earns more but loses the bid. Your reputation helps.
- **Crews:** every crew needs a truck. Specialists (shingles, metal, flat, repairs) work faster on their job type. Watch morale and quality: sloppy crews cause callbacks and bad reviews.
- **Town map:** watch crews roof houses in real time (days fly by at 1x / 2x / 4x).
- **Events:** hail storms flood you with leads, rain delays, material price spikes, injuries, insurance adjusters, crews quitting, warranty callbacks, going viral.
- **Grow:** trucks, power tools, dumpsters, safety, training, a sales rep (unlocks Auto-Bid), offices, marketing campaigns, and three new towns including downtown commercial roofs.
- Progress saves automatically in your browser. Away for a while? You earn a little repeat business.

## Tech
Plain HTML/CSS/JS, no build step, no dependencies, no tracking. `engine.js` is a pure-logic game engine (also used by the node economy simulation in `tests/`), `game.js` is the touch UI. MIT licensed.

## Tests
```
npm i playwright-core
node tests/sim.js 720        # economy simulation: scripted strategies over in-game months
node tests/multi.js 2400 24  # 24 seeds of the smart strategy
node tests/e2e.js            # phone-viewport Playwright run: tutorial, bid, job, hire, event
```
