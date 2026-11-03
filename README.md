# Scouting Sprocket

Scouting Sprocket is a browser-based scouting form manager. Build forms, fill them out, import and export data, and manage what is stored, all from a single web UI.

You can run it two ways:

| | **Hosted (GitHub Pages)** | **Local server (Java)** |
|---|---|---|
| Setup | None. Open a link. | Install Java 11+, compile, run |
| Where data lives | In your browser on that device | On disk in `data.token` (+ `data.token.bak`) |
| Works offline | After the first load, if the browser has cached the page | Yes, runs on your own machine |
| Shared between devices | No. Use Export / Import to move data | Anything that can reach the server sees the same data |
| Best for | Quick use, phones and tablets, demos | Event laptops, a single source of truth, durable backups |

> **Hosted link:** `https://<username>.github.io/<repo>/`

---

## Contents

- [Quick start](#quick-start)
- [Main pages](#main-pages)
- [Using the hosted (GitHub Pages) version](#using-the-hosted-github-pages-version)
- [Running the local Java server](#running-the-local-java-server)
- [Deploying your own copy to GitHub Pages](#deploying-your-own-copy-to-github-pages)
- [Data format](#data-format)
- [Backups and moving data](#backups-and-moving-data)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Quick start

**Just want to try it?** Open the hosted link above. No install needed.

**Want durable, on-disk storage?** Run the local server:

```bash
javac Main.java
java Main
```

The app opens at <http://localhost:8080>.

---

## Main pages

- **Dashboard**: application home page
- **Forms**: view and use the configured scouting forms
- **Builder**: create or update the form definition
- **Export**: export collected data
- **Import**: import a saved form or token
- **Data Actions**: perform actions on stored scouting data
- **Settings**: manage application settings, locking, and data wiping

Both the hosted and local versions use the same pages.

---

## Using the hosted (GitHub Pages) version

The hosted version is a static site. GitHub serves the HTML, CSS, and JavaScript, and everything else happens in your browser. There is no backend, so:

- **Your data stays on your device.** Nothing is sent to GitHub or to any server of ours.
- **Data is tied to one browser profile.** A different browser, a private window, or another device will start empty.
- **Clearing site data deletes your scouting data.** If you clear cookies and site data for the page, or the browser evicts storage under pressure, the data goes with it.
- **There is no automatic `data.token.bak`.** Export regularly instead (see [Backups and moving data](#backups-and-moving-data)).

Tips for using it at an event:

1. Open the page once with a good connection so the browser can cache it.
2. Export after every few matches, and again at the end of the day.
3. Avoid private or incognito windows for real scouting sessions.
4. If several scouts are collecting data on separate devices, have each one export. Then import the files together on one machine.

---

## Running the local Java server

### Requirements

- Java 11 or newer
- A modern web browser

The server uses only Java's standard library. No external dependencies are required.

### Run it

From the repository directory, compile and start the server.

**Windows (PowerShell)**

```powershell
javac Main.java
java Main
```

**macOS / Linux**

```bash
javac Main.java
java Main
```

The application automatically opens <http://localhost:8080> in the system browser. If the browser cannot be opened automatically, visit that address manually. The server prints its URL and the locations of the persistent token files when it starts.

### Configuration

The default port is `8080`. Override it with the `scouting.port` system property:

```bash
java -Dscouting.port=8081 Main
```

By default, files are stored in the current working directory. Set `scouting.root` to use another directory:

```powershell
# Windows
java -Dscouting.root=C:\path\to\scouting-data Main
```

```bash
# macOS / Linux
java -Dscouting.root=/path/to/scouting-data Main
```

The application stores the current form data in `data.token` and keeps the previous version in `data.token.bak`.

---

## Deploying your own copy to GitHub Pages

You can host your own copy of the static site from a fork or from this repository.

### Option A: Deploy from a branch (simplest)

1. Push the static site files to your repository. The entry point is `index.html`.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose your branch (for example `main`) and the folder that contains `index.html` (`/ (root)` or `/docs`).
5. Click **Save**. After a minute or two, the site is live at `https://<username>.github.io/<repo>/`.

### Option B: Deploy with GitHub Actions

1. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Add `.github/workflows/pages.yml`:

```yaml
name: Deploy static site to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .   # change to the folder that contains index.html, e.g. ./docs
      - id: deployment
        uses: actions/deploy-pages@v4
```

3. Push to `main`. The workflow publishes the site, and the URL appears in the workflow summary.

### Notes for project sites

GitHub serves project sites from a sub-path (`/<repo>/`), not from the domain root. Use **relative** paths for assets and links (`./app.js`, not `/app.js`), or the page will load without its scripts and styles.

### Preview locally before pushing

Any static file server works. Browsers restrict some features on `file://` URLs, so serve the folder instead of double-clicking `index.html`:

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

Or use the Java server above, which serves the same pages.

---

## Data format

Imported and saved tokens must be valid JSON objects containing a `sections` array.

```json
{
  "sections": []
}
```

The local server rejects malformed JSON, unsupported content types, and payloads larger than 1 MiB.

---

## Backups and moving data

Because the hosted version stores data in the browser, treat **Export** as your backup.

- **Export** from the Export page to save your data as a file.
- **Import** it on another device or browser from the Import page.
- Keep exported files somewhere safe (cloud drive, USB stick, email to yourself) before clearing browser data or switching devices.

On the local server, `data.token.bak` holds the previous version of your data. It is a safety net against a bad save, not a substitute for copying the whole `scouting.root` folder somewhere else.

---

## Testing

The integration test covers the Java server. Compile both Java files and run the test:

```bash
javac Main.java MainTest.java
java MainTest
```

The test starts the server against a temporary data directory and verifies persistence, validation, size limits, locking, backups, and restart behavior.

---

## Troubleshooting

**The hosted page loads but looks broken or blank.**
Check that asset paths are relative (see [Notes for project sites](#notes-for-project-sites)). Open the browser's developer console for 404 errors.

**My data disappeared on the hosted version.**
Site data was probably cleared, or you opened the page in a different browser, profile, or private window. Import from your last export.

**My changes to the hosted site do not show up.**
GitHub Pages can take a few minutes to update. Hard-refresh the page (Ctrl+Shift+R / Cmd+Shift+R) to bypass the browser cache.

**`java Main` says the port is already in use.**
Pick another port: `java -Dscouting.port=8081 Main`.

**The browser did not open automatically.**
Visit <http://localhost:8080> manually, or the port you configured.

---

## License

Add your license here.
