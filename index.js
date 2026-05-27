@echo off
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=kosher_local
set PGUSER=postgres
set PGPASSWORD=TU_PASSWORD_LOCAL
pg_dump -Fc -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f kosher_local.dump
echo.
echo Export listo: kosher_local.dump
pause
