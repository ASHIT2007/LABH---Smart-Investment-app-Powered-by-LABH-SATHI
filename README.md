<div align="center">

<img width="200" height="200" alt="LABH LITE Logo" src="https://github.com/user-attachments/assets/a141a5a6-1366-4885-a00e-513a41b98d67" />

# LABH — Smart Investment App Powered by LABH SATHI

**Premium Stock Market Trading Simulation Dashboard**

*A sleek, immersive, and visually stunning trading experience built with modern fintech aesthetics.*

[![Live Demo](https://youtu.be/S4ePGrZBpq0)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://github.com/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI)

</div>

---

## 📋 Table of Contents

- [🎬 Demo Video](#-demo-video)
- [📸 Screenshots](#-screenshots)
- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [🌟 Key Highlights](#-key-highlights)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)


## 📸 Screenshots

<div align="center">



### 🏠 Dashboard Overview

<img width="1917" height="902" alt="image" src="https://github.com/user-attachments/assets/26966956-723c-404e-a300-7d2d8e352f61" />


### 📊 Live Trading Interface

<img width="1280" height="611" alt="image" src="https://github.com/user-attachments/assets/bcb0ec57-7bb2-44e1-ab16-f09384714963" />

### 🌍 3D Global Market Globe

<img width="1280" height="602" alt="image" src="https://github.com/user-attachments/assets/6cf2bb09-dbb3-493b-9d64-e44e8da71b6e" />


### 🤖 AI-Powered Insights (LABH SATHI)

<img width="1280" height="607" alt="image" src="https://github.com/user-attachments/assets/a1eeafb4-8879-4b10-a38b-b6b3f7c0012f" />


### 🔐 Login Page

<img width="1917" height="902" alt="image" src="https://github.com/user-attachments/assets/c80b69aa-e7b5-4916-8efe-f37e90565cf9" />



</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎨 **Glassmorphism UI** | Premium frosted glass design with vibrant gradients and smooth animations |
| 📈 **Real-Time Market Simulation** | Live price tracking with dynamic candlestick & line charts |
| 💹 **Complete Trading System** | Order Book, Buy/Sell Ticket, Portfolio & Trade History |
| 🌍 **3D Global Market Globe** | Interactive globe visualization using `globe.gl` |
| 🤖 **LABH SATHI AI** | AI-powered market insights and trading suggestions via Groq API |
| 🔐 **Secure Authentication** | Login system with Supabase-backed data persistence |
| 📰 **Market News Feed** | Real-time financial news and sentiment analysis |
| 📱 **Fully Responsive** | Optimized for desktop, tablet, and mobile viewports |

---

## 🛠️ Tech Stack

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chart.js&logoColor=white)
![globe.gl](https://img.shields.io/badge/globe.gl-000000?style=for-the-badge&logo=three.js&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_AI-00FF88?style=for-the-badge&logo=groq&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ installed
- **npm** or **yarn** package manager
- API keys for Groq, Supabase (see `.env.example`)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI.git
cd LABH---Smart-Investment-app-Powered-by-LABH-SATHI

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:3000` (or your configured port).

---

## 📁 Project Structure

```
labh-lite/
├── frontend/
│   ├── index.html           # Main dashboard UI
│   ├── login.html           # Authentication page
│   ├── css/                 # Glassmorphism styles & animations
│   ├── js/                  # Client-side logic & interactivity
│   ├── img/                 # Static image assets
│   └── globe-gl/            # 3D Globe visualization assets
├── api/                     # Serverless API routes
├── server.js                # Express.js backend server
├── vercel.json              # Vercel deployment configuration
├── .env.example             # Environment variable template
├── package.json             # Node.js dependencies & scripts
└── LICENSE                  # MIT License
```

---

## 🌟 Key Highlights

- 🎯 **Fully functional** simulated trading environment with realistic market mechanics
- 💎 **Premium UI** with glassmorphism, micro-animations, and vibrant gradients
- 📊 **Real-time charts** with dynamic candlestick and line visualizations
- 🤖 **Fast AI insights** powered by Groq's ultra-low-latency inference
- ☁️ **Cloud-native** architecture optimized for Vercel serverless deployment
- 🔒 **Secure by design** with Supabase authentication and data persistence

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by [ASHIT TIWARY](https://github.com/ASHIT2007)**

⭐ **Star this repo if you love beautiful fintech interfaces!** ⭐

[![GitHub Stars](https://img.shields.io/github/stars/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI?style=social)](https://github.com/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI)
[![GitHub Forks](https://img.shields.io/github/forks/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI?style=social)](https://github.com/ASHIT2007/LABH---Smart-Investment-app-Powered-by-LABH-SATHI/fork)

</div>
