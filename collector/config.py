import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/qdii_arbitrage")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

TRADING_START = (9, 30)
TRADING_END = (15, 0)
POLL_INTERVAL = 30

COST_STOCK_COMMISSION = 0.015
COST_FX_SPREAD = 0.001
COST_SLIPPAGE = 0.001
TOTAL_COST_ESTIMATE = 0.017
