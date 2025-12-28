#!/bin/bash
set -e

echo "Starting Modern School Chatbot (ChatGPT-4-mini)"

if [ -z "$OPENAI_API_KEY" ]; then
  echo "ERROR: OPENAI_API_KEY not set"
  exit 1
fi

# Start FAISS loading in background
python -c "from vector import load_vector_store; import threading; threading.Thread(target=load_vector_store, daemon=True).start()" &

# Start Uvicorn immediately
exec uvicorn api:app --host=0.0.0.0 --port=${PORT:-8080}
