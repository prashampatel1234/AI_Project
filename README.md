# 🤖 AI Student Assistant — Full Stack AI Chatbot

## 🚀 Overview

AI Student Assistant is a full-stack AI-powered chatbot built using FastAPI (backend) and React (frontend).
It uses Groq API with LLaMA 3.3 (70B Versatile) to generate fast and intelligent responses.

The system is designed with a modular architecture, supporting tool usage, memory, and future extensibility like document and image understanding.


## 🧠 Features

* 💬 AI-powered chatbot interface
* ⚡ High-speed responses using Groq (LLaMA 3.3 70B)
* 🧩 Modular backend (routes, services, models)
* 🧠 Persistent conversation memory
* 🔧 Tool integration (calculator + web search)
* 🌐 REST API with FastAPI
* 🎨 React frontend (currently improving)


## Upcoming Features

* 📄 PDF content extraction for AI analysis
* 🖼️ Image text extraction (OCR)
* 📚 Document-based question answering
* 🔄 Streaming responses (typing effect)


## 🛠️ Tech Stack

* **Frontend:** React, TypeScript
* **Backend:** FastAPI, Python
* **AI Model:** Groq API — `llama-3.3-70b-versatile`
* **Tools:** Git, Uvicorn


## 📂 Project Structure

backend/
├── main.py
├── .env
├── .env.example
├── requirements.txt
├── memory.json
│
├── models/
│   └── schemas.py
│
├── routes/
│   └── chat.py
│
└── services/
    ├── llm.py
    ├── tools.py
    └── memory.py

frontend/

## ⚙️ Backend Walkthrough

### 🔹 main.py

* Initializes FastAPI app
* Configures CORS
* Registers routes


### 🔹 models/schemas.py

Defines request/response models:

* `ChatRequest`
* `ChatResponse`
* `HealthResponse`

### 🔹 routes/chat.py

API endpoints:

* `POST /chat/` → Send message to AI
* `GET /chat/history` → Retrieve chat history
* `DELETE /chat/history` → Clear memory


### 🔹 services/memory.py

* Stores chat history in `memory.json`
* Functions:

  * `load_memory()`
  * `save_memory()`
  * `add_to_memory()`


### 🔹 services/tools.py

Supports tool-based augmentation:

| Keyword   | Tool                    |
| --------- | ----------------------- |
| calculate | Python-based calculator |
| search    | DuckDuckGo API          |


### 🔹 services/llm.py

* Integrates with **Groq API**
* Uses model:llama-3.3-70b-versatile


* Injects tool outputs into prompts
* Maintains conversation context


## ⚡ Quick Start

### 1. Add API Key

Create `backend/.env`:
GROQ_API_KEY=your_api_key_here
MODEL=llama-3.3-70b-versatile

### 2. Setup Virtual Environment

```bash
uv venv
.venv\Scripts\activate

### 3. Install Dependencies

```bash
uv pip install -r backend/requirements.txt
```

### 4. Run Backend

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. API Docs

Open:
http://localhost:8000/docs



## 🔌 Frontend Integration

```javascript
const response = await fetch("http://localhost:8000/chat/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: userInput }),
});

const data = await response.json();
```


## 📊 API Endpoints

| Method | Endpoint        | Description   |
| ------ | --------------- | ------------- |
| GET    | `/`             | Health check  |
| POST   | `/chat/`        | Send message  |
| GET    | `/chat/history` | Get history   |
| DELETE | `/chat/history` | Clear history |

## 🧪 Validation

* ✅ Backend modules tested
* ✅ Tools working (calculator + search)
* ✅ Memory persistence verified
* ✅ FastAPI running with Uvicorn


## 🔐 Environment Variables

```
GROQ_API_KEY=your_api_key_here
```

---

## 👨‍💻 Author

**Prasham Patel**
