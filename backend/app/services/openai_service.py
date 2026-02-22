from __future__ import annotations

from typing import AsyncGenerator, Literal
import math
import os

from dotenv import load_dotenv
from openai import AsyncAzureOpenAI, AsyncOpenAI

from app.utils.format_message import format_user_message

load_dotenv()

ReasoningEffort = Literal["low", "medium", "high"]


class AzureConfig:
    """Azure OpenAI connection settings supplied by the end-user."""

    def __init__(self, endpoint: str, deployment: str, api_version: str):
        self.endpoint = endpoint
        self.deployment = deployment
        self.api_version = api_version


class OpenAIService:
    def __init__(self):
        self.default_api_key = os.getenv("OPENAI_API_KEY")
        self._clients: dict[tuple[str, str | None], AsyncOpenAI | AsyncAzureOpenAI] = {}

    def _resolve_api_key(self, override_api_key: str | None = None) -> str:
        api_key = (override_api_key or self.default_api_key or "").strip()
        if not api_key:
            raise ValueError(
                "Missing OpenAI API key. Set OPENAI_API_KEY or provide api_key in request."
            )
        return api_key

    @staticmethod
    def estimate_tokens(text: str) -> int:
        # Mirrors Next.js fallback heuristic.
        return math.ceil(len(text) / 4)

    @staticmethod
    def _build_input(system_prompt: str, user_prompt: str) -> list[dict]:
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    @staticmethod
    def _create_client(
        api_key: str,
        azure: AzureConfig | None = None,
    ) -> AsyncOpenAI | AsyncAzureOpenAI:
        if azure:
            return AsyncAzureOpenAI(
                api_key=api_key,
                azure_endpoint=azure.endpoint,
                api_version=azure.api_version,
                max_retries=2,
                timeout=600,
            )
        return AsyncOpenAI(
            api_key=api_key,
            max_retries=2,
            timeout=600,
        )

    def _get_or_create_client(
        self,
        api_key: str,
        azure: AzureConfig | None = None,
    ) -> AsyncOpenAI | AsyncAzureOpenAI:
        """Cache clients by (api_key, azure_endpoint) to reuse HTTP connection pools."""
        key = (api_key, azure.endpoint if azure else None)
        if key not in self._clients:
            self._clients[key] = self._create_client(api_key, azure)
        return self._clients[key]

    async def close_all_clients(self) -> None:
        """Shut down all cached OpenAI clients (call at app shutdown)."""
        for client in self._clients.values():
            await client.close()
        self._clients.clear()

    @staticmethod
    def _resolve_model(model: str, azure: AzureConfig | None = None) -> str:
        """For Azure the 'model' parameter must be the deployment name."""
        if azure:
            return azure.deployment
        return model

    async def stream_completion(
        self,
        *,
        model: str,
        system_prompt: str,
        data: dict[str, str | None],
        api_key: str | None = None,
        reasoning_effort: ReasoningEffort | None = None,
        max_output_tokens: int | None = None,
        azure: AzureConfig | None = None,
    ) -> AsyncGenerator[str, None]:
        user_prompt = format_user_message(data)
        resolved_api_key = self._resolve_api_key(api_key)
        resolved_model = self._resolve_model(model, azure)
        payload: dict = {
            "model": resolved_model,
            "stream": True,
            "input": self._build_input(system_prompt, user_prompt),
        }
        if reasoning_effort:
            payload["reasoning"] = {"effort": reasoning_effort}
        if max_output_tokens:
            payload["max_output_tokens"] = max_output_tokens

        client = self._get_or_create_client(resolved_api_key, azure)
        stream = await client.responses.create(**payload)
        try:
            async for event in stream:
                if event.type == "response.output_text.delta":
                    delta = getattr(event, "delta", None)
                    if isinstance(delta, str) and delta:
                        yield delta
                    continue

                if event.type == "error":
                    message = getattr(event, "message", None) or "OpenAI stream failed."
                    raise ValueError(str(message))
        finally:
            await stream.close()

    async def count_input_tokens(
        self,
        *,
        model: str,
        system_prompt: str,
        data: dict[str, str | None],
        api_key: str | None = None,
        reasoning_effort: ReasoningEffort | None = None,
        azure: AzureConfig | None = None,
    ) -> int:
        user_prompt = format_user_message(data)
        resolved_api_key = self._resolve_api_key(api_key)
        resolved_model = self._resolve_model(model, azure)
        payload: dict = {
            "model": resolved_model,
            "input": self._build_input(system_prompt, user_prompt),
        }
        if reasoning_effort:
            payload["reasoning"] = {"effort": reasoning_effort}

        client = self._get_or_create_client(resolved_api_key, azure)
        try:
            response = await client.responses.input_tokens.count(**payload)
            input_tokens = getattr(response, "input_tokens", None)
            if not isinstance(input_tokens, int):
                raise ValueError("OpenAI input token count returned invalid payload.")
            return input_tokens
        except Exception:
            raise
