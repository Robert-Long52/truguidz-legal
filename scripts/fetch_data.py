#!/usr/bin/env python3
"""Refresh data/github.json and data/media.json for the TruOutdoorz site.

Runs on a schedule in GitHub Actions (see .github/workflows/refresh-data.yml) and works locally too:
    python3 scripts/fetch_data.py

Everything is fetched here, at build time, so visitors' browsers never call GitHub, YouTube or Dev.to.
Uses only the standard library. Public data only; no keys needed (GITHUB_TOKEN is used if present, to
avoid rate limits).
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GITHUB_USER = "Robert-Long52"
DEVTO_USER = "truoutdoorz"
YOUTUBE_CHANNEL_ID = "UCWMc1asJV-13gpA7XAMpxtg"
REDDIT_USER = os.environ.get("REDDIT_USER", "").strip()   # fill in once the account is ready to post
HIDE_REPOS = set()                                        # repo names to leave off the site

UA = "truoutdoorz-site-refresh/1.0 (+https://truguidz.com)"


def get(url, headers=None, binary=False, timeout=25):
    h = {"User-Agent": UA}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def get_json(url, headers=None):
    return json.loads(get(url, headers))


def gh(path):
    h = {"Accept": "application/vnd.github+json"}
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return get_json(f"https://api.github.com{path}", h)


def safe(label, fn, fallback):
    try:
        return fn()
    except Exception as exc:  # keep going; the page falls back gracefully
        print(f"[warn] {label}: {exc}", file=sys.stderr)
        return fallback


# ---------------------------------------------------------------- GitHub
def fetch_github():
    repos = gh(f"/users/{GITHUB_USER}/repos?per_page=100&sort=pushed&type=owner")
    repos = [r for r in repos if not r["fork"] and not r["private"] and r["name"] not in HIDE_REPOS]
    langs = Counter()
    out = []
    for r in repos:
        rl = safe(f"languages {r['name']}", lambda r=r: gh(f"/repos/{GITHUB_USER}/{r['name']}/languages"), {})
        langs.update(rl)
        out.append({
            "name": r["name"],
            "description": r.get("description") or "",
            "language": r.get("language") or "",
            "stars": r.get("stargazers_count", 0),
            "pushed_at": r.get("pushed_at"),
            "url": r["html_url"],
        })
    # Daily public commit counts for the last 90 days, from public push events.
    activity = Counter()
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    for page in (1, 2, 3):
        events = safe(f"events p{page}", lambda page=page: gh(f"/users/{GITHUB_USER}/events/public?per_page=100&page={page}"), [])
        if not events:
            break
        for ev in events:
            if ev.get("type") != "PushEvent":
                continue
            when = datetime.fromisoformat(ev["created_at"].replace("Z", "+00:00"))
            if when < cutoff:
                continue
            n = ev.get("payload", {}).get("distinct_size") or ev.get("payload", {}).get("size") or 1
            activity[when.date().isoformat()] += n
    total = sum(langs.values()) or 1
    return {
        "user": GITHUB_USER,
        "repo_count": len(out),
        "repos": out[:6],
        "languages": [{"name": k, "pct": round(v * 100 / total, 1)} for k, v in langs.most_common(6)],
        "activity": dict(sorted(activity.items())),
        "commits_90d": sum(activity.values()),
    }


# ---------------------------------------------------------------- YouTube
def fetch_youtube():
    xml = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={YOUTUBE_CHANNEL_ID}")
    ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    root = ET.fromstring(xml)
    vids = []
    for e in root.findall("a:entry", ns)[:6]:
        vid = e.find("yt:videoId", ns).text
        vids.append({
            "id": vid,
            "title": e.find("a:title", ns).text,
            "published": e.find("a:published", ns).text,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "thumb": f"img/media/yt-{vid}.jpg",
        })
    # Store thumbnails locally so visitors never load them from YouTube.
    media_dir = ROOT / "img" / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    keep = set()
    for v in vids:
        path = ROOT / v["thumb"]
        keep.add(path.name)
        if not path.exists():
            try:
                path.write_bytes(get(f"https://i.ytimg.com/vi/{v['id']}/mqdefault.jpg", binary=True))
            except Exception as exc:
                print(f"[warn] thumbnail {v['id']}: {exc}", file=sys.stderr)
                v["thumb"] = ""
    for old in media_dir.glob("yt-*.jpg"):
        if old.name not in keep:
            old.unlink()
    return vids


# ---------------------------------------------------------------- Dev.to
def fetch_devto():
    arts = get_json(f"https://dev.to/api/articles?username={DEVTO_USER}&per_page=6")
    return [{
        "title": a["title"],
        "description": a.get("description") or "",
        "url": a["url"],
        "published": a.get("published_at") or a.get("published_timestamp"),
        "minutes": a.get("reading_time_minutes"),
        "tags": a.get("tag_list") if isinstance(a.get("tag_list"), list) else [t.strip() for t in (a.get("tag_list") or "").split(",") if t.strip()],
    } for a in arts]


# ---------------------------------------------------------------- Reddit (optional)
def fetch_reddit():
    if not REDDIT_USER:
        return []
    xml = get(f"https://www.reddit.com/user/{REDDIT_USER}/submitted.rss")
    ns = {"a": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(xml)
    posts = []
    for e in root.findall("a:entry", ns)[:6]:
        link = e.find("a:link", ns).attrib.get("href")
        cat = e.find("a:category", ns)
        posts.append({
            "title": e.find("a:title", ns).text,
            "url": link,
            "published": e.find("a:updated", ns).text,
            "subreddit": cat.attrib.get("label") if cat is not None else "",
        })
    return posts


# ---------------------------------------------------------------- write
def write_if_changed(path, payload):
    """Write JSON only when the content (ignoring the timestamp) changed, so we don't make noise commits."""
    path.parent.mkdir(parents=True, exist_ok=True)
    old = {}
    if path.exists():
        try:
            old = json.loads(path.read_text())
        except Exception:
            old = {}
    a = {k: v for k, v in old.items() if k != "updated"}
    b = {k: v for k, v in payload.items() if k != "updated"}
    if a == b and old:
        print(f"unchanged: {path.relative_to(ROOT)}")
        return
    payload["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote: {path.relative_to(ROOT)}")


def main():
    data_dir = ROOT / "data"
    old_gh = {}
    old_media = {}
    try:
        old_gh = json.loads((data_dir / "github.json").read_text())
    except Exception:
        pass
    try:
        old_media = json.loads((data_dir / "media.json").read_text())
    except Exception:
        pass

    # If a source fails, keep what we had instead of blanking the page.
    gh_data = safe("github", fetch_github, None)
    if gh_data is None:
        gh_data = {k: v for k, v in old_gh.items() if k != "updated"} or {"user": GITHUB_USER, "repos": [], "languages": [], "activity": {}, "repo_count": 0, "commits_90d": 0}
    yt = safe("youtube", fetch_youtube, None)
    dv = safe("devto", fetch_devto, None)
    rd = safe("reddit", fetch_reddit, None)
    media = {
        "youtube": yt if yt is not None else old_media.get("youtube", []),
        "devto": dv if dv is not None else old_media.get("devto", []),
        "reddit": rd if rd is not None else old_media.get("reddit", []),
        "reddit_user": REDDIT_USER,
    }
    write_if_changed(data_dir / "github.json", gh_data)
    write_if_changed(data_dir / "media.json", media)


if __name__ == "__main__":
    main()
