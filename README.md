# Turespaña IMEX kiosk

Portrait **1080×1920** photo + lead-capture kiosk for **Turespaña (Tourism Spain / Spain Tourism Board)** at **IMEX Las Vegas**.

This is the product repo. Turespaña code does **not** live in `elevate-photobooth-2`, `godr-marlins-kiosk`, or other client repos.

Closest pattern: [godr-marlins-kiosk](https://github.com/Powerwyze/godr-marlins-kiosk) (AI costume + email). Destination picker inspired by [mxu-circuit-kiosk](https://github.com/Powerwyze/mxu-circuit-kiosk).

## Guest flow

1. Kiosk attract screen (not a marketing landing page): pick **1 of 6** Spain destinations.
2. Camera countdown → photo.
3. Name + email for the **Turespaña newsletter** (required).
4. AI dresses every person for that destination as a hyper-real tourism poster.
5. Portrait emailed; QR to phone if Supabase storage is configured.

## Destinations

Six tiles, renamed in [`public/data/destinations.json`](public/data/destinations.json):

**Andalucía · Madrid · Cataluña · País Vasco · Galicia · Valencia**

Costume and landmark prompts live in that file so they stay easy to edit.

## Activation photo style

Generated photos follow a **hyper-real AI/CGI commercial tourism poster** look (style lock). Reference asset:

[`public/assets/activation-style-ref.jpg`](public/assets/activation-style-ref.jpg)

Copy the *look* of that poster (composited subjects, painted-flag sky stroke, dramatic lighting). Swap branding to **Turespaña / spain.info** and Spanish destination costumes — not baseball uniforms. Kiosk UI chrome stays spain.info / Turespaña and is **not** restyled to match the poster.

## Event dates

On-screen and in email:

**IMEX Las Vegas · Oct 13–15 2026 · Hotel Mandalay** (indoor kiosk).

(Earlier intake had Oct 10–13; the kiosk now uses the official IMEX America 2026 dates.)

## Brand

- Logo URL: **unknown**. No Sol de Miró artwork is shipped (copyright: Successió Miró). Typographic wordmark + a **geometric** sun motif only.
- Colors pulled from public Turespaña / spain.info / Sol de Miró descriptions and Wikipedia/Pantone approximations: black `#1B161C`, yellow `#FFEA00`, red `#E42719`, green `#7CB165`. Treat as a **temporary** palette until a licensed kit arrives.

## Repo shape

```
public/index.html    kiosk UI (portrait-first)
public/app.js
public/styles.css
public/claim.html    QR claim page (phone)
public/data/destinations.json
public/assets/       OSK, QR lib, activation-style-ref.jpg
api/banana.js        AI image generation (OpenAI, Gemini fallback)
api/send-photo.js    email delivery
api/lead.js          newsletter lead + optional photo store
api/claim.js         QR lookup
api/health.js        env NAME presence only (no values)
package.json
vercel.json
```

## Environment variables

Copy **by name** from the closest photo+lead Vercel project (`godr-marlins-kiosk`). Never commit values. Then set `FROM_NAME` to `Turespaña` (not a secret).

| Name | Role |
| --- | --- |
| `OPENAI_API_KEY` | Primary image edit |
| `OPENAI_IMAGE_MODEL` | default `gpt-image-1` |
| `OPENAI_IMAGE_SIZE` | default `1024x1536` (portrait) |
| `OPENAI_IMAGE_QUALITY` | default `high` |
| `GEMINI_API_KEY` | Fallback image gen |
| `GMAIL_USER` / `GOOGLE_APP_PASSWORD` | SMTP fallback |
| `WYZER_GMAIL_USER` / `WYZER_APP_PASSWORD` | Preferred SMTP |
| `FROM_NAME` | Email from-name |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_BUCKET` | Lead table `turespana_leads` + QR photo store |

`GET /api/health` reports which of those **names** are present (booleans only).

### Optional Supabase table

```sql
create table if not exists turespana_leads (
  id text primary key,
  email text,
  name text,
  destination_id text,
  destination_label text,
  newsletter boolean,
  public_url text,
  source text,
  event text,
  created_at timestamptz default now()
);
```

If the table or bucket is missing, email delivery still works; QR claim is skipped.

## Local

```bash
npm install
npx vercel dev
```

## Contacts (do not email from this agent)

- Client: Alba de la Cruz Gonzalez Vazquez
- Logistics: Ines, ines.arsenia@tt-thinktank.com
- Thread id: `19fd6c51d61fe4e9`

## Remaining human gaps

- Confirm licensed logo file (geometric sun is temporary)
- Newsletter legal copy / privacy
- Create `turespana_leads` + storage bucket if QR is required
- Hardware: 1 indoor branded kiosk, 3 days, 8 hours/day
- Expected attendance ~6000 (throughput planning)
