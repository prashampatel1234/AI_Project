# StudyAI — Full Stack Student AI Assistant

<p align="center">
  AI-powered learning assistant with real-time chat, document analysis, and image understanding
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Backend-FastAPI-green">
  <img src="https://img.shields.io/badge/Frontend-React-blue">
  <img src="https://img.shields.io/badge/Language-TypeScript-yellow">
  <img src="https://img.shields.io/badge/AI-Groq-orange">
  <img src="https://img.shields.io/badge/Status-Active-success">
</p>

---

## Overview

StudyAI is a full-stack AI-powered educational chatbot built using FastAPI for the backend and React with TypeScript for the frontend.

It integrates Groq’s high-speed AI models to provide intelligent explanations, analyze documents, and process images. The platform is designed to simplify learning by making complex topics easier to understand through interactive AI.

---

## Features

* Intelligent AI Chat with step-by-step explanations
* Real-time streaming responses using Server-Sent Events
* PDF text extraction and analysis using PyMuPDF
* Image understanding with advanced vision models
* Clean markdown rendering with code highlighting
* Built-in tools like web search and math handling
* Drag-and-drop file upload interface

---

## Tech Stack

### Frontend

* React 18
* TypeScript
* Vite
* CSS
* react-markdown
* react-syntax-highlighter

### Backend

* FastAPI
* Groq API
* HTTPX
* PyMuPDF
* python-dotenv

---

## Project Structure

```text
AI_Project
 ┣ backend
 ┃ ┣ models
 ┃ ┣ routes
 ┃ ┣ services
 ┃ ┣ main.py
 ┃ ┣ requirements.txt
 ┃ ┗ .env
 ┃
 ┗ frontend
   ┣ public
   ┣ src
   ┃ ┣ App.tsx
   ┃ ┣ App.css
   ┃ ┗ main.tsx
   ┣ package.json
   ┗ vite.config.ts
```


## Quick Start Guide

### 1. Setup Backend

Create a .env file inside backend:

```env
GROQ_API_KEY=your_api_key_here
```

Run backend:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at:
http://localhost:8000

Note: {"detail": "Not Found"} is normal for root route

---

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:
http://localhost:5173

---

## API Endpoints

API documentation:
http://localhost:8000/docs

| Method | Endpoint        | Description            |
| ------ | --------------- | ---------------------- |
| GET    | /health         | Server health check    |
| POST   | /chat           | Streaming AI chat      |
| POST   | /chat-with-file | Chat with image or PDF |
| POST   | /upload-analyze | File analysis          |

---

## Future Improvements

* User authentication system
* Chat history storage
* Deployment on cloud (AWS / Vercel)
* Voice input and output
* Multi-language support

---

## Author

Prasham Patel

---

