# =============================================
# 🛠️ Makefile - Comandos Úteis
# =============================================

.PHONY: help build up down logs clean test

help: ## Mostra esta ajuda
	@echo "📋 Comandos disponíveis:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Builda todas as imagens
	@echo "🔨 Buildando imagens..."
	docker compose build

up: ## Sobe todos os containers
	@echo "🚀 Subindo containers..."
	docker compose up -d
	@echo "✅ Containers rodando!"
	@echo ""
	@echo "📍 Serviços disponíveis:"
	@echo "  API Python:    http://localhost:8000"
	@echo "  Docs API:      http://localhost:8000/docs"
	@echo "  Scraper:       http://localhost:3001"
	@echo "  Browserless:   ws://localhost:3000"
	@echo "  Redis:         localhost:6379"

down: ## Para todos os containers
	@echo "🛑 Parando containers..."
	docker-compose down --remove-orphans --volumes

restart: down up ## Reinicia todos os containers

logs: ## Mostra logs de todos os containers
	docker-compose logs -f

logs-api: ## Mostra logs da API Python
	docker-compose logs -f api

logs-scraper: ## Mostra logs do Scraper
	docker-compose logs -f scraper

logs-browserless: ## Mostra logs do Browserless
	docker-compose logs -f browserless

ps: ## Lista containers rodando
	docker-compose ps

clean: ## Remove containers, volumes e imagens
	@echo "🧹 Limpando tudo..."
	docker-compose down -v --rmi all
	@echo "✅ Limpeza concluída!"

test: ## Testa a API
	@echo "🧪 Testando API..."
	@curl -s http://localhost:8000/health | jq .
	@echo ""
	@curl -s http://localhost:3001/health | jq .

rebuild: clean build up ## Limpa, builda e sobe tudo novamente

shell-api: ## Abre shell no container da API
	docker-compose exec api /bin/bash

shell-scraper: ## Abre shell no container do Scraper
	docker-compose exec scraper /bin/bash

stats: ## Mostra estatísticas dos containers
	docker stats --no-stream

cache-clear: ## Limpa todo o cache
	@echo "🧹 Limpando cache..."
	@curl -X DELETE http://localhost:8000/api/cache
	@echo "✅ Cache limpo!"

cache-stats: ## Mostra estatísticas do cache
	@curl -s http://localhost:8000/api/stats | jq .