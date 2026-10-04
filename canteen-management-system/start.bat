@echo off
title Hitahara - Canteen Management System
color 0E

echo ===================================================================
echo     HITAHARA - CAMPUS CANTEEN MANAGEMENT SYSTEM
echo     Core Engine : Pure C (Linked List, FIFO Queue, LIFO Stack)
echo     Frontend    : Clean Luxury UI (Student Menu + Protected Staff Portal)
echo     Staff PIN   : 1234
echo ===================================================================
echo.

cd /d "%~dp0\core"
echo [*] Checking C Core Data Structures Engine...
if not exist canteen_core.exe (
    echo [*] Compiling C Engine with Zig...
    zig cc -Wall -Wextra canteen_core.c -o canteen_core.exe
)
if exist canteen_core.exe (
    echo [OK] canteen_core.exe is ready!
)

echo.
cd /d "%~dp0\server"
echo [*] Launching Hitahara Server...
echo [*] Web URL: http://localhost:3000
echo.
start http://localhost:3000
node server.js

pause
