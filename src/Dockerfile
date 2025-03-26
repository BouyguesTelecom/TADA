FROM node:18-alpine AS builder
WORKDIR /app
COPY ../package*.json ./
RUN npm set strict-ssl false && npm install
COPY .. ./
RUN npm run build
RUN mkdir -p ./tmp/images

FROM node:18-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tmp ./tmp

CMD ["node", "dist/api/server.js"]