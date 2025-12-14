from openai import OpenAI
from typing import Optional
import tempfile
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory explicitly
env_path = Path(__file__).parent / ".env"
print(env_path)
load_dotenv(dotenv_path=env_path)
print(os.getenv("OPENAI_API_KEY"))

class TranscriptionService:
    """Service for audio transcription using OpenAI Whisper"""
    
    _client: Optional[OpenAI] = None
    
    @classmethod
    def get_client(cls) -> OpenAI:
        """Get or create OpenAI client"""
        if cls._client is None:
            # Try reloading if not found
            # if not os.getenv("OPENAI_API_KEY"):
            load_dotenv(dotenv_path=env_path)
            
            api_key = os.getenv("OPENAI_API_KEY")
            
            if not api_key:
                print("❌ OPENAI_API_KEY not found in environment variables")
                print(f"Checked .env at: {env_path}")
                raise ValueError("OPENAI_API_KEY environment variable not set. Please add it to your .env file to use transcription features.")
                
            cls._client = OpenAI(api_key=api_key)
            print(f"✅ OpenAI client initialized for Whisper transcription")
        return cls._client
    
    @staticmethod
    async def transcribe_audio(audio_data: bytes, filename: str = "audio.webm") -> str:
        """
        Transcribe audio using OpenAI Whisper API
        
        Args:
            audio_data: Raw audio bytes
            filename: Original filename with extension
            
        Returns:
            Transcribed text
        """
        try:
            client = TranscriptionService.get_client()
            
            # Validate audio data size
            if len(audio_data) < 1000:
                raise ValueError(f"Audio file too small ({len(audio_data)} bytes). Please record for at least 1-2 seconds.")
            
            # Determine file extension
            ext = filename.split(".")[-1] if "." in filename else "webm"
            
            # Write audio to temp file (Whisper API requires a file)
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name
            
            try:
                # Call Whisper API
                print(f"🎤 Transcribing audio ({len(audio_data)} bytes)...")
                
                with open(temp_path, "rb") as audio_file:
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="en",
                        response_format="text"
                    )
                
                print(f"✅ Transcription complete: {len(transcript)} characters")
                return transcript.strip() if isinstance(transcript, str) else transcript.text.strip()
                
            finally:
                # Clean up temp file
                os.unlink(temp_path)
                
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            raise
