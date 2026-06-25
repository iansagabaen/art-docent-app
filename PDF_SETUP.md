# Adding PDF Curricula

Your PDF folder is ready at `public/pdfs/`. Here's how to add your lesson PDFs:

## Quick Setup

1. **Prepare your PDFs** with the names listed below
2. **Drop them into:** `/Users/ian/my-projects/projects/art-docent-app/public/pdfs/`
3. **Test locally:** `npm run dev` and check that links work
4. **Deploy:** Push to GitHub, Netlify auto-deploys

## PDF Naming Convention

Use these exact filenames (PDFs should match your lesson names):

### Potentially Qualified (2 times)
- `clay-wickiups.pdf` → Clay Wickiups
- `mixed-moods.pdf` → Mixed Moods
- `positively-negative.pdf` → Positively Negative
- `reflections-on-buildings.pdf` → Reflections on Buildings
- `pigment-of-imagination.pdf` → Pigment of Imagination

### Single Experience (1 time)
- `clay-bears-and-quail.pdf` → Clay Bears & Quail
- `drawing-still-life.pdf` → Drawing Still Life
- `egyptian-bird-masks.pdf` → Egyptian Bird Masks
- `fauve-landscape.pdf` → Fauve Landscape
- `finding-balance.pdf` → Finding Balance
- `heads-and-faces.pdf` → Heads & Faces
- `human-form.pdf` → Human Form
- `lights-color-collage.pdf` → Lights, Color, Collage
- `pleasing-pastels.pdf` → Pleasing Pastels
- `printmaking.pdf` → Printmaking
- `see-shells.pdf` → See Shells
- `watercolor-ecospheres.pdf` → Watercolor Ecospheres
- `watercolor-seascapes.pdf` → Watercolor Seascapes
- `watercolor-still-life.pdf` → Watercolor Still Life

## Testing

After adding PDFs, test locally:
```bash
npm run dev
# Visit http://localhost:5173?testDate=2026-01-01
# Click the "📄 PDF" links in the class cards
```

## On Production

Once you push to GitHub, Netlify will:
1. Copy `public/pdfs/` to `dist/pdfs/`
2. Serve PDFs at `https://your-site.netlify.app/pdfs/filename.pdf`
3. App automatically links to them

## Troubleshooting

- **"PDF link broken"** → Check filename matches exactly (case-sensitive)
- **"File not found"** → Verify PDF is in `/public/pdfs/` folder
- **"Works locally, not on Netlify"** → Clear browser cache, rebuild site
