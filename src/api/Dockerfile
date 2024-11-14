FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm set strict-ssl false && npm install
COPY . .
RUN npm run build
WORKDIR /images
COPY ./images .

FROM node:20-alpine
WORKDIR /

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/images ./tmp/images

CMD ["node", "dist/server.js"]