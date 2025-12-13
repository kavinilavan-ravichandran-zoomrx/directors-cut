# Running TrialSense with Poetry

## Quick Start

### Backend (with Poetry)

```bash
cd backend

# First time setup
poetry install
poetry shell

# Set up environment
cp ../.env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here

# Initialize database (first time only)
python seed_data.py
python ingestion.py

# Start backend server
python main.py
```

Backend runs at: **http://localhost:8000**

### Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

## Poetry Commands

```bash
# Activate virtual environment
poetry shell

# Run commands without activating shell
poetry run python main.py

# Add new dependency
poetry add package-name

# Update dependencies
poetry update

# Show installed packages
poetry show

# Exit virtual environment
exit
```

## Environment Variables

In `backend/.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite+aiosqlite:///./trialsense.db
```

Get Gemini API key: https://makersuite.google.com/app/apikey

## Verify Setup

1. Backend API: http://localhost:8000
2. API docs: http://localhost:8000/docs
3. Frontend: http://localhost:5173

## Demo

Try in Screener mode:
```
62-year-old woman, metastatic TNBC, failed AC-T and capecitabine, 
BRCA wild-type, ECOG 1, Chennai
```

## Troubleshooting

**Poetry not found?**
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

**Wrong Python version?**
```bash
poetry env use python3.11
poetry install
```

**Frontend blank?**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```
