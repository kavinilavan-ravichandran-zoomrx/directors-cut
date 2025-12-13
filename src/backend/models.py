from sqlalchemy import Column, Integer, String, Float, Boolean, Date, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import date

Base = declarative_base()

# SQLAlchemy ORM Models
class TrialORM(Base):
    __tablename__ = "trials"
    
    id = Column(Integer, primary_key=True, index=True)
    nct_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    phase = Column(String)
    status = Column(String)
    conditions = Column(JSON)  # List of condition strings
    interventions = Column(JSON)  # List of intervention strings
    eligibility_criteria_raw = Column(Text)
    eligibility_parsed = Column(JSON, nullable=True)
    min_age = Column(Integer, nullable=True)
    max_age = Column(Integer, nullable=True)
    sex = Column(String)
    sponsor = Column(String)
    last_updated = Column(Date)
    
    locations = relationship("LocationORM", back_populates="trial", cascade="all, delete-orphan")
    patient_links = relationship("PatientTrialLinkORM", back_populates="trial", cascade="all, delete-orphan")


class LocationORM(Base):
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    trial_id = Column(Integer, ForeignKey("trials.id"), nullable=False)
    facility = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=True)
    country = Column(String, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    
    trial = relationship("TrialORM", back_populates="locations")


class PatientTrialLinkORM(Base):
    __tablename__ = "patient_trial_links"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), nullable=False)
    nct_id = Column(String, ForeignKey("trials.nct_id"), nullable=False)
    
    fit_score = Column(Integer)
    fit_category = Column(String)
    explanation = Column(String)
    meets_criteria = Column(JSON)
    missing_info = Column(JSON)
    match_data = Column(JSON)  # Store full serialized TrialMatch details
    
    patient = relationship("PatientORM", back_populates="saved_trials")
    trial = relationship("TrialORM", back_populates="patient_links")


class PatientORM(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    age = Column(Integer)
    sex = Column(String)
    condition = Column(String)
    condition_normalized = Column(String, nullable=True)
    histology = Column(String, nullable=True)
    stage = Column(String, nullable=True)
    line_of_therapy = Column(String, nullable=True)
    prior_treatments = Column(JSON)
    current_treatments = Column(JSON, nullable=True)
    biomarkers = Column(JSON)
    ecog = Column(String, nullable=True)
    cns_involvement = Column(Boolean, nullable=True)
    metastatic_sites = Column(JSON, nullable=True)
    comorbidities = Column(JSON, nullable=True)
    organ_function = Column(String, nullable=True)
    location_city = Column(String, nullable=True)
    location_country = Column(String, default="India")
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    
    saved_trials = relationship("PatientTrialLinkORM", back_populates="patient", cascade="all, delete-orphan")


# Pydantic Models for API
class Location(BaseModel):
    facility: str
    city: str
    state: Optional[str] = None
    country: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class LocationInput(BaseModel):
    city: str
    country: str = "India"
    lat: Optional[float] = None
    lng: Optional[float] = None


class Trial(BaseModel):
    nct_id: str
    title: str
    phase: str
    status: str
    conditions: List[str]
    interventions: List[str]
    eligibility_criteria_raw: str
    eligibility_parsed: Optional[Dict[str, Any]] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    sex: str
    locations: List[Location]
    sponsor: str
    last_updated: date


class PatientProfile(BaseModel):
    condition: str
    condition_normalized: Optional[str] = None
    histology: Optional[str] = None
    stage: Optional[str] = None
    line_of_therapy: Optional[str] = None
    prior_treatments: List[str] = Field(default_factory=list)
    current_treatments: Optional[List[str]] = None
    biomarkers: Dict[str, Any] = Field(default_factory=dict)
    ecog: Optional[Union[int, str]] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    cns_involvement: Optional[bool] = None
    metastatic_sites: Optional[List[str]] = None
    comorbidities: Optional[List[str]] = None
    organ_function: Optional[str] = None
    location: Optional[LocationInput] = None


class TrialMatch(BaseModel):
    nct_id: str
    title: str
    phase: str
    fit_score: int  # 0-100
    fit_category: str  # "strong", "moderate", "weak", "ineligible"
    nearest_site: Optional[Location] = None
    distance_km: Optional[float] = None
    meets_criteria: List[str]
    fails_criteria: List[str]
    missing_info: List[str]
    explanation: str


class ScreenRequest(BaseModel):
    query: str


class ScreenResponse(BaseModel):
    patient_profile: PatientProfile
    matches: List[TrialMatch]


class MatchRequest(BaseModel):
    patient_profile: PatientProfile


class MatchResponse(BaseModel):
    matches: List[TrialMatch]


class ListenerAnalyzeRequest(BaseModel):
    transcript: str
    accumulated_context: Optional[Dict[str, Any]] = None


class ListenerAnalyzeResponse(BaseModel):
    should_trigger: bool
    confidence: str  # "high", "medium", "low"
    trigger_reason: Optional[str] = None
    patient_profile: Optional[PatientProfile] = None
    matches: Optional[List[TrialMatch]] = None


class ChartResponse(BaseModel):
    patient: PatientProfile
    matches: List[TrialMatch]


class SavePatientRequest(BaseModel):
    name: str
    patient_profile: PatientProfile
    selected_trials: List[TrialMatch]  # Up to 3 selected trials


class SavePatientResponse(BaseModel):
    success: bool
    patient_id: str
    message: str


class PatientListResponse(BaseModel):
    patients: List[Dict[str, Any]]


class UpdatePatientTrialsRequest(BaseModel):
    selected_trials: List[TrialMatch]


class UpdatePatientProfileRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    condition: Optional[str] = None
    stage: Optional[str] = None
    ecog: Optional[Union[int, str]] = None
    line_of_therapy: Optional[str] = None
    prior_treatments: Optional[List[str]] = None
    current_treatments: Optional[List[str]] = None
    biomarkers: Optional[Dict[str, Any]] = None
