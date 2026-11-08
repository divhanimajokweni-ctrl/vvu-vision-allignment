# Pilot Programme: E-commerce SA (Generic)

## Tier: Business
## Duration: 30 days
## Value: R11,988/year

## Pain Points Addressed
- LCP above 2.5s threshold (42.3% of sites fail)
- CLS above 0.1 (31.9% of sites fail)
- No real-time RUM monitoring
- Revenue loss from slow pages

## Simulation Results
- lcp_p75_good: 42.3 → 64.8787 (+53.4%)
- cls_p75_good: 68.1 → 82.7177 (+21.5%)
- inp_p75_good: 55.2 → 69.4714 (+25.9%)
- avg_page_weight: 2450 → 2450 (+0.0%)

## Onboarding Steps
1. Sign consent form (POPIA §11, §18)
2. Deploy MI300X node (bootstrap_mi300x_droplet.sh)
3. Configure web performance module
4. Run 30-day pilot with actual data
5. Review results, decide on production

## Success Criteria
- Improvement > 20% on at least 2 metrics
- Circuit breaker trips < 5% of inferences
- Zero POPIA violations
- Client satisfaction > 4/5
