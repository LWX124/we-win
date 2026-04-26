"""Net Asset Value (NAV) calculation for QDII funds."""
import logging

logger = logging.getLogger(__name__)


def calculate_realtime_nav(index_price, cny_rate, calibration_factor, position_adjust=1.0, is_domestic_index=False):
    if calibration_factor == 0:
        return 0.0
    nav = (index_price * cny_rate) / calibration_factor
    return nav * position_adjust


def calculate_premium(market_price, nav):
    if nav == 0:
        return 0.0
    return (market_price / nav - 1.0) * 100.0
