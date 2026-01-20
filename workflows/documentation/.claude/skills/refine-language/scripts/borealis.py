#!/usr/bin/env python3
"""Kaller LM Studio med Borealis-modellen for å forbedre norsk tekst."""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# Standardverdier
DEFAULT_API_URL = "http://localhost:1234/v1/chat/completions"
DEFAULT_MODEL = "borealis-4b-instruct-preview"


def load_env_file() -> dict[str, str]:
    """Les konfigurasjon fra .env-fil hvis den finnes."""
    env_vars = {}
    script_dir = Path(__file__).parent
    env_file = script_dir / ".env"

    if not env_file.exists():
        return env_vars

    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                env_vars[key.strip()] = value.strip()

    return env_vars


def get_config() -> tuple[str, str]:
    """Hent API URL og modellnavn fra miljøvariabler eller .env-fil."""
    env_file_vars = load_env_file()

    api_url = (
        os.environ.get("BOREALIS_API_URL")
        or env_file_vars.get("BOREALIS_API_URL")
        or DEFAULT_API_URL
    )
    model = (
        os.environ.get("BOREALIS_MODEL")
        or env_file_vars.get("BOREALIS_MODEL")
        or DEFAULT_MODEL
    )

    return api_url, model


def forbedre_tekst(tekst: str) -> str:
    """Send tekst til Borealis-modellen og returner forbedret versjon."""
    api_url, model = get_config()

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Du er en norsk språkekspert. Din oppgave er å forbedre tekster på norsk. Behold meningen, men gjør språket klarere, mer presist og bedre formulert. Svar med den forbedrede teksten i sin helhet."
            },
            {
                "role": "user",
                "content": f"Kan du forbedre denne teksten? Svar helst med den forbedrede teksten i sin helhet. Tekst:\n\n{tekst}"
            }
        ],
        "temperature": 0.7
    }

    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except urllib.error.URLError as e:
        return f"FEIL: Kunne ikke koble til {api_url}. Sjekk at tjenesten kjører. ({e})"
    except (KeyError, IndexError):
        return "FEIL: Uventet respons fra LLM-tjenesten."


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print("Bruk: python borealis.py <tekst>")
        print()
        api_url, model = get_config()
        print(f"Konfigurasjon:")
        print(f"  API URL: {api_url}")
        print(f"  Modell:  {model}")
        sys.exit(1)

    tekst = " ".join(sys.argv[1:])
    print(forbedre_tekst(tekst))
