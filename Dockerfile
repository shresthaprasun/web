FROM node:14-alpine as base

WORKDIR /src
COPY package*.json ./
EXPOSE 3000

FROM base as production
ENV NODE_ENV=production
RUN npm i
COPY . ./
CMD ["npm", "start"]