# CliniQ 🏥
> **AI-Powered Clinical Trial Matching Assistant** for the Agentic AI App Hackathon.

CliniQ acts as an intelligent layer between oncologists and the complex world of clinical trials. By understanding unstructured patient data (text, voice, images) and the deep semantic logic of trial eligibility criteria, it finds life-saving matches that keyword searches miss.

## 🚀 Key Features

- **🧠 Semantic Matching**: Uses **Google Gemini** to "read" trial protocols and match them against patient profiles with near-human reasoning.
- **📄 Multimodal Screener**: Extract structured patient data instantly from:
  - **Text**: Clinical notes, emails, or case summaries.
  - **Images**: Scans of pathology reports or EMR screenshots.
  - **Voice**: Real-time consultation audio.
- **👂 Ambient Listener**: Runs in the background during consultations. Detects when a patient runs out of standard options and proactively suggests trials.
- **📊 Chart Peek**: A "Population Health" view to monitor existing patients for new trial opportunities automatically.
- **📊 Token Usage Tracking**: All LLM calls automatically track and log token usage (input, output, and total tokens) for cost monitoring and transparency.

## 🛠️ Quick Start

We have provided a unified start script to get both the Backend and Frontend running immediately.

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Google Gemini API Key** (Get it [here](https://makersuite.google.com/app/apikey))
- *(Optional)* **OpenAI API Key** (Only required if you want to use the Voice/Listener features)

### Installation & Run

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd directors-cut
   ```

2. **Run the Start Script**
   ```bash
   cd src
   ./start.sh
   ```
   
   *The script will:*
   - Check for dependencies (Poetry, npm).
   - Install them if missing.
   - Prompt you to add your `GEMINI_API_KEY` to `src/backend/.env`.
   - Seed the local database.
   - Launch the **Backend (Port 8000)** and **Frontend (Port 5173)**.

3. **Open the App**
   - Go to [http://localhost:5173](http://localhost:5173)

## 📚 Documentation

- [**ARCHITECTURE.md**](./ARCHITECTURE.md): System diagrams and component breakdown.
- [**EXPLANATION.md**](./EXPLANATION.md): Deep dive into the AI reasoning and "how it works".
- [**DEMO.md**](./DEMO.md): Video walkthrough and screenshots.

## 🏗️ Project Structure

```
directors-cut/
├── src/
│   ├── backend/          # FastAPI, SQLAlchemy, Gemini Logic
│   ├── frontend/         # React, Vite, Tailwind
│   └── start.sh          # Universal startup script
├── ARCHITECTURE.md       # Technical design
├── EXPLANATION.md        # Solution details
├── DEMO.md               # Demo video/materials
└── README.md             # This file
```

## 🏆 Hackathon Tracks & judging
Built for the **Agentic AI App Hackathon**, focusing on:
- **Technical Excellence**: Robust clean architecture.
- **Gemini Integration**: Utilizing the latest Multimodal capabilities.
- **Societal Impact**: Addressing a critical bottleneck in cancer care.
