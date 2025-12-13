import asyncio
from datetime import datetime
from database import AsyncSessionLocal, init_db
from models import PatientORM

async def seed_demo_patients():
    """Create demo patients for Chart Peek mode"""
    
    demo_patients = [
        {
            "patient_id": "P001",
            "name": "Mrs. Lakshmi V.",
            "age": 58,
            "sex": "Female",
            "condition": "Metastatic Triple Negative Breast Cancer",
            "condition_normalized": "TNBC",
            "stage": "Metastatic",
            "line_of_therapy": "3L+",
            "prior_treatments": ["AC-T", "Capecitabine", "Eribulin"],
            "current_treatments": None,
            "biomarkers": {"BRCA1": "WT", "BRCA2": "WT", "PD-L1_CPS": 8},
            "ecog": 1,
            "cns_involvement": False,
            "metastatic_sites": ["Liver", "Bone"],
            "comorbidities": ["Hypertension"],
            "organ_function": "Adequate",
            "location_city": "Chennai",
            "location_country": "India",
            "location_lat": 13.0827,
            "location_lng": 80.2707
        },
        {
            "patient_id": "P002",
            "name": "Mr. Rajesh K.",
            "age": 67,
            "sex": "Male",
            "condition": "Non-Small Cell Lung Cancer EGFR+",
            "condition_normalized": "NSCLC",
            "stage": "Stage IV",
            "line_of_therapy": "2L",
            "prior_treatments": ["Osimertinib"],
            "current_treatments": None,
            "biomarkers": {"EGFR": "L858R", "T790M": "negative"},
            "ecog": 1,
            "cns_involvement": True,
            "metastatic_sites": ["Brain", "Lung"],
            "comorbidities": ["Diabetes"],
            "organ_function": "Adequate",
            "location_city": "Bangalore",
            "location_country": "India",
            "location_lat": 12.9716,
            "location_lng": 77.5946
        },
        {
            "patient_id": "P003",
            "name": "Mrs. Priya S.",
            "age": 45,
            "sex": "Female",
            "condition": "Triple Negative Breast Cancer",
            "condition_normalized": "TNBC",
            "stage": "Metastatic",
            "line_of_therapy": "1L",
            "prior_treatments": [],
            "current_treatments": None,
            "biomarkers": {"BRCA1": "Mutation", "PD-L1_CPS": 15},
            "ecog": 0,
            "cns_involvement": False,
            "metastatic_sites": ["Lung"],
            "comorbidities": [],
            "organ_function": "Adequate",
            "location_city": "Mumbai",
            "location_country": "India",
            "location_lat": 19.0760,
            "location_lng": 72.8777
        }
    ]
    
    async with AsyncSessionLocal() as session:
        for patient_data in demo_patients:
            patient = PatientORM(**patient_data)
            session.add(patient)
        
        await session.commit()
        print("✅ Demo patients created successfully!")

async def main():
    """Initialize database and seed data"""
    
    print("Initializing database...")
    await init_db()
    
    print("Seeding demo patients...")
    await seed_demo_patients()
    
    print("\n🎉 Database setup complete!")
    print("\nDemo Patients:")
    print("- P001: Mrs. Lakshmi V. (TNBC, 3L+, Chennai)")
    print("- P002: Mr. Rajesh K. (NSCLC EGFR+, 2L, Bangalore)")
    print("- P003: Mrs. Priya S. (TNBC, 1L, Mumbai)")

if __name__ == "__main__":
    asyncio.run(main())
