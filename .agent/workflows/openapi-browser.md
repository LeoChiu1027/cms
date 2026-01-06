---
description: Open an OpenAPI document in the browser for interactive viewing
---

# Open OpenAPI Document in Browser

This workflow opens an OpenAPI specification file in an interactive browser viewer.

## Steps

1. Identify the OpenAPI file to open (e.g., `docs/api/openapi.yaml` or any `.yaml`/`.json` OpenAPI spec)

// turbo
2. Run the openapi-browser command:
```bash
npx openapi-browser --file <path-to-openapi-file>
```

For example:
```bash
npx openapi-browser --file docs/api/openapi.yaml
```

## Common OpenAPI Files in This Project

- `docs/api/openapi.yaml` - Main bundled OpenAPI specification
- Individual path files in `docs/api/paths/`

## Notes

- The command will start a local server and open the browser automatically
- Press `Ctrl+C` to stop the server when done
- If the file path contains spaces, wrap it in quotes
