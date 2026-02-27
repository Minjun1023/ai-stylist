
import json
import logging
import re
from typing import TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_CODE_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _extract_json_block(raw_text: str) -> str | None:
    if not raw_text:
        return None

    trimmed = raw_text.strip()
    if not trimmed:
        return None

    match = _CODE_FENCE_RE.search(trimmed)
    if match:
        return match.group(1).strip()

    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    return trimmed[start : end + 1].strip()


def parse_json_to_model(raw_text: str, model_type: type[T]) -> T | None:
    json_text = _extract_json_block(raw_text)
    if not json_text:
        return None

    try:
        payload = json.loads(json_text)
    except json.JSONDecodeError:
        return None

    try:
        return model_type.model_validate(payload)
    except ValidationError as error:
        logger.warning("model validate failed: %s", error)
        return None

