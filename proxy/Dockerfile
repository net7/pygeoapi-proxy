ARG PHP_IMAGE_TAG=8.5-fpm-nginx
ARG BUN_IMAGE_TAG=latest
ARG NODE_IMAGE_TAG=latest

FROM oven/bun:${BUN_IMAGE_TAG} AS bun
FROM node:${NODE_IMAGE_TAG} AS node

FROM serversideup/php:${PHP_IMAGE_TAG} AS composer_deps

USER root
WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

COPY . .
RUN composer dump-autoload --optimize --no-interaction

FROM composer_deps AS assets

ARG VITE_APP_NAME
ARG VITE_REVERB_APP_KEY
ARG VITE_REVERB_HOST
ARG VITE_REVERB_PORT
ARG VITE_REVERB_SCHEME

ENV VITE_APP_NAME="${VITE_APP_NAME}" \
    VITE_REVERB_APP_KEY="${VITE_REVERB_APP_KEY}" \
    VITE_REVERB_HOST="${VITE_REVERB_HOST}" \
    VITE_REVERB_PORT="${VITE_REVERB_PORT}" \
    VITE_REVERB_SCHEME="${VITE_REVERB_SCHEME}"

USER root
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN bun ci && bun run build

FROM serversideup/php:${PHP_IMAGE_TAG} AS runtime

USER root
WORKDIR /var/www/html

COPY --from=composer_deps --chown=www-data:www-data /var/www/html /var/www/html
COPY --from=assets --chown=www-data:www-data /var/www/html/public/build /var/www/html/public/build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx
COPY --from=node /usr/local/bin/node /usr/local/bin/node

RUN mkdir -p \
        storage/app/public \
        storage/framework/cache \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data
