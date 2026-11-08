# Pilot Programme: Volkswagen South Africa

## Tier: O2O
## Duration: 30 days
## Value: R119,988/year

## Pain Points Addressed
- Production line downtime (R22K/hour)
- No fail-closed quality assurance
- Regulatory compliance (IATF 16949)
- Worker safety monitoring (POPIA §26)

## Simulation Results
- defects_per_100_vehicles: 192 → 93.9676 (+51.1%)
- first_pass_yield: 94.2 → 99.6361 (+5.8%)
- production_downtime_cost: 22000 → 21419.6716 (+2.6%)

## Onboarding Steps
1. Sign consent form (POPIA §11, §18)
2. Deploy MI300X node (bootstrap_mi300x_droplet.sh)
3. Configure quality assurance module
4. Run 30-day pilot with actual data
5. Review results, decide on production

## Success Criteria
- Improvement > 20% on at least 2 metrics
- Circuit breaker trips < 5% of inferences
- Zero POPIA violations
- Client satisfaction > 4/5
