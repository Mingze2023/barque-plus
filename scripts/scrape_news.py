"""
Barque+ news scraper
====================
Collects articles from the Barque's website and saves them to
data/news.json, which the News section of Barque+ loads.

GitHub runs this automatically once a day (see
.github/workflows/scrape-and-publish.yml). You can also start it from the
GitHub website: Actions tab > "Scrape news and publish site" > Run workflow.

How it works
1. Finds article links from the site's RSS feed and its blog listing pages.
2. Opens each new article and pulls out the title, author, date, images,
   captions and text.
3. Keeps articles found on earlier runs, and remembers when each article was
   first found ("firstSeen"), which powers the "new" label.

Settings can be changed with environment variables:
  BARQUE_SITE   the website to scrape (default https://www.thebarquebhs.com)
  REFRESH_ALL   set to 1 to re-download every article, not just new ones
"""

import json
import os
import re
import sys
import time
import hashlib
import urllib.request
import urllib.error
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse, unquote
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup

SITE = os.environ.get("BARQUE_SITE", "https://www.thebarquebhs.com").rstrip("/")
REFRESH_ALL = os.environ.get("REFRESH_ALL") == "1"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "data", "news.json")
MAX_LISTING_PAGES = 30      # stop looking through /blog/page/N after this many
DELAY_SECONDS = 0.5         # pause between requests, to be polite to the site
HEADERS = {"User-Agent": "BarquePlusScraper/1.0 (student newspaper project)"}


# ---------------------------------------------------------------- helpers
def log(*parts):
    print(*parts, flush=True)


def fetch(url):
    """Downloads a page. Returns its text, or None if it failed."""
    try:
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        log(f"  could not download {url}: {error}")
        return None
    finally:
        time.sleep(DELAY_SECONDS)


def clean_text(text):
    return re.sub(r"\s+", " ", text or "").strip()


def to_iso(value):
    """Turns many date formats into '2026-11-13T08:00:00+00:00', or None."""
    if not value:
        return None
    value = value.strip()
    for pattern in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%d %b %Y"):
        try:
            # Noon, so the date doesn't shift to the day before in Pacific time
            return datetime.strptime(value, pattern).replace(hour=12, tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        pass
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if len(value) == 10:  # just a date like 2026-03-01: use noon (see above)
            parsed = parsed.replace(hour=12)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def article_id(url):
    """A short, safe ID for an article, made from the end of its address."""
    slug = unquote(urlparse(url).path.rstrip("/").split("/")[-1]).lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", slug).strip("-")[:90]
    return slug or hashlib.sha1(url.encode()).hexdigest()[:16]


def clean_image(url):
    """Wix serves small blurry previews; this asks for the full image instead."""
    if not url:
        return None
    if "static.wixstatic.com/media/" in url and "/v1/" in url:
        url = url.split("/v1/")[0]
    return url


def is_article_link(url):
    path = urlparse(url).path
    return urlparse(url).netloc in ("", urlparse(SITE).netloc) and "/post/" in path


# ------------------------------------------------- 1. finding article links
def links_from_rss():
    """Wix blogs publish a feed at /blog-feed.xml listing recent articles."""
    found = {}
    text = fetch(SITE + "/blog-feed.xml")
    if not text:
        return found
    try:
        root = ET.fromstring(text.encode("utf-8"))
    except ET.ParseError as error:
        log(f"  RSS feed could not be read: {error}")
        return found

    namespaces = {"dc": "http://purl.org/dc/elements/1.1/"}
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        if not link:
            continue
        enclosure = item.find("enclosure")
        description_html = item.findtext("description") or ""
        found[link] = {
            "title": clean_text(item.findtext("title")),
            "author": clean_text(item.findtext("dc:creator", namespaces=namespaces)),
            "date": to_iso(item.findtext("pubDate")),
            "image": clean_image(enclosure.get("url") if enclosure is not None else None),
            "summary": clean_text(BeautifulSoup(description_html, "html.parser").get_text(" ")),
        }
    log(f"  RSS feed listed {len(found)} articles")
    return found


def links_from_listing_pages():
    """Looks through /blog, /blog/page/2, ... for links to articles."""
    found = set()
    for page in range(1, MAX_LISTING_PAGES + 1):
        url = SITE + "/blog" if page == 1 else f"{SITE}/blog/page/{page}"
        html = fetch(url)
        if not html:
            break
        soup = BeautifulSoup(html, "html.parser")
        before = len(found)
        for a in soup.find_all("a", href=True):
            link = urljoin(SITE + "/", a["href"]).split("?")[0].split("#")[0]
            if is_article_link(link):
                found.add(link)
        if len(found) == before:   # this page had nothing new: we've reached the end
            break
    log(f"  blog pages listed {len(found)} articles")
    return found


# --------------------------------------------------- 2. reading one article
def find_json_ld(soup):
    """Many sites describe the article in a hidden JSON block (schema.org)."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if isinstance(item, dict) and item.get("@type") in ("BlogPosting", "NewsArticle", "Article"):
                return item
    return {}


def meta(soup, *names):
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def image_src(img):
    for attribute in ("data-src", "data-pin-media", "src"):
        value = img.get(attribute)
        if value and not value.startswith("data:"):
            return value
    srcset = img.get("srcset")
    if srcset:
        return srcset.split(",")[-1].strip().split(" ")[0]
    return None


def visible_text(soup, *selectors, attribute=None):
    """Text (or an attribute) of the first element matching any selector."""
    for selector in selectors:
        found = soup.select_one(selector)
        if found:
            value = found.get(attribute) if attribute else found.get_text(" ")
            if value and clean_text(value):
                return clean_text(value)
    return None


def find_body_container(soup):
    """The part of the page that holds the article text."""
    selectors = [
        '[data-hook="post-description"]',
        '[data-hook="post-content"]',
        '[data-id="content-viewer"]',
        '[data-id="rich-content-viewer"]',
        "article",
        "main",
    ]
    for selector in selectors:
        found = soup.select_one(selector)
        if found and len(found.find_all("p")) >= 1:
            return found
    # Last resort: the element containing the most paragraphs directly
    best, best_count = None, 0
    for element in soup.find_all(["div", "section"]):
        count = len(element.find_all("p", recursive=False))
        if count > best_count:
            best, best_count = element, count
    return best


def read_body(container, page_url):
    """Turns the article into a list of blocks: paragraphs, headings, images."""
    blocks, seen_text, seen_images = [], set(), set()
    if container is None:
        return blocks

    for element in container.find_all(["p", "h1", "h2", "h3", "h4", "li", "blockquote", "figure", "img"]):
        # ----- Images -----
        if element.name in ("figure", "img"):
            if element.name == "img" and element.find_parent("figure"):
                continue  # handled together with its <figure> (so we get the caption)
            img = element if element.name == "img" else element.find("img")
            if not img:
                continue
            figure = img.find_parent("figure")
            src = clean_image(urljoin(page_url, image_src(img) or ""))
            if not src or src in seen_images or src == page_url:
                continue
            seen_images.add(src)
            caption = None
            if figure is not None:
                caption_tag = figure.find("figcaption") or figure.find(attrs={"data-hook": "imageViewerCaption"})
                caption = clean_text(caption_tag.get_text(" ")) if caption_tag else None
            blocks.append({"type": "image", "src": src, "caption": caption or None})
            continue

        # ----- Text -----
        if element.find_parent("figure"):
            continue  # captions are handled with their image
        if element.name == "p" and element.find_parent(["blockquote", "li"]):
            continue  # the whole quote or list item is taken at once
        text = clean_text(element.get_text(" "))
        if not text or text in seen_text:
            continue
        seen_text.add(text)
        kind = "heading" if element.name in ("h1", "h2", "h3", "h4") else "quote" if element.name == "blockquote" else "paragraph"
        blocks.append({"type": kind, "text": text})
    return blocks


def read_article(url, hints):
    """Downloads one article page and pulls out everything we need."""
    html = fetch(url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    ld = find_json_ld(soup)

    author = ld.get("author")
    if isinstance(author, list):
        author = author[0] if author else None
    if isinstance(author, dict):
        author = author.get("name")

    image = ld.get("image")
    if isinstance(image, list):
        image = image[0] if image else None
    if isinstance(image, dict):
        image = image.get("url")

    h1 = soup.find("h1")
    title = (clean_text(ld.get("headline")) or clean_text(meta(soup, "og:title"))
             or (clean_text(h1.get_text(" ")) if h1 else "") or hints.get("title") or "Untitled")
    body = read_body(find_body_container(soup), url)

    # Don't repeat the title as the first paragraph
    if body and body[0].get("text") == title:
        body = body[1:]
    if not any(block["type"] == "paragraph" for block in body) and hints.get("summary"):
        body.append({"type": "paragraph", "text": hints["summary"]})

    paragraphs = [block["text"] for block in body if block["type"] == "paragraph"]
    return {
        "id": article_id(url),
        "url": url,
        "title": title,
        "author": (clean_text(author) or clean_text(meta(soup, "author", "article:author")) or hints.get("author")
                   or visible_text(soup, '[data-hook="user-name"]', '[rel="author"]', ".author") or "The Barque"),
        "date": (to_iso(ld.get("datePublished")) or to_iso(meta(soup, "article:published_time")) or hints.get("date")
                 or to_iso(visible_text(soup, "time[datetime]", attribute="datetime"))
                 or to_iso(visible_text(soup, '[data-hook="time-ago"]', attribute="title"))
                 or to_iso(visible_text(soup, '[data-hook="time-ago"]'))),
        "image": clean_image(image) or clean_image(meta(soup, "og:image")) or hints.get("image")
                 or next((block["src"] for block in body if block["type"] == "image"), None),
        "excerpt": " ".join(paragraphs)[:400] or hints.get("summary", "")[:400],
        "body": body,
    }


# ------------------------------------------------------------------ 3. run
def load_previous():
    try:
        with open(OUTPUT, encoding="utf-8") as file:
            data = json.load(file)
        return {a["id"]: a for a in data.get("articles", []) if not a.get("sample")}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def main():
    log(f"Scraping {SITE}")
    now = datetime.now(timezone.utc).isoformat()
    previous = load_previous()
    log(f"  {len(previous)} articles saved from earlier runs")

    rss = links_from_rss()
    urls = set(rss) | links_from_listing_pages()
    if not urls and not previous:
        log("ERROR: found no articles at all. The site may have changed or blocked the scraper.")
        sys.exit(1)

    articles = dict(previous)
    added = updated = failed = 0
    for url in sorted(urls):
        key = article_id(url)
        old = previous.get(key)
        if old and old.get("body") and not REFRESH_ALL:
            continue  # already have this one
        log(f"  reading {url}")
        article = read_article(url, rss.get(url, {}))
        if not article:
            failed += 1
            continue
        article["firstSeen"] = old["firstSeen"] if old and old.get("firstSeen") else now
        if not article["date"]:
            article["date"] = article["firstSeen"]
        articles[key] = article
        if old:
            updated += 1
        else:
            added += 1

    ordered = sorted(articles.values(), key=lambda a: a.get("date") or "", reverse=True)
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as file:
        json.dump({"source": SITE, "updated": now, "articles": ordered}, file, ensure_ascii=False, indent=1)

    log(f"Done: {len(ordered)} articles total ({added} new, {updated} refreshed, {failed} failed).")


if __name__ == "__main__":
    main()
