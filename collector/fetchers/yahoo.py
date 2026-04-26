"""Yahoo Finance API v7 fetcher."""
import requests
import logging

logger = logging.getLogger(__name__)
YAHOO_API = "https://query2.finance.yahoo.com/v7/finance/quote"


def fetch_quotes(symbols):
    try:
        resp = requests.get(
            YAHOO_API,
            params={"symbols": ",".join(symbols)},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Yahoo API request failed: {e}")
        return {}

    data = resp.json()
    results = {}
    for item in data.get("quoteResponse", {}).get("result", []):
        symbol = item.get("symbol", "")
        results[symbol] = {
            "symbol": symbol,
            "price": item.get("regularMarketPrice"),
            "prev_close": item.get("regularMarketPreviousClose"),
            "change_pct": item.get("regularMarketChangePercent"),
            "currency": item.get("currency"),
        }
    return results
