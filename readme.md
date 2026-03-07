# VideoBox

A Modern Video Conferencing Platform

VideoBox is a real-time video conferencing web application that enables users to create and join virtual meetings directly from their browser. The platform uses WebRTC for peer-to-peer video and audio communication and a Socket-based signaling server to establish connections between participants.

VideoBox aims to provide a simple, fast, and secure meeting experience similar to modern conferencing platforms while remaining lightweight, browser-based, and easy to deploy.

---

# Features

## Core Features

* Real-time video and audio communication
* Create and join meeting rooms using a meeting link
* Peer-to-peer video streaming using WebRTC
* Real-time signaling using Socket communication
* Multiple participants in a single meeting room
* Automatic camera and microphone access
* Responsive design for desktop and mobile devices

## User Interface Features

* Modern and responsive landing page
* Meeting join interface
* Dynamic video grid layout for participants
* Meeting controls (mute, camera, leave meeting)
* Real-time participant connection handling

## Additional Capabilities

* Dynamic meeting room creation
* Browser-based communication (no installation required)
* Cross-device compatibility
* Low latency video communication
* Mobile-first responsive design

---

#  Project Architecture

VideoBox follows a **client-server architecture**.

The frontend handles the user interface and media stream management, while the backend handles signaling between peers for establishing WebRTC connections.

### Architecture Flow

User Browser
↓
Frontend Application (React)
↓
Signaling Server (Node.js + Socket.IO)
↓
WebRTC Peer Connections between Participants

Once the signaling process is complete, video and audio streams are exchanged directly between users through WebRTC peer-to-peer connections.

---

#  Tech Stack

## Frontend

* React
* Tailwind CSS
* WebRTC APIs
* Socket Client

## Backend

* Node.js
* Express.js
* Socket.IO

## Other Tools

* WebRTC STUN servers
* npm package manager
* ESLint for code quality

---

#  Project Structure

```
videobox
│
├── backend
│   ├── server.js
│   ├── socket.js
│   └── package.json
│
├── frontend
│   ├── public
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   ├── utils
│   │   └── App.js
│   └── package.json
│
└── README.md
```

---

# ⚙️ Installation and Setup

## 1. Clone the Repository

```
git clone https://github.com/advaitpathak259/videobox.git
```

```
cd videobox
```

---

## 2. Install Backend Dependencies

```
cd backend
npm install
```

Start the backend server:

```
npm start
```

The backend will run on:

```
http://localhost:5000
```

---

## 3. Install Frontend Dependencies

```
cd frontend
npm install
```

Start the frontend:

```
npm start
```

The frontend will run on:

```
http://localhost:3000
```

---

# 📡 How VideoBox Works

1. A user creates or joins a meeting room.
2. The frontend connects to the backend signaling server.
3. The signaling server exchanges WebRTC connection information between users.
4. WebRTC establishes direct peer-to-peer connections.
5. Video and audio streams are shared between participants in real time.



# 👨‍💻 Author

Developed as a full-stack WebRTC video conferencing project using modern web technologies.

Project Name: **VideoBox**
