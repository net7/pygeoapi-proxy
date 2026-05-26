#!/bin/bash
set -e

export PYGEOAPI_HOME="${PYGEOAPI_HOME:-/pygeoapi}"
export PYGEOAPI_CONFIG="${PYGEOAPI_CONFIG:-${PYGEOAPI_HOME}/local.config.yml}"
export PYGEOAPI_OPENAPI="${PYGEOAPI_OPENAPI:-${PYGEOAPI_HOME}/local.openapi.yml}"

SCRIPT_NAME="${SCRIPT_NAME:=/}"
CONTAINER_NAME="${CONTAINER_NAME:=pygeoapi}"
CONTAINER_HOST="${CONTAINER_HOST:=0.0.0.0}"
CONTAINER_PORT="${CONTAINER_PORT:=80}"
WSGI_APP="${WSGI_APP:=pygeoapi.flask_app:APP}"
WSGI_WORKERS="${WSGI_WORKERS:=4}"
WSGI_WORKER_TIMEOUT="${WSGI_WORKER_TIMEOUT:=6000}"
WSGI_WORKER_CLASS="${WSGI_WORKER_CLASS:=gevent}"
PYGEOAPI_OPENAPI_GENERATE_FAIL_ON_INVALID_COLLECTION="${PYGEOAPI_OPENAPI_GENERATE_FAIL_ON_INVALID_COLLECTION:=true}"

if [ "${PYGEOAPI_OPENAPI_GENERATE_FAIL_ON_INVALID_COLLECTION}" = false ]; then
    OPENAPI_GENERATE_FAIL_ON_INVALID_COLLECTION='--no-fail-on-invalid-collection'
else
    OPENAPI_GENERATE_FAIL_ON_INVALID_COLLECTION='--fail-on-invalid-collection'
fi

cd "${PYGEOAPI_HOME}"

echo "Default config in ${PYGEOAPI_CONFIG}"
echo "Trying to generate openapi.yml"
/venv/bin/pygeoapi openapi generate "${PYGEOAPI_CONFIG}" --output-file "${PYGEOAPI_OPENAPI}" ${OPENAPI_GENERATE_FAIL_ON_INVALID_COLLECTION}
echo "openapi.yml generated"

if [ -n "${PYGEOAPI_ASYNCAPI:-}" ]; then
    echo "Trying to generate asyncapi.yml"
    /venv/bin/pygeoapi asyncapi generate "${PYGEOAPI_CONFIG}" --output-file "${PYGEOAPI_ASYNCAPI}"
    echo "asyncapi.yml generated"
fi

if [ "${SCRIPT_NAME}" = '/' ]; then
    export SCRIPT_NAME=""
fi

entry_cmd="${1:-run}"

case "${entry_cmd}" in
    test)
        for test_py in tests/test_*.py; do
            case "${test_py}" in
                tests/test_elasticsearch__provider.py|tests/test_sensorthings_provider.py|tests/test_postgresql_provider.py|tests/test_mongo_provider.py)
                    echo "Skipping: ${test_py}"
                    ;;
                *)
                    /venv/bin/python3 -m pytest "${test_py}"
                    ;;
            esac
        done
        ;;
    run)
        echo "Starting gunicorn name=${CONTAINER_NAME} on ${CONTAINER_HOST}:${CONTAINER_PORT} with ${WSGI_WORKERS} workers and SCRIPT_NAME=${SCRIPT_NAME}"
        exec /venv/bin/gunicorn --workers "${WSGI_WORKERS}" \
            --worker-class="${WSGI_WORKER_CLASS}" \
            --timeout "${WSGI_WORKER_TIMEOUT}" \
            --name="${CONTAINER_NAME}" \
            --bind "${CONTAINER_HOST}:${CONTAINER_PORT}" \
            "${WSGI_APP}"
        ;;
    run-with-hot-reload)
        echo "Starting gunicorn with hot reload"
        exec /venv/bin/gunicorn --workers "${WSGI_WORKERS}" \
            --worker-class="${WSGI_WORKER_CLASS}" \
            --timeout "${WSGI_WORKER_TIMEOUT}" \
            --name="${CONTAINER_NAME}" \
            --bind "${CONTAINER_HOST}:${CONTAINER_PORT}" \
            --reload \
            --reload-extra-file "${PYGEOAPI_CONFIG}" \
            "${WSGI_APP}"
        ;;
    *)
        exec "$@"
        ;;
esac
