"""LLM abstraction.

The RAG service always builds a *grounded draft* from verified structured
data and retrieved passages. The LLM layer then only rewrites that draft into
fluent prose using the supplied context — it is never asked to recall facts.

Providers
  mock               (default) deterministic, offline, returns the grounded draft
  openai_compatible  any OpenAI-style /chat/completions endpoint — e.g. a local
                     Ollama (http://localhost:11434/v1), vLLM or TGI server
                     hosting an open-weight model (Llama 3.1, Mistral, Qwen 2.5)

Configure with LLM_PROVIDER, LLM_BASE_URL, LLM_MODEL, LLM_API_KEY.
If a real provider fails, the service falls back to the grounded draft so the
application never becomes unusable.
"""
from __future__ import annotations

import json
import os
import urllib.request

SYSTEM_PROMPT = (
    "You are CoalMind AI, an assistant for CMPDI / Coal India officers. Answer ONLY using the numbered context "
    "passages and verified facts provided. Keep every figure exactly as given, including units and financial year. "
    "If the context is insufficient, reply exactly: 'I could not find sufficient verified information in the "
    "organizational knowledge base.' Be concise and formal. Do not add information that is not in the context."
)


class MockLLM:
    name = "Grounded template composer (Demo Mode — no external LLM)"
    provider = "mock"

    def generate(self, question: str, draft: str, context: list[dict]) -> str:
        return draft


class OpenAICompatibleLLM:
    provider = "openai_compatible"

    def __init__(self) -> None:
        self.base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1").rstrip("/")
        self.model = os.getenv("LLM_MODEL", "llama3.1:8b-instruct")
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.name = f"{self.model} via {self.base_url}"

    def generate(self, question: str, draft: str, context: list[dict]) -> str:
        ctx = "\n\n".join(f"[{i + 1}] {c['title']} (p.{c['page']}): {c['text']}" for i, c in enumerate(context))
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{ctx}\n\nVerified facts / draft answer:\n{draft}\n\nQuestion: {question}\n\n"
                                        "Rewrite the draft as the final answer (2-4 sentences)."},
        ]
        body = json.dumps({"model": self.model, "messages": messages, "temperature": 0.1}).encode()
        req = urllib.request.Request(f"{self.base_url}/chat/completions", data=body, method="POST",
                                     headers={"Content-Type": "application/json",
                                              **({"Authorization": f"Bearer {self.api_key}"} if self.api_key else {})})
        try:
            with urllib.request.urlopen(req, timeout=float(os.getenv("LLM_TIMEOUT", "30"))) as resp:
                data = json.loads(resp.read())
            text = data["choices"][0]["message"]["content"].strip()
            return text or draft
        except Exception:
            return draft  # graceful degradation to the grounded draft


_llm = None


def get_llm():
    global _llm
    if _llm is None:
        _llm = OpenAICompatibleLLM() if os.getenv("LLM_PROVIDER", "mock") == "openai_compatible" else MockLLM()
    return _llm
