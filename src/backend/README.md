# TrialSense Backend

FastAPI backend with Gemini AI integration for clinical trial matching.

## Setup with Poetry

```bash
# Install dependencies
poetry install

# Activate virtual environment
poetry shell

# Set up environment variables
cp ../.env.example .env
# Edit .env and add your GEMINI_API_KEY

# Initialize database
python seed_data.py
python ingestion.py

# Start server
python main.py
```

## API Endpoints

- `POST /api/screen` - Screen patient from text/voice
- `POST /api/match` - Match patient to trials
- `GET /api/trials/{nct_id}` - Get trial details
- `POST /api/listener/analyze` - Analyze transcript
- `GET /api/chart/{patient_id}` - Get patient chart

## Tech Stack

- FastAPI
- SQLAlchemy (async)
- Google Gemini AI
- SQLite
- Geopy
