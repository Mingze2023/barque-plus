"""
Collects Bellevue High School's lunch and breakfast menus from Health-e Pro
and saves them to data/menus.json for Barque+ (the Miscellaneous section).

The Health-e Pro menu pages build their calendars with JavaScript from a JSON
API, so this reads that same API instead of the page:

  /api/organizations/{org}/sites/{site}/menus/
        -> the school's menus, each with the months that are published
  /api/organizations/{org}/menus/{menu}/year/{YYYY}/month/{MM}/date_overwrites
        -> one month of one menu: a list of days, each with its foods
           (grouped under categories) or a "day off" note

Run by the daily GitHub Action. Months that can't be read keep their old
copy, so a bad day on Health-e Pro never empties the calendars.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date, datetime, timezone

API = "https://menus.healthepro.com/api"
WEB = "https://menus.healthepro.com"
ORGANIZATION = 99     # Bellevue School District
SITE = 766            # Bellevue High School
MENUS = {
    "lunch": {"id": 131448, "title": "Lunch"},
    "breakfast": {"id": 131445, "title": "Breakfast"},
}
KEEP_MONTHS_BACK = 12    # forget months older than this
SCAN_MONTHS_AHEAD = 12   # if the published-month list can't be read, try this far ahead
DELAY_SECONDS = 0.4
HEADERS = {
    "User-Agent": "BarquePlusScraper/1.0 (student newspaper project)",
    "Accept": "application/json",
}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "menus.json")


def log(*parts):
    print(*parts, flush=True)


def get_json(path):
    request = urllib.request.Request(API + path, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    time.sleep(DELAY_SECONDS)
    return data


def month_key(year, month):
    return f"{year:04d}-{month:02d}"


def add_months(year, month, n):
    total = year * 12 + (month - 1) + n
    return total // 12, total % 12 + 1


def read_month_name(value):
    """'2026-11', '2026-11-01', '11/2026', {'year':2026,'month':11} ... -> (2026, 11)"""
    if isinstance(value, dict):
        try:
            return int(value.get("year")), int(value.get("month"))
        except (TypeError, ValueError):
            return None
    text = str(value)
    m = re.search(r"(\d{4})\D(\d{1,2})", text)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"(\d{1,2})\D(\d{4})", text)
    if m:
        return int(m.group(2)), int(m.group(1))
    return None


def published_months():
    """{menu_id: [(year, month), ...]} from the school's menu list ({} if unreadable)."""
    try:
        payload = get_json(f"/organizations/{ORGANIZATION}/sites/{SITE}/menus/")
    except Exception as error:
        log(f"  Couldn't read the menu list ({error}).")
        return {}
    items = payload.get("data", []) if isinstance(payload, dict) else payload
    months = {}
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or "id" not in item:
            continue
        found = [read_month_name(v) for v in (item.get("published_months") or [])]
        months[int(item["id"])] = sorted({f for f in found if f and 1 <= f[1] <= 12})
    return months


def clean(text):
    return " ".join(str(text or "").split())


def day_off_reason(days_off):
    """Health-e Pro's days_off can be a dict, a list of dicts, or a bool."""
    if not days_off:
        return None
    if isinstance(days_off, dict):
        description = clean(days_off.get("description") or days_off.get("name"))
        if days_off.get("status") or description:
            return description or "No school"
        return None
    if isinstance(days_off, list):
        for entry in days_off:
            reason = day_off_reason(entry)
            if reason:
                return reason
        return None
    if days_off is True:
        return "No school"
    return None


def read_day(entry):
    """One day from date_overwrites -> (YYYY-MM-DD, {...}) or None."""
    day = str(entry.get("day") or "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return None
    setting = entry.get("setting")
    if isinstance(setting, str):
        try:
            setting = json.loads(setting) if setting.strip() else {}
        except json.JSONDecodeError:
            setting = {}
    if not isinstance(setting, dict):
        setting = {}

    off = day_off_reason(setting.get("days_off"))
    if off:
        return day, {"off": off}

    items = [i for i in (setting.get("current_display") or []) if isinstance(i, dict)]
    items.sort(key=lambda i: i.get("weight") or 0)
    sections, notes, current = [], [], None
    for item in items:
        name = clean(item.get("name"))
        kind = clean(item.get("type")).lower()
        if not name:
            continue
        if kind == "category":
            current = {"title": name, "items": []}
            sections.append(current)
        elif kind == "text":
            if name not in notes:
                notes.append(name)
        else:
            if current is None:
                current = {"title": "", "items": []}
                sections.append(current)
            if name not in current["items"]:
                current["items"].append(name)
    sections = [s for s in sections if s["items"]]
    if not sections and not notes:
        return None
    result = {"sections": sections}
    if notes:
        result["notes"] = notes
    return day, result


def read_month(menu_id, year, month):
    payload = get_json(f"/organizations/{ORGANIZATION}/menus/{menu_id}/year/{year:04d}/month/{month:02d}/date_overwrites")
    entries = payload.get("data", []) if isinstance(payload, dict) else payload
    days = {}
    for entry in entries if isinstance(entries, list) else []:
        if isinstance(entry, dict):
            parsed = read_day(entry)
            if parsed:
                days[parsed[0]] = parsed[1]
    return dict(sorted(days.items()))


def load_previous():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def main(today=None):
    today = today or date.today()
    previous = load_previous().get("menus", {})
    oldest = month_key(*add_months(today.year, today.month, -KEEP_MONTHS_BACK))
    published = published_months()

    result = {}
    for key, info in MENUS.items():
        menu_id = info["id"]
        months = dict(previous.get(key, {}).get("months", {}))
        targets = published.get(menu_id)
        scanning = not targets
        if scanning:
            # No published-month list: start at the school year's August and look ahead.
            start_year = today.year if today.month >= 8 else today.year - 1
            targets = [add_months(start_year, 8, n) for n in range(0, 12 + SCAN_MONTHS_AHEAD)]
            targets = [t for t in targets if month_key(*t) <= month_key(*add_months(today.year, today.month, SCAN_MONTHS_AHEAD))]
        log(f"{info['title']}: checking {len(targets)} month(s){' (scanning)' if scanning else ''}")

        empty_in_a_row = 0
        for year, month in targets:
            mk = month_key(year, month)
            if mk < oldest:
                continue
            try:
                days = read_month(menu_id, year, month)
            except Exception as error:
                log(f"  {mk}: couldn't read ({error}); keeping the old copy" if mk in months else f"  {mk}: couldn't read ({error})")
                continue
            if days:
                months[mk] = days
                empty_in_a_row = 0
                log(f"  {mk}: {len(days)} days")
            else:
                months.pop(mk, None)
                empty_in_a_row += 1
                log(f"  {mk}: nothing published")
                if scanning and mk > month_key(today.year, today.month) and empty_in_a_row >= 2:
                    break

        months = {mk: d for mk, d in sorted(months.items()) if mk >= oldest}
        result[key] = {
            "title": info["title"],
            "page": f"{WEB}/organizations/{ORGANIZATION}/sites/{SITE}/menus/{menu_id}",
            "months": months,
        }

    if result == previous:
        log("No menu changes.")
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "menus": result,
        }, f, indent=1, ensure_ascii=False)
    log(f"Saved {sum(len(m['months']) for m in result.values())} month(s) of menus.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
