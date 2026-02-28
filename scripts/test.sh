#!/bin/bash
# Unified Iteration Target: scripts/test.sh
# Validates Sections phase-by-phase according to Spec.md specs:
# [Phase 0-1] API Sanity and Bad payload 404/400 checks
# [Phase 3] Agent Lifecycle running 7 ReAct steps fully via SSE
# [Phase 4] Embedding seed injection and Qdrant testing with vector_search Tool usage.
# NOTE: All routes except /health and /auth/* require a Bearer token.
#       Set DRIVE_TEST_TOKEN env var before running.

API="http://localhost:3001"

if [ -z "$DRIVE_TEST_TOKEN" ]; then
  echo "❌ DRIVE_TEST_TOKEN is not set. All routes except /health require auth."
  echo "   Login via http://localhost:3001/auth/google, copy the token, then run:"
  echo "   DRIVE_TEST_TOKEN=\"<token>\" ./scripts/test.sh"
  exit 1
fi

TOK="$DRIVE_TEST_TOKEN"

echo "======================================"
echo "    Phase 3: Agent Exec API Tests     "
echo "======================================"

# 1. Health check
echo -e "\n[1] Checking /health status..."
curl -s "$API/health" | jq || echo "Failed to reach health endpoint"

# 2. Chat basics: POST /chats with invalid body
echo -e "\n[2] Edge Case: Create Chat Room with Invalid Schema... (expecting 401 without token — now 401 is success)"
INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/chats" -H "Content-Type: application/json" -d '{}')
echo "Response without token: HTTP $INVALID_STATUS (expected 401)"

# 3. Chat basics: GET non-existent chat
echo -e "\n[3] Edge Case: Fetching a non-existent Chat Room... (expecting 404/error)"
curl -s -H "Authorization: Bearer $TOK" "$API/chats/00000000-0000-0000-0000-000000000001" | jq

# 4. Chat basics: POST /chats with valid body
echo -e "\n[4] Creating a new Chat Room..."
CHAT_RESPONSE=$(curl -s -X POST "$API/chats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d '{}')

CHAT_ID=$(echo "$CHAT_RESPONSE" | jq -r '.id')
if [ "$CHAT_ID" == "null" ] || [ -z "$CHAT_ID" ]; then
    echo "❌ ERROR: Could not retrieve CHAT_ID. Ensure the server is running."
    exit 1
fi
echo "✅ Chat Room Created! ID: $CHAT_ID"

# 5. Agent lifecycle: POST /chats/:chatId/messages
echo -e "\n[5] Sending a new message to chat $CHAT_ID..."
MSG_RESPONSE=$(curl -s -X POST "$API/chats/$CHAT_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d '{"content": "Tell me a short 2 sentence story."}')

TASK_ID=$(echo "$MSG_RESPONSE" | jq -r '.taskId')
if [ "$TASK_ID" == "null" ] || [ -z "$TASK_ID" ]; then
    echo "❌ ERROR: Could not retrieve TASK_ID."
    exit 1
fi
echo "✅ Message sent! Generated Task ID: $TASK_ID"

# 6. Polling Task State until completion
echo -e "\n[6] Polling Task State..."
MAX_RETRIES=35
RETRY_COUNT=0
STATUS="running"
TASK_RESPONSE=""

while [[ "$STATUS" == "pending" || "$STATUS" == "running" ]]; do
  TASK_RESPONSE=$(curl -s -H "Authorization: Bearer $TOK" "$API/tasks/$TASK_ID")
  STATUS=$(echo "$TASK_RESPONSE" | jq -r '.status')
  
  echo -ne "Task status: $STATUS (Attempt $RETRY_COUNT / $MAX_RETRIES)\r"
  
  if [[ "$STATUS" != "pending" && "$STATUS" != "running" ]]; then
    break
  fi
  
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Timeout waiting for task to complete."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  sleep 2
done

echo -e "\n✅ Task finished with status: $STATUS"

# Assert Task properties
FINAL_ANSWER=$(echo "$TASK_RESPONSE" | jq -r '.finalAnswerMarkdown // empty')
STEP_SUMMARIES_LEN=$(echo "$TASK_RESPONSE" | jq '.stepSummaries | length')

if [ "$STATUS" == "completed" ] && [ -n "$FINAL_ANSWER" ] && [ "$STEP_SUMMARIES_LEN" -gt 0 ]; then
    echo "✅ Agent lifecycle assertions passed! (completed, finalAnswer and stepSummaries populated)"
else
    echo "❌ Agent lifecycle assertions failed!"
    echo "FINAL_ANSWER: $FINAL_ANSWER"
    echo "STEP_SUMMARIES_LEN: $STEP_SUMMARIES_LEN"
    echo "$TASK_RESPONSE" | jq
fi

# 7. Events verification
echo -e "\n[7] Verifying Agent Event Stream..."
EVENTS_DATA=$(curl -s -H "Authorization: Bearer $TOK" "$API/tasks/$TASK_ID/events")

START_COUNT=$(echo "$EVENTS_DATA" | jq '[.events[] | select(.type == "start")] | length')
PLAN_COUNT=$(echo "$EVENTS_DATA" | jq '[.events[] | select(.type == "plan")] | length')
EXEC_COUNT=$(echo "$EVENTS_DATA" | jq '[.events[] | select(.type == "step_executing")] | length')
COMP_COUNT=$(echo "$EVENTS_DATA" | jq '[.events[] | select(.type == "step_complete")] | length')
FINISH_COUNT=$(echo "$EVENTS_DATA" | jq '[.events[] | select(.type == "finish")] | length')

MISSING_ID_COUNT=$(echo "$EVENTS_DATA" | jq '[.events[] | select(.id == null)] | length')

if [ "$START_COUNT" -ge 1 ] && [ "$PLAN_COUNT" -ge 1 ] && [ "$EXEC_COUNT" -ge 1 ] && [ "$COMP_COUNT" -ge 1 ] && [ "$FINISH_COUNT" -ge 1 ]; then
    echo "✅ Agent events contained all required types: start, plan, step_executing, step_complete, finish!"
else
    echo "❌ Missing some event types!"
    echo "START: $START_COUNT, PLAN: $PLAN_COUNT, EXEC: $EXEC_COUNT, COMP: $COMP_COUNT, FINISH: $FINISH_COUNT"
fi

if [ "$MISSING_ID_COUNT" -eq 0 ]; then
    echo "✅ All events have valid stream IDs!"
else
    echo "❌ $MISSING_ID_COUNT events are missing stream IDs!"
fi

# ======================================
# Phase 4: Vector Search Tool
# ======================================
echo -e "\n\n======================================"
echo "    Phase 4: Vector Search Tool       "
echo "======================================"

echo -e "\n[8] Seeding Dummy Data into Qdrant..."
SEED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOK" "$API/seed")
if [ "$SEED_STATUS" -ne 200 ]; then
    echo "❌ ERROR: Failed to seed dummy data. HTTP Status: $SEED_STATUS"
    exit 1
else
    echo "✅ Seeded successfully (HTTP 200)"
fi

echo -e "\n[9] Edge Case: Query Vector Debug endpoint with invalid schema... (expecting 400 failure)"
DEBUG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET -H "Authorization: Bearer $TOK" "$API/debug/qdrant/vector-search?topK=5")
if [ "$DEBUG_STATUS" -ne 400 ]; then
    echo "❌ ERROR: Expected HTTP 400 for invalid query schema, got: $DEBUG_STATUS"
    exit 1
else
    echo "✅ Invalid schema correctly rejected with HTTP 400"
fi

echo -e "\n[10] Creating a new Chat Room for Vector Search Test..."
CHAT_RESPONSE2=$(curl -s -X POST "$API/chats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d '{}')
CHAT_ID2=$(echo "$CHAT_RESPONSE2" | jq -r '.id')
echo "✅ Chat Room Created! ID: $CHAT_ID2"

echo -e "\n[11] Sending Vector Search query..."
MSG_RESPONSE2=$(curl -s -X POST "$API/chats/$CHAT_ID2/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d '{"content": "Tell me what vector search is according to your internal seeded docs."}')

TASK_ID2=$(echo "$MSG_RESPONSE2" | jq -r '.taskId')
echo "✅ Message sent! Generated Task ID: $TASK_ID2"

echo -e "\n[12] Polling Task State..."
STATUS2="running"
TASK_RESPONSE2=""
MAX_RETRIES2=40
RETRY_COUNT2=0

while [[ "$STATUS2" == "pending" || "$STATUS2" == "running" ]]; do
  TASK_RESPONSE2=$(curl -s -H "Authorization: Bearer $TOK" "$API/tasks/$TASK_ID2")
  STATUS2=$(echo "$TASK_RESPONSE2" | jq -r '.status')
  
  echo -ne "Task status: $STATUS2 (Attempt $RETRY_COUNT2 / $MAX_RETRIES2)\r"
  
  if [[ "$STATUS2" != "pending" && "$STATUS2" != "running" ]]; then
    break
  fi
  
  if [ $RETRY_COUNT2 -ge $MAX_RETRIES2 ]; then
    echo "❌ Timeout waiting for task to complete."
    break
  fi
  
  RETRY_COUNT2=$((RETRY_COUNT2+1))
  sleep 2
done

echo -e "\n✅ Task finished with status: $STATUS2"

FINAL_ANSWER2=$(echo "$TASK_RESPONSE2" | jq -r '.finalAnswerMarkdown // empty')
echo "Final Answer: $FINAL_ANSWER2"

if echo "$FINAL_ANSWER2" | grep -qi "semantic retrieval" || echo "$FINAL_ANSWER2" | grep -qi "vector search" || echo "$FINAL_ANSWER2" | grep -qi "dummy AI response"; then
    echo "✅ Agent successfully answered using seeded vector docs!"
else
    echo "❌ Agent failed to use seeded vector docs in final answer!"
fi

echo -e "\n[13] Verifying Agent Event Stream for Vector Search Tool..."
EVENTS_DATA2=$(curl -s -H "Authorization: Bearer $TOK" "$API/tasks/$TASK_ID2/events")
TOOL_USED=$(echo "$EVENTS_DATA2" | jq '[.events[] | select(.tools != null) | .tools[] | select(. == "vector_search")] | length')

if [ "$TOOL_USED" -ge 1 ]; then
    echo "✅ Agent successfully executed vector_search tool inside its ReAct loop!"
else
    echo "❌ Agent failed to execute vector_search tool! TOOL_USED matches found: $TOOL_USED"
fi

echo -e "\n\nTest Run Complete!"
echo -e "\n============================================="
echo -e "  Phase 5: Google Auth + Basic Drive Listing   "
echo -e "============================================="

echo -e "\n============================================="
echo -e "  Phase 5: Google Auth + Drive Sync Verify   "
echo -e "============================================="
echo -e "\n[14] Verifying Drive is accessible with provided token..."
DRIVE_FILES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOK" "$API/drive/files")
if [ "$DRIVE_FILES_STATUS" -eq 200 ]; then
  echo "✅ Drive files endpoint accessible with provided token!"
elif [ "$DRIVE_FILES_STATUS" -eq 401 ]; then
  echo "❌ Token is invalid or expired. Re-login at http://localhost:3001/auth/google"
  exit 1
else
  echo "⚠️  Unexpected status $DRIVE_FILES_STATUS from /drive/files"
fi

echo -e "\n============================================="
echo -e "  Phase 6: Fetch Worker + Ingestion Progress  "
echo -e "============================================="

if [ -z "$DRIVE_TEST_TOKEN" ]; then
    echo "⚠️  Skipping automated Phase 6 tests because DRIVE_TEST_TOKEN is not set."
    echo "To run these tests, set DRIVE_TEST_TOKEN to a valid JWT from the /auth/google login flow."
    echo "Example: DRIVE_TEST_TOKEN=\"eyJhbG...\" ./scripts/test.sh"
else
    echo -e "\n[15] Testing POST /drive/sync triggers jobs..."
    SYNC_RESPONSE=$(curl -s -X POST "$API/drive/sync?limit=3" -H "Authorization: Bearer $DRIVE_TEST_TOKEN")
    SYNC_STATUS=$(echo "$SYNC_RESPONSE" | jq -r 'if type == "object" and has("status") then "success" else "error" end')
    
    if [ "$SYNC_STATUS" != "success" ]; then
        echo "❌ ERROR: /drive/sync failed or returned unexpected response:"
        echo "$SYNC_RESPONSE" | jq
    else
        SUPPORTED_IN_SYNC=$(echo "$SYNC_RESPONSE" | jq -r '.summary.supportedCount // 0')
        echo "✅ /drive/sync triggered successfully. $SUPPORTED_IN_SYNC supported files discovered."
        echo "Polling /drive/progress until all files reach terminal state (indexed or failed)..."
        echo "⏳ Giving workers 3s to pick up jobs..."
        sleep 3
        
        MAX_POLLS=40
        POLLS=0
        while [ $POLLS -lt $MAX_POLLS ]; do
            PROGRESS=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/drive/progress")
            INDEXED=$(echo "$PROGRESS" | jq -r '.totals.indexed // 0')
            SUPPORTED=$(echo "$PROGRESS" | jq -r '.totals.supported // 0')
            FAILED=$(echo "$PROGRESS" | jq -r '.totals.failed // 0')
            TERMINAL=$((INDEXED + FAILED))
            
            echo -ne "Progress: $INDEXED indexed, $FAILED failed out of $SUPPORTED supported (Attempt $POLLS / $MAX_POLLS)\r"
            
            if [ "$SUPPORTED" == "0" ]; then
                echo -e "\n⚠️ No supported files found in Drive to process."
                break
            fi
            
            if [ "$TERMINAL" -ge "$SUPPORTED" ]; then
                echo -e "\n✅ All $SUPPORTED files reached terminal state! ($INDEXED indexed, $FAILED failed)"
                break
            fi
            
            if [ $POLLS -ge $((MAX_POLLS - 1)) ]; then
                echo -e "\n❌ Timeout: only $TERMINAL / $SUPPORTED files reached terminal state after $((MAX_POLLS * 3))s."
            fi
            
            POLLS=$((POLLS+1))
            sleep 3
        done
        echo -e "\n✅ Workers processed the pipeline. Files are now indexed or failed."
    fi
    
    echo -e "\n[16] Testing POST /drive/files/:fileId/retry..."
    # Grab the first failed file if any exist 
    FAILED_FILE_ID=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/drive/progress" | jq -r '.files[] | select(.ingestionPhase == "failed") | .fileId' | head -n 1)
    
    if [ -z "$FAILED_FILE_ID" ] || [ "$FAILED_FILE_ID" == "null" ] || [ "$FAILED_FILE_ID" == "" ]; then
        echo "⚠️ No failed files found to test the retry endpoint."
    else
        echo "Testing retry on file ID: $FAILED_FILE_ID"
        RETRY_RESPONSE=$(curl -s -X POST "$API/drive/files/$FAILED_FILE_ID/retry" -H "Authorization: Bearer $DRIVE_TEST_TOKEN")
        RETRY_MSG=$(echo "$RETRY_RESPONSE" | jq -r '.message // .error')
        if echo "$RETRY_MSG" | grep -qi "successfully"; then
             echo "✅ Retry endpoint successfully reset file back to discovered/chunk_pending queue!"
        else
             echo "❌ Retry endpoint returned unexpected response: $RETRY_MSG"
        fi
    fi
    echo -e "\n============================================="
    echo -e "  Phase 7: Vectorize Worker & Indexing       "
    echo -e "============================================="
    echo -e "\n[17] Verifying files transitioned to 'indexed'..."
    
    INDEXED_COUNT=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/drive/progress" | jq -r '.totals.indexed // 0')
    if [ "$INDEXED_COUNT" -gt 0 ]; then
         echo "✅ Success! $INDEXED_COUNT files reached the terminal 'indexed' state."
    else
         echo "❌ Failure! No files reached 'indexed' state. Ensure worker-drive-vectorize is running!"
    fi
    
    # Optional debug check for chunks if endpoint exists, or just explain manual check
    echo -e "\n✅ To manually verify Phase 7 chunks, check your PostgreSQL 'chunks' table and Qdrant 'drive_vectors' collection for matching UUIDs."
fi

echo -e "\n✅ Test Run Complete! Run workers in another terminal window using 'pnpm -F worker-drive-fetch run dev' to see queues drain in real-time."

echo -e "\n============================================="
echo -e "  Phase 8: Drive Retrieve Tool + Citations    "
echo -e "============================================="

if [ -z "$DRIVE_TEST_TOKEN" ]; then
  echo "⚠️  DRIVE_TEST_TOKEN is not set. Skipping Phase 8 (requires authenticated user with indexed Drive files)."
else
  echo -e "\n[P8-1] Creating a new Chat Room for Drive Retrieve Test..."
  CHAT_RESPONSE3=$(curl -s -X POST "$API/chats" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{}')
  CHAT_ID3=$(echo "$CHAT_RESPONSE3" | jq -r '.id')
  echo "✅ Chat Room Created! ID: $CHAT_ID3"

  echo -e "\n[P8-2] Sending Drive Search query..."
  MSG_RESPONSE3=$(curl -s -X POST "$API/chats/$CHAT_ID3/messages" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{"content": "Using the drive_retrieve tool, summarize the specific Google Drive document I just synced including its file name."}')

  TASK_ID3=$(echo "$MSG_RESPONSE3" | jq -r '.taskId')
  echo "✅ Message sent! Generated Task ID: $TASK_ID3"

  echo -e "\n[P8-3] Polling Task State..."
  STATUS3="running"
  TASK_RESPONSE3=""
  MAX_RETRIES3=40
  RETRY_COUNT3=0

  while [[ "$STATUS3" == "pending" || "$STATUS3" == "running" ]]; do
    TASK_RESPONSE3=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/tasks/$TASK_ID3")
    STATUS3=$(echo "$TASK_RESPONSE3" | jq -r '.status')
    
    echo -ne "Task status: $STATUS3 (Attempt $RETRY_COUNT3 / $MAX_RETRIES3)\r"
    
    if [[ "$STATUS3" != "pending" && "$STATUS3" != "running" ]]; then
      break
    fi
    
    if [ $RETRY_COUNT3 -ge $MAX_RETRIES3 ]; then
      echo "❌ Timeout waiting for task to complete."
      break
    fi
    
    RETRY_COUNT3=$((RETRY_COUNT3+1))
    sleep 2
  done

  echo -e "\n✅ Task finished with status: $STATUS3"

  # Assert drive_retrieve was used
  EVENTS_DATA3=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/tasks/$TASK_ID3/events")
  TOOL_USED3=$(echo "$EVENTS_DATA3" | jq '[.events[] | select(.tools != null) | .tools[] | select(. == "drive_retrieve")] | length')

  if [ "$TOOL_USED3" -ge 1 ]; then
      echo "✅ Agent successfully executed drive_retrieve tool inside its ReAct loop!"
  else
      echo "❌ Agent failed to execute drive_retrieve tool! TOOL_USED matches found: $TOOL_USED3"
  fi

  # Assert citations exist
  CITATIONS_LEN=$(echo "$TASK_RESPONSE3" | jq '.resultJson.citations | length')
  if [ "$CITATIONS_LEN" -gt 0 ]; then
      echo "✅ Citations were successfully bubbled up to the final task state! Count: $CITATIONS_LEN"
      
      FIRST_CHUNK_ID=$(echo "$TASK_RESPONSE3" | jq -r '.resultJson.citations[0].chunkId // empty')
      
      echo -e "\n[P8-4] Testing GET /drive/chunk/:chunkId..."
      if [ -n "$FIRST_CHUNK_ID" ] && [ "$FIRST_CHUNK_ID" != "null" ]; then
          echo "Fetching chunk preview for chunk ID: $FIRST_CHUNK_ID..."
          CHUNK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/drive/chunk/$FIRST_CHUNK_ID")
          if [ "$CHUNK_STATUS" -eq 200 ]; then
              echo "✅ GET /drive/chunk/:chunkId returned HTTP 200!"
              curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/drive/chunk/$FIRST_CHUNK_ID" | jq '{ chunkId, fileId, fileName, mimeType }'
          else
              echo "❌ GET /drive/chunk/:chunkId returned HTTP $CHUNK_STATUS"
          fi
      else
          echo "❌ No valid chunk ID found in citations to test the preview route."
      fi
  else
      echo "❌ No citations were generated in the final response. Check server logs for [drive_retrieve] output."
  fi
fi

echo -e "\n\n============================================="
echo -e "  Phase 9: Web Tools (web_search, web_scrape) "
echo -e "============================================="

if [ -z "$DRIVE_TEST_TOKEN" ]; then
  echo "⚠️  DRIVE_TEST_TOKEN is not set. Skipping Phase 9 (requires authenticated session)."
else
  echo -e "\n[P9-1] Creating a new Chat Room for Web Search Test..."
  CHAT_RESPONSE9=$(curl -s -X POST "$API/chats" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{}')
  CHAT_ID9=$(echo "$CHAT_RESPONSE9" | jq -r '.id')
  if [ "$CHAT_ID9" == "null" ] || [ -z "$CHAT_ID9" ]; then
    echo "❌ ERROR: Could not create chat room for Phase 9."
    exit 1
  fi
  echo "✅ Chat Room Created! ID: $CHAT_ID9"

  echo -e "\n[P9-2] Sending a web-search-triggering message..."
  MSG_RESPONSE9=$(curl -s -X POST "$API/chats/$CHAT_ID9/messages" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{"content": "Search the web for the latest news about OpenAI and summarize what you find."}')

  TASK_ID9=$(echo "$MSG_RESPONSE9" | jq -r '.taskId')
  if [ "$TASK_ID9" == "null" ] || [ -z "$TASK_ID9" ]; then
    echo "❌ ERROR: Could not retrieve TASK_ID for Phase 9."
    exit 1
  fi
  echo "✅ Message sent! Generated Task ID: $TASK_ID9"

  echo -e "\n[P9-3] Polling Task State until completion..."
  STATUS9="running"
  TASK_RESPONSE9=""
  MAX_RETRIES9=45
  RETRY_COUNT9=0

  while [[ "$STATUS9" == "pending" || "$STATUS9" == "running" ]]; do
    TASK_RESPONSE9=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/tasks/$TASK_ID9")
    STATUS9=$(echo "$TASK_RESPONSE9" | jq -r '.status')

    echo -ne "Task status: $STATUS9 (Attempt $RETRY_COUNT9 / $MAX_RETRIES9)\r"

    if [[ "$STATUS9" != "pending" && "$STATUS9" != "running" ]]; then
      break
    fi

    if [ $RETRY_COUNT9 -ge $MAX_RETRIES9 ]; then
      echo -e "\n❌ Timeout waiting for Phase 9 task to complete."
      break
    fi

    RETRY_COUNT9=$((RETRY_COUNT9+1))
    sleep 2
  done

  echo -e "\n✅ Task finished with status: $STATUS9"

  # Assert web_search tool was used
  echo -e "\n[P9-4] Verifying web_search was executed in the Agent Event Stream..."
  EVENTS_DATA9=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/tasks/$TASK_ID9/events")
  TOOL_USED9=$(echo "$EVENTS_DATA9" | jq '[.events[] | select(.tools != null) | .tools[] | select(. == "web_search")] | length')

  if [ "$TOOL_USED9" -ge 1 ]; then
    echo "✅ Agent successfully executed web_search tool inside its ReAct loop!"
  else
    echo "❌ Agent failed to execute web_search tool! Matches found: $TOOL_USED9"
    echo "   Tip: Ensure TAVILY_API_KEY is set in the server environment."
  fi

  # Assert at least one WebCitation was generated
  echo -e "\n[P9-5] Verifying WebCitations in final task state..."
  WEB_CITES9=$(echo "$TASK_RESPONSE9" | jq '[.resultJson.citations[]? | select(.type == "web")] | length')

  if [ "$WEB_CITES9" -ge 1 ]; then
    echo "✅ WebCitations successfully populated! Count: $WEB_CITES9"
    echo "$TASK_RESPONSE9" | jq '.resultJson.citations[]? | select(.type == "web") | { type, url, title }'
  else
    echo "❌ No WebCitations found in resultJson.citations."
    echo "   Full citations dump:"
    echo "$TASK_RESPONSE9" | jq '.resultJson.citations'
  fi

  # ── [P9-6] web_scrape explicit test ──────────────────────────────────────
  echo -e "\n[P9-6] Testing web_scrape tool explicitly..."
  CHAT_RESPONSE9B=$(curl -s -X POST "$API/chats" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{}')
  CHAT_ID9B=$(echo "$CHAT_RESPONSE9B" | jq -r '.id')
  echo "✅ Chat Room Created! ID: $CHAT_ID9B"

  MSG_RESPONSE9B=$(curl -s -X POST "$API/chats/$CHAT_ID9B/messages" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{"content": "Scrape the webpage at https://www.thehindu.com/news/national/supreme-court-orders-removal-of-stray-dogs-from-schools-hospitals-other-public-institutions-directs-nhai-to-clear-cattle-from-highways/article70251263.ece and tell me what it says."}')
  TASK_ID9B=$(echo "$MSG_RESPONSE9B" | jq -r '.taskId')
  echo "✅ Message sent! Generated Task ID: $TASK_ID9B"

  STATUS9B="running"
  TASK_RESPONSE9B=""
  MAX_RETRIES9B=45
  RETRY_COUNT9B=0

  while [[ "$STATUS9B" == "pending" || "$STATUS9B" == "running" ]]; do
    TASK_RESPONSE9B=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/tasks/$TASK_ID9B")
    STATUS9B=$(echo "$TASK_RESPONSE9B" | jq -r '.status')
    echo -ne "Task status: $STATUS9B (Attempt $RETRY_COUNT9B / $MAX_RETRIES9B)\r"
    if [[ "$STATUS9B" != "pending" && "$STATUS9B" != "running" ]]; then break; fi
    if [ $RETRY_COUNT9B -ge $MAX_RETRIES9B ]; then echo -e "\n❌ Timeout waiting for scrape task."; break; fi
    RETRY_COUNT9B=$((RETRY_COUNT9B+1))
    sleep 2
  done
  echo -e "\n✅ Scrape task finished with status: $STATUS9B"

  EVENTS_DATA9B=$(curl -s -H "Authorization: Bearer $DRIVE_TEST_TOKEN" "$API/tasks/$TASK_ID9B/events")
  SCRAPE_USED=$(echo "$EVENTS_DATA9B" | jq '[.events[] | select(.tools != null) | .tools[] | select(. == "web_scrape")] | length')

  # Also check for reflecting events being emitted (per-step LLM thought)
  REFLECTING_COUNT=$(echo "$EVENTS_DATA9B" | jq '[.events[] | select(.type == "reflecting")] | length')

  if [ "$SCRAPE_USED" -ge 1 ]; then
    echo "✅ Agent successfully executed web_scrape tool!"
  else
    echo "❌ Agent did not execute web_scrape. SCRAPE_USED=$SCRAPE_USED"
    echo "   Tip: The agent plans steps — if no step contains 'scrape'/'webpage', the keyword router won't trigger."
  fi

  if [ "$REFLECTING_COUNT" -ge 1 ]; then
    echo "✅ Per-step 'reflecting' events are being emitted! Count: $REFLECTING_COUNT"
  else
    echo "⚠️  No 'reflecting' events found (thought generation may not have triggered)."
  fi
fi

echo -e "\n\n============================================="
echo -e "  Phase 10: Concurrency Limits (429 Tests)    "
echo -e "============================================="

if [ -z "$DRIVE_TEST_TOKEN" ]; then
  echo "⚠️  DRIVE_TEST_TOKEN is not set. Skipping Phase 10."
else
  echo -e "\n[P10-1] Testing Global Concurrency Limits..."
  echo "Firing 11 concurrent requests to POST /chats/:chatId/messages..."
  
  # Create a fresh chat for these requests
  CHAT_RESPONSE10=$(curl -s -X POST "$API/chats" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
    -d '{}')
  CHAT_ID10=$(echo "$CHAT_RESPONSE10" | jq -r '.id')
  
  if [ "$CHAT_ID10" == "null" ] || [ -z "$CHAT_ID10" ]; then
    echo "❌ ERROR: Could not create chat room for Phase 10."
    exit 1
  fi
  
  > /tmp/parallel_results.txt
  
  # Fire 11 requests in parallel
  for i in {1..11}; do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/chats/$CHAT_ID10/messages" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DRIVE_TEST_TOKEN" \
      -d "{\"content\": \"Concurrency test message $i\"}" >> /tmp/parallel_results.txt &
  done
  
  # Wait for all background curls to finish
  wait
  
  echo "Done. Aggregating HTTP status codes:"
  cat /tmp/parallel_results.txt | sort | uniq -c
  
  # We expect at least one 429 response because the limit is 10
  if grep -q "429" /tmp/parallel_results.txt; then
    echo "✅ Concurrency limit successfully enforced! Received at least one HTTP 429 Too Many Requests."
  else
    echo "❌ Concurrency limit failed or was not reached! Expected at least one 429 response."
  fi
  
  rm /tmp/parallel_results.txt
  
  echo -e "\n⏳ Giving the active tasks a moment to clear out before concluding..."
  sleep 5
fi

echo -e "\n✅✅ All Phase Tests Concluded! ✅✅\n"
