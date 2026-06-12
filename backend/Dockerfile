# ─────────────────────────────
# 1. Base image
# ─────────────────────────────
FROM node:20-alpine

# ─────────────────────────────
# 2. Set working directory
# ─────────────────────────────
WORKDIR /app

# ─────────────────────────────
# 3. Install dependencies first (for caching)
# ─────────────────────────────
COPY package*.json ./

# Install ALL dependencies (Prisma needs devDependencies too during build)
RUN npm install

# ─────────────────────────────
# 4. Copy Prisma schema
# ─────────────────────────────
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# ─────────────────────────────
# 5. Copy source code
# ─────────────────────────────
COPY src ./src

# ─────────────────────────────
# 6. Environment
# Cloud Run uses PORT automatically
# ─────────────────────────────
ENV PORT=8080

# ─────────────────────────────
# 7. Expose port
# ─────────────────────────────
EXPOSE 8080

# ─────────────────────────────
# 8. Start server
# ─────────────────────────────
CMD ["node", "src/server.js"]