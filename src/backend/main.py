from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import os
from datetime import date

from database import get_db, init_db
from models import (
    ScreenRequest, ScreenResponse, MatchRequest, MatchResponse,
    ListenerAnalyzeRequest, ListenerAnalyzeResponse, ChartResponse,
    PatientORM, PatientProfile, SavePatientRequest, SavePatientResponse,
    UpdatePatientTrialsRequest, UpdatePatientProfileRequest,
    TrialORM, PatientTrialLinkORM, LocationInput
)
from llm_service import LLMService
from ct_service import ClinicalTrialsService
from transcription_service import TranscriptionService

app = FastAPI(title="TrialSense API", version="1.0.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()
    print("✅ Database initialized")
    print("🌐 Using live ClinicalTrials.gov API for trial data")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "TrialSense API", "data_source": "ClinicalTrials.gov Live API"}

@app.post("/api/extract")
async def extract_profile(request: ScreenRequest):
    """
    Extract patient profile from natural language query only (no trial matching)
    """
    # Extract patient profile using LLM
    patient_profile = await LLMService.extract_patient_profile(request.query)
    return {"patient_profile": patient_profile}


@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio using OpenAI Whisper API
    Accepts audio file upload (webm, mp3, wav, etc.)
    Returns transcribed text
    """
    try:
        # Read audio data
        audio_data = await audio.read()
        filename = audio.filename or "audio.webm"
        
        print(f"📤 Received audio file: {filename} ({len(audio_data)} bytes)")
        
        # Transcribe with Whisper
        transcript = await TranscriptionService.transcribe_audio(audio_data, filename)
        
        return {
            "success": True,
            "transcript": transcript,
            "duration_hint": "Processing complete"
        }
        
    except Exception as e:
        print(f"❌ Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/api/screen", response_model=ScreenResponse)
async def screen_patient(request: ScreenRequest):
    """
    Screener Mode: Extract patient profile from natural language query
    and return matching trials from ClinicalTrials.gov
    """
    
    # Extract patient profile using LLM
    patient_profile = await LLMService.extract_patient_profile(request.query)
    
    # Search and match trials from ClinicalTrials.gov
    matches = await ClinicalTrialsService.match_patient_to_trials(
        patient_profile,
        max_results=10
    )
    
    return ScreenResponse(
        patient_profile=patient_profile,
        matches=matches
    )

@app.post("/api/extract/image", response_model=dict)
async def extract_patient_image(image: UploadFile = File(...)):
    """
    Multimodal Screener Step 1: Extract patient profile from image
    """
    # Read image data
    image_bytes = await image.read()
    print(f"📷 Received image file: {image.filename} ({len(image_bytes)} bytes)")
    
    # Extract patient profile using LLM Vision
    patient_profile = await LLMService.extract_profile_from_image(image_bytes)
    
    return {"patient_profile": patient_profile}

@app.post("/api/match", response_model=MatchResponse)
async def match_patient(request: MatchRequest):
    """
    Match a structured patient profile to trials from ClinicalTrials.gov
    """
    
    # Search and match trials
    matches = await ClinicalTrialsService.match_patient_to_trials(
        request.patient_profile,
        max_results=10
    )
    
    return MatchResponse(matches=matches)


@app.post("/api/search_trials")
async def search_trials(request: MatchRequest):
    """
    Step 1: Just search ClinicalTrials.gov for trials (no LLM evaluation)
    Returns raw trial data for progressive loading
    """
    from ct_service import ClinicalTrialsService
    
    trials = await ClinicalTrialsService.search_trials(request.patient_profile, max_results=10)
    
    return {
        "trials_count": len(trials),
        "trials": trials
    }


@app.post("/api/evaluate_trials")
async def evaluate_trials(request: dict):
    """
    Step 2: Evaluate trials using LLM (the slow part)
    Takes patient_profile and trials list, returns evaluated matches
    """
    from llm_service import LLMService
    from models import PatientProfile, TrialMatch, Location
    
    patient_profile = PatientProfile(**request["patient_profile"])
    trials = request["trials"]
    
    # Batch evaluate all trials
    evaluations = await LLMService.batch_evaluate_eligibility(patient_profile, trials)
    
    # Build match objects
    matches = []
    for i, trial in enumerate(trials):
        evaluation = evaluations[i] if i < len(evaluations) else {
            "fit_score": 40,
            "fit_category": "weak",
            "meets_criteria": [],
            "fails_criteria": [],
            "missing_info": [],
            "explanation": "Evaluation incomplete."
        }
        
        # Get first location
        nearest_site = None
        if trial.get("locations"):
            first_loc = trial["locations"][0]
            nearest_site = {
                "facility": first_loc.get("facility", "Unknown"),
                "city": first_loc.get("city", ""),
                "state": first_loc.get("state", ""),
                "country": first_loc.get("country", "")
            }
        
        matches.append({
            "nct_id": trial.get("nct_id", ""),
            "title": trial.get("title", ""),
            "phase": trial.get("phase", ""),
            "fit_score": evaluation.get("fit_score", 40),
            "fit_category": evaluation.get("fit_category", "weak"),
            "nearest_site": nearest_site,
            "distance_km": None,
            "meets_criteria": evaluation.get("meets_criteria", []),
            "fails_criteria": evaluation.get("fails_criteria", []),
            "missing_info": evaluation.get("missing_info", []),
            "explanation": evaluation.get("explanation", "")
        })
    
    # Sort by fit score
    matches.sort(key=lambda x: x["fit_score"], reverse=True)
    
    return {"matches": matches}

@app.get("/api/trials/{nct_id}")
async def get_trial(nct_id: str):
    """Get detailed information about a specific trial"""
    
    # Redirect to ClinicalTrials.gov
    return {
        "nct_id": nct_id,
        "url": f"https://clinicaltrials.gov/study/{nct_id}",
        "message": "View full trial details on ClinicalTrials.gov"
    }

@app.post("/api/listener/analyze", response_model=ListenerAnalyzeResponse)
async def analyze_transcript(request: ListenerAnalyzeRequest):
    """
    Listener Mode: Analyze consultation transcript for trial matching triggers
    """
    
    # Analyze transcript with LLM
    analysis = await LLMService.analyze_transcript(
        request.transcript,
        request.accumulated_context
    )
    
    response = ListenerAnalyzeResponse(
        should_trigger=analysis["should_trigger"],
        confidence=analysis["confidence"],
        trigger_reason=analysis.get("trigger_reason"),
        patient_profile=None,
        matches=None
    )
    
    # If triggered, extract patient profile and find matches
    if analysis["should_trigger"]:
        patient_info = analysis.get("accumulated_patient_info", {})
        
        # Create patient profile from accumulated info
        patient_profile = PatientProfile(**patient_info)
        response.patient_profile = patient_profile
        
        # Search ClinicalTrials.gov for matches
        if patient_profile.condition:
            matches = await ClinicalTrialsService.match_patient_to_trials(
                patient_profile,
                max_results=5
            )
            response.matches = matches
    
    return response



@app.delete("/api/patients/{patient_id}")
async def delete_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a patient by ID
    """
    result = await db.execute(
        select(PatientORM).where(PatientORM.patient_id == patient_id)
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    await db.delete(patient)
    await db.commit()
    
    return {"success": True, "message": "Patient deleted successfully"}

@app.put("/api/patients/{patient_id}/trials")
async def update_patient_trials(
    patient_id: str,
    request: UpdatePatientTrialsRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update selected trials for a patient (replaces existing selection)
    """
    # 1. Get Patient
    result = await db.execute(
        select(PatientORM).where(PatientORM.patient_id == patient_id).options(selectinload(PatientORM.saved_trials))
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # 2. Clear existing links (simplest strategy for "replace selection")
    # Using delete loop or delete statement
    # Since we have cascade="all, delete-orphan", clearing the list might work if assigned, 
    # but safer to explicitly delete the links for this patient
    
    # Actually, let's keep it simple: Remove all current links and re-add.
    for link in patient.saved_trials:
        await db.delete(link)
    
    # 3. Add new links
    for trial_match in request.selected_trials[:3]:
        # Check/Create TrialORM
        res = await db.execute(select(TrialORM).where(TrialORM.nct_id == trial_match.nct_id))
        trial_orm = res.scalar_one_or_none()
        
        if not trial_orm:
            trial_orm = TrialORM(
                nct_id=trial_match.nct_id,
                title=trial_match.title,
                phase=trial_match.phase,
                status="Active",
                conditions=[],
                interventions=[],
                eligibility_criteria_raw="",
                sex="All",
                sponsor="Unknown",
                last_updated=date.today()
            )
            db.add(trial_orm)
            await db.flush()
            
        link = PatientTrialLinkORM(
            patient_id=patient_id,
            nct_id=trial_match.nct_id,
            fit_score=trial_match.fit_score,
            fit_category=trial_match.fit_category,
            explanation=trial_match.explanation,
            meets_criteria=trial_match.meets_criteria,
            missing_info=trial_match.missing_info,
            match_data=trial_match.model_dump()
        )
        db.add(link)
    
    await db.commit()
    
    return {"success": True, "message": "Patient trials updated successfully"}

@app.put("/api/patients/{patient_id}")
async def update_patient_profile(
    patient_id: str,
    request: UpdatePatientProfileRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update patient profile details
    """
    result = await db.execute(
        select(PatientORM).where(PatientORM.patient_id == patient_id)
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Update fields if provided
    if request.name is not None:
        patient.name = request.name
    if request.age is not None:
        patient.age = request.age
    if request.sex is not None:
        patient.sex = request.sex
    if request.condition is not None:
        patient.condition = request.condition
    if request.stage is not None:
        patient.stage = request.stage
    if request.ecog is not None:
        patient.ecog = request.ecog
    if request.line_of_therapy is not None:
        patient.line_of_therapy = request.line_of_therapy
    if request.prior_treatments is not None:
        patient.prior_treatments = request.prior_treatments
    if request.current_treatments is not None:
        patient.current_treatments = request.current_treatments
    if request.biomarkers is not None:
        patient.biomarkers = request.biomarkers
        
    await db.commit()
    
    return {"success": True, "message": "Patient profile updated successfully"}

@app.get("/api/chart/{patient_id}", response_model=ChartResponse)
async def get_chart_data(
    patient_id: str,
    skip_matching: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Chart Peek Mode: Get patient data and optionally matching trials from ClinicalTrials.gov
    If skip_matching=true, returns saved trials from DB only (no LLM calls)
    """
    
    # Fetch patient from database
    result = await db.execute(
        select(PatientORM).where(PatientORM.patient_id == patient_id).options(selectinload(PatientORM.saved_trials))
    )
    patient_orm = result.scalar_one_or_none()
    
    if not patient_orm:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Convert to PatientProfile
    patient_profile = PatientProfile(
        condition=patient_orm.condition,
        condition_normalized=patient_orm.condition_normalized,
        histology=patient_orm.histology,
        stage=patient_orm.stage,
        line_of_therapy=patient_orm.line_of_therapy,
        prior_treatments=patient_orm.prior_treatments or [],
        current_treatments=patient_orm.current_treatments,
        biomarkers=patient_orm.biomarkers or {},
        ecog=patient_orm.ecog,
        age=patient_orm.age,
        sex=patient_orm.sex,
        cns_involvement=patient_orm.cns_involvement,
        metastatic_sites=patient_orm.metastatic_sites,
        comorbidities=patient_orm.comorbidities,
        organ_function=patient_orm.organ_function,
        location=LocationInput(
            city=patient_orm.location_city,
            country=patient_orm.location_country or "India",
            lat=patient_orm.location_lat,
            lng=patient_orm.location_lng
        ) if patient_orm.location_city else None
    )

    response = ChartResponse(
        patient=patient_profile,
        matches=[]
    )
    
    if skip_matching:
        # Return saved trials from DB links (no LLM calls)
        from models import TrialMatch, Location
        
        matches = []
        if patient_orm.saved_trials:
            for link in patient_orm.saved_trials:
                if link.match_data:
                    matches.append(TrialMatch(**link.match_data))
        
        response.matches = matches
        return response

    # Search ClinicalTrials.gov for matching trials (makes LLM calls)
    try:
        matches = await ClinicalTrialsService.match_patient_to_trials(
            patient_profile,
            max_results=10
        )
    except Exception as e:
        print(f"Error matching trials: {e}")
        matches = []
    
    response.matches = matches
    return response

@app.post("/api/patients/save", response_model=SavePatientResponse)
async def save_patient(
    request: SavePatientRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Save a patient with selected trials to the database
    """
    import uuid
    
    # Generate patient ID
    patient_id = f"P{str(uuid.uuid4())[:8].upper()}"
    
    # Create patient record
    patient_orm = PatientORM(
        patient_id=patient_id,
        name=request.name,
        age=request.patient_profile.age,
        sex=request.patient_profile.sex,
        condition=request.patient_profile.condition,
        condition_normalized=request.patient_profile.condition_normalized,
        histology=request.patient_profile.histology,
        stage=request.patient_profile.stage,
        line_of_therapy=request.patient_profile.line_of_therapy,
        prior_treatments=request.patient_profile.prior_treatments,
        current_treatments=request.patient_profile.current_treatments,
        biomarkers=request.patient_profile.biomarkers,
        ecog=request.patient_profile.ecog,
        cns_involvement=request.patient_profile.cns_involvement,
        metastatic_sites=request.patient_profile.metastatic_sites,
        comorbidities=request.patient_profile.comorbidities,
        organ_function=request.patient_profile.organ_function,
        location_city=request.patient_profile.location.city if request.patient_profile.location else None,
        location_country=request.patient_profile.location.country if request.patient_profile.location else "India",
        location_lat=request.patient_profile.location.lat if request.patient_profile.location else None,
        location_lng=request.patient_profile.location.lng if request.patient_profile.location else None
    )
    db.add(patient_orm)
    
    # Process selected trials
    for trial_match in request.selected_trials[:3]:
        # 1. Check if trial exists, create if not
        result = await db.execute(select(TrialORM).where(TrialORM.nct_id == trial_match.nct_id))
        trial_orm = result.scalar_one_or_none()
        
        if not trial_orm:
            trial_orm = TrialORM(
                nct_id=trial_match.nct_id,
                title=trial_match.title,
                phase=trial_match.phase,
                status="Active", # Placeholder
                conditions=[], # Placeholder or parse from somewhere if available? 
                interventions=[],
                eligibility_criteria_raw="",
                sex="All",
                sponsor="Unknown",
                last_updated=date.today()
            )
            db.add(trial_orm)
            await db.flush() # Flush to get ID if needed, though nct_id is unique key
            
        # 2. Create Link
        link = PatientTrialLinkORM(
            patient_id=patient_id,
            nct_id=trial_match.nct_id,
            fit_score=trial_match.fit_score,
            fit_category=trial_match.fit_category,
            explanation=trial_match.explanation,
            meets_criteria=trial_match.meets_criteria,
            missing_info=trial_match.missing_info,
            match_data=trial_match.model_dump()
        )
        db.add(link)
    
    await db.commit()
    
    print(f"✅ Saved patient {patient_id}: {request.name} with {len(request.selected_trials)} trials")
    
    return SavePatientResponse(
        success=True,
        patient_id=patient_id,
        message=f"Patient {request.name} saved with {len(request.selected_trials)} selected trials"
    )

@app.get("/api/patients")
async def list_patients(db: AsyncSession = Depends(get_db)):
    """
    List all saved patients
    """
    result = await db.execute(
        select(PatientORM).options(selectinload(PatientORM.saved_trials))
    )
    patients = result.scalars().all()
    
    return {
        "patients": [
            {
                "patient_id": p.patient_id,
                "name": p.name,
                "condition": p.condition,
                "age": p.age,
                "sex": p.sex,
                "stage": p.stage,
                "trial_count": len(p.saved_trials) if p.saved_trials else 0
            }
            for p in patients
        ]
    }


@app.get("/api/patients/{patient_id}/trials")
async def get_patient_trials(
    patient_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get saved trials for a specific patient
    """
    result = await db.execute(
        select(PatientORM).where(PatientORM.patient_id == patient_id).options(selectinload(PatientORM.saved_trials))
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    from models import TrialMatch
    matches = []
    if patient.saved_trials:
        for link in patient.saved_trials:
            if link.match_data:
                matches.append(TrialMatch(**link.match_data))

    print(f"DEBUG: Returning {len(matches)} saved trials for {patient_id}: {[m.nct_id for m in matches]}")
    return {
        "patient_id": patient.patient_id,
        "name": patient.name,
        "selected_trials": [m.model_dump() for m in matches]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
