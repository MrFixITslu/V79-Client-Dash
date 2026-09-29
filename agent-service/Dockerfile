FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev=false

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests

ENV NODE_ENV=production
EXPOSE 3055

CMD ["npm", "start"]
