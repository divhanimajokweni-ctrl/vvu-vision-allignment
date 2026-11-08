# Pilot Programme: Isuzu South Africa

## Tier: O2O
## Duration: 30 days
## Value: R119,988/year

## Pain Points Addressed
- Production line quality escapes (0.8% rate)
- Recall risk (0.42% global rate)
- First-pass yield below 95%
- Downtime cost R400K/hour (R22K USD)
- No real-time digital twin of production floor

## Simulation Results
- defects_per_100_vehicles: 192 → 94.4176 (+50.8%)
- recall_rate: 0.42 → 0.2014 (+52.1%)
- first_pass_yield: 94.2 → 98.8024 (+4.9%)
- production_downtime_cost: 22000 → 20610.4791 (+6.3%)
- quality_escape_rate: 0.8 → 0.3321 (+58.5%)

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
