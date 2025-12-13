import google.generativeai as genai
import os
import json
from typing import Dict, Any, Optional, List
from models import PatientProfile, TrialMatch
from dotenv import load_dotenv

load_dotenv()
print(os.getenv("GEMINI_API_KEY"))
# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel('gemini-2.5-pro')

class LLMService:
    """Service for all LLM-powered operations using Gemini"""
    
    @staticmethod
    async def extract_profile_from_image(image_bytes: bytes) -> PatientProfile:
        """Extract structured patient profile from an image (report/note) using Gemini Vision"""
        import PIL.Image
        import io

        print(f"🔍 Extracting patient profile from image ({len(image_bytes)} bytes)...")
        
        try:
            image = PIL.Image.open(io.BytesIO(image_bytes))
            
            prompt = """You are a clinical data extraction system for oncology. Extract a structured patient profile from the image of this medical document.

RULES:
- Expand medical abbreviations:
  - TNBC = triple-negative breast cancer
  - NSCLC = non-small cell lung cancer
  - osi/osimertinib/Tagrisso = osimertinib
  - pembro = pembrolizumab
  - AC-T = doxorubicin + cyclophosphamide followed by taxane
  - ECOG/PS = performance status
- Infer line of therapy from prior treatments count (1 prior = 2L, 2 priors = 3L+)
- Handle negations: "no brain mets" → cns_involvement: false
- "Good PS" or "up and about" → ecog: 0 or 1
- If information is not mentioned, set to null (do not guess)

OUTPUT FORMAT (JSON only, no explanation):
{
  "condition": "",
  "stage": "",
  "line_of_therapy": "",
  "prior_treatments": [],
  "biomarkers": {},
  "ecog": null,
  "age": null,
  "sex": null,
  "cns_involvement": null,
  "metastatic_sites": [],
  "location": {"city": "", "country": "India"}
}"""

            response = await model.generate_content_async([prompt, image])
            print("✅ Patient profile extracted from image")
            text = response.text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            profile_data = json.loads(text)
            return PatientProfile(**profile_data)
        except Exception as e:
            print(f"Error extracting patient profile from image: {e}")
            return PatientProfile(condition="Unknown")
            
    @staticmethod
    async def extract_patient_profile(query: str) -> PatientProfile:
        """Extract structured patient profile from natural language query"""
        
        prompt = f"""You are a clinical data extraction system for oncology. Extract a structured patient profile from the oncologist's description.

RULES:
- Expand medical abbreviations:
  - TNBC = triple-negative breast cancer
  - NSCLC = non-small cell lung cancer
  - osi/osimertinib/Tagrisso = osimertinib
  - pembro = pembrolizumab
  - AC-T = doxorubicin + cyclophosphamide followed by taxane
  - ECOG/PS = performance status
- Infer line of therapy from prior treatments count (1 prior = 2L, 2 priors = 3L+)
- Handle negations: "no brain mets" → cns_involvement: false
- "Good PS" or "up and about" → ecog: 0 or 1
- If information is not mentioned, set to null (do not guess)

Extract patient profile from: "{query}"

OUTPUT FORMAT (JSON only, no explanation):
{{
  "condition": "",
  "stage": "",
  "line_of_therapy": "",
  "prior_treatments": [],
  "biomarkers": {{}},
  "ecog": null,
  "age": null,
  "sex": null,
  "cns_involvement": null,
  "metastatic_sites": [],
  "location": {{"city": "", "country": "India"}}
}}"""

        print(f"🔍 Extracting patient profile from: '{query[:50]}...'")
        
        try:
            response = model.generate_content(prompt)
            print("✅ Patient profile extracted")
            text = response.text.strip()
            # Remove markdown code blocks if present
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            profile_data = json.loads(text)
            return PatientProfile(**profile_data)
        except Exception as e:
            print(f"Error extracting patient profile: {e}")
            # Return minimal profile on error
            return PatientProfile(condition="Unknown")
    
    @staticmethod
    async def extract_search_keywords(patient_profile: PatientProfile) -> Dict[str, List[str]]:
        """Extract search keywords and variations for ClinicalTrials.gov API"""
        
        patient_json = patient_profile.model_dump_json(indent=2)
        
        prompt = f"""You are a clinical trial search expert. Given a patient profile, extract the best search keywords and variations to find relevant trials on ClinicalTrials.gov.

PATIENT PROFILE:
{patient_json}

Generate search keywords in these categories:
1. CONDITION: Main disease/cancer type and common variations
2. BIOMARKERS: Genetic markers, mutations, receptor status
3. TREATMENTS: Prior treatments that might be exclusion criteria
4. PHASE: Preferred trial phases based on line of therapy

RULES:
- Use medical terminology that appears in trial listings
- Include abbreviations AND full names
- For TNBC: include "triple negative breast cancer", "TNBC", "triple-negative"
- For biomarkers: include gene names and common notations
- Consider line of therapy: 1L → Phase 3, 2L+ → Phase 2/3
- Include location if specified

OUTPUT FORMAT (JSON only):
{{
  "condition_keywords": ["primary term", "variation 1", "variation 2"],
  "biomarker_keywords": ["biomarker1", "biomarker2"],
  "phase_preference": ["PHASE2", "PHASE3"],
  "location_filter": "country name or null"
}}"""

        print(f"🔑 Extracting search keywords...")
        
        try:
            response = model.generate_content(prompt)
            print("✅ Keywords extracted")
            text = response.text.strip()
            # Remove markdown code blocks
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            return json.loads(text)
        except Exception as e:
            print(f"Error extracting keywords: {e}")
            # Return basic keywords from condition
            return {
                "condition_keywords": [patient_profile.condition],
                "biomarker_keywords": [],
                "phase_preference": ["PHASE2", "PHASE3"],
                "location_filter": patient_profile.location.country if patient_profile.location else None
            }
    
    @staticmethod
    async def evaluate_eligibility(
        patient_profile: PatientProfile,
        trial_criteria: str,
        trial_title: str,
        trial_phase: str
    ) -> Dict[str, Any]:
        """Evaluate patient eligibility for a trial and generate fit score"""
        
        patient_json = patient_profile.model_dump_json(indent=2)
        
        prompt = f"""You are a clinical trial eligibility evaluator. Given a patient profile and trial eligibility criteria, determine if the patient is a potential fit.

EVALUATION STEPS:
1. Check each inclusion criterion - does patient meet it?
2. Check each exclusion criterion - does patient violate it?
3. Identify missing information that would be needed to confirm eligibility
4. Assign fit score and category

FIT CATEGORIES:
- "strong" (80-100): Meets all stated criteria, no exclusions violated
- "moderate" (50-79): Meets most criteria, minor gaps or missing info
- "weak" (20-49): Significant gaps or uncertain fit
- "ineligible" (0-19): Clearly violates exclusion criteria

PATIENT PROFILE:
{patient_json}

TRIAL: {trial_title} ({trial_phase})

ELIGIBILITY CRITERIA:
{trial_criteria}

OUTPUT FORMAT (JSON only):
{{
  "fit_score": 0-100,
  "fit_category": "strong|moderate|weak|ineligible",
  "meets_criteria": ["list of criteria patient meets"],
  "fails_criteria": ["list of criteria patient fails"],
  "missing_info": ["list of info needed to confirm"],
  "explanation": "2-3 sentence plain English summary for the physician"
}}"""

        print(f"⚖️ Evaluating eligibility for: {trial_title[:40]}...")
        
        try:
            response = model.generate_content(prompt)
            print(f"✅ Evaluated: {trial_title[:30]}")
            text = response.text.strip()
            # Remove markdown code blocks
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            return json.loads(text)
        except Exception as e:
            print(f"Error evaluating eligibility: {e}")
            return {
                "fit_score": 30,
                "fit_category": "weak",
                "meets_criteria": [],
                "fails_criteria": [],
                "missing_info": ["Unable to evaluate - system error"],
                "explanation": "Error occurred during evaluation. Please review manually."
            }
    
    @staticmethod
    async def batch_evaluate_eligibility(
        patient_profile: PatientProfile,
        trials: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Evaluate patient eligibility for multiple trials in a single LLM call"""
        
        patient_json = patient_profile.model_dump_json(indent=2)
        
        # Build trials summary for prompt
        trials_text = ""
        for i, trial in enumerate(trials):
            trials_text += f"""
TRIAL {i+1}:
- NCT ID: {trial.get('nct_id', 'Unknown')}
- Title: {trial.get('title', 'Unknown')}
- Phase: {trial.get('phase', 'N/A')}
- Eligibility Criteria: {trial.get('eligibility_criteria', 'Not provided')[:1500]}

"""
        
        prompt = f"""You are a clinical trial eligibility evaluator. Given a patient profile and multiple trial eligibility criteria, evaluate each trial for patient fit.

PATIENT PROFILE:
{patient_json}

{trials_text}

For EACH trial, evaluate:
1. Does patient meet inclusion criteria?
2. Does patient violate exclusion criteria?
3. What info is missing?
4. Assign fit score (0-100) and category

FIT CATEGORIES:
- "strong" (80-100): Meets all criteria
- "moderate" (50-79): Meets most criteria
- "weak" (20-49): Significant gaps
- "ineligible" (0-19): Violates exclusions

OUTPUT FORMAT (JSON array, one object per trial in order):
[
  {{
    "nct_id": "NCT...",
    "fit_score": 0-100,
    "fit_category": "strong|moderate|weak|ineligible",
    "meets_criteria": ["criteria met"],
    "fails_criteria": ["criteria failed"],
    "missing_info": ["info needed"],
    "explanation": "1-2 sentence summary"
  }}
]"""

        print(f"⚖️ Batch evaluating {len(trials)} trials...")
        
        try:
            response = model.generate_content(prompt)
            print(f"✅ Batch evaluation complete")
            text = response.text.strip()
            
            # Remove markdown code blocks
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            evaluations = json.loads(text)
            
            # Ensure we have evaluations for all trials
            if len(evaluations) < len(trials):
                # Pad with default evaluations
                for i in range(len(evaluations), len(trials)):
                    evaluations.append({
                        "nct_id": trials[i].get("nct_id", "Unknown"),
                        "fit_score": 40,
                        "fit_category": "weak",
                        "meets_criteria": [],
                        "fails_criteria": [],
                        "missing_info": ["Evaluation not completed"],
                        "explanation": "Trial needs manual review."
                    })
            
            return evaluations
            
        except Exception as e:
            print(f"Error in batch evaluation: {e}")
            # Return default evaluations for all trials
            return [{
                "nct_id": t.get("nct_id", "Unknown"),
                "fit_score": 40,
                "fit_category": "weak",
                "meets_criteria": [],
                "fails_criteria": [],
                "missing_info": ["Batch evaluation failed"],
                "explanation": "Could not evaluate. Please review manually."
            } for t in trials]
    
    @staticmethod
    async def analyze_transcript(
        transcript: str,
        accumulated_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyze consultation transcript for trial matching triggers"""
        
        context_str = json.dumps(accumulated_context, indent=2) if accumulated_context else "{}"
        
        prompt = f"""You are monitoring an oncology consultation transcript. Determine if the conversation has reached a point where clinical trial information would be valuable.

TRIGGER PHRASES (high confidence):
- "we've exhausted options"
- "nothing else is approved"
- "have you considered a clinical trial"
- "failed all standard treatments"
- "no other approved therapies"
- "what about experimental treatments"

TRIGGER PATTERNS (medium confidence):
- Multiple treatment failures mentioned + patient asking "what now?"
- Doctor expressing uncertainty about next steps
- Discussion of prognosis without treatment options

DO NOT TRIGGER on:
- Routine follow-up visits
- Treatment going well
- General medical history taking
- First-line treatment discussions

TRANSCRIPT SO FAR:
{transcript}

ACCUMULATED CONTEXT:
{context_str}

OUTPUT FORMAT (JSON only):
{{
  "should_trigger": true|false,
  "confidence": "high|medium|low",
  "trigger_reason": "phrase or pattern that triggered",
  "accumulated_patient_info": {{
    "condition": "",
    "prior_treatments": [],
    "biomarkers": {{}},
    "age": null,
    "sex": null,
    "location": null
  }}
}}"""

        print(f"👂 Analyzing transcript ({len(transcript)} chars)...")
        
        try:
            response = model.generate_content(prompt)
            print("✅ Transcript analyzed")
            text = response.text.strip()
            # Remove markdown code blocks
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            return json.loads(text)
        except Exception as e:
            print(f"Error analyzing transcript: {e}")
            return {
                "should_trigger": False,
                "confidence": "low",
                "trigger_reason": None,
                "accumulated_patient_info": {}
            }
