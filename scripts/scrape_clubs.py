"""
Reads the club table on the Bellevue High School website and saves it to
data/clubs.json for Barque+ (Club Information > "Add Clubs from School Website").

The table is the one under "ASB Membership required to participate in Clubs at
Bellevue High School" with the columns CLUB, Advisor, Meeting Day, Location, Time.

Run by the daily GitHub Action. If the page can't be read, or the table isn't
found, the old data/clubs.json is left alone (and the website falls back to its
built-in list in js/club-list.js).
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

from bs4 import BeautifulSoup

PAGE = "https://bellevuehigh.bsd405.org/student-life/clubs-and-activities"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "clubs.json")
HEADERS = {"User-Agent": "BarquePlusScraper/1.0 (student newspaper project)"}

# Which of our fields each column header goes into
COLUMNS = {
    "club": "name",
    "advisor": "advisor",
    "meeting day": "meetingDay",
    "day": "meetingDay",
    "location": "room",
    "room": "room",
    "time": "meetingTime",
}


def clean(text):
    return " ".join(text.split())


def field_for(header):
    header = clean(header).lower().rstrip(":")
    for key, field in COLUMNS.items():
        if header == key or header.startswith(key):
            return field
    return None


def read_clubs(html):
    soup = BeautifulSoup(html, "html.parser")
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue
        headers = [field_for(c.get_text(" ")) for c in rows[0].find_all(["th", "td"])]
        if "name" not in headers or "advisor" not in headers:
            continue   # not the club table
        clubs = []
        for row in rows[1:]:
            cells = [clean(c.get_text(" ")) for c in row.find_all(["th", "td"])]
            club = {"name": "", "advisor": "", "meetingDay": "", "room": "", "meetingTime": ""}
            for field, value in zip(headers, cells):
                if field:
                    club[field] = value[:200]
            club["name"] = club["name"][:100]
            if club["name"]:
                clubs.append(club)
        if clubs:
            return clubs
    return []


def main():
    try:
        request = urllib.request.Request(PAGE, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8", errors="replace")
    except Exception as error:
        print(f"Couldn't read the clubs page ({error}). Keeping the old list.")
        return 0

    clubs = read_clubs(html)
    if not clubs:
        print("Couldn't find the club table on the page. Keeping the old list.")
        return 0

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("clubs")
    if old == clubs:
        print(f"Club list unchanged ({len(clubs)} clubs).")
        return 0

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "source": PAGE,
            "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "clubs": clubs,
        }, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(clubs)} clubs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
