# Games

## Topic-wise News Promotion Tracker

A simple web dashboard is added at `topic-news-dashboard/`.

### Run locally

```bash
cd /workspace/Games/topic-news-dashboard
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

### How it works

- Paste a public Google Sheet URL.
- Click **Load Data**.
- Choose **Topic** and **Headline/News** columns.
- Click **Analyze** to see:
  - Topic-wise counts
  - Most repeated headlines
  - Topic-level repeated-news breakdown

> Note: Your Google Sheet must be public (Anyone with link can view), otherwise browser fetch will fail.
