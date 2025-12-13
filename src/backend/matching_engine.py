from typing import List, Optional, Tuple
from models import PatientProfile, Trial, TrialMatch, Location
from geopy.distance import geodesic
from llm_service import LLMService
import math

class MatchingEngine:
    """Core matching engine for clinical trials"""
    
    @staticmethod
    def calculate_distance(
        patient_location: Optional[Tuple[float, float]],
        trial_location: Tuple[float, float]
    ) -> Optional[float]:
        """Calculate distance in km using haversine formula"""
        if not patient_location:
            return None
        
        try:
            return geodesic(patient_location, trial_location).kilometers
        except Exception:
            return None
    
    @staticmethod
    def find_nearest_site(
        patient_location: Optional[Tuple[float, float]],
        trial_locations: List[Location]
    ) -> Tuple[Optional[Location], Optional[float]]:
        """Find nearest trial site to patient"""
        if not patient_location or not trial_locations:
            return None, None
        
        nearest_site = None
        min_distance = float('inf')
        
        for location in trial_locations:
            if location.lat and location.lng:
                distance = MatchingEngine.calculate_distance(
                    patient_location,
                    (location.lat, location.lng)
                )
                if distance and distance < min_distance:
                    min_distance = distance
                    nearest_site = location
        
        return nearest_site, min_distance if nearest_site else None
    
    @staticmethod
    async def match_patient_to_trial(
        patient: PatientProfile,
        trial: Trial
    ) -> TrialMatch:
        """Match a patient to a single trial with LLM evaluation"""
        
        # Get patient location coordinates
        patient_coords = None
        if patient.location and patient.location.lat and patient.location.lng:
            patient_coords = (patient.location.lat, patient.location.lng)
        
        # Find nearest trial site
        nearest_site, distance = MatchingEngine.find_nearest_site(
            patient_coords,
            trial.locations
        )
        
        # Use LLM to evaluate eligibility
        evaluation = await LLMService.evaluate_eligibility(
            patient,
            trial.eligibility_criteria_raw,
            trial.title,
            trial.phase
        )
        
        return TrialMatch(
            nct_id=trial.nct_id,
            title=trial.title,
            phase=trial.phase,
            fit_score=evaluation.get("fit_score", 0),
            fit_category=evaluation.get("fit_category", "weak"),
            nearest_site=nearest_site,
            distance_km=distance,
            meets_criteria=evaluation.get("meets_criteria", []),
            fails_criteria=evaluation.get("fails_criteria", []),
            missing_info=evaluation.get("missing_info", []),
            explanation=evaluation.get("explanation", "")
        )
    
    @staticmethod
    async def match_patient_to_trials(
        patient: PatientProfile,
        trials: List[Trial],
        max_results: int = 10
    ) -> List[TrialMatch]:
        """Match patient to multiple trials and rank by fit score"""
        
        matches = []
        for trial in trials:
            match = await MatchingEngine.match_patient_to_trial(patient, trial)
            matches.append(match)
        
        # Sort by fit score (descending) and distance (ascending)
        matches.sort(
            key=lambda m: (
                -m.fit_score,  # Higher score first
                m.distance_km if m.distance_km else float('inf')  # Closer first
            )
        )
        
        # Return top matches
        return matches[:max_results]
    
    @staticmethod
    def filter_trials_by_condition(
        trials: List[Trial],
        condition: str
    ) -> List[Trial]:
        """Pre-filter trials by condition for efficiency"""
        condition_lower = condition.lower()
        
        # Common oncology condition mappings
        condition_keywords = {
            "tnbc": ["triple negative", "tnbc", "breast cancer"],
            "nsclc": ["non-small cell", "nsclc", "lung cancer"],
            "breast": ["breast cancer", "breast carcinoma"],
            "lung": ["lung cancer", "lung carcinoma", "nsclc", "sclc"],
            "colorectal": ["colorectal", "colon cancer", "rectal cancer"],
        }
        
        # Get relevant keywords
        keywords = []
        for key, values in condition_keywords.items():
            if key in condition_lower:
                keywords.extend(values)
        
        if not keywords:
            # Use the condition itself
            keywords = [condition_lower]
        
        # Filter trials
        filtered = []
        for trial in trials:
            trial_conditions = " ".join(trial.conditions).lower()
            if any(keyword in trial_conditions for keyword in keywords):
                filtered.append(trial)
        
        return filtered if filtered else trials  # Return all if no matches
