FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm set strict-ssl false && npm install

RUN npm run build

EXPOSE 3002
ENV PORT=3002
ENV TOKEN=Bearer\ NinjaDesIles
ENV UPLOAD_DIR=uploads

CMD ["npm", "start"]