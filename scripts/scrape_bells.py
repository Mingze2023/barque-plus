"""
Reads the bell schedules on the Bellevue High School website and saves them
to data/bells.json for Barque+ (the Miscellaneous section).

The page has one table per schedule (columns Period, Start, End), each named
by a tab or heading such as "Monday, Tuesday, Friday", "Wednesday" or
"Thursday".

Run by the daily GitHub Action. If the page can't be read, or the tables
aren't found, the old data/bells.json is left alone (and the website falls
back to its built-in copy in js/bell-list.js).
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

from bs4 import BeautifulSoup

PAGE = "https://bellevuehigh.bsd405.org/our-school/bell-schedule"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "bells.json")
HEADERS = {"User-Agent": "BarquePlusScraper/1.0 (student newspaper project)"}
DAY_NAMES = {"monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5}
TIME = re.compile(r"^\d{1,2}:\d{2}$")


def clean(text):
    return " ".join(str(text or "").split())


def days_in(name):
    lower = name.lower()
    return [n for day, n in DAY_NAMES.items() if day in lower]


def name_for(table, soup):
    """The tab label or heading that names this table."""
    # 1. A tab: some parent has an id, and a link points to "#that-id"
    for parent in table.parents:
        pid = parent.get("id") if hasattr(parent, "get") else None
        if pid:
            link = soup.find("a", href="#" + pid) or soup.find(attrs={"aria-controls": pid})
            if link and days_in(clean(link.get_text(" "))):
                return clean(link.get_text(" "))
    # 2. A heading or caption before it that names a day
    caption = table.find("caption")
    if caption and days_in(clean(caption.get_text(" "))):
        return clean(caption.get_text(" "))
    for previous in table.find_all_previous(["h1", "h2", "h3", "h4", "h5", "h6", "strong", "p"], limit=12):
        text = clean(previous.get_text(" "))
        if days_in(text) and len(text) <= 60:
            return text
    return ""


def read_schedules(html):
    soup = BeautifulSoup(html, "html.parser")
    schedules = []
    for table in soup.find_all("table"):
        rows = [[clean(c.get_text(" ")) for c in tr.find_all(["th", "td"])] for tr in table.find_all("tr")]
        rows = [r for r in rows if any(r)]
        if not rows:
            continue
        header = [c.lower() for c in rows[0]]
        if not ("start" in " ".join(header) and "end" in " ".join(header)):
            continue
        periods = []
        for r in rows[1:]:
            if len(r) >= 3 and r[0] and TIME.match(r[1]) and TIME.match(r[2]):
                start = r[1].lstrip("0") if not r[1].startswith("0:") else r[1]
                end = r[2].lstrip("0") if not r[2].startswith("0:") else r[2]
                periods.append([r[0][:40], start, end])
        if not periods:
            continue
        name = name_for(table, soup)
        schedules.append({"name": name, "days": days_in(name), "periods": periods})
    # Every schedule needs a name that says which days it's for
    if len(schedules) < 2 or any(not s["days"] for s in schedules):
        return []
    return schedules


def main():
    try:
        request = urllib.request.Request(PAGE, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8", errors="replace")
    except Exception as error:
        print(f"Couldn't read the bell schedule page ({error}). Keeping the old copy.")
        return 0

    schedules = read_schedules(html)
    if not schedules:
        print("Couldn't find the bell schedule tables on the page. Keeping the old copy.")
        return 0

    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("schedules")
    if old == schedules:
        print(f"Bell schedules unchanged ({len(schedules)} schedules).")
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "source": PAGE,
            "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "schedules": schedules,
        }, f, indent=1, ensure_ascii=False)
    print(f"Saved {len(schedules)} bell schedules: " + "; ".join(s["name"] for s in schedules))
    return 0


if __name__ == "__main__":
    sys.exit(main())
