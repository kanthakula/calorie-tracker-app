"""The shared analysis prompt + tolerant JSON parsing.

The vision step returns a LIST of detected food items (each with an estimated
visible-portion weight in grams and per-item nutrition + confidence) plus an
overall healthiness rating, confidence, and short notes. Every provider gets
the same instructions so we get a consistent JSON shape back.
"""

from __future__ import annotations

import json
from typing import Any

# The required top-level output keys, in contract order.
REQUIRED_KEYS: tuple[str, ...] = (
    "items",
    "healthiness_rating",
    "confidence",
    "notes",
)

# The required per-item keys.
ITEM_KEYS: tuple[str, ...] = (
    "name",
    "quantity_g",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "confidence",
)

SYSTEM_PROMPT = (
    "You are a nutrition assistant for a calorie-tracking app. Analyze the food "
    "shown in this image and identify EACH distinct food item separately. For "
    "every item estimate: name (short label); quantity_g (estimated grams of "
    "the visible portion of THAT item); calories (whole kcal for that portion); "
    "protein_g, carbs_g, fat_g (estimated grams, whole numbers); confidence "
    "(low|medium|high based on how clearly that item is identifiable). Then give "
    "an overall healthiness_rating: integer 1-5 (1=very unhealthy, 5=very "
    "healthy); an overall confidence (low|medium|high); and notes: one short "
    "sentence with caveats. If the image does not contain any food, return an "
    "empty items list, healthiness_rating 1, confidence low, and notes "
    "explaining that no food was detected."
)

JSON_INSTRUCTION = (
    "Respond with ONLY a single JSON object with exactly these top-level keys: "
    "items, healthiness_rating, confidence, notes. 'items' is an array of "
    "objects, each with exactly these keys: name, quantity_g, calories, "
    "protein_g, carbs_g, fat_g, confidence. Do not include markdown, code "
    "fences, or any text outside the JSON object."
)

# Full text sent as the user/system instruction to each provider.
FULL_PROMPT = f"{SYSTEM_PROMPT}\n\n{JSON_INSTRUCTION}"

# ---------------------------------------------------------------------------
# Text parsing
# ---------------------------------------------------------------------------
#
# The text step parses a free-text meal description ("2 boiled eggs and a
# slice of toast with butter") into the SAME items-array shape the vision step
# produces. We reuse REQUIRED_KEYS / ITEM_KEYS / RESPONSE_JSON_SCHEMA so the
# normalization + grounding pipeline is identical for both paths.

TEXT_SYSTEM_PROMPT = (
    "You are a nutrition assistant for a calorie-tracking app. Read the user's "
    "free-text description of what they ate and identify EACH distinct food "
    "item separately. For every item estimate: name (short label); quantity_g "
    "(estimated grams for the described portion of THAT item, using typical "
    "serving sizes when the amount is not stated); calories (whole kcal for "
    "that portion); protein_g, carbs_g, fat_g (estimated grams, whole "
    "numbers); confidence (low|medium|high based on how clearly that item and "
    "its amount are described). Then give an overall healthiness_rating: "
    "integer 1-5 (1=very unhealthy, 5=very healthy); an overall confidence "
    "(low|medium|high); and notes: one short sentence with caveats. If the "
    "text does not describe any food, return an empty items list, "
    "healthiness_rating 1, confidence low, and notes explaining that no food "
    "was detected."
)

# Same JSON shape requirement as the vision instruction.
FULL_TEXT_PROMPT = f"{TEXT_SYSTEM_PROMPT}\n\n{JSON_INSTRUCTION}"

# JSON schema (used by Gemini's response_schema).
RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "quantity_g": {"type": "number"},
                    "calories": {"type": "integer"},
                    "protein_g": {"type": "integer"},
                    "carbs_g": {"type": "integer"},
                    "fat_g": {"type": "integer"},
                    "confidence": {"type": "string"},
                },
                "required": list(ITEM_KEYS),
            },
        },
        "healthiness_rating": {"type": "integer"},
        "confidence": {"type": "string"},
        "notes": {"type": "string"},
    },
    "required": list(REQUIRED_KEYS),
}


def parse_provider_json(text: str) -> dict[str, Any]:
    """Tolerantly parse a provider's text response into a dict.

    Strips ```json fences and slices from the first ``{`` to the last ``}`` so
    we survive providers that wrap JSON in prose or code fences.
    """
    if not text:
        raise ValueError("Empty response from provider.")

    cleaned = text.strip()

    # Strip code fences if present.
    if cleaned.startswith("```"):
        # Remove leading ```lang and trailing ```
        cleaned = cleaned.lstrip("`")
        # Drop an optional leading "json" language tag.
        if cleaned[:4].lower() == "json":
            cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    # Slice from first { to last }.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]

    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("Provider JSON was not an object.")
    return parsed
