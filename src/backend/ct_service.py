import httpx
from typing import List, Dict, Any, Optional
from models import PatientProfile, TrialMatch, Location
from llm_service import LLMService
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import asyncio

class ClinicalTrialsService:
    """Service for fetching and processing trials from ClinicalTrials.gov API"""
    
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
    
    @staticmethod
    async def search_trials(patient_profile: PatientProfile, max_results: int = 10) -> List[Dict[str, Any]]:
        """Search ClinicalTrials.gov API based on patient profile"""
        
        # Use LLM to extract search keywords
        keywords = await LLMService.extract_search_keywords(patient_profile)
        
        # Use primary condition keyword (first one is usually most specific)
        condition_keywords = keywords.get("condition_keywords", [patient_profile.condition])
        primary_condition = condition_keywords[0] if condition_keywords else patient_profile.condition
        
        # Build API parameters - simplified to avoid 400 errors
        params = {
            "query.cond": primary_condition,
            "filter.overallStatus": "RECRUITING",
            "pageSize": min(max_results, 20),  # Fetch more to filter later
            "format": "json"
        }
        
        # Note: Phase and location filtering will be done in post-processing
        # The API's filter.phase parameter causes 400 errors
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(ClinicalTrialsService.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                studies = data.get("studies", [])
                return [ClinicalTrialsService._parse_study(study) for study in studies]
                
        except Exception as e:
            print(f"Error fetching trials from ClinicalTrials.gov: {e}")
            return []
    
    @staticmethod
    def _parse_study(study: Dict[str, Any]) -> Dict[str, Any]:
        """Parse a study from ClinicalTrials.gov API response"""
        
        protocol = study.get("protocolSection", {})
        identification = protocol.get("identificationModule", {})
        status = protocol.get("statusModule", {})
        eligibility = protocol.get("eligibilityModule", {})
        interventions = protocol.get("armsInterventionsModule", {})
        conditions = protocol.get("conditionsModule", {})
        contacts = protocol.get("contactsLocationsModule", {})
        design = protocol.get("designModule", {})
        
        # Extract phase
        phases = design.get("phases", [])
        phase_str = ", ".join(phases) if phases else "N/A"
        
        # Extract locations
        locations = []
        location_list = contacts.get("locations", [])
        for loc in location_list[:10]:  # Limit to 10 locations
            locations.append({
                "facility": loc.get("facility", "Unknown"),
                "city": loc.get("city", ""),
                "state": loc.get("state", ""),
                "country": loc.get("country", ""),
                "lat": None,  # Will geocode if needed
                "lng": None
            })
        
        # Extract interventions
        intervention_list = interventions.get("interventions", [])
        intervention_names = [i.get("name", "") for i in intervention_list]
        
        # Extract eligibility criteria
        eligibility_text = eligibility.get("eligibilityCriteria", "No eligibility criteria provided")
        
        # Extract sponsor
        sponsor_module = protocol.get("sponsorCollaboratorsModule", {})
        sponsor = sponsor_module.get("leadSponsor", {}).get("name", "Unknown")
        
        return {
            "nct_id": identification.get("nctId", ""),
            "title": identification.get("briefTitle", ""),
            "phase": phase_str,
            "status": status.get("overallStatus", ""),
            "conditions": conditions.get("conditions", []),
            "interventions": intervention_names,
            "eligibility_criteria": eligibility_text,
            "min_age": eligibility.get("minimumAge", ""),
            "max_age": eligibility.get("maximumAge", ""),
            "sex": eligibility.get("sex", "ALL"),
            "sponsor": sponsor,
            "locations": locations
        }
    
    @staticmethod
    async def match_patient_to_trials(
        patient_profile: PatientProfile,
        max_results: int = 10
    ) -> List[TrialMatch]:
        """Search trials and evaluate patient eligibility using batch evaluation"""
        
        # Search for trials
        trials = await ClinicalTrialsService.search_trials(patient_profile, max_results)
        
        if not trials:
            return []
        
        print(f"📋 Found {len(trials)} trials, running batch evaluation...")
        
        # Batch evaluate all trials in one LLM call
        evaluations = await LLMService.batch_evaluate_eligibility(patient_profile, trials)
        
        # Create match objects
        matches = []
        for i, trial in enumerate(trials):
            try:
                # Get evaluation for this trial
                evaluation = evaluations[i] if i < len(evaluations) else {
                    "fit_score": 40,
                    "fit_category": "weak",
                    "meets_criteria": [],
                    "fails_criteria": [],
                    "missing_info": ["Not evaluated"],
                    "explanation": "Trial needs manual review."
                }
                
                # Find nearest location (skip geocoding to save time)
                nearest_site = None
                distance_km = None
                
                if trial["locations"]:
                    # Just use first location for now
                    first_loc = trial["locations"][0]
                    nearest_site = Location(
                        facility=first_loc.get("facility", "Unknown"),
                        city=first_loc.get("city", ""),
                        state=first_loc.get("state", ""),
                        country=first_loc.get("country", "")
                    )
                
                # Create match object
                match = TrialMatch(
                    nct_id=trial["nct_id"],
                    title=trial["title"],
                    phase=trial["phase"],
                    fit_score=evaluation.get("fit_score", 40),
                    fit_category=evaluation.get("fit_category", "weak"),
                    nearest_site=nearest_site,
                    distance_km=distance_km,
                    meets_criteria=evaluation.get("meets_criteria", []),
                    fails_criteria=evaluation.get("fails_criteria", []),
                    missing_info=evaluation.get("missing_info", []),
                    explanation=evaluation.get("explanation", "No explanation available.")
                )
                
                matches.append(match)
                
            except Exception as e:
                print(f"Error creating match for trial {trial.get('nct_id')}: {e}")
                continue
        
        # Sort by fit score
        matches.sort(key=lambda x: x.fit_score, reverse=True)
        
        print(f"✅ Matched {len(matches)} trials")
        
        return matches
    
    @staticmethod
    async def _find_nearest_location(
        patient_location: Dict[str, Any],
        trial_locations: List[Dict[str, Any]]
    ) -> tuple[Optional[Location], Optional[float]]:
        """Find the nearest trial location to patient"""
        
        if not patient_location or not trial_locations:
            return None, None
        
        # Convert Pydantic model to dict if needed
        if hasattr(patient_location, 'model_dump'):
            patient_location = patient_location.model_dump()
        
        patient_coords = (patient_location.get("lat"), patient_location.get("lng"))
        
        # If patient coords not available, geocode
        if not all(patient_coords):
            geolocator = Nominatim(user_agent="trialsense")
            try:
                location = geolocator.geocode(f"{patient_location.get('city')}, {patient_location.get('country')}")
                if location:
                    patient_coords = (location.latitude, location.longitude)
                else:
                    return None, None
            except:
                return None, None
        
        nearest = None
        min_distance = float('inf')
        
        for loc in trial_locations:
            # Geocode trial location if needed
            trial_coords = (loc.get("lat"), loc.get("lng"))
            
            if not all(trial_coords):
                geolocator = Nominatim(user_agent="trialsense")
                try:
                    location = geolocator.geocode(f"{loc.get('city')}, {loc.get('country')}")
                    if location:
                        trial_coords = (location.latitude, location.longitude)
                        loc["lat"] = location.latitude
                        loc["lng"] = location.longitude
                    else:
                        continue
                except:
                    continue
            
            # Calculate distance
            try:
                distance = geodesic(patient_coords, trial_coords).kilometers
                if distance < min_distance:
                    min_distance = distance
                    nearest = Location(**loc)
            except:
                continue
        
        return nearest, min_distance if nearest else None
