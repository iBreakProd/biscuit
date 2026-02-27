#!/bin/bash

# Base API URL
API="http://localhost:3001"

echo "======================================"
echo "      Testing Chat API Endpoints      "
echo "======================================"

# 1. Test Health Check
echo -e "\n[1] Checking /health status..."
curl -s "$API/health" | jq || echo "Failed to reach health endpoint"

# 2. Create Chat Room
echo -e "\n[2] Creating a new Chat Room..."
CHAT_RESPONSE=$(curl -s -X POST "$API/chats" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$CHAT_RESPONSE" | jq

CHAT_ID=$(echo "$CHAT_RESPONSE" | jq -r '.id')
if [ "$CHAT_ID" == "null" ] || [ -z "$CHAT_ID" ]; then
    echo "ERROR: Could not retrieve CHAT_ID. Make sure the server is running."
    exit 1
fi
echo "✅ Chat Room Created! ID: $CHAT_ID"

# 3. Add Message to Chat
echo -e "\n[3] Sending a new message to chat $CHAT_ID..."
MSG_RESPONSE=$(curl -s -X POST "$API/chats/$CHAT_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, this is a test agent task request!"}')

echo "$MSG_RESPONSE" | jq

TASK_ID=$(echo "$MSG_RESPONSE" | jq -r '.taskId')
if [ "$TASK_ID" == "null" ] || [ -z "$TASK_ID" ]; then
    echo "ERROR: Could not retrieve TASK_ID."
    exit 1
fi
echo "✅ Message sent! Generated Task ID: $TASK_ID"

# 4. Get Chat History 
echo -e "\n[4] Getting Chat History..."
curl -s "$API/chats/$CHAT_ID" | jq

# 5. Get Initial Task Object
echo -e "\n[5] Polling Task State..."
curl -s "$API/tasks/$TASK_ID" | jq

echo -e "\n\nTest Run Complete!"
echo "To test real-time server-sent events (SSE) manually, run:"
echo "curl -N -H \"Accept: text/event-stream\" $API/sse/agent/$TASK_ID"
