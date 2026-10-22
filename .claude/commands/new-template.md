Create assessment template $ARGUMENTS in `templates/$ARGUMENTS/`, valid against `templates/_schema/manifest.schema.json`:

- `manifest.yaml`, `Dockerfile`, `compose.yaml` (if services), `brief.md`, `seed/`, `hidden-tests/`.
- `golden/`: 5 submissions (strong, good, average, weak, adversarial) with human labels per rubric item.
- No real cloud credentials (BR-33): use LocalStack for AWS-style tasks.
- Image runs as non-root, no secrets baked in; env slots declared in the manifest only.
