SHELL:=/usr/bin/env bash
PATH := $(PATH):node_modules/.bin
SRC := $(shell find src/*.ts)
EXAMPLE_ENV_FILE = .env.example
ENV_FILE := .env
EXAMPLE_GITHUB_EVENT_PATH = .github_event.example.json
GITHUB_EVENT_PATH = .github_event.json
ENVIRONMENT = `cat .env | xargs`
EXAMPLE_RUN_DEVELOPMENT_FILE = run-development.example.ts
RUN_DEVELOPMENT_FILE = run-development.ts

dist/index.js: ${SRC} ## build project
	ncc build src/index.ts

build:
	tsc --project ./tsconfig.json

.PHONY: setup
setup: ## setup project for development
	yarn

.PHONY: clean
clean: ## remove built files
	rm -rf dist/*

.PHONY: lint
lint: ## check for formatting errors
	eslint --quiet src/**/**/*.ts

.PHONY: test
test: ## verify functionality
	jest

.PHONY: test-watch
test-watch: ## start test watcher
	jest --watch --watchPathIgnorePatterns tmp

${ENV_FILE}:
	cp ${EXAMPLE_ENV_FILE} ${ENV_FILE}

${GITHUB_EVENT_PATH}:
	cp ${EXAMPLE_GITHUB_EVENT_PATH} ${GITHUB_EVENT_PATH}

${RUN_DEVELOPMENT_FILE}:
	cp ${EXAMPLE_RUN_DEVELOPMENT_FILE} ${RUN_DEVELOPMENT_FILE}

.PHONY: run-development
run-development: ${RUN_DEVELOPMENT_FILE} ${ENV_FILE} ${GITHUB_EVENT_PATH} ## Run code in development
	tsc ${RUN_DEVELOPMENT_FILE} --outDir ./tmp/
	env $(ENVIRONMENT) \
		INPUT_GITHUB_TOKEN=${GITHUB_PACKAGE_PULL_TOKEN} \
		GITHUB_EVENT_PATH=${GITHUB_EVENT_PATH} \
		node --inspect ./tmp/run-development.js

help: ## Runs the help!
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
