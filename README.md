# Art Docent Schedule & Stats

A mobile-first PWA for tracking art docent schedules and teaching experience.

## What it does

- **Upcoming classes**: Shows your next scheduled art docent classes
- **Your stats**: Tracks how many times you've led or assisted each lesson
- **Qualification tracking**: Automatically calculates which lessons you're qualified to lead (3+ experiences)
- **Mobile app**: Install as a home screen app on iPhone or Android

## Data source

The app pulls live data from a Google Sheet. You maintain the spreadsheet, the app automatically reflects your latest classes.

**Columns used:**
- Date: Class date
- Lesson: Lesson name
- Lead: Who's leading the class
- Assist: Primary assistant
- Assist 2: Secondary assistant

## How to update your classes

1. Open the Google Sheet
2. Add a new row with your class info
3. The app updates automatically next time you open it

## How to install on your phone

**iPhone:**
1. Open the app in Safari
2. Tap the Share icon → "Add to Home Screen"
3. Name it "Art Docent" → Add

**Android:**
1. Open the app in Chrome
2. Tap the menu (three dots) → "Install app"
3. Follow prompts

## Deployment

This app is deployed on Netlify and connects to the GitHub repo. When you push changes to GitHub, Netlify automatically builds and deploys.

## Future Features

These are ideas for future updates:

- [ ] Click into a lesson to see full teaching details
- [ ] Add PDF link for teaching materials (stored in Google Drive)
- [ ] Add YouTube learning link for each lesson
- [ ] Filter by lesson type, school, or grade level
- [ ] Search by date or lesson name
- [ ] Student roster per class
- [ ] Attendance tracking
- [ ] Notes per class (what worked, what didn't)

## How to edit the code

The app is built with React and Vite. If you want to make changes:

1. Edit the source files in `src/`
2. Test locally with `npm run dev`
3. Push to GitHub when ready
4. Netlify auto-deploys

If you're not comfortable editing code, you can always ask Claude to make updates for you using GitHub + Claude Desktop + Claude Code automation.

## Tech stack

- React 18 (UI)
- Vite (build tool)
- Netlify (hosting)
- PWA (home screen app)
- Google Sheets CSV (data source)
