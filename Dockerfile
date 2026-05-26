ARG PYGEOAPI_IMAGE_TAG=latest
FROM geopython/pygeoapi:${PYGEOAPI_IMAGE_TAG}

LABEL org.opencontainers.image.source="https://hub.docker.com/r/geopython/pygeoapi"

COPY --chmod=755 ./entrypoint.sh /usr/local/bin/pygeoapi-entrypoint.sh

# pygeoapi listens on port 80 in the official image.
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/pygeoapi-entrypoint.sh"]
CMD ["run"]

# To bake a local configuration into the image, add a my.config.yml file next to
# this Dockerfile and uncomment the line below.
# COPY ./my.config.yml /pygeoapi/local.config.yml
#
# Recommended local run with a mounted config:
# docker run --rm -p 5000:80 \
#   -v "$(pwd)/my.config.yml:/pygeoapi/local.config.yml:ro" \
#   pygeoapi-local
