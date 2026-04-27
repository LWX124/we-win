"""Database operations for the collector."""
import psycopg2
import psycopg2.extras
from config import DATABASE_URL

_conn = None


def get_conn():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL)
        _conn.autocommit = True
    return _conn


def fetch_active_funds():
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT f.id, f.symbol, f.name, f.exchange, f.currency, f.category,
                   fp."pairIndex", fp."calibrationFactor" as pair_calibration,
                   fp."positionAdjust"
            FROM "Fund" f
            LEFT JOIN "FundPair" fp ON fp."fundId" = f.id
            WHERE f."isActive" = true
        """)
        return cur.fetchall()


def insert_fund_price(fund_id, price, volume, turnover, source, timestamp):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "FundPrice" (id, "fundId", timestamp, "marketPrice", volume, turnover, source)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
        """, (fund_id, timestamp, price, volume, turnover, source))


def insert_exchange_rate(pair, rate, timestamp, source):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "ExchangeRate" (id, pair, rate, timestamp, source)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
        """, (pair, rate, timestamp, source))


def insert_index_price(symbol, price, timestamp, source):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "IndexPrice" (id, "indexSymbol", price, timestamp, source)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
        """, (symbol, price, timestamp, source))


def insert_valuation(fund_id, timestamp, official_nav, fair_nav, realtime_nav, calibration_factor, premium):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "FundValuation" (id, "fundId", timestamp, "officialNAV", "fairNAV",
                                          "realtimeNAV", "calibrationFactor", premium)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s)
        """, (fund_id, timestamp, official_nav, fair_nav, realtime_nav, calibration_factor, premium))


def insert_signal(fund_id, timestamp, signal_type, premium_rate, z_score, historical_mean, historical_std, cost_estimate, net_spread):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "ArbitrageSignal" (id, "fundId", timestamp, type, "premiumRate",
                                            "zScore", "historicalMean", "historicalStd",
                                            "costEstimate", "netSpread", status)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
        """, (fund_id, timestamp, signal_type, premium_rate, z_score, historical_mean, historical_std, cost_estimate, net_spread))


def expire_old_signals(fund_id):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE "ArbitrageSignal" SET status = 'EXPIRED'
            WHERE "fundId" = %s AND status = 'ACTIVE'
        """, (fund_id,))


def get_historical_premiums(fund_id, days=30):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT premium FROM "FundValuation"
            WHERE "fundId" = %s AND premium IS NOT NULL
            ORDER BY timestamp DESC
            LIMIT %s
        """, (fund_id, days * 50))
        return [float(r[0]) for r in cur.fetchall()]
