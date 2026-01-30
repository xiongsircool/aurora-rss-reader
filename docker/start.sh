#!/bin/bash
set -e

echo "Starting Aurora RSS Reader..."

# Start backend
echo "Starting backend service..."
cd /app/backend
node dist/main.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:15432/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# Start nginx
echo "Starting nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Handle shutdown
trap "kill $BACKEND_PID $NGINX_PID 2>/dev/null" EXIT

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
