# Release Checklist

## Before Every Release

### Code Quality
- [ ] `npm run build` completes without errors
- [ ] No console errors when running `npm run dev`
- [ ] No API keys, secrets, or `.env` files in tracked files
- [ ] `.gitignore` covers `.env`, `.env.local`, and `node_modules`

### Conversion Testing
- [ ] MP3 + JPG produces a playable video
- [ ] MP3 + PNG produces a playable video
- [ ] MP3 + WebP produces a playable video
- [ ] Short audio file (under 30 seconds) converts correctly
- [ ] Longer audio file (3+ minutes) converts correctly
- [ ] Progress percentage advances during conversion
- [ ] Time display shows correct elapsed / total time
- [ ] Downloaded file plays in a standard video player (VLC, phone gallery)
- [ ] Downloaded file uploads successfully to YouTube

### Mobile Testing
- [ ] App loads on Android Chrome
- [ ] File selection works via tap on both upload areas
- [ ] Image preview displays correctly
- [ ] Convert button is disabled until both files are selected
- [ ] Convert button is easily tappable (large touch target)
- [ ] Screen stays on during conversion
- [ ] Progress bar and percentage are visible during conversion
- [ ] Download button works on mobile
- [ ] "Start Over" resets the app correctly
- [ ] Footer text is readable
- [ ] No horizontal scrolling on small screens

### Desktop Testing
- [ ] App loads on Chrome desktop
- [ ] All features work on desktop viewport
- [ ] File drag-and-drop area is clickable

### Error Handling
- [ ] Selecting an unsupported file type shows a clear error
- [ ] Error state shows a "Try Again" button
- [ ] Reloading during conversion does not break the app

## GitHub Release
- [ ] Version number updated in `package.json`
- [ ] README is accurate and up to date
- [ ] No placeholder text left in documentation
- [ ] Create a GitHub release with a version tag (e.g., `v1.0.0`)
- [ ] Attach the built `dist/` folder as a ZIP if distributing

## Gumroad Delivery
- [ ] Build the project: `npm run build`
- [ ] ZIP the `dist/` folder
- [ ] Test the ZIP: extract it, open `index.html` in a browser, verify conversion works
- [ ] Upload ZIP to Gumroad product
- [ ] Verify Gumroad product description matches actual capabilities
- [ ] Set price to $5
- [ ] Test purchase flow with a free coupon if possible

## Security Checklist
- [ ] No API keys in source code
- [ ] No `.env` or `.env.local` files committed
- [ ] No Google AI Studio references in code
- [ ] No hardcoded URLs pointing to private services
- [ ] Dependencies are up to date (`npm audit`)
