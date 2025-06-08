# Deployment Guide

## Vercel Deployment

### Changes Made for Vercel Compatibility:

1. **Updated webpack.config.js**: Changed output directory from `dist` to `build`
2. **Added vercel.json**: Configuration for Vercel deployment
3. **Added html-webpack-plugin**: To properly generate HTML file in build directory

### Deploy Steps:

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Test build locally**:
   ```bash
   npm run build
   ```
   This should create a `build` directory with `bundle.js` and `index.html`

3. **Deploy to Vercel**:
   - Push changes to GitHub
   - Connect repository to Vercel
   - Vercel will automatically detect the build configuration

### Important Notes:

- The app includes a banner warning users that backend is not deployed
- Update the GitHub URL in the banner to match your repository
- Remove the banner when you deploy the backend

### Backend Deployment:

When ready to deploy backend:
1. Deploy backend to a service like Railway, Render, or AWS
2. Update the socket connection URL in the frontend
3. Remove the deployment warning banner 