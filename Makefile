ENV_TARGET := $(firstword $(filter develop staging production,$(MAKECMDGOALS)))
ENV ?= $(if $(ENV_TARGET),$(ENV_TARGET),develop)
ENV_FILE := .env.$(ENV)
COMPOSE_FILES := -f compose.yaml -f compose.$(ENV).yaml
COMPOSE := docker compose --env-file $(ENV_FILE) $(COMPOSE_FILES)
SERVICE ?=
CMD ?=

.PHONY: help develop staging production env config build pull up start stop down restart ps logs shell artisan migrate fresh seed test pint composer bun-install bun-build optimize clear horizon-status pygeoapi-validate destroy

help:
	@printf '%s\n' 'Usage: make [develop|staging|production] <target>'
	@printf '%s\n' ''
	@printf '%s\n' 'Default environment: develop'
	@printf '%s\n' 'Examples:'
	@printf '%s\n' '  make up'
	@printf '%s\n' '  make staging up'
	@printf '%s\n' '  make production logs SERVICE=laravel'
	@printf '%s\n' '  make artisan CMD="route:list"'
	@printf '%s\n' ''
	@printf '%s\n' 'Targets:'
	@printf '%s\n' '  env               Create .env.<env> from .env.<env>.example if missing'
	@printf '%s\n' '  config            Render merged Docker Compose configuration'
	@printf '%s\n' '  build             Build images with latest base image pulls'
	@printf '%s\n' '  pull              Pull service images'
	@printf '%s\n' '  up                Build and start the stack in background'
	@printf '%s\n' '  start             Start the stack without rebuilding'
	@printf '%s\n' '  stop              Stop running containers'
	@printf '%s\n' '  down              Stop and remove containers/network'
	@printf '%s\n' '  restart           Restart the stack'
	@printf '%s\n' '  ps                Show container status'
	@printf '%s\n' '  logs              Follow logs, optionally SERVICE=name'
	@printf '%s\n' '  shell             Open a shell in the Laravel container'
	@printf '%s\n' '  artisan           Run php artisan CMD="..."'
	@printf '%s\n' '  migrate           Run Laravel migrations'
	@printf '%s\n' '  fresh             Run migrate:fresh --seed'
	@printf '%s\n' '  seed              Run database seeders'
	@printf '%s\n' '  test              Run Laravel tests'
	@printf '%s\n' '  pint              Format PHP with Pint'
	@printf '%s\n' '  bun-install       Install frontend dependencies with Bun locally'
	@printf '%s\n' '  bun-build         Build frontend assets with Bun locally'
	@printf '%s\n' '  optimize          Cache Laravel config/routes/views/events'
	@printf '%s\n' '  clear             Clear Laravel caches'
	@printf '%s\n' '  horizon-status    Show Horizon status'
	@printf '%s\n' '  pygeoapi-validate Validate pygeoapi config in the container'
	@printf '%s\n' '  destroy           Remove containers and named volumes for this env'

develop staging production:
	@:

env:
	@if [ ! -f "$(ENV_FILE)" ]; then cp "$(ENV_FILE).example" "$(ENV_FILE)"; printf 'Created %s\n' "$(ENV_FILE)"; else printf 'Using %s\n' "$(ENV_FILE)"; fi

config: env
	$(COMPOSE) config

build: env
	$(COMPOSE) build --pull

pull: env
	$(COMPOSE) pull

up: env
	$(COMPOSE) up -d --build

start: env
	$(COMPOSE) up -d

stop: env
	$(COMPOSE) stop

down: env
	$(COMPOSE) down

restart: env
	$(COMPOSE) restart

ps: env
	$(COMPOSE) ps

logs: env
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

shell: env
	$(COMPOSE) exec laravel sh

artisan: env
	$(COMPOSE) exec laravel php artisan $(CMD)

migrate: env
	$(COMPOSE) exec laravel php artisan migrate --force

fresh: env
	$(COMPOSE) exec laravel php artisan migrate:fresh --seed --force

seed: env
	$(COMPOSE) exec laravel php artisan db:seed --force

test: env
	$(COMPOSE) exec laravel php artisan test --compact

pint: env
	$(COMPOSE) exec laravel vendor/bin/pint --format agent

composer: env
	$(COMPOSE) exec laravel composer $(CMD)

bun-install:
	cd proxy && bun install

bun-build:
	cd proxy && bun run build

optimize: env
	$(COMPOSE) exec laravel php artisan optimize

clear: env
	$(COMPOSE) exec laravel php artisan optimize:clear

horizon-status: env
	$(COMPOSE) exec laravel php artisan horizon:status

pygeoapi-validate: env
	$(COMPOSE) exec pygeoapi /venv/bin/pygeoapi config validate -c /pygeoapi/local.config.yml

destroy: env
	$(COMPOSE) down -v --remove-orphans
