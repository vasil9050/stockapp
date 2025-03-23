"use client"

import { useState } from 'react'
import useSWR from 'swr'
import { StockSearch } from '@/components/stock-search'
import { StockChart } from '@/components/stock-chart'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, TrendingUp, TrendingDown, AlertCircle, CandlestickChart } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from '@/lib/utils'

const ALPHA_VANTAGE_API_KEY = 'T7GCMIKGFV6I3TEX'

const TIME_RANGES = {
  '1D': { function: 'TIME_SERIES_INTRADAY', interval: '5min', outputsize: 'full' },
  '1M': { function: 'TIME_SERIES_DAILY', outputsize: 'compact' },
  '6M': { function: 'TIME_SERIES_DAILY', outputsize: 'full' },
  '1Y': { function: 'TIME_SERIES_WEEKLY' },
  '5Y': { function: 'TIME_SERIES_MONTHLY' },
  'ALL': { function: 'TIME_SERIES_MONTHLY' }
} as const

type TimeRange = keyof typeof TIME_RANGES

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  
  if (data['Error Message']) {
    throw new Error(data['Error Message'])
  }
  
  if (data['Note']) {
    throw new Error('API rate limit exceeded. Please try again in a minute.')
  }
  
  const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'))
  const timeSeries = data[timeSeriesKey]
  
  if (!timeSeries) {
    throw new Error('No data available for this stock symbol. Please check the symbol and try again.')
  }
  
  return Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
    date,
    open: parseFloat(values['1. open']),
    high: parseFloat(values['2. high']),
    low: parseFloat(values['3. low']),
    close: parseFloat(values['4. close']),
    volume: parseFloat(values['5. volume'])
  })).reverse()
}

export default function Home() {
  const [symbol, setSymbol] = useState('TATAMOTORS.BSE')
  const [timeRange, setTimeRange] = useState<TimeRange>('1M')
  const [showCandlestick, setShowCandlestick] = useState(false)
  
  const { data, error, isLoading } = useSWR(
    symbol ? `https://www.alphavantage.co/query?${new URLSearchParams({
      function: TIME_RANGES[timeRange].function,
      symbol,
      ...(TIME_RANGES[timeRange].interval ? { interval: TIME_RANGES[timeRange].interval } : {}),
      ...(TIME_RANGES[timeRange].outputsize ? { outputsize: TIME_RANGES[timeRange].outputsize } : {}),
      apikey: ALPHA_VANTAGE_API_KEY
    })}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      errorRetryCount: 2
    }
  )

  const handleSearch = (query: string) => {
    if (!query) return
    setSymbol(query.toUpperCase())
  }

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-500' : 'text-red-500'
  }

  const getChangeIcon = (change: number) => {
    return change >= 0 ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const calculateChange = () => {
    if (!data || data.length < 2) return 0
    return ((data[data.length - 1].close - data[0].close) / data[0].close * 100)
  }

  const change = data ? calculateChange() : 0

  const filterDataByTimeRange = (data: any[]) => {
    if (!data) return []
    const now = new Date()
    let cutoffDate = new Date()
    
    switch (timeRange) {
      case '1D':
        cutoffDate.setDate(now.getDate() - 1)
        break
      case '1M':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case '6M':
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case '1Y':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
      case '5Y':
        cutoffDate.setFullYear(now.getFullYear() - 5)
        break
      default:
        return data
    }
    
    return data.filter(item => new Date(item.date) >= cutoffDate)
  }

  const filteredData = data ? filterDataByTimeRange(data) : []

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div className="flex items-center space-x-2">
            <LineChart className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Indian Stock Market Dashboard</h1>
          </div>
          <StockSearch onSearch={handleSearch} />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-full" />
              </Card>
            ))
          ) : filteredData.length > 0 ? (
            <>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Current Price</p>
                <h2 className="mt-2 text-2xl font-bold">₹{filteredData[filteredData.length - 1].close.toFixed(2)}</h2>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Opening Price</p>
                <h2 className="mt-2 text-2xl font-bold">₹{filteredData[0].open.toFixed(2)}</h2>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Change</p>
                <div className="mt-2 flex items-center space-x-2">
                  {getChangeIcon(change)}
                  <span className={cn("text-2xl font-bold", getChangeColor(change))}>
                    {change.toFixed(2)}%
                  </span>
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Volume</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {(filteredData[filteredData.length - 1].volume / 1000000).toFixed(1)}M
                </h2>
              </Card>
            </>
          ) : null}
        </div>

        <Card className="p-4">
          <div className="mb-4 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {showCandlestick ? <CandlestickChart className="h-4 w-4" /> : <LineChart className="h-4 w-4" />}
                <Label htmlFor="chart-type">Candlestick</Label>
                <Switch
                  id="chart-type"
                  checked={showCandlestick}
                  onCheckedChange={setShowCandlestick}
                />
              </div>
            </div>
            <ToggleGroup type="single" value={timeRange} onValueChange={(value: TimeRange) => value && setTimeRange(value)}>
              {Object.keys(TIME_RANGES).map((range) => (
                <ToggleGroupItem key={range} value={range} aria-label={`Show ${range} chart`}>
                  {range}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : error ? (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-center text-muted-foreground">
                Please try searching for a valid stock symbol (e.g., TATAMOTORS.BSE, RELIANCE.BSE)
              </p>
            </div>
          ) : filteredData.length > 0 ? (
            <StockChart data={filteredData} showCandlestick={showCandlestick} />
          ) : null}
        </Card>
      </div>
    </main>
  )
}