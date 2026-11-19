# Tabibito 旅人 · Japan trip companion

A small phone app for a trip to Japan. It has four tabs:

- **Home**: what's up next (with a countdown), today's plans, and trip progress.
- **Itinerary**: day-by-day timeline of travel 🚄, hotels 🏨, activities ⛩️ and food 🍜. Add plans by hand, or **import a document** (Word `.docx`, PDF, Excel `.xlsx`, CSV, text, or a calendar `.ics`). Everything found is shown for review before it's added.
- **Explore**: pick a city, press the button and get 3 random things to do. There are 187 popular spots and hidden gems across 16 places. Tap one for what you'll do, tips, cost and a Google Maps link, then add it to the to-do list or itinerary.
- **To-do**: a wish list of things to do, grouped by city, to tick off.

All data is saved **on the phone only** (browser storage). Nothing is sent anywhere and there's no login. It works offline once it has been opened.
Use *Settings → Save backup* now and then.

## Hosting it on GitHub Pages (free)

Your friend does **not** need a GitHub account. She only gets a link, and she can't see or change your account.

1. On GitHub, open this repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. Pick the branch with the app (e.g. `main`) and the **/ (root)** folder → **Save**.
4. After a minute the page shows the link, e.g. `https://<your-username>.github.io/<repo-name>/`.
5. Send her that link. On her phone:
   - **iPhone**: open it in Safari → Share → **Add to Home Screen**.
   - **Android**: open it in Chrome → ⋮ menu → **Add to Home screen / Install app**.

Notes:
- The link contains your GitHub username. If you don't want that, drag this folder onto https://app.netlify.com/drop for a link like `something.netlify.app`, which you can rename.
- GitHub Pages on a free account needs the repo to be **public**. That's fine: the repo only holds the app code. Her itinerary and to-dos never get uploaded.
- When you push updates, she just reopens the app (it may take one extra reopen to pick up the new version).

## Editing the activity ideas

They're all in `js/activities.js`, one line per idea:
`[name, "p" (popular) or "h" (hidden gem), category, area, duration, cost, what you'll do, tip]`.

## Tech

Plain HTML, CSS and JavaScript with no build step. Bundled: the Baloo 2 font (SIL OFL) and pdf.js 3.11.174 (Apache-2.0) for reading PDFs.
To run it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
