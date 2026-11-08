#!/usr/bin/env python3
"""
Pre-meeting fact check for VVU pilot targets, using Parallel's Task API.

Fills the facts the pilot agreements need and tests claims from the target list
before they are repeated in a meeting. Every answer must carry a source URL.

Setup:   pip install parallel-web pydantic
         export PARALLEL_API_KEY=...        (https://platform.parallel.ai)
Run:     python pilot_target_research.py --dry-run     # prints the inputs, no API call
         python pilot_target_research.py               # all targets
         python pilot_target_research.py --only Schaeffler Broubart
Output:  pilot_research.json and pilot_research.md (next to this script)

Results are web-sourced and unverified until you confirm them on a primary source
(CIPC, the company site, a signed document). Treat them as Hypothesis tier.
"""
import argparse
import asyncio
import json
from pathlib import Path

from parallel import AsyncParallel
from pydantic import BaseModel, Field

PROCESSOR = "core"   # "base" is cheaper; "pro" is deeper. Check pricing at docs.parallel.ai.


class TargetFacts(BaseModel):
    legal_entity: str = Field(description="Exact registered legal name of the South African entity that would sign a pilot agreement, or 'not found'.")
    registration_number: str = Field(description="CIPC registration number if publicly stated, else 'not found'.")
    site_address: str = Field(description="Street address of the relevant Gqeberha / Eastern Cape site, else 'not found'.")
    decision_makers: str = Field(description="Named people and titles relevant to operations, technology or quality at this site, each with a source URL, else 'not found'.")
    certifications: str = Field(description="Management-system certifications publicly claimed for this site (e.g. ISO 50001, IATF 16949, ISO 9001) with the certifying source URL, else 'not found'.")
    current_systems: str = Field(description="Monitoring, MES, alarm, VMS or automation platforms publicly named for this site or company, with source URLs, else 'not found'.")
    claim_check: str = Field(description="Verdict on the specific claim given in the input: SUPPORTED, CONTRADICTED or NOT FOUND, with one sentence of evidence and a source URL.")
    sources: str = Field(description="All source URLs used, separated by spaces.")


TARGETS = {
    "Schaeffler": ("Schaeffler South Africa, Deal Party, Gqeberha",
                   "The Deal Party plant holds live ISO 50001 and IATF 16949 certification."),
    "Broubart": ("Broubart Umkhombe Security Group / Broubart Technologies, Gqeberha (the iCentre)",
                 "Broubart monitors more than 1,200 AI streams from its iCentre and leadership is Andre Wood (MD), Anton Bloemhoff (Director of Technology), Mark Wood (Director of Operations and Sales)."),
    "VW Kariega": ("Volkswagen Group South Africa, Kariega plant, Eastern Cape",
                   "Suppliers to the plant are under customer pressure to report verified energy or carbon data per vehicle or part."),
    "Isuzu": ("Isuzu Motors South Africa, Struandale plant, Gqeberha",
              "Tier-1 suppliers to Isuzu are asked for product carbon-footprint or energy data."),
    "Aspen": ("Aspen Pharmacare, Gqeberha manufacturing site (Aspen Port Elizabeth)",
              "The site operates under SAHPRA GMP licensing with cold-chain and cleanroom monitoring obligations."),
    "Fresenius": ("Fresenius Kabi South Africa, Gqeberha manufacturing site",
                  "The site operates under SAHPRA GMP licensing with environmental monitoring obligations."),
    "Vitality": ("Vitality Wellness Centre, Gqeberha, and the Discovery / Vitality entity that operates it",
                 "The Gqeberha Wellness Centre is inside Sportsmans Warehouse and is operated by a Discovery entity rather than a franchisee."),
    "Durr": ("Durr Africa (Durr Systems South Africa), Eastern Cape presence",
             "Durr Africa delivers paint-shop and automation cells to South African automotive plants and sells through a partner or reseller model."),
}


def build_input(name: str) -> str:
    entity, claim = TARGETS[name]
    return (
        f"Target: {entity}.\n"
        f"Claim to test: {claim}\n"
        "Find the facts requested in the output fields. Use only sources you can cite. "
        "If a fact is not publicly stated, say 'not found' instead of guessing."
    )


async def run_one(client: AsyncParallel, name: str):
    try:
        result = await client.task_run.execute(input=build_input(name), processor=PROCESSOR, output=TargetFacts)
        parsed = result.output.parsed
        return name, (parsed.model_dump() if parsed is not None else {"raw": str(result.output.content)})
    except Exception as exc:  # keep one failure from losing the other results
        return name, {"error": f"{type(exc).__name__}: {exc}"}


async def main(names):
    client = AsyncParallel()   # reads PARALLEL_API_KEY from the environment
    results = dict(await asyncio.gather(*(run_one(client, n) for n in names)))
    here = Path(__file__).resolve().parent
    (here / "pilot_research.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    lines = ["# Pilot target research (web-sourced, unverified: Hypothesis tier)\n"]
    for name, data in results.items():
        lines.append(f"## {name}\n")
        for k, v in data.items():
            lines.append(f"- **{k}**: {v}")
        lines.append("")
    (here / "pilot_research.md").write_text("\n".join(lines))
    print(f"Wrote {here/'pilot_research.json'} and {here/'pilot_research.md'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="Target names, e.g. Schaeffler Broubart")
    ap.add_argument("--dry-run", action="store_true", help="Print the task inputs and exit")
    a = ap.parse_args()
    names = a.only or list(TARGETS)
    unknown = [n for n in names if n not in TARGETS]
    if unknown:
        raise SystemExit(f"Unknown target(s): {unknown}. Choose from {list(TARGETS)}")
    if a.dry_run:
        for n in names:
            print(f"--- {n} ---\n{build_input(n)}\n")
    else:
        asyncio.run(main(names))
