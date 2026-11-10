# Windows PowerShell Startup Script for Python FastAPI Backend
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting Financial Fraud Detection Platform (Python Engine)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check Python installation
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not found in PATH. Please install Python 3.10+ from python.org" -ForegroundColor Red
    Exit 1
}

# Virtual environment setup
if (!(Test-Path "venv")) {
    Write-Host "Creating Python virtual environment in ./venv..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
pip install -r requirements.txt

Write-Host "Running automated tests..." -ForegroundColor Green
pytest python_backend/tests/test_api.py -v

Write-Host "Launching Uvicorn server on http://127.0.0.1:8000..." -ForegroundColor Green
uvicorn python_backend.main:app --host 127.0.0.1 --port 8000 --reload
