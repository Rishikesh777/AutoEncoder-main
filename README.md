# 🔐 AutoVault

A full-stack web application developed as a **BTech Computer Science Engineering Mini Project** for secure and reversible protection of medical images. AutoVault combines **Deep Learning**, **Reversible Data Hiding**, and **Cryptographic techniques** to embed sensitive patient information into medical images while preserving diagnostic quality and enabling complete restoration of the original image.

<p align="left">
  <img src="https://img.shields.io/badge/BTech-CSE%20Mini%20Project-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Status-Completed-success?style=for-the-badge"/>
</p>

---

## 📖 Project Overview

Medical images exchanged through telemedicine and PACS systems are vulnerable to tampering and unauthorized access. Traditional watermarking techniques often introduce irreversible image distortion, making them unsuitable for medical applications where every pixel is important.

AutoVault addresses this challenge by integrating a convolutional autoencoder with reversible watermarking and cryptographic authentication to securely embed patient information while allowing the exact original medical image to be recovered after extraction. The application also verifies image authenticity and detects any unauthorized modifications through secure hash verification. :contentReference[oaicite:1]{index=1}

---

## ✨ Key Features

- 🧠 Autoencoder-generated 128-bit authentication tag
- 🩺 Secure embedding of patient information into medical images
- 🔄 Reversible watermark extraction with pixel-perfect image restoration
- 🌊 Integer Wavelet Transform (IWT) based embedding
- 📦 Huffman compression for efficient payload storage
- 🔐 Optional AES encryption for embedded data
- 🔑 Blake3 hashing for integrity verification
- 📊 PSNR, SSIM and MSE quality evaluation
- 👤 JWT-based user authentication
- 📁 Upload history and metadata management
- 📱 Modern responsive React interface

---

## 🛠️ Prerequisites

Install the following before running the project:

- Node.js (v18 or later)
- Python 3.10+
- MongoDB Community Server or MongoDB Atlas
- Git

---

## 📦 Frontend Dependencies

```bash
npm install
```

Installs:

- React
- Vite
- Material UI
- React Router
- Axios
- Emotion
- ESLint

---

---

## 📦 Node Backend Dependencies

```bash
cd server
npm install
```

Installs:

- Express
- MongoDB (Mongoose)
- JWT Authentication
- Multer
- bcryptjs
- dotenv
- CORS
- node-fetch

---

---

## 🐍 Python Backend Dependencies

Navigate to the Python backend:

```bash
cd server/python-backend
```

Install requirements:

```bash
pip install -r requirements.txt
```

If the requirements file is unavailable, install:

```bash
pip install

fastapi
uvicorn
torch
torchvision
numpy
opencv-python
pillow
scikit-image
pywavelets
blake3
pydicom
python-multipart
pymongo
cryptography
```

---

## 🚀 Running the Project

### 1️⃣ Start MongoDB

Ensure MongoDB is running locally or update the `.env` file with your MongoDB Atlas connection string.

---

### 2️⃣ Start the Node Backend

```bash
cd server
npm install
npm run dev
```

Runs on:

```
http://localhost:5000
```

---

### 3️⃣ Start the Python Backend

```bash
cd server/python-backend

uvicorn app:app --reload
```

Runs on:

```
http://localhost:8000
```

---

### 4️⃣ Start the React Frontend

```bash
npm install
npm run dev
```

Runs on:

```
http://localhost:5173
```

---

Open the application in your browser and begin embedding or extracting medical image watermarks.
