# Pilot Programme: Garmin Uncle (Pilot)

## Tier: Bench
## Duration: 30 days
## Value: R3,000/year

## Pain Points Addressed
- No real-time stress monitoring
- Gait analysis accuracy only 87.3%
- No cryptographic proof of health data
- POPIA biometric consent (62% rate)

## Simulation Results
- gait_detection_accuracy: 87.3 → 99.9 (+14.4%)
- biometric_consent_rate: 62 → 77.0821 (-24.3%)
- stress_prediction_auc: 0.84 → 0.952 (+13.3%)

## Onboarding Steps
1. Sign consent form (POPIA §11, §18)
2. Deploy MI300X node (bootstrap_mi300x_droplet.sh)
3. Configure health monitoring module
4. Run 30-day pilot with actual data
5. Review results, decide on production

## Success Criteria
- Improvement > 20% on at least 2 metrics
- Circuit breaker trips < 5% of inferences
- Zero POPIA violations
- Client satisfaction > 4/5
