"""China Money fetcher for official CNY parity rates."""
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
CHINAMONEY_API = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew"


def fetch_cny_rates():
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        resp = requests.post(
            CHINAMONEY_API,
            json={"startDate": today, "endDate": today, "currency": "", "pageNum": 1, "pageSize": 50},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"ChinaMoney API request failed: {e}")
        return {}

    data = resp.json()
    records = data.get("records", [])
    pair_map = {"USD": "USDCNY", "HKD": "HKDCNY", "JPY": "JPYCNY", "EUR": "EURCNY"}
    results = {}
    for record in records:
        currency = record.get("ccy")
        rate_val = record.get("values", [None])[0]
        if currency in pair_map and rate_val is not None:
            results[pair_map[currency]] = {
                "pair": pair_map[currency],
                "rate": float(rate_val) / 100 if currency in ("JPY",) else float(rate_val),
                "timestamp": today,
            }
    return results
