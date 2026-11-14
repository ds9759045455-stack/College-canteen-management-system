@echo off
title Campusbite - Modern Pure Veg Canteen Management System
color 0A

echo ===================================================================
echo     CAMPUSBITE - CAMPUS CANTEEN MANAGEMENT SYSTEM
echo     100% Pure Vegetarian | Charcoal Black & Forest Green
echo     Core Engine  : Pure C (Linked List, FIFO Queue, LIFO Stack)
echo     Staff PIN    : 1234
echo     Designers    : Developed and Designed by Yash & DIskha
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
echo [*] Launching Campusbite Server...
echo [*] Web URL: http://localhost:3000
echo.
start http://localhost:3000
node server.js

pause
