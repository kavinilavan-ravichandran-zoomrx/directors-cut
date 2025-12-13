#!/bin/bash

# TrialSense - Quick Start Script

echo "🚀 Starting TrialSense..."

# Determine python command
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

# Check if Poetry is installed
if ! command -v poetry &> /dev/null; then
    echo "❌ Poetry not found. Installing..."
    curl -sSL https://install.python-poetry.org | $PYTHON_CMD -
fi

# Backend setup
echo ""
echo "📦 Setting up backend..."
cd backend

# Install dependencies
poetry install

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file..."
    cp ../.env.example .env
    echo "📝 Please edit backend/.env and add your GEMINI_API_KEY"
    echo "   Get your key from: https://makersuite.google.com/app/apikey"
    read -p "Press enter when you've added your API key..."
fi

# Initialize database if needed
if [ ! -f trialsense.db ]; then
    echo "🗄️  Initializing database..."
    poetry run $PYTHON_CMD seed_data.py
    poetry run $PYTHON_CMD ingestion.py
fi

# Start backend in background
echo "🔧 Starting backend server..."
poetry run $PYTHON_CMD main.py &
BACKEND_PID=$!

cd ..

# Frontend setup
echo ""
echo "🎨 Setting up frontend..."
cd frontend

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend
echo "🚀 Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ TrialSense is running!"
echo ""
echo "📍 Backend:  http://localhost:8000"
echo "📍 Frontend: http://localhost:5173"
echo "📍 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
