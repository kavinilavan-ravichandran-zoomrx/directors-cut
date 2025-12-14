from typing import List, Dict, Any, Optional
import os
import json
import re
from datetime import date
from llm_service import LLMService
from gtts import gTTS
import asyncio
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# Initialize Google GenAI client for grounding with Google Search
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

class ClinicalRadarService:
    """
    Service for the Clinical Radar (Ambient Monitoring) feature.
    Monitors patient treatments for safety signals, competitor updates, and trial readouts.
    """
    
    @staticmethod
    async def get_unique_treatments(db_session) -> List[Dict[str, Any]]:
        """Fetch unique current treatments from all patients in the database"""
        from sqlalchemy import select
        from models import PatientORM
        
        result = await db_session.execute(select(PatientORM))
        patients = result.scalars().all()
        
        unique_treatments = set()
        
        # Collect all treatments
        for p in patients:
            if p.current_treatments:
                for tx in p.current_treatments:
                    # Normalize simple string cleaning
                    clean_tx = tx.strip()
                    if clean_tx and clean_tx.lower() != "none" and len(clean_tx) > 2:
                        unique_treatments.add(clean_tx)
        
        return list(unique_treatments)
        
    @staticmethod
    def _extract_citations(response) -> List[Dict[str, str]]:
        """
        Extract citation information from grounding metadata.
        Returns list of {title, url} for each source.
        """
        citations = []
        try:
            if (response.candidates and 
                response.candidates[0].grounding_metadata and
                response.candidates[0].grounding_metadata.grounding_chunks):
                
                chunks = response.candidates[0].grounding_metadata.grounding_chunks
                for chunk in chunks:
                    if chunk.web:
                        citations.append({
                            "title": chunk.web.title or "Source",
                            "url": chunk.web.uri or ""
                        })
        except Exception as e:
            print(f"Error extracting citations: {e}")
        return citations

    @staticmethod
    async def perform_ambient_search(treatment: str) -> Dict[str, Any]:
        """
        Perform a real web search for a specific treatment using Google Search grounding.
        Uses Gemini's grounding with Google Search to get real-time information with citations.
        """
        
        prompt = f"""Search for the latest clinical and safety updates for the oncology drug/treatment: "{treatment}".

Find REAL, CURRENT information about:
1. Recent FDA safety alerts, black box warnings, or adverse event reports
2. New regulatory approvals or label changes
3. Recent clinical trial results or readouts
4. Competitor drug developments in the same therapeutic area

Provide factual information with specific dates and sources. Focus on updates from last week. Today's date is {date.today()}

After searching, summarize the most important finding in this JSON format:
{{
    "drug": "{treatment}",
    "found_update": true/false,
    "category": "ADVERSE_EVENT" or "REGULATORY" or "COMPETITOR" or "TRIAL_UPDATE",
    "severity": "high" or "medium" or "low",
    "title": "Short headline of the finding",
    "description": "2-3 sentence summary with specific details from the search",
    "date": "YYYY-MM-DD format, the date of the update"
}}

If no significant recent updates are found, set found_update to false."""
        
        try:
            # Use Google Search grounding tool
            grounding_tool = types.Tool(
                google_search=types.GoogleSearch()
            )
            
            config = types.GenerateContentConfig(
                tools=[grounding_tool]
            )
            
            # Run the API call in a thread pool since the SDK is synchronous
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=prompt,
                config=config
            )
            
            text = response.text.strip() if response.text else ""
            print(f"Response text length: {len(text)}, preview: {text[:200] if text else 'EMPTY'}")
            
            # Extract citations from grounding metadata
            citations = ClinicalRadarService._extract_citations(response)
            print(f"Found {len(citations)} citations")
            
            # If text is empty but we have citations, build response from citations
            if not text:
                if citations:
                    return {
                        "drug": treatment,
                        "found_update": True,
                        "category": "TRIAL_UPDATE",
                        "severity": "medium",
                        "title": f"Recent updates found for {treatment}",
                        "description": f"Found {len(citations)} relevant sources with recent information.",
                        "date": str(date.today()),
                        "source": citations[0]["title"] if citations else "Google Search",
                        "source_url": citations[0]["url"] if citations else "",
                        "sources": citations
                    }
                else:
                    return {
                        "drug": treatment,
                        "found_update": False,
                        "description": "No response from search",
                        "sources": []
                    }
            
            # Parse JSON from response
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            # Try to extract JSON from the response
            json_match = re.search(r'\{[^{}]*"drug"[^{}]*\}', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            elif text:
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    # If JSON parsing fails, create structured response from text
                    data = {
                        "drug": treatment,
                        "found_update": True,
                        "category": "TRIAL_UPDATE",
                        "severity": "medium", 
                        "title": f"Update for {treatment}",
                        "description": text[:500],
                        "date": str(date.today())
                    }
            else:
                data = {
                    "drug": treatment,
                    "found_update": False,
                    "description": "No structured data returned",
                    "sources": []
                }
            
            # Add real citations from Google Search grounding
            if citations:
                data["sources"] = citations
                data["source"] = citations[0]["title"] if citations else "Google Search"
                data["source_url"] = citations[0]["url"] if citations else ""
            else:
                data["source"] = "Google Search"
                data["source_url"] = ""
                data["sources"] = []
            
            return data
            
        except Exception as e:
            print(f"Error in ambient search with Google grounding: {e}")
            import traceback
            traceback.print_exc()
            return {
                "drug": treatment,
                "found_update": False,
                "description": f"Search error: {str(e)}",
                "sources": []
            }

    @staticmethod
    async def generate_daily_briefing(alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Synthesize alerts into a "Podcast" script and generate audio.
        """
        
        if not alerts:
            return {"podcast_path": None, "transcript": "No new updates today."}
        
        alerts_json = json.dumps(alerts, indent=2)
        
        prompt = f"""You are "Clinical Radar", an AI assistant. Generate a morning briefing podcast script based on these new drug triggers found overnight.
        
        ALERTS:
        {alerts_json}
        
        STYLE:
        - Professional, concise, like a "NPR News" for oncologists.
        - Start with "Good morning, here is your Clinical Radar update."
        - Group by severity.
        - End with "Staying vigilant for your patients."
        - Keep it under 200 words.
        
        OUTPUT: Pure text of the script.
        """
        
        try:
            from llm_service import model
            response = await model.generate_content_async(prompt)
            script = response.text.strip()
            
            # Generate Audio using gTTS
            output_dir = "static/audio"
            os.makedirs(output_dir, exist_ok=True)
            filename = f"briefing_{date.today()}.mp3"
            filepath = os.path.join(output_dir, filename)
            
            tts = gTTS(text=script, lang='en', tld='co.uk')
            await asyncio.to_thread(tts.save, filepath)
            
            return {
                "podcast_url": f"/static/audio/{filename}",
                "transcript": script
            }
            
        except Exception as e:
            print(f"Error generating podcast: {e}")
            return {"podcast_url": None, "transcript": "Error generating briefing."}

    @staticmethod
    async def save_alerts(db_session, alerts: List[Dict[str, Any]]):
        """Save new alerts to DB, avoiding duplicates"""
        from models import RadarAlertORM
        from sqlalchemy import select
        
        for alert_data in alerts:
            # Check for duplicate (same drug + title)
            # In a real app, maybe stricter checks or hash
            result = await db_session.execute(
                select(RadarAlertORM).where(
                    RadarAlertORM.drug == alert_data["drug"],
                    RadarAlertORM.title == alert_data["title"]
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                new_alert = RadarAlertORM(
                    drug=alert_data["drug"],
                    category=alert_data.get("category", "info"),
                    severity=alert_data.get("severity", "low"),
                    title=alert_data["title"],
                    description=alert_data.get("description", ""),
                    source=alert_data.get("source", "Unknown"),
                    source_url=alert_data.get("source_url"),
                    date=alert_data.get("date", str(date.today())),
                    is_new=True
                )
                db_session.add(new_alert)
        
        await db_session.commit()

    @staticmethod
    async def get_alerts(db_session) -> List[Dict[str, Any]]:
        """Get all alerts, sorted by is_new (DESC) then date (DESC)"""
        from models import RadarAlertORM
        from sqlalchemy import select
        
        result = await db_session.execute(
            select(RadarAlertORM).order_by(RadarAlertORM.is_new.desc(), RadarAlertORM.id.desc())
        )
        alerts = result.scalars().all()
        return alerts

    @staticmethod
    async def mark_alerts_as_read(db_session, alert_ids: List[int]):
        """Mark specific alerts as read"""
        from models import RadarAlertORM
        from sqlalchemy import select, update
        
        # If alert_ids is empty, mark all as read? Or just do nothing?
        # Let's support marking specific IDs
        if not alert_ids:
            return
            
        stmt = (
            update(RadarAlertORM)
            .where(RadarAlertORM.id.in_(alert_ids))
            .values(is_new=False)
        )
        await db_session.execute(stmt)
        await db_session.commit()

