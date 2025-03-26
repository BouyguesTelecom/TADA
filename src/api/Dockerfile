FROM node:18-alpine AS builder
WORKDIR /app/src
COPY ./package*.json ./
RUN npm set strict-ssl false && npm install
COPY .. ./
RUN npm run build
RUN mkdir -p ./images


FROM node:18-alpine
WORKDIR /

COPY --from=builder /app/src/package*.json ./
COPY --from=builder /app/src/node_modules ./node_modules
COPY --from=builder /app/src/dist ./dist
COPY --from=builder /app/src/images ./tmp/images

CMD ["node", "dist/server.js"]
