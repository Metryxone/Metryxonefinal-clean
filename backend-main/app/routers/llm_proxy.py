"""
OpenAI-compatible proxy that routes requests through emergentintegrations
so the Node backend (or any OpenAI SDK consumer) can use the Emergent
Universal LLM key by setting baseURL = http://localhost:8002/llm/v1
"""
from __future__ import annotations

import os
import time
import uuid
import json
import asyncio
from typing import List, Literal, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

router = APIRouter(prefix="/llm/v1", tags=["llm-proxy"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Map common OpenAI model names to (provider, model) tuples for emergentintegrations
def resolve_provider_and_model(model: str) -> tuple[str, str]:
    m = (model or "").lower()
    if m.startswith("claude"):
        return ("anthropic", model)
    if m.startswith("gemini"):
        return ("gemini", model)
    # Default: openai (including gpt-4.1-mini, gpt-4o, gpt-5, gpt-5-mini, o3, etc.)
    return ("openai", model or "gpt-4.1-mini")


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "function", "developer"]
    content: Any  # str, or list of content-parts; we handle both


class ResponseFormat(BaseModel):
    type: Optional[str] = None


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    max_completion_tokens: Optional[int] = None
    response_format: Optional[ResponseFormat] = None
    stream: Optional[bool] = False
    # Allow extra fields without error
    class Config:
        extra = "allow"


def _content_to_text(content: Any) -> str:
    """OpenAI content can be a string or a list of parts. Flatten to text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for part in content:
            if isinstance(part, dict):
                t = part.get("text") or part.get("content") or ""
                texts.append(str(t))
            else:
                texts.append(str(part))
        return "\n".join(texts)
    return str(content)


@router.post("/chat/completions")
async def chat_completions(
    req: ChatCompletionRequest,
    authorization: Optional[str] = Header(default=None),
):
    # Caller's API key (Node backend will pass the Emergent key here).
    # Fall back to EMERGENT_LLM_KEY from env if no Authorization header.
    bearer = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    api_key = bearer or EMERGENT_LLM_KEY
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing Emergent LLM key")

    # Separate system from conversation messages
    system_parts: List[str] = []
    convo: List[ChatMessage] = []
    for m in req.messages:
        if m.role == "system" or m.role == "developer":
            system_parts.append(_content_to_text(m.content))
        else:
            convo.append(m)

    system_message = "\n\n".join(s for s in system_parts if s) or "You are a helpful assistant."

    # If caller asked for JSON response, reinforce it in the system prompt
    if req.response_format and (req.response_format.type or "") == "json_object":
        system_message += (
            "\n\nIMPORTANT: Respond ONLY with a valid JSON object. "
            "No markdown, no code fences, no prose outside the JSON."
        )

    # Build a single combined user prompt that preserves prior turns
    if not convo:
        raise HTTPException(status_code=400, detail="At least one non-system message is required")

    if len(convo) == 1 and convo[0].role == "user":
        prompt_text = _content_to_text(convo[0].content)
    else:
        lines = []
        for m in convo:
            role_label = m.role.upper()
            lines.append(f"[{role_label}]\n{_content_to_text(m.content)}")
        # Ensure the final turn is framed as a user request
        if convo[-1].role != "user":
            lines.append("[USER]\nPlease continue.")
        prompt_text = "\n\n".join(lines)

    provider, model_name = resolve_provider_and_model(req.model)

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"proxy-{uuid.uuid4().hex[:12]}",
            system_message=system_message,
        ).with_model(provider, model_name)

        if req.max_completion_tokens or req.max_tokens:
            try:
                chat = chat.with_max_tokens(req.max_completion_tokens or req.max_tokens)
            except Exception:
                pass  # method may not exist on all versions; ignore silently

        response_text = await chat.send_message(UserMessage(text=prompt_text))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM upstream error: {e}") from e

    # Clean code-fenced JSON if caller asked for json_object
    if req.response_format and (req.response_format.type or "") == "json_object":
        stripped = (response_text or "").strip()
        if stripped.startswith("```"):
            # remove ```json ... ``` fences
            stripped = stripped.strip("`")
            if stripped.lower().startswith("json"):
                stripped = stripped[4:].lstrip()
            response_text = stripped.rstrip("`").strip()

    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created_ts = int(time.time())

    # ── Streaming response (SSE, OpenAI-compatible) ──
    if req.stream:
        async def event_stream():
            # Split into word-sized chunks for smoother client-side UX
            tokens = (response_text or "").split(" ")
            for i, tok in enumerate(tokens):
                delta = tok if i == 0 else " " + tok
                chunk = {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created_ts,
                    "model": req.model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"role": "assistant", "content": delta} if i == 0 else {"content": delta},
                            "finish_reason": None,
                        }
                    ],
                }
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0)  # let event loop flush

            # Final chunk with finish_reason
            done_chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": req.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(done_chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": created_ts,
        "model": req.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": response_text or ""},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }


@router.get("/models")
async def list_models():
    """Minimal OpenAI-compatible models endpoint."""
    models = [
        "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano",
        "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4",
        "o3", "o3-pro", "o4-mini", "o1",
        "claude-sonnet-4-6", "claude-opus-4-6", "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001", "claude-opus-4-5-20251101",
        "gemini-3.1-pro-preview", "gemini-3-flash-preview",
        "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite",
    ]
    return {
        "object": "list",
        "data": [
            {"id": m, "object": "model", "created": 0, "owned_by": "emergent"}
            for m in models
        ],
    }


@router.get("/health")
async def health():
    return {"status": "ok", "has_key": bool(EMERGENT_LLM_KEY)}
