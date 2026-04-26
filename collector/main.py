"""QDII Arbitrage Data Collector - fetches market data, calculates NAVs, detects signals."""
import schedule
import time
import logging
import datetime
import redis
import json
from config import POLL_INTERVAL, REDIS_URL, DATABASE_URL
from db import (
    fetch_active_funds, insert_fund_price, insert_exchange_rate,
    insert_index_price, insert_valuation, insert_signal,
    expire_old_signals, get_historical_premiums,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

r = redis.from_url(REDIS_URL)


def should_run():
    now = datetime.datetime.now()
    if now.weekday() >= 5:
        return False
    t = (now.hour, now.minute)
    return (9, 30) <= t <= (15, 5)


def fetch_and_process():
    if not should_run():
        return

    now = datetime.datetime.now()
    logger.info("Starting data collection cycle...")

    try:
        from fetchers.sina import fetch_fund_prices
        from fetchers.yahoo import fetch_quotes
        from fetchers.chinamoney import fetch_cny_rates
        from calculators.nav import calculate_realtime_nav, calculate_premium
        from calculators.signals import detect_signal
        from config import TOTAL_COST_ESTIMATE

        # Step 1: Fetch exchange rates
        rates = fetch_cny_rates()
        for pair, data in rates.items():
            insert_exchange_rate(pair, data["rate"], now, "CHINAMONEY")

        # Step 2: Fetch index prices
        CATEGORY_INDEX_MAP = {
            "US_TECH": "^NDX", "US_SP": "^GSPC", "US_OIL": "XOP",
            "US_BIO": "XBI", "US_CONS": "XLY", "US_GENERAL": "AGG",
            "HK_HSI": "^HSI", "HK_HSCEI": "^HSCE", "HK_TECH": "^HSTECH",
            "JP_NKY": "^N225", "EU_DAX": "^GDAXI",
        }
        yahoo_symbols = list(set(CATEGORY_INDEX_MAP.values()))
        index_prices = fetch_quotes(yahoo_symbols)
        for symbol, data in index_prices.items():
            if data.get("price"):
                insert_index_price(symbol, data["price"], now, "YAHOO")

        CURRENCY_MAP = {"USD": "USDCNY", "HKD": "HKDCNY", "JPY": "JPYCNY", "EUR": "EURCNY"}

        # Step 3: Process funds
        funds = fetch_active_funds()
        sina_symbols = [f["symbol"] for f in funds]
        fund_prices = fetch_fund_prices(sina_symbols)

        for fund in funds:
            symbol = fund["symbol"]
            if symbol not in fund_prices:
                continue

            price_data = fund_prices[symbol]
            market_price = price_data.get("price")
            if not market_price:
                continue

            insert_fund_price(fund["id"], market_price, price_data.get("volume"), None, "SINA", now)

            category = fund["category"]
            index_symbol = CATEGORY_INDEX_MAP.get(category)
            index_price = index_prices.get(index_symbol, {}).get("price") if index_symbol else None

            currency = fund["currency"]
            rate_pair = CURRENCY_MAP.get(currency)
            rate = rates.get(rate_pair, {}).get("rate") if rate_pair else None

            if not index_price or not rate:
                continue

            calibration = float(fund.get("pair_calibration") or 1.0)
            position_adj = float(fund.get("position_adjust") or 1.0)

            realtime_nav = calculate_realtime_nav(
                index_price, rate, calibration, position_adj,
                is_domestic_index=(category == "MIXED"),
            )
            premium = calculate_premium(market_price, realtime_nav)

            insert_valuation(fund["id"], now, None, None, realtime_nav, calibration, premium)

            history = get_historical_premiums(fund["id"], days=30)
            history.append(premium)

            signal = detect_signal(premium, history, TOTAL_COST_ESTIMATE)
            if signal:
                expire_old_signals(fund["id"])
                insert_signal(
                    fund["id"], now, signal["type"], signal["premium_rate"],
                    signal.get("z_score"), signal.get("historical_mean"),
                    signal.get("historical_std"), signal["cost_estimate"],
                    signal["net_spread"],
                )
                r.publish("arbitrage:signals", json.dumps({
                    "fundId": fund["id"], "type": signal["type"],
                    "premiumRate": signal["premium_rate"],
                    "zScore": signal.get("z_score"),
                    "netSpread": signal["net_spread"],
                    "fundSymbol": fund["symbol"], "fundName": fund["name"],
                    "timestamp": now.isoformat(),
                }, default=str))
                logger.info(f"Signal: {fund['symbol']} {signal['type']} premium={signal['premium_rate']:.2f}% z={signal.get('z_score', 0):.1f}")

            r.publish("arbitrage:prices", json.dumps({
                "fundId": fund["id"], "marketPrice": market_price,
                "realtimeNAV": realtime_nav, "premium": premium,
                "timestamp": now.isoformat(),
            }, default=str))

        logger.info(f"Cycle complete. Processed {len(funds)} funds.")
    except Exception as e:
        logger.error(f"Data collection failed: {e}", exc_info=True)


def main():
    logger.info("QDII Arbitrage Collector starting...")
    schedule.every(POLL_INTERVAL).seconds.do(fetch_and_process)
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    main()
