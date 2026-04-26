"""Sina Finance API fetcher for A-share market data."""
import requests
import re
import logging

logger = logging.getLogger(__name__)
SINA_API = "http://hq.sinajs.cn/list="


def _fetch(symbols):
    query = ",".join(symbols)
    headers = {"Referer": "https://finance.sina.com.cn"}
    try:
        resp = requests.get(f"{SINA_API}{query}", headers=headers, timeout=10)
        resp.encoding = "gb2312"
    except requests.RequestException as e:
        logger.error(f"Sina API request failed: {e}")
        return {}

    results = {}
    for line in resp.text.strip().split("\n"):
        match = re.match(r'var hq_str_(.+?)="(.+)"', line)
        if not match:
            continue
        symbol = match.group(1)
        data = match.group(2).split(",")
        if len(data) < 4 or not data[0]:
            continue
        results[symbol] = _parse_line(symbol, data)
    return results


def _parse_line(symbol, data):
    if symbol.startswith("f_"):
        return {
            "symbol": symbol[2:],
            "name": data[0],
            "price": float(data[1]) if data[1] else None,
            "prev_close": float(data[2]) if data[2] else None,
            "volume": int(float(data[8])) if len(data) > 8 and data[8] else None,
        }
    elif symbol.startswith("s_"):
        return {
            "symbol": symbol[2:],
            "name": data[0],
            "price": float(data[1]) if data[1] else None,
            "change_pct": float(data[3]) if len(data) > 3 and data[3] else None,
        }
    return {
        "symbol": symbol,
        "name": data[0],
        "price": float(data[3]) if len(data) > 3 and data[3] else None,
        "prev_close": float(data[2]) if len(data) > 1 and data[2] else None,
    }


def fetch_fund_prices(symbols):
    sina_symbols = []
    for s in symbols:
        if s.startswith("SH"):
            sina_symbols.append(f"f_{s[2:]}")
        elif s.startswith("SZ"):
            sina_symbols.append(f"f_{s[2:]}")

    results = {}
    for i in range(0, len(sina_symbols), 50):
        batch = sina_symbols[i : i + 50]
        results.update(_fetch(batch))
    return results
