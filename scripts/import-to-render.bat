@echo off
set RENDER_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
pg_restore --clean --if-exists --no-owner --no-privileges -d "%RENDER_DATABASE_URL%" kosher_local.dump
echo.
echo Import terminado.
pause
