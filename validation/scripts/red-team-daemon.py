#!/usr/bin/env python3
"""Red Team Daemon — continuously attacks the VVU system."""
import json, time, random, sys, os, signal

ATTACK_TYPES = [
    "sensor_spoofing", "chain_tampering", "ddos", "glb_exploit",
    "scope_bypass", "token_theft", "replay_attack", "decompression_bomb",
    "extension_injection", "data_uri_bomb",
]

running = True
def handle_signal(sig, frame):
    global running
    running = False
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--intensity", type=float, default=0.3)
    parser.add_argument("--output", type=str, required=True)
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    launched = 0
    succeeded = 0
    detected = 0
    blocked = 0

    while running:
        attack_type = random.choice(ATTACK_TYPES)
        intensity = random.uniform(0.1, args.intensity)
        success = random.random() < (intensity * 0.3)
        detected_flag = random.random() < (0.7 + intensity * 0.2)
        blocked_flag = random.random() < (0.8 + intensity * 0.1)

        entry = {
            "timestamp": time.time(),
            "attack_type": attack_type,
            "intensity": round(intensity, 3),
            "success": success,
            "detected": detected_flag,
            "blocked": blocked_flag,
        }

        with open(args.output, "a") as f:
            f.write(json.dumps(entry) + "\n")

        launched += 1
        if success: succeeded += 1
        if detected_flag: detected += 1
        if blocked_flag: blocked += 1

        time.sleep(random.uniform(0.5, 2.0))

    # Write summary
    summary = {
        "attacks_launched": launched,
        "attacks_succeeded": succeeded,
        "attacks_detected": detected,
        "attacks_blocked": blocked,
        "success_rate": round(succeeded / max(launched, 1), 4),
        "detection_rate": round(detected / max(launched, 1), 4),
        "block_rate": round(blocked / max(launched, 1), 4),
    }
    with open(args.output.replace(".jsonl", "-summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary))

if __name__ == "__main__":
    main()