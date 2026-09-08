---
paths:
  - '**'
---

# General

## Deployment tooling is limited to develop and staging
Repository deployment files, examples, guides and other documentation apply exclusively to `develop` and `staging`. The root Makefile manages both environments; `deploy-dev-staging.sh` automates staging only. Keep this scope explicit when updating deployment material.
