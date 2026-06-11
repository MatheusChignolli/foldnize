# Foldnize landing page

Static marketing site for [foldnize.com](https://foldnize.com). Download buttons resolve the latest `foldnize-app-v*` installer from GitHub Releases ([`download.js`](./download.js)).

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
cd landing
npx --yes serve .
```

## Netlify deploy

1. **New site** → Import from Git → this repository.
2. Netlify reads [`netlify.toml`](../netlify.toml) at the repo root (`base: landing`, no build step).
3. **Domain:** add `foldnize.com` under Site settings → Domain management.

If you configure manually: base directory **`landing`**, publish **`.`**, no build command.

## Cloudflare Web Analytics

The beacon snippet is in [`index.html`](./index.html). View stats under **Analytics & logs → Web Analytics** in the [Cloudflare dashboard](https://dash.cloudflare.com).

## SEO

The landing page includes:

| Asset | Purpose |
| ----- | ------- |
| `index.html` | Title, meta description, canonical URL, Open Graph, Twitter Cards, JSON-LD |
| `robots.txt` | Crawl rules + sitemap reference |
| `sitemap.xml` | Single-page sitemap for `https://foldnize.com/` |
| `assets/og-image.svg` | Social preview image (1200×630) |

After deploying, submit the sitemap in [Google Search Console](https://search.google.com/search-console) and validate structured data with the [Rich Results Test](https://search.google.com/test/rich-results).

## Files

| File | Role |
| ---- | ---- |
| `index.html` | Page content, SEO meta tags, Cloudflare Web Analytics |
| `styles.css` | Styles |
| `download.js` | OS-aware GitHub Release download links |
| `robots.txt` | Search engine crawl directives |
| `sitemap.xml` | XML sitemap |
| `assets/og-image.svg` | Open Graph / Twitter preview image |
