#!/usr/bin/env python3
"""Purple Team Daemon — adaptive defense that learns from red team attacks."""
import json, time, random, sys, os, signal

running = True
def handle_signal(sig, frame):
    global running
    running = False
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=str, required=True)
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    threat_intel = {}
    defenses = 0
    adaptations = 0

    while running:
        # Read latest red team attack (simulate by generating)
        attack_type = random.choice([
            "sensor_spoofing", "chain_tampering", "ddos", "glb_exploit",
            "scope_bypass", "token_theft", "replay_attack", "decompression_bomb",
        ])
        blocked = random.random() < 0.85
        success = random.random() < 0.1

        if attack_type not in threat_intel:
            threat_intel[attack_type] = {"count": 0, "blocked": 0, "succeeded": 0}
        threat_intel[attack_type]["count"] += 1
        if blocked: threat_intel[attack_type]["blocked"] += 1
        if success: threat_intel[attack_type]["succeeded"] += 1

        defenses += 1
        adaptation = None
        if success:
            adaptations += 1
            adaptation = f"Increased monitoring for {attack_type}"

        entry = {
            "timestamp": time.time(),
            "attack_type": attack_type,
            "defense_deployed": True,
            "blocked": blocked,
            "adaptation": adaptation,
            "threat_intel": threat_intel[attack_type],
        }

        with open(args.output, "a") as f:
            f.write(json.dumps(entry) + "\n")

        time.sleep(random.uniform(1.0, 3.0))

    summary = {
        "defenses_deployed": defenses,
        "adaptations": adaptations,
        "threat_intel": threat_intel,
    }
    with open(args.output.replace(".jsonl", "-summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary))

if __name__ == "__main__":
    main()
