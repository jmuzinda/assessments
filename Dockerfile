FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "src/main.ts"]
