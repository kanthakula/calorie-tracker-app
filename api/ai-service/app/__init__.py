"""K21 Calorie Tracker — AI service package.

This package owns ALL AI/image/nutrition processing for the K21 Calorie
Tracker monorepo. The Node API is the only public gateway and calls this
service over HTTP. Provider API keys live here (env + a gitignored runtime
config) and are NEVER returned to any caller.
"""

__version__ = "0.1.0"
