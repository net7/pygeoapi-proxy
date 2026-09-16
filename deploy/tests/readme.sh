#!/bin/sh

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
english_readme="$repository_root/README.md"
italian_readme="$repository_root/README.it.md"
wordmark="$repository_root/docs/assets/proxygeoapi-wordmark.svg"

require_file() {
    if [ ! -f "$1" ]; then
        printf 'Required README asset does not exist: %s\n' "$1" >&2
        exit 1
    fi
}

require_text() {
    if ! grep -F -- "$2" "$1" > /dev/null; then
        printf 'Missing README contract in %s: %s\n' "$1" "$2" >&2
        exit 1
    fi
}

require_absent_text() {
    if grep -F -- "$2" "$1" > /dev/null; then
        printf 'Obsolete README content in %s: %s\n' "$1" "$2" >&2
        exit 1
    fi
}

require_file "$english_readme"
require_file "$italian_readme"
require_file "$wordmark"

first_line='![proxygeoapi](docs/assets/proxygeoapi-wordmark.svg)'
test "$(sed -n '1p' "$english_readme")" = "$first_line"
test "$(sed -n '1p' "$italian_readme")" = "$first_line"

require_text "$wordmark" 'fill="#2563EB"'
require_text "$wordmark" 'Figlet slant'
require_text "$wordmark" 'width="614" height="83"'
require_text "$wordmark" 'viewBox="0 0 614 83"'
require_absent_text "$wordmark" '<rect'
require_text "$wordmark" 'font-family="Menlo, monospace"'
require_text "$wordmark" 'style="white-space: pre"'
require_text "$wordmark" '<text x="0" y="1"'
require_text "$wordmark" '<text x="0" y="17"'
require_text "$wordmark" '<text x="0" y="81"'

preserved_row_count=$(awk '
    /<text .*style="white-space: pre">/ {
        count++
    }
    END {
        print count + 0
    }
' "$wordmark")
if [ "$preserved_row_count" -ne 6 ]; then
    printf 'Expected six whitespace-preserving SVG rows, found %s\n' \
        "$preserved_row_count" >&2
    exit 1
fi

require_text "$english_readme" '[Italiano](README.it.md)'
require_text "$italian_readme" '[English](README.md)'
require_text "$english_readme" '[DEPLOY.md](DEPLOY.md)'
require_text "$italian_readme" '[DEPLOY.it.md](DEPLOY.it.md)'

for document in "$english_readme" "$italian_readme"; do
    require_text "$document" 'OGC_PROCESSES_BASE_URL'
    require_text "$document" 'https://voice.pi.ingv.it/geoinquire/'

    for version in \
        13.32.0 3.3.4 1.39.0 5.31.0 4.1.0 0.2.0 \
        5.49.0 1.11.1 19.3.0 3.7.1 5.9.3 4.3.3 \
        2.0.8 0.475.0 5.3.0 8.17.1 8.21.3 \
        2.0.0-alpha.43 3.31.3 5.24.0 4.5.1 2.27.1 \
        8.3.0 1.4.2
    do
        require_text "$document" "$version"
    done

    for obsolete_text in \
        'http://pygeoapi/' \
        'http://pygeoapi:' \
        'localhost:5000' \
        'PYGEOAPI_BASE_URL' \
        'PYGEOAPI_SERVER_URL' \
        'PYGEOAPI_PORT' \
        'make pygeoapi-validate' \
        'geopython/pygeoapi:latest'
    do
        require_absent_text "$document" "$obsolete_text"
    done
done
