# ClinIQ Architecture

## High-Level Overview

ClinIQ is a full-stack automated clinical trial matching system designed to bridge the gap between oncology patients and suitable clinical trials. It leverages generative AI for unstructured data extraction and semantic matching.

```mermaid
graph TD
    User[Oncologist / User] -->|Interacts| UI[Frontend (React + Vite)]
    
    subgraph "Frontend Layer"
        UI -->|Audio/Voice| Recorder[Voice Recorder]
        UI -->|Uploads| Uploader[File Uploader]
        UI -->|Queries| Dashboard[Dashboard View]
    end
    
    UI -->|HTTP Requests| API[Backend API (FastAPI)]
    
    subgraph "Backend Layer"
        API -->|Transcribe| Whisper[OpenAI Whisper Service]
        API -->|Extract & Match| Gemini[Google Gemini Service]
        API -->|Store/Retrieve| DB[(SQLite Database)]
        API -->|Search| CTService[Clinical Trials Service]
    end
    
    subgraph "External Services"
        Gemini -->|LLM Calls| GoogleAI[Google Gemini API]
        Whisper -->|STT| OpenAI[OpenAI API]
        CTService -->|Fetch Data| CTGov[ClinicalTrials.gov Data]
    end
```

## Core Components

### 1. Frontend (React + TypeScript)
- **Tech Stack**: React, Vite, TailwindCSS, TypeScript.
- **Responsibilities**:
  - Captures user input (text, voice, images).
  - Visualizes patient profiles and trial matches.
  - Manages "Modes" of interaction: Screener, Listener, and Chart Peek.

### 2. Backend (FastAPI + Python)
- **Tech Stack**: FastAPI, SQLAlchemy (Async), Poetry.
- **Responsibilities**:
  - **API Layer**: Exposes REST endpoints for the frontend.
  - **Orchestration**: Manages the flow between data, AI services, and trial matching logic.
  - **Database**: efficient storage of Patient Profiles and Trial Metadata using `aiosqlite`.

### 3. AI Services
- **Google Gemini (Integration Core)**:
  - **Extraction**: Converts unstructured text descriptions and medical images into structured `PatientProfile` objects.
  - **Matching**: Semantically evaluates patient eligibility against trial criteria, providing a "Fit Score" and explanation.
  - **Listener**: Analyzes conversation streams to detect triggers for trial recommendations.
- **OpenAI Whisper**:
  - Provides high-accuracy transcription of medical consultations.

### 4. Data Layer
- **SQLite**: Local relational database for storing patients, trials, and their associations.
- **ClinicalTrials.gov**: Source of truth for trial registry data (ingested or queried live).
