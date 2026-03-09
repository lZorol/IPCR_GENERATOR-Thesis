@echo off

echo Starting ML Service...
start /min cmd /k "cd /d ml-service && call .venv\Scripts\activate && python app.py"

echo Starting Backend...
start /min cmd /k "cd /d backend && node server.js"

echo Starting Frontend...
start cmd /k "cd /d frontend && npm run dev"

echo All services started.