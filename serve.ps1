# Serves the game at http://localhost:8000 (ES modules don't load from file://).
# Caching is off, so a normal reload always picks up code changes.
Set-Location $PSScriptRoot
python serve.py 8000
