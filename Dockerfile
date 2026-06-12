FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma + build TS + Next
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["npm", "start"]