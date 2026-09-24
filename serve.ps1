# Serves the game at http://localhost:8000 (ES modules don't load from file://)
Set-Location $PSScriptRoot
Write-Host "Open http://localhost:8000  (Ctrl+C to stop)"
python -m http.server 8000
