# PyScratch

A Scratch-style block editor that writes real Python and runs it in your browser.
Runs entirely on free static hosting (GitHub Pages). No paid APIs, no server.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page layout (header, editor, Python panel, stage, modals) |
| `style.css` | Colours and responsive layout |
| `app.js` | Blocks, Python generator, stage, sprites, projects, accounts, community |
| `pyscratch.py` | Python runtime: `move`, `turn`, `goto`, `say`, `wait`, `tick`, `on_edge` |
| `builder.html` / `builder.js` | Website builder (drag blocks to make a web page) |
| `site.html` | Public viewer for published websites |
| `config.js` | Supabase keys for publishing (empty = publishing off) |
| `README.md` | This file |

## Publish free on GitHub Pages

1. Create a free account at https://github.com.
2. Click **+ → New repository**. Name it `pyscratch`, set it to **Public**, and create it.
3. Click **uploading an existing file**. Drag in all the files above (they must sit at the
   top level, not inside a folder). Click **Commit changes**.
4. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to
   *Deploy from a branch*, branch **main**, folder **/ (root)**. Click **Save**.
5. Wait about a minute, then open `https://YOUR-USERNAME.github.io/pyscratch/`.

Blockly and Pyodide load from the free jsDelivr CDN, so there is nothing to install.

## Using it

- **Build:** drag blocks from the left into the workspace. Attach them under
  *when green flag clicked*. The Python code panel updates live.
- **Run:** green flag or Run. **Stop** ends the program.
- **Save / Publish:** requires an account (Account button, top right).
- **Export / Import:** works without an account, as `.pyscratch.json` files.
- **Websites:** open **Websites** in the top bar. Drag blocks to build a page, then
  **Save**, **Download HTML** or **Publish**. A published site opens at `site.html?id=...`.

## Turn on publishing (free Supabase)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor** and run:

```sql
create table sites (
  id text primary key,
  owner text not null,
  title text,
  html text not null,
  updated timestamptz default now()
);
alter table sites enable row level security;
create policy "anyone can read sites" on sites for select using (true);
create policy "anyone can insert sites" on sites for insert with check (true);
create policy "anyone can update sites" on sites for update using (true);
```

3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key into
   `config.js`, commit the change, and wait for GitHub Pages to update.

**Security warning:** these policies let anyone with the site's public key overwrite any
published site, and the owner name is only checked by the browser. That is fine for testing
but not for a public launch. Before opening it to strangers, switch to Supabase Auth and
restrict the policies to the signed-in owner.

## Known limits

- Accounts and the Community are stored in each browser's localStorage. They are not
  shared between devices or people. Real cross-user accounts (Google, Apple, email) need
  a free backend such as Firebase Auth or Supabase, which would be added in `app.js`.
- Only the selected sprite runs when you press Run.
- Sounds, costumes, lists and custom blocks are placeholders.

