import httpx
import asyncio
from typing import List, Dict, Any
from datetime import datetime
from models import TrialORM, LocationORM
from database import AsyncSessionLocal
from sqlalchemy import select
from geopy.geocoders import Nominatim
import time

# ClinicalTrials.gov API v2
CT_GOV_API = "https://clinicaltrials.gov/api/v2/studies"

class TrialIngestion:
    """Fetch and parse trials from ClinicalTrials.gov"""
    
    def __init__(self):
        self.geolocator = Nominatim(user_agent="trialsense")
    
    def geocode_location(self, city: str, country: str) -> tuple[float, float] | None:
        """Get lat/lng for a location"""
        try:
            location = self.geolocator.geocode(f"{city}, {country}")
            if location:
                return (location.latitude, location.longitude)
        except Exception as e:
            print(f"Geocoding error for {city}, {country}: {e}")
        return None
    
    async def fetch_oncology_trials(self, max_trials: int = 200) -> List[Dict[str, Any]]:
        """Fetch recruiting oncology trials from ClinicalTrials.gov"""
        
        params = {
            "query.cond": "cancer OR oncology OR carcinoma OR tumor",
            "filter.overallStatus": "RECRUITING",
            "filter.phase": "PHASE2|PHASE3",
            "pageSize": min(max_trials, 100),
            "format": "json",
            "fields": "NCTId,BriefTitle,Phase,OverallStatus,Condition,InterventionName,"
                     "EligibilityCriteria,MinimumAge,MaximumAge,Sex,LocationFacility,"
                     "LocationCity,LocationState,LocationCountry,LeadSponsorName,LastUpdatePostDate"
        }
        
        trials = []
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(CT_GOV_API, params=params)
                response.raise_for_status()
                data = response.json()
                
                if "studies" in data:
                    trials = data["studies"]
                    print(f"Fetched {len(trials)} trials from ClinicalTrials.gov")
                
            except Exception as e:
                print(f"Error fetching trials: {e}")
        
        return trials
    
    def parse_trial(self, study_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse trial data from ClinicalTrials.gov format"""
        
        protocol = study_data.get("protocolSection", {})
        identification = protocol.get("identificationModule", {})
        status = protocol.get("statusModule", {})
        conditions = protocol.get("conditionsModule", {})
        interventions = protocol.get("armsInterventionsModule", {})
        eligibility = protocol.get("eligibilityModule", {})
        contacts = protocol.get("contactsLocationsModule", {})
        sponsors = protocol.get("sponsorCollaboratorsModule", {})
        
        # Extract basic info
        nct_id = identification.get("nctId", "")
        title = identification.get("briefTitle", "")
        
        # Phase
        phases = status.get("phases", [])
        phase = phases[0] if phases else "Unknown"
        
        # Status
        overall_status = status.get("overallStatus", "Unknown")
        
        # Conditions
        condition_list = conditions.get("conditions", [])
        
        # Interventions
        intervention_list = []
        for intervention in interventions.get("interventions", []):
            intervention_list.append(intervention.get("name", ""))
        
        # Eligibility criteria
        eligibility_text = eligibility.get("eligibilityCriteria", "")
        
        # Age
        min_age_str = eligibility.get("minimumAge", "")
        max_age_str = eligibility.get("maximumAge", "")
        
        def parse_age(age_str: str) -> int | None:
            if not age_str or age_str.lower() == "n/a":
                return None
            # Extract number from strings like "18 Years"
            try:
                return int(''.join(filter(str.isdigit, age_str)))
            except:
                return None
        
        min_age = parse_age(min_age_str)
        max_age = parse_age(max_age_str)
        
        # Sex
        sex = eligibility.get("sex", "ALL")
        
        # Locations
        locations = []
        for location in contacts.get("locations", []):
            facility = location.get("facility", "")
            city = location.get("city", "")
            state = location.get("state")
            country = location.get("country", "")
            
            if city and country:
                # Geocode location
                coords = self.geocode_location(city, country)
                lat, lng = coords if coords else (None, None)
                
                locations.append({
                    "facility": facility,
                    "city": city,
                    "state": state,
                    "country": country,
                    "lat": lat,
                    "lng": lng
                })
                
                # Rate limit for geocoding
                time.sleep(0.5)
        
        # Sponsor
        sponsor = sponsors.get("leadSponsor", {}).get("name", "Unknown")
        
        # Last updated
        last_update_str = status.get("lastUpdatePostDateStruct", {}).get("date", "")
        try:
            last_updated = datetime.strptime(last_update_str, "%Y-%m-%d").date()
        except:
            last_updated = datetime.now().date()
        
        return {
            "nct_id": nct_id,
            "title": title,
            "phase": phase,
            "status": overall_status,
            "conditions": condition_list,
            "interventions": intervention_list,
            "eligibility_criteria_raw": eligibility_text,
            "min_age": min_age,
            "max_age": max_age,
            "sex": sex,
            "locations": locations,
            "sponsor": sponsor,
            "last_updated": last_updated
        }
    
    async def ingest_trials(self, max_trials: int = 200):
        """Main ingestion pipeline"""
        
        print("Starting trial ingestion...")
        
        # Fetch trials
        studies = await self.fetch_oncology_trials(max_trials)
        
        if not studies:
            print("No trials fetched. Using sample data instead.")
            await self.create_sample_trials()
            return
        
        # Parse and save trials
        async with AsyncSessionLocal() as session:
            for study in studies[:max_trials]:
                try:
                    trial_data = self.parse_trial(study)
                    
                    # Check if trial already exists
                    result = await session.execute(
                        select(TrialORM).where(TrialORM.nct_id == trial_data["nct_id"])
                    )
                    existing = result.scalar_one_or_none()
                    
                    if existing:
                        print(f"Trial {trial_data['nct_id']} already exists, skipping")
                        continue
                    
                    # Create trial
                    locations_data = trial_data.pop("locations")
                    trial = TrialORM(**trial_data)
                    
                    # Add locations
                    for loc_data in locations_data:
                        location = LocationORM(**loc_data)
                        trial.locations.append(location)
                    
                    session.add(trial)
                    await session.commit()
                    
                    print(f"Ingested trial: {trial_data['nct_id']} - {trial_data['title']}")
                    
                except Exception as e:
                    print(f"Error parsing trial: {e}")
                    await session.rollback()
        
        print(f"Ingestion complete!")
    
    async def create_sample_trials(self):
        """Create sample trials for demo purposes"""
        
        sample_trials = [
            {
                "nct_id": "NCT04939948",
                "title": "Dato-DXd Versus Chemotherapy in Previously Treated Inoperable or Metastatic Triple-Negative Breast Cancer",
                "phase": "PHASE3",
                "status": "RECRUITING",
                "conditions": ["Triple Negative Breast Cancer", "TNBC", "Metastatic Breast Cancer"],
                "interventions": ["Datopotamab deruxtecan", "Dato-DXd", "Chemotherapy"],
                "eligibility_criteria_raw": """Inclusion Criteria:
- Histologically or cytologically confirmed triple-negative breast cancer (TNBC)
- Metastatic or locally advanced inoperable disease
- Received 1-2 prior lines of chemotherapy for advanced disease
- ECOG performance status 0-1
- Adequate organ function

Exclusion Criteria:
- Active brain metastases
- Prior treatment with trophoblast cell-surface antigen 2 (Trop-2) directed therapy
- Clinically significant cardiac disease
- Active infection requiring systemic therapy""",
                "min_age": 18,
                "max_age": None,
                "sex": "ALL",
                "sponsor": "Daiichi Sankyo",
                "last_updated": datetime.now().date(),
                "locations": [
                    {"facility": "Apollo Cancer Centre", "city": "Chennai", "state": "Tamil Nadu", "country": "India", "lat": 13.0827, "lng": 80.2707},
                    {"facility": "Tata Memorial Hospital", "city": "Mumbai", "state": "Maharashtra", "country": "India", "lat": 19.0760, "lng": 72.8777}
                ]
            },
            {
                "nct_id": "NCT05382286",
                "title": "AKT Inhibitor Capivasertib in Combination With Paclitaxel in Triple Negative Breast Cancer",
                "phase": "PHASE2",
                "status": "RECRUITING",
                "conditions": ["Triple Negative Breast Cancer", "TNBC"],
                "interventions": ["Capivasertib", "Paclitaxel"],
                "eligibility_criteria_raw": """Inclusion Criteria:
- Metastatic or locally advanced TNBC
- At least one prior chemotherapy regimen for advanced disease
- Measurable disease per RECIST 1.1
- ECOG PS 0-1
- Fresh tumor biopsy required

Exclusion Criteria:
- Brain metastases
- Prior AKT inhibitor therapy
- Uncontrolled diabetes
- Severe hepatic impairment""",
                "min_age": 18,
                "max_age": 75,
                "sex": "ALL",
                "sponsor": "AstraZeneca",
                "last_updated": datetime.now().date(),
                "locations": [
                    {"facility": "CMC Vellore", "city": "Vellore", "state": "Tamil Nadu", "country": "India", "lat": 12.9165, "lng": 79.1325},
                    {"facility": "AIIMS", "city": "New Delhi", "state": "Delhi", "country": "India", "lat": 28.5672, "lng": 77.2100}
                ]
            },
            {
                "nct_id": "NCT04584112",
                "title": "Pembrolizumab Plus Chemotherapy in Triple Negative Breast Cancer",
                "phase": "PHASE3",
                "status": "RECRUITING",
                "conditions": ["Triple Negative Breast Cancer", "TNBC"],
                "interventions": ["Pembrolizumab", "Chemotherapy", "Paclitaxel", "Carboplatin"],
                "eligibility_criteria_raw": """Inclusion Criteria:
- Previously untreated metastatic TNBC
- PD-L1 positive (CPS ≥10)
- ECOG PS 0-1
- No prior immunotherapy

Exclusion Criteria:
- Active autoimmune disease
- Active brain metastases
- Prior immune checkpoint inhibitor therapy""",
                "min_age": 18,
                "max_age": None,
                "sex": "ALL",
                "sponsor": "Merck Sharp & Dohme",
                "last_updated": datetime.now().date(),
                "locations": [
                    {"facility": "Kidwai Memorial Institute", "city": "Bangalore", "state": "Karnataka", "country": "India", "lat": 12.9716, "lng": 77.5946},
                    {"facility": "Apollo Cancer Centre", "city": "Chennai", "state": "Tamil Nadu", "country": "India", "lat": 13.0827, "lng": 80.2707}
                ]
            }
        ]
        
        async with AsyncSessionLocal() as session:
            for trial_data in sample_trials:
                locations_data = trial_data.pop("locations")
                trial = TrialORM(**trial_data)
                
                for loc_data in locations_data:
                    location = LocationORM(**loc_data)
                    trial.locations.append(location)
                
                session.add(trial)
            
            await session.commit()
            print("Sample trials created successfully!")


if __name__ == "__main__":
    async def main():
        from database import init_db
        
        # Initialize database
        await init_db()
        
        # Run ingestion
        ingestion = TrialIngestion()
        await ingestion.ingest_trials(max_trials=50)
    
    asyncio.run(main())
