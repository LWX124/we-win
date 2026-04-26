"""Arbitrage signal detection using Z-score method."""
import numpy as np
import logging
from config import TOTAL_COST_ESTIMATE

logger = logging.getLogger(__name__)


def detect_signal(current_premium, historical_premiums, cost_estimate=TOTAL_COST_ESTIMATE):
    if len(historical_premiums) < 30:
        return None

    premiums = np.array(historical_premiums)
    mean = float(np.mean(premiums))
    std = float(np.std(premiums))

    if std == 0:
        return None

    z_score = (current_premium - mean) / std

    if abs(z_score) <= 2.0:
        return None

    net_spread = abs(current_premium) - cost_estimate
    if net_spread <= 0:
        return None

    if current_premium > 0 and z_score > 2.0:
        signal_type = "PREMIUM"
    elif current_premium < 0 and z_score < -2.0:
        signal_type = "DISCOUNT"
    else:
        return None

    return {
        "type": signal_type,
        "premium_rate": current_premium,
        "z_score": z_score,
        "historical_mean": mean,
        "historical_std": std,
        "cost_estimate": cost_estimate,
        "net_spread": net_spread,
    }
