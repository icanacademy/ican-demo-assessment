#!/bin/bash

# ICAN Demo Assessment Launcher
# Double-click this file to start the app

cd "$(dirname "$0")"

echo "============================================"
echo "   ICAN Demo Assessment App"
echo "============================================"
echo ""

# Start Cloudflare tunnel if not already running
if ! pgrep -f "cloudflared tunnel run cosmodrive" > /dev/null 2>&1; then
    echo "🌐 Starting Cloudflare Tunnel..."
    cloudflared tunnel run cosmodrive &
    sleep 2
    echo "✅ Cloudflare Tunnel started"
else
    echo "🌐 Cloudflare Tunnel already running"
fi
echo "🌍 Public URL: https://demo.icanacademy.work"
echo ""
echo "Starting server on port 3003..."
echo ""

# Check if port 3003 is already in use
if lsof -i :3003 > /dev/null 2>&1; then
    echo "⚠️  Port 3003 is already in use!"
    echo "The app may already be running."
    echo ""
    echo "Opening browser anyway..."
    sleep 1
    open "http://localhost:3003"
else
    # Start the server
    npm start &
    SERVER_PID=$!

    echo "Waiting for server to start..."
    sleep 2

    echo "✅ Server started!"
    echo ""
    echo "Opening browser..."
    open "http://localhost:3003"

    echo ""
    echo "============================================"
    echo "App running at: http://localhost:3003"
    echo "============================================"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""

    # Wait for the server process
    wait $SERVER_PID
fi
