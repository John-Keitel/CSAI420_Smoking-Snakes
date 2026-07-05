.PHONY: help install build format format-fix lint lint-fix typecheck test test-integration test-e2e-ui up deploy logs down dev db-generate db-push db-migrate db-seed

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and generate Prisma client
	npm ci

build: ## Build the Next.js application
	npm run build

format: ## Check formatting
	npm run format

format-fix: ## Format project files
	npm run format:fix

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

typecheck: ## Run Next.js type generation and TypeScript checks
	npm run typecheck

test: ## Run the Playwright E2E test suite
	npm test

test-integration: ## Run the deployed IVR integration tests
	npm run test:integration

test-e2e-ui: ## Open the Playwright UI mode
	npm run test:e2e:ui

up: ## Start local infrastructure (Postgres, MinIO, Mailpit)
	docker compose up -d --wait postgres minio mailpit

deploy: ## Build and start the complete Docker application stack
	docker compose up -d --build --wait

logs: ## Follow application and migration logs
	docker compose logs --follow app migrate

down: ## Stop local infrastructure
	docker compose down

dev: ## Start the development server
	npm run dev

db-generate: ## Generate the Prisma client
	npm run db:generate

db-push: ## Push schema changes to the database
	npm run db:push

db-migrate: ## Deploy database migrations
	npm run db:sync

db-seed: ## Seed the database
	npm run db:seed
