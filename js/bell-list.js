// ============================================================
// Bellevue High School bell schedules (built in)
//
// Copied from https://bellevuehigh.bsd405.org/our-school/bell-schedule
// The daily GitHub Action (scripts/scrape_bells.py) re-reads that page and
// saves data/bells.json; the Schedules/Map page uses that file when it
// exists, and this built-in copy when it doesn't.
//
// Times are written the way the school writes them (no a.m./p.m.):
// 7:00-11:59 are morning, 12:xx is noon, 1:00-6:59 are afternoon.
// days: 1 = Monday ... 5 = Friday
// ============================================================
export const BELL_PAGE = 'https://bellevuehigh.bsd405.org/our-school/bell-schedule';

export const BELL_SCHEDULES = [
  {
    name: 'Monday, Tuesday, Friday',
    days: [1, 2, 5],
    periods: [
      ['Zero', '7:00', '7:50'],
      ['1st', '8:00', '8:50'],
      ['2nd', '8:55', '9:50'],
      ['3rd', '9:55', '10:45'],
      ['4th', '10:50', '11:40'],
      ['5a', '11:45', '12:35'],
      ['1st Lunch', '11:40', '12:15'],
      ['2nd Lunch', '12:40', '1:10'],
      ['5b', '12:20', '1:10'],
      ['6th', '1:15', '2:05'],
      ['7th', '2:10', '3:00'],
      ['Tutorial', '3:00', '3:30'],
      ['8th*', '3:35', '4:35'],
    ],
  },
  {
    name: 'Wednesday',
    days: [3],
    periods: [
      ['Zero', '7:00', '7:50'],
      ['2nd', '8:00', '9:30'],
      ['4th', '9:35', '11:05'],
      ['6th', '11:10', '12:40'],
      ['Break', '12:45', '12:55'],
    ],
  },
  {
    name: 'Thursday',
    days: [4],
    periods: [
      ['Zero', '7:00', '7:50'],
      ['1st', '8:00', '9:30'],
      ['3rd', '9:40', '11:10'],
      ['5a', '11:20', '12:50'],
      ['1st Lunch', '11:10', '11:45'],
      ['2nd Lunch', '12:50', '1:25'],
      ['5b', '11:50', '1:20'],
      ['7th', '1:30', '3:00'],
      ['Tutorial', '3:00', '3:30'],
      ['8th*', '3:35', '4:35'],
    ],
  },
];

export const BELL_NOTE = '* Period 8 is offered to students enrolled in selected WANIC Skills Center courses.';
