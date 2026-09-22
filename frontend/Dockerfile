# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Vite reads VITE_* env vars at build time
ARG VITE_API_URL=/api
ARG VITE_PAYMENT_UPI_ID=pratik.kamble11@ybl
ARG VITE_PAYMENT_QR_IMAGE_URL=/payment-qr.png
ARG VITE_SUPPORT_EMAIL=mr.canopus111@gmail.com
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PAYMENT_UPI_ID=${VITE_PAYMENT_UPI_ID}
ENV VITE_PAYMENT_QR_IMAGE_URL=${VITE_PAYMENT_QR_IMAGE_URL}
ENV VITE_SUPPORT_EMAIL=${VITE_SUPPORT_EMAIL}

RUN npm run build

# ── Stage 2: Serve via Nginx ────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom config
COPY nginx.conf /etc/nginx/conf.d/canopus.conf

# Copy built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
