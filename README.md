# 📁 PocketDrive

> A full-stack cloud document management application that helps users securely upload, organize, search, preview, and print documents from anywhere.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-22-green?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-Backend-lightgrey)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 📖 Overview

PocketDrive is a cloud-based document management platform inspired by modern cloud storage services. It enables users to securely manage files and folders while providing features designed for real-world document workflows such as printing, document organization, and quick access across devices.

The project focuses on performance, security, and a clean user experience while demonstrating full-stack development using modern web technologies.


## ✨ Features

### Authentication

* Google OAuth login
* Secure JWT authentication
* Refresh token support
* Session persistence
* Protected routes

### File Management

* Upload single or multiple files
* Folder-based organization
* Nested folders
* Rename and move files
* Duplicate detection
* File versioning
* Drag-and-drop interactions

### File Preview

* PDF preview
* Image preview
* Text file preview
* Secure file access using signed URLs

### Search & Organization

* Search files and folders
* Filter by type
* Favorites
* Recent files
* Activity history

### Print Queue

* Add files to print queue
* Reorder files
* Merge PDFs
* Download files together
* Save reusable print profiles

### QR Login

* Generate QR session
* Scan from mobile
* Login on desktop without entering credentials

### Trash Management

* Restore deleted files
* Permanent delete
* Automatic retention period

### Responsive UI

* Mobile-friendly design
* Grid and List view
* Custom dialogs
* Toast notifications



# 🛠 Tech Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Zustand
* Axios
* pdf-lib
* html5-qrcode
* dnd-kit

## Backend

* Node.js
* Express.js
* TypeScript
* JWT
* Multer
* Google OAuth

## Database & Storage

* Supabase PostgreSQL
* Supabase Storage

## Deployment

* Vercel (Frontend)
* Render (Backend)



# 📂 Project Structure

PocketDrive/

├── backend/
│   ├── src/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── utils/
│   └── config/
│
├── frontend/
│   ├── src/
│   ├── app/
│   ├── components/
│   ├── store/
│   ├── lib/
│   └── types/
│
└── README.md



# 🚀 Getting Started

## Prerequisites

* Node.js 22+
* npm
* Supabase Project
* Google OAuth Credentials



## Clone Repository

git clone https://github.com/yourusername/PocketDrive.git

cd PocketDrive


## Backend Setup

cd backend

npm install

npm run dev

Create a `.env` file inside the backend directory and configure:

PORT=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE=
JWT_SECRET=
JWT_REFRESH_SECRET=
CLIENT_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=


## Frontend Setup

cd frontend

npm install

npm run dev

Create a `.env.local` file:

NEXT_PUBLIC_API_URL=


## Application

Frontend

http://localhost:3000

Backend

http://localhost:5000


# 🔒 Security

* JWT Authentication
* Google OAuth
* Refresh Token Rotation
* Secure Cookies
* Rate Limiting
* Signed File URLs
* Input Validation
* User Data Isolation


# 🚀 Future Improvements

* File sharing using public links
* Two-factor authentication
* Mobile application
* OCR support for scanned documents
* Team workspaces
* Offline support
* AI-powered document tagging


# 👨‍💻 Author

**Vigneshwaran C**

GitHub: https://github.com/Vigneshwaran2006

LinkedIn: https://www.linkedin.com/in/vigneshwaran2k6/

Email: vwaran172@gmail.com


# 📄 License

This project is licensed under the MIT License.


## ⭐ If you found this project useful, consider giving it a star!
