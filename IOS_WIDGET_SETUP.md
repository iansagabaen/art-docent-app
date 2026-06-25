# iOS Widget Setup Guide

Your Art Docent App now generates a static `next-class.json` file that updates every time you push to GitHub and Netlify rebuilds.

## Endpoint

```
https://eloquent-horse-a1ede7.netlify.app/next-class.json
```

## JSON Response Format

```json
{
  "nextClass": {
    "date": "Jan 13",
    "time": "1:30 PM",
    "lesson": "Drawing Still Life",
    "teacher": "Katheryn McGinnis",
    "school": "Covington",
    "grade": "6",
    "lead": "Katheryn McGinnis",
    "assist": "Ian Sagabaen",
    "assist2": ""
  },
  "generatedAt": "2026-06-25T18:23:50.812Z",
  "upcoming": [
    {
      "date": "Jan 13",
      "lesson": "Drawing Still Life",
      "teacher": "Katheryn McGinnis"
    }
  ]
}
```

## iOS Shortcut Setup

### Option A: Simple Widget (Ask Siri / Home Screen)

1. Open **Shortcuts** app on iPhone
2. Tap **+** to create new shortcut
3. Search for and add these actions in order:

```
1. "Get contents of URL" → https://eloquent-horse-a1ede7.netlify.app/next-class.json
2. "Get Dictionary Value" → nextClass (from the response)
3. "Ask for [Dictionary Value]" → Show: lesson, date, teacher, school
   - or create a custom formatted text block
4. "Show Result" → Display the class details
```

### Option B: Home Screen Widget (Advanced)

For a Home Screen widget, you'll need to use a third-party shortcut widget app like:
- **WidgetKit** (if available on iOS 17+)
- **Shortcuts Widget** by Apple
- **Cardhop** or similar

Or follow these steps in Shortcuts:

1. Create a shortcut (above)
2. Open **Home Screen** → Edit
3. Tap **+** to add widget
4. Search **Shortcuts** 
5. Select your shortcut → Done

The widget will show the shortcut button; tap it to see class details.

### Option C: Maximize Widget (iOS 18+)

If using iOS 18+, you can:
1. Create the shortcut above
2. Long-press Home Screen
3. Select **Add Widget**
4. Choose **Shortcuts**
5. Select your shortcut
6. Drag to expand to larger widget size

## Testing the Endpoint

In Safari on your iPhone:
```
https://eloquent-horse-a1ede7.netlify.app/next-class.json
```

You should see JSON with your next class details (or `"nextClass": null` if no upcoming classes).

## How It Updates

Every time you:
1. Push to GitHub (`git push origin main`)
2. Netlify auto-builds your site (takes ~1-2 minutes)
3. The `generate-next-class.js` script runs
4. `next-class.json` is updated with the latest class data
5. Your iOS Shortcut fetches the fresh data

**No manual intervention needed!** Just push your changes and the widget stays current.

## Troubleshooting

**Shortcut returns nothing/error:**
- Test the endpoint in Safari first
- Check that the URL is exactly: `https://eloquent-horse-a1ede7.netlify.app/next-class.json`
- Wait 1-2 minutes after pushing (Netlify deploy time)

**Widget shows old data:**
- Force refresh: Swipe down in Shortcuts app
- Netlify might still be building (check the Netlify dashboard)

**No upcoming classes:**
- The JSON will show `"nextClass": null`
- Check your Google Sheet — add future class dates in the `Date` column
