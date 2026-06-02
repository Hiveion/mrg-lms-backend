# FROM node:18-alpine

# WORKDIR /usr/src/app

# COPY package*.json ./
# RUN npm install

# COPY . .

# RUN npx prisma generate
# RUN npm run build

# EXPOSE 5000
# CMD ["node", "dist/main.js"]
FROM node:20-bullseye-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
RUN chmod +x start.sh

EXPOSE 3001
CMD ["sh", "start.sh"]
