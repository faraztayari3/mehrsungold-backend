# Mehrsungold — Backend (local run)

This project is a NestJS backend. Local run steps (macOS, zsh):

1. Copy `.env.example` to `.env` and fill real values (do NOT commit real .env):
```bash
cd Back/mehrsungold-backend
cp .env.example .env
# Edit DATABASE_URI and other secrets
```

2. Install dependencies and start server:
```bash
nvm use 18 # if you use nvm
npm install
npm run dev    # development (nodemon)
# or
npm start      # production style (node main.js)
```

3. Default backend port: `PORT` in `.env` (example uses 3001).

Notes:
- The project expects `DATABASE_URI` environment variable (name: `DATABASE_URI`).
- If your DB is remote and blocks your IP, you may need VPN or allowlist.
- Do not commit `.env` with credentials. Use GitHub Secrets for CI/deploy.
