# Frontend Troubleshooting

If the frontend is showing blank, try these steps:

## 1. Clean Install

```bash
cd frontend

# Remove existing dependencies
rm -rf node_modules package-lock.json

# Fresh install
npm install

# Start dev server
npm run dev
```

## 2. Check Console Errors

Open browser console (F12) and check for errors. Common issues:

- **Module not found**: Run `npm install`
- **Port already in use**: Kill process on port 5173
- **CORS errors**: Ensure backend is running on port 8000

## 3. Verify Files

Make sure these files exist:
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- `index.html`

## 4. Check main.tsx

Ensure `src/main.tsx` has:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## 5. Build from Scratch

If still blank:

```bash
cd ..
rm -rf frontend
npx create-vite@latest frontend --template react-ts
cd frontend
npm install
npm install axios lucide-react

# Copy over the src files from backup
# Then run:
npm run dev
```

## 6. Check Backend Connection

Frontend expects backend at `http://localhost:8000`

In `src/types.ts`, verify:
```typescript
export const API_BASE_URL = 'http://localhost:8000';
```

## 7. Browser Cache

- Clear browser cache
- Try incognito/private mode
- Try different browser (Chrome recommended)

## Still Not Working?

Run these commands and share the output:

```bash
cd frontend
npm run dev
# Copy any error messages

# In browser console (F12):
# Check for any red error messages
```
