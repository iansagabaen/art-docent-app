# Adding Curriculum Links

The app now supports linking to your teaching materials. Here's how to add them:

## Setup

1. Open `src/App.jsx`
2. Find the `CURRICULUM_LINKS` object (near the top, after the imports)
3. Add your URLs following the format below

## Qualified Lessons (3+ times)

For lessons you're qualified to lead, add links to your Google Docs:

```javascript
const CURRICULUM_LINKS = {
  'Cityscape: A Lesson in Architecture': 'https://docs.google.com/document/d/YOUR-GOOGLE-DOC-ID/edit',
  'Photography': 'https://docs.google.com/document/d/YOUR-GOOGLE-DOC-ID/edit',
  'Art That Speaks': 'https://docs.google.com/document/d/YOUR-GOOGLE-DOC-ID/edit',
  'Tidal Zone Prints': 'https://docs.google.com/document/d/YOUR-GOOGLE-DOC-ID/edit',
  // ... etc
}
```

### How to get your Google Doc ID:
1. Open your Google Doc
2. Look at the URL: `https://docs.google.com/document/d/YOUR-GOOGLE-DOC-ID/edit`
3. Copy the `YOUR-GOOGLE-DOC-ID` part
4. Paste it into the CURRICULUM_LINKS object

**Make sure your Google Doc is shared with "Link sharing enabled" so anyone with the link can view it.**

## Potentially Qualified & Single Experience Lessons (1-2 times)

For lessons with PDFs, upload them to a cloud service and add the URLs:

### Option 1: Google Drive
1. Upload your PDF to Google Drive
2. Right-click → Share → Change to "Anyone with the link"
3. Copy the share link (should end in `/view`)
4. Paste into CURRICULUM_LINKS:
```javascript
'Clay Wickiups': 'https://drive.google.com/file/d/FILE-ID/view',
```

### Option 2: GitHub (Free, permanent)
1. Create a `pdfs/` folder in the repo
2. Upload PDFs there
3. Use the raw GitHub URL:
```javascript
'Clay Wickiups': 'https://raw.githubusercontent.com/iansagabaen/art-docent-app/main/pdfs/clay-wickiups.pdf',
```

### Option 3: Netlify (Easiest)
1. Create a `public/pdfs/` folder in the project
2. Add your PDFs there
3. Reference them as:
```javascript
'Clay Wickiups': '/pdfs/clay-wickiups.pdf',
```

## Example Complete Setup

```javascript
const CURRICULUM_LINKS = {
  // Qualified - Google Docs
  'Cityscape: A Lesson in Architecture': 'https://docs.google.com/document/d/1a2b3c4d5e6f/edit',
  'Photography': 'https://docs.google.com/document/d/2x3y4z5a6b7/edit',
  'Art That Speaks': 'https://docs.google.com/document/d/7m8n9o0p1q2/edit',
  'Tidal Zone Prints': 'https://docs.google.com/document/d/3c4d5e6f7g8/edit',

  // Potentially Qualified/Single - PDFs (via Google Drive)
  'Clay Wickiups': 'https://drive.google.com/file/d/1ABC2DEF3GHI/view',
  'Mixed Moods': 'https://drive.google.com/file/d/2XYZ3ABC4DEF/view',
  
  // Or via local (Netlify/public folder)
  'Drawing Still Life': '/pdfs/drawing-still-life.pdf',
}
```

## Testing

After adding URLs, you can test locally:
```bash
npm run dev
# Visit http://localhost:5173?testDate=2026-01-01
```

Click the **📖 Curriculum** or **📄 PDF** links to verify they work.

## Deployment

When you deploy to Netlify, the curriculum links will automatically work:
- Google Docs links work as-is
- Google Drive PDFs work as-is
- Local `/pdfs/` files are served from the `public/` folder
