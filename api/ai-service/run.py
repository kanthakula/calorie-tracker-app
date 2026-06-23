"""Production launcher for the FastAPI AI service (used by PM2 / process managers).

Binds to 127.0.0.1 because the service is internal — only the Node API calls it
(authenticated with the shared x-internal-token). Reads PORT from the env, default 8000.
"""
import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("AI_SERVICE_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)
