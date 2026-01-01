# 🚀 RMM Analytics - Installation & Usage Guide

A comprehensive analytics platform for RMM (Real Money Market) protocol, providing detailed insights into your DeFi positions, interest calculations, and transaction history.

## 📋 Prerequisites

Before starting, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **Git**

## 🏗️ Project Structure

```
rmmgain/
├── pages/            # Next.js pages and API routes
│   ├── api/          # API routes (Next.js API routes)
│   └── index.tsx     # Main frontend page
├── lib/              # Library code
│   └── services/     # Business logic and API services
├── components/       # React components
├── utils/            # Utility functions and constants
└── types/            # TypeScript type definitions
```

## 🚀 Quick Start

### Step 1: Clone the Repository

```bash
git clone git@github.com:Baptiste-Yucca/rmmgain.git
cd rmmgain
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

Create a `.env` file in the root directory:

```bash
# Environment Variables
NEXT_PUBLIC_GNOSISSCAN_API_KEY=your_gnosisscan_api_key_here
NEXT_PUBLIC_THEGRAPH_API_KEY=your_thegraph_api_key_here
NEXT_PUBLIC_THEGRAPH_API_URL=https://api.thegraph.com/subgraphs/id/QmVH7ota6caVV2ceLY91KYYh6BJs2zeMScTTYgKDpt7VRg
NEXT_PUBLIC_GNOSIS_RPC_URL=https://rpc.gnosischain.com/
```

### Step 4: API Keys Setup

#### GnosisScan API Key (Required)
1. Go to [https://gnosisscan.io/](https://gnosisscan.io/)
2. Create a free account
3. Navigate to "API-KEYs" in your profile
4. Create a new API key
5. Add it to your `.env` file as `NEXT_PUBLIC_GNOSISSCAN_API_KEY`

#### TheGraph API Key (Recommended)
1. Go to [https://thegraph.com/](https://thegraph.com/)
2. Create an account
3. Navigate to "API Keys"
4. Create a new API key
5. Add it to your `.env` file as `NEXT_PUBLIC_THEGRAPH_API_KEY`

## 🎯 Running the Application

### Development Mode

```bash
npm run dev
```
The application will start on `http://localhost:3000`

### Production Mode

```bash
npm run build
npm start
```
The application will start on `http://localhost:3000`

## 🛑 Stopping the Application

```bash
# Press Ctrl+C in the terminal
```

## 🔄 Restarting the Application

```bash
# Stop with Ctrl+C, then restart
npm run dev
```

## 📊 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🌐 API Endpoints

### Main Endpoints
- **Health Check**: `GET /`
- **RMM V2**: `GET /api/rmm/v2/:address`
- **RMM V3**: `GET /api/rmm/v3/:address`

### Example Usage
```bash
# Test the API
curl http://localhost:3000/api/rmm/v3/0x7ca24d4443ff5298d9a1729622a116b712a58a56
```

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### Environment Variables Not Loading
```bash
# Verify .env file exists
ls -la .env

# Check if variables are loaded
echo $NEXT_PUBLIC_GNOSISSCAN_API_KEY
echo $NEXT_PUBLIC_THEGRAPH_API_KEY
```

#### API Key Errors
```bash
# Verify API keys in .env file
cat .env | grep API_KEY
```

#### Dependencies Issues
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📱 Using the Application

1. **Open your browser** and navigate to `http://localhost:3000`
2. **Enter an EVM address** (e.g., `0x3f3994bb23c48204ddeb99aa6bf6dd275abf7a3f`)
3. **Click "Analyze"** to view your RMM data
4. **Explore the dashboard** with charts, transactions, and financial summaries

## 🏗️ Development

### Adding New Features
1. Frontend components go in `components/`
2. API routes go in `pages/api/`
3. Business logic and services go in `lib/services/`
4. Utility functions go in `utils/`
5. Update types in `types/`

### Code Style
- Framework: Next.js with TypeScript
- Frontend: React hooks + TypeScript
- API: Next.js API routes (TypeScript)
- Styling: TailwindCSS
- Charts: Chart.js + React-Chartjs-2

## 🤝 Support

If you encounter issues:
1. Check the user guide
2. Open an issue.

## 📄 License

Please contact Realtoken DAO.

## Made with ❤️ for the community -- Battistù

---

**Happy analyzing! 🚀📊**

