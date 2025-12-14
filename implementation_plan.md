# Implementation Plan - Clinical Radar Improvements

## Goals
1.  Document the Clinical Radar feature flow (Done).
2.  Enable clickable source links in the alerts UI.

## Proposed Changes

### Backend
#### [src/backend/models.py]
- Add `RadarAlertORM` table to store alerts. 
  - Fields: `id`, `drug`, `category`, `severity`, `title`, `description`, `source`, `source_url`, `date`, `is_new` (bool), `created_at`.
- Add Pydantic models: `RadarAlert`, `RadarAlertCreate`.

#### [src/backend/clinical_radar_service.py]
- Update `perform_ambient_search` prompt to request `source_url`.
- Add `save_alerts` method: Saves new findings to DB. Avoids duplicates based on (drug + title).
- Add `get_alerts` method: Returns alerts sorted by `is_new` DESC, then `date` DESC.
- Add `mark_as_read` method.

#### [src/backend/main.py]
- Update `/api/radar/scan` to save results to DB instead of just returning them.
- Add `GET /api/radar/alerts` to fetch history.
- Add `POST /api/radar/read` to mark alerts as read (e.g., when "Daily Briefing" is played or explicitly dismissed).

### Frontend
#### [src/frontend/src/components/ClinicalRadarMode.tsx]
- Update `Alert` interface to include `id`, `is_new`, `source_url`.
- `useEffect` on mount: Fetch existing alerts from `/api/radar/alerts`.
- Update Alert Card:
  - Add "NEW" badge if `is_new` is true.
  - Apply visual dimming if `!is_new`.
  - Add clickable "Source" link.
- "Run Scan" now refreshes the list after backend saves new items.

## Verification Plan

### Manual Verification
1.  **Restart Backend**: Apply changes and restart the server.
2.  **Run Scan**: Go to Clinical Radar mode and click "Run Scan".
3.  **Inspect Alert**: When alerts appear, verify that the "Source" text is blue/underlined or has an icon.
4.  **Click Link**: Click the link and verify it opens a new tab to a valid domain (e.g., fda.gov, clinicaltrials.gov).
