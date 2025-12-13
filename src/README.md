# TrialSense - Clinical Trial Matching System

AI-powered clinical trial matching with three interaction modes: Screener, Listener, and Chart Peek.

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Install dependencies (choose one method)

# Option A: Using pip
pip3 install -r requirements.txt

# Option B: Using Poetry (recommended)
poetry install
poetry shell

# Set up environment
cp ../.env.example .env
# Edit .env and add your GEMINI_API_KEY

# Initialize database with sample data
python3 seed_data.py
python3 ingestion.py

# Start backend server
python3 main.py
```

Backend will run at: **http://localhost:8000**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Frontend will run at: **http://localhost:5173**

## Environment Variables

Create `backend/.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite+aiosqlite:///./trialsense.db
```

Get your Gemini API key: https://makersuite.google.com/app/apikey

## Verify Setup

1. Backend health check: http://localhost:8000
2. API docs: http://localhost:8000/docs
3. Frontend: http://localhost:5173

## Demo Data

**Patients:**
- P001: Mrs. Lakshmi V. (TNBC, 3L+, Chennai)
- P002: Mr. Rajesh K. (NSCLC EGFR+, 2L, Bangalore)
- P003: Mrs. Priya S. (TNBC, 1L, Mumbai)

**Trials:**
- NCT04939948: Dato-DXd (TNBC, Phase 3)
- NCT05382286: AKT Inhibitor (TNBC, Phase 2)
- NCT04584112: Pembrolizumab (TNBC, Phase 3)

## Features

### Screener Mode
- Voice/text patient input
- AI profile extraction
- Trial matching with fit scores

### Listener Mode
- Real-time transcript monitoring
- Automatic trial surfacing
- Context accumulation

### Chart Peek Mode
- Mock EMR interface
- Auto-populated trial recommendations
- Patient chart view

## Tech Stack

**Backend:** FastAPI, SQLAlchemy, Gemini AI, SQLite  
**Frontend:** React, TypeScript, Vite, Axios

## Troubleshooting

**Frontend blank/not loading?**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Backend errors?**
- Verify GEMINI_API_KEY in `.env`
- Run `python3 seed_data.py` to initialize database
- Check port 8000 is not in use

**Voice input not working?**
- Use Chrome browser (Safari/Firefox don't support SpeechRecognition API)

## Project Structure

```
hackathon_2k25/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── models.py            # Data models
│   ├── llm_service.py       # Gemini AI
│   ├── matching_engine.py   # Trial matching
│   ├── seed_data.py         # Sample data
│   └── requirements.txt     # Dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ScreenerMode.tsx
│   │   │   ├── ListenerMode.tsx
│   │   │   └── ChartPeekMode.tsx
│   │   └── index.css        # Design system
│   └── package.json
└── README.md
```

## API Endpoints

- `POST /api/screen` - Screen patient from text/voice
- `POST /api/match` - Match patient profile to trials
- `GET /api/trials/{nct_id}` - Get trial details
- `POST /api/listener/analyze` - Analyze transcript
- `GET /api/chart/{patient_id}` - Get patient chart

## License

MIT
