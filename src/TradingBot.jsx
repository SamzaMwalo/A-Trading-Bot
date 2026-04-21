import React, { useState, useEffect, useRef } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ============================================
// CANDLESTICK CHART COMPONENT
// ============================================

const CandlestickChart = ({ data, height = 350 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        Loading chart data...
      </div>
    );
  }

  // Use fixed dimensions for SVG
  const svgWidth = 800;
  const svgHeight = height;
  const marginLeft = 60;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 40;

  const chartWidth = svgWidth - marginLeft - marginRight;
  const chartHeight = svgHeight - marginTop - marginBottom;

  // Get price ranges
  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const priceRange = maxPrice - minPrice || 1;

  // Calculate candle positions
  const candleWidth = Math.max(chartWidth / (data.length * 3), 2); // Reduced from 1.5 to 3, min from 4 to 2
  const spacing = chartWidth / (data.length + 1);

  // Helper function to convert price to Y coordinate
  const priceToY = (price) => {
    return svgHeight - marginBottom - ((price - minPrice) / priceRange) * chartHeight;
  };

  return (
    <svg
      width="100%"
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* White background */}
      <rect width={svgWidth} height={svgHeight} fill="white" />

      {/* Grid lines */}
      {[...Array(6)].map((_, i) => {
        const price = minPrice + (priceRange / 5) * i;
        const y = priceToY(price);
        return (
          <g key={`gridline-${i}`}>
            <line
              x1={marginLeft}
              y1={y}
              x2={svgWidth - marginRight}
              y2={y}
              stroke="#f0f0f0"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            {/* Y-axis label */}
            <text
              x={marginLeft - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#666"
            >
              ${price.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={svgHeight - marginBottom} stroke="#999" strokeWidth="1" />
      <line x1={marginLeft} y1={svgHeight - marginBottom} x2={svgWidth - marginRight} y2={svgHeight - marginBottom} stroke="#999" strokeWidth="1" />

      {/* Candlesticks */}
      {data.map((candle, index) => {
        const x = marginLeft + spacing * (index + 1);
        
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);
        const bodyHeight = Math.max(bodyBottom - bodyTop, 2);

        return (
          <g key={`candle-${index}`}>
            {/* Wick (line from high to low) */}
            <line
              x1={x}
              y1={highY}
              x2={x}
              y2={lowY}
              stroke={candle.color}
              strokeWidth="1"
            />
            {/* Body (rectangle from open to close) */}
            <rect
              x={x - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={candle.color}
              stroke={candle.color}
              strokeWidth="1"
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((candle, index) => {
        if (index % Math.max(1, Math.floor(data.length / 6)) === 0) {
          const x = marginLeft + spacing * (index + 1);
          return (
            <text
              key={`xlabel-${index}`}
              x={x}
              y={svgHeight - 20}
              textAnchor="middle"
              fontSize="10"
              fill="#666"
            >
              {candle.time}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
};

const TradingBot = () => {
  const [price, setPrice] = useState(2450);
  const [priceHistory, setPriceHistory] = useState([]);
  const [balance, setBalance] = useState(100);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [indicators, setIndicators] = useState({
    rsi: 50,
    macd: 0,
    signal: 0,
    bb_upper: 0,
    bb_lower: 0,
    sma20: 0,
    sma50: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [tradingStats, setTradingStats] = useState({
    wins: 0,
    losses: 0,
    totalTrades: 0,
    winRate: 0,
    totalPnL: 0,
  });

  const priceRef = useRef(2450);
  const historyRef = useRef([]);
  const simulationRef = useRef(null);

  // ============================================
  // TECHNICAL INDICATORS CALCULATIONS
  // ============================================

  // RSI (Relative Strength Index)
  const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) return 50;

    const deltas = [];
    for (let i = 1; i < prices.length; i++) {
      deltas.push(prices[i] - prices[i - 1]);
    }

    const gains = deltas.slice(-period).filter(d => d > 0);
    const losses = deltas.slice(-period).filter(d => d < 0);

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? -losses.reduce((a, b) => a + b, 0) / period : 0;

    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));

    return Math.round(rsi);
  };

  // MACD (Moving Average Convergence Divergence)
  const calculateMACD = (prices) => {
    if (prices.length < 26) return { macd: 0, signal: 0 };

    const ema12 = prices.slice(-12).reduce((a, b) => a + b, 0) / 12;
    const ema26 = prices.slice(-26).reduce((a, b) => a + b, 0) / 26;
    const macd = ema12 - ema26;
    const signal = (macd + (prices.length > 35 ? prices[prices.length - 1] * 0.1 : 0)) / 2;

    return {
      macd: Math.round(macd * 100) / 100,
      signal: Math.round(signal * 100) / 100,
    };
  };

  // Bollinger Bands
  const calculateBB = (prices, period = 20) => {
    if (prices.length < period) return { upper: 0, lower: 0, sma: 0 };

    const recent = prices.slice(-period);
    const sma = recent.reduce((a, b) => a + b, 0) / period;
    const variance = recent.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: Math.round((sma + 2 * stdDev) * 100) / 100,
      lower: Math.round((sma - 2 * stdDev) * 100) / 100,
      sma: Math.round(sma * 100) / 100,
    };
  };

  // Simple Moving Average
  const calculateSMA = (prices, period) => {
    if (prices.length < period) return prices[prices.length - 1];
    return (
      Math.round(
        (prices.slice(-period).reduce((a, b) => a + b, 0) / period) * 100
      ) / 100
    );
  };

  // ============================================
  // CANDLESTICK DATA GENERATION
  // ============================================

  const generateCandlestickData = (prices) => {
    if (prices.length < 5) return [];
    
    const candles = [];
    // For 5-minute intervals, show each price point as a candle (less grouping needed)
    const candleSize = 1;
    
    for (let i = 0; i < prices.length; i += candleSize) {
      const candlePrices = prices.slice(i, i + candleSize);
      const open = candlePrices[0];
      const close = candlePrices[candlePrices.length - 1];
      const high = Math.max(...candlePrices);
      const low = Math.min(...candlePrices);
      
      candles.push({
        time: Math.floor(i / candleSize),
        open: Math.round(open * 100) / 100,
        close: Math.round(close * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        color: close >= open ? '#10b981' : '#ef4444', // Green if up, red if down
      });
    }
    
    return candles;
  };

  // ============================================
  // TRADING LOGIC
  // ============================================

  const executeTrade = (type, currentPrice) => {
    if (type === 'BUY') {
      const amount = Math.floor((balance * 0.5) / currentPrice);
      if (amount > 0) {
        const cost = amount * currentPrice;
        setBalance(prev => prev - cost);
        setPositions(prev => [
          ...prev,
          {
            type: 'BUY',
            entry: currentPrice,
            amount,
            time: new Date().toLocaleTimeString(),
          },
        ]);
        setTrades(prev => [
          ...prev,
          {
            type: 'BUY',
            price: currentPrice,
            amount,
            time: new Date().toLocaleTimeString(),
            pnl: 0,
          },
        ]);
      }
    } else if (type === 'SELL' && positions.length > 0) {
      const pos = positions[0];
      const proceeds = pos.amount * currentPrice;
      const pnl = Math.round((proceeds - pos.amount * pos.entry) * 100) / 100;

      setBalance(prev => prev + proceeds);
      setPositions(prev => prev.slice(1));
      setTrades(prev => [
        ...prev,
        {
          type: 'SELL',
          price: currentPrice,
          amount: pos.amount,
          time: new Date().toLocaleTimeString(),
          pnl,
        },
      ]);

      setTradingStats(prev => ({
        wins: pnl > 0 ? prev.wins + 1 : prev.wins,
        losses: pnl <= 0 ? prev.losses + 1 : prev.losses,
        totalTrades: prev.totalTrades + 1,
        winRate:
          pnl > 0
            ? Math.round(((prev.wins + 1) / (prev.totalTrades + 1)) * 100)
            : Math.round((prev.wins / (prev.totalTrades + 1)) * 100),
        totalPnL: prev.totalPnL + pnl,
      }));
    }
  };

  // ============================================
  // PRICE SIMULATION & AUTO-TRADING
  // ============================================

  useEffect(() => {
    if (!isRunning) return;

    // Update price every 5 minutes (300,000 ms)
    simulationRef.current = setInterval(() => {
      // Realistic price movement with drift and volatility
      const drift = (Math.random() - 0.5) * 4;
      const volatility = (Math.random() - 0.5) * 8;
      let newPrice = priceRef.current + drift + volatility;

      // Keep price in realistic range
      newPrice = Math.max(2400, Math.min(2500, newPrice));
      newPrice = Math.round(newPrice * 100) / 100;

      priceRef.current = newPrice;

      setPriceHistory(prev => {
        const updated = [...prev, newPrice].slice(-200);
        historyRef.current = updated;

        if (updated.length >= 26) {
          // Calculate all indicators
          const rsi = calculateRSI(updated);
          const { macd, signal } = calculateMACD(updated);
          const bb = calculateBB(updated);
          const sma20 = calculateSMA(updated, 20);
          const sma50 = calculateSMA(updated, 50);

          setIndicators({
            rsi,
            macd,
            signal,
            bb_upper: bb.upper,
            bb_lower: bb.lower,
            sma20,
            sma50,
          });

          // AUTO-TRADING STRATEGY
          // BUY: RSI oversold + price above lower Bollinger Band
          if (positions.length === 0 && rsi < 35 && newPrice > bb.lower) {
            executeTrade('BUY', newPrice);
          }
          // SELL: RSI overbought
          else if (positions.length > 0 && rsi > 70) {
            executeTrade('SELL', newPrice);
          }
        }

        return updated;
      });

      setPrice(newPrice);
    }, 300000); // 300,000 ms = 5 minutes

    return () => clearInterval(simulationRef.current);
  }, [isRunning, positions]);

  // ============================================
  // CALCULATIONS FOR DISPLAY
  // ============================================

  const candlestickData = generateCandlestickData(priceHistory);
  const openPnL =
    positions.length > 0
      ? Math.round((price - positions[0].entry) * positions[0].amount * 100) /
        100
      : 0;
  const equity =
    balance + (positions.length > 0 ? price * positions[0].amount : 0);

  // ============================================
  // RENDER UI
  // ============================================

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1f2937',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
      }}
    >
      {/* ===== HEADER ===== */}
      <div
        style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '20px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '15px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '600', margin: '0 0 4px 0' }}>
              XAUUSD Trading Bot
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
                margin: '0',
              }}
            >
              Educational Paper Trading Simulator
            </p>
          </div>

          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              padding: '10px 20px',
              backgroundColor: isRunning ? '#ef4444' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.target.style.opacity = '0.9')}
            onMouseLeave={e => (e.target.style.opacity = '1')}
          >
            {isRunning ? '⏹ Stop Simulation' : '▶ Start Simulation'}
          </button>
        </div>

        {/* KEY METRICS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          <MetricCard label="Price" value={`$${price}`} color="#3b82f6" />
          <MetricCard label="Equity" value={`$${Math.round(equity)}`} color="#8b5cf6" />
          <MetricCard label="Balance" value={`$${Math.round(balance)}`} color="#06b6d4" />
          <MetricCard
            label="Open P&L"
            value={`$${openPnL}`}
            color={openPnL >= 0 ? '#10b981' : '#ef4444'}
          />
        </div>
      </div>

      {/* ===== PRICE CHART ===== */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 15px 0' }}>
          Price & Technical Analysis
        </h2>

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '15px',
            border: '1px solid #e5e7eb',
            marginBottom: '15px',
          }}
        >
          <CandlestickChart data={candlestickData} height={350} />
        </div>

        {/* INDICATORS GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          <IndicatorCard
            label="RSI (14)"
            value={indicators.rsi}
            subtitle={
              indicators.rsi < 30
                ? '⬇️ Oversold'
                : indicators.rsi > 70
                ? '⬆️ Overbought'
                : '⚖️ Neutral'
            }
          />
          <IndicatorCard
            label="MACD"
            value={indicators.macd}
            subtitle={`Signal: ${indicators.signal}`}
          />
          <IndicatorCard
            label="SMA 20"
            value={`$${indicators.sma20}`}
            subtitle="20-day avg"
          />
          <IndicatorCard
            label="Bollinger Bands"
            value={`U: $${indicators.bb_upper}`}
            subtitle={`L: $${indicators.bb_lower}`}
          />
        </div>
      </div>

      {/* ===== TRADING STATISTICS ===== */}
      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '20px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 15px 0' }}>
          Trading Statistics
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <StatCard label="Total Trades" value={tradingStats.totalTrades} />
          <StatCard
            label="Win Rate"
            value={`${tradingStats.winRate}%`}
            highlight={tradingStats.winRate > 50}
          />
          <StatCard
            label="Total P&L"
            value={`$${tradingStats.totalPnL}`}
            highlight={tradingStats.totalPnL >= 0}
          />
          <StatCard
            label="Active Position"
            value={positions.length > 0 ? `BUY ${positions[0].amount}` : 'None'}
          />
        </div>

        {/* RECENT TRADES */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0' }}>
            Recent Trades
          </h3>

          <div
            style={{
              maxHeight: '240px',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
            }}
          >
            {trades.length === 0 ? (
              <p
                style={{
                  padding: '15px',
                  color: '#9ca3af',
                  margin: '0',
                  fontSize: '14px',
                }}
              >
                No trades yet. Start simulation to begin trading.
              </p>
            ) : (
              trades
                .slice()
                .reverse()
                .slice(0, 10)
                .map((trade, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 15px',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontWeight: '600',
                          color:
                            trade.type === 'BUY' ? '#10b981' : '#ef4444',
                        }}
                      >
                        {trade.type}
                      </span>
                      <span style={{ color: '#6b7280', marginLeft: '10px' }}>
                        {trade.amount} oz @ ${trade.price}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {trade.pnl !== 0 && (
                        <p
                          style={{
                            margin: '0',
                            color: trade.pnl > 0 ? '#10b981' : '#ef4444',
                            fontWeight: '600',
                          }}
                        >
                          ${trade.pnl}
                        </p>
                      )}
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          color: '#9ca3af',
                          fontSize: '11px',
                        }}
                      >
                        {trade.time}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* DISCLAIMER */}
        <div
          style={{
            marginTop: '25px',
            padding: '15px',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            border: '1px solid #93c5fd',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: '#1e40af',
              margin: '0',
              lineHeight: '1.6',
            }}
          >
            <strong>⚠️ Educational Disclaimer:</strong> This is a{' '}
            <strong>simulation tool</strong> for learning technical analysis.
            Real trading involves significant risk and requires proper risk
            management. Past performance never guarantees future results. No
            trading system is consistently profitable. Always use stop-losses,
            manage position size carefully, and never risk capital you cannot
            afford to lose. Forex trading can result in substantial losses.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// REUSABLE COMPONENT: METRIC CARD
// ============================================

function MetricCard({ label, value, color }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: `1px solid #e5e7eb`,
        borderLeftWidth: '3px',
        borderLeftColor: color,
      }}
    >
      <p
        style={{
          fontSize: '11px',
          color: '#6b7280',
          margin: '0 0 6px 0',
          fontWeight: '500',
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: '18px', fontWeight: '600', margin: '0', color }}>
        {value}
      </p>
    </div>
  );
}

// ============================================
// REUSABLE COMPONENT: INDICATOR CARD
// ============================================

function IndicatorCard({ label, value, subtitle }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          color: '#6b7280',
          margin: '0 0 6px 0',
          fontWeight: '500',
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: '11px', color: '#6b7280', margin: '6px 0 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ============================================
// REUSABLE COMPONENT: STAT CARD
// ============================================

function StatCard({ label, value, highlight }) {
  const highlightColor =
    highlight === undefined
      ? '#6b7280'
      : highlight
      ? '#10b981'
      : '#ef4444';

  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          color: '#6b7280',
          margin: '0 0 6px 0',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0',
          color: highlightColor,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export default TradingBot;