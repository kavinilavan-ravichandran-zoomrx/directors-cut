# Clinical Radar - E2E Feature Guide

## Overview
**Clinical Radar** is an ambient intelligence feature designed to passively monitor patient safety and treatment landscape. Instead of requiring active queries, it runs in the background, scanning for adverse events, regulatory updates, and new competitor trials relevant to the specific treatments your patients are receiving.

## User Flow

### 1. Treatment Extraction (Background)
- **Trigger**: Every time a patient is saved or updated in the system.
- **Process**: The backend extracts the `current_treatments` list (e.g., "Pembrolizumab", "Osimertinib") and maintains a unique set of monitored targets.
- **Visual**: In the "Clinical Radar" tab, these appear in the "Monitored Targets" list.

### 2. Performing a Scan
- **Action**: User clicks the **"Run Scan"** button on the Radar dashboard.
- **System Action**: 
  - The UI simulates a distributed search across databases (Animation).
  - The backend (`ClinicalRadarService`) invokes Gemini 2.0.
  - Gemini "simulates" a real-time web search for each drug, looking for:
    - 🔴 **Adverse Events**: Black box warnings, new side effects.
    - 🟡 **Regulatory**: FDA/EMA label changes.
    - 🔵 **Competitor**: New drug approvals in the same class.
- **Output**: A list of actionable "Alerts" sorted by severity.

### 3. Reviewing Alerts
- **Visual**: High-severity alerts (Adverse Events) are highlighted in Red/Orange.
- **Detail**: Each card contains:
  - **Headline**: e.g., "FDA Warning for Cardiotoxicity".
  - **Summary**: 2-sentence bite-sized context.
  - **Source**: Link to the source (e.g., FDA MedWatch, NEJM).
- **Interaction**: Clicking the "Source" link opens the external page.

### 4. Daily Audio Briefing (Podcast)
- **Auto-Trigger**: Once the scan is complete and alerts are found.
- **Generation**: 
  - Gemini summarizes the alerts into a cohesive, professional "News Anchor" script.
  - `gTTS` (Google Text-to-Speech) converts this script into an MP3 file.
- **Playback**: The user can listen to the 30-60 second briefing directly in the dashboard via the built-in audio player.

## Technical Components

- **Frontend**: `ClinicalRadarMode.tsx` (Polling, Audio Player, Alert Cards).
- **Backend Service**: `clinical_radar_service.py` (LLM Search Simulation, gTTS integration).
- **Storage**: `static/audio/` for temporary podcast files.

## Future Roadmap
- [ ] Connect to real PubMed/FDA APIs instead of LLM simulation.
- [ ] Email/SMS push notifications for High Severity alerts.
- [ ] "One-click" action to notify patients affected by a safety warning.
