@echo off 
echo Iniciando Parking Management... 
cd /d "%~dp0"
echo Verificando base de datos...
node scripts/migrate_db.js
start http://localhost:3000 
npm run dev
