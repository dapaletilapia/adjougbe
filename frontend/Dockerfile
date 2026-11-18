# --- Build du front React ----------------------------------------------------
# Image glibc : sur Alpine, npm ignore les binaires natifs musl de rolldown/tailwind.
FROM node:22.23.4-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Nginx : sert le front, relaie l'API et les médias publics ---------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
